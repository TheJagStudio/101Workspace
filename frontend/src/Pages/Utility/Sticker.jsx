import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { X, Printer, Loader } from 'lucide-react';
import './Sticker.css';
import Barcode from '../../Components/Utility/Barcode';
import { apiRequest } from '../../utils/api';

// ── Constants ──
const STICKERS_PER_PAGE = 6;
const A4_WIDTH_PX = 816;
const A4_HEIGHT_PX = 1056;
const SETS_STORAGE_KEY = 'ld_sets';
const STYLE_STORAGE_KEY = 'stickerGenerator_styleSettings';

const STICKER_API = `${import.meta.env.VITE_SERVER_URL}/api/utility/sticker`;

const BADGE_COLORS = { NEW: '#16a34a', SALE: '#dc2626', HOT: '#ea580c', CLEARANCE: '#7c3aed' };

const FIELD_META = {
    brand: { label: 'Brand', sub: 'before first —', field: 'title', color: '#cc2222' },
    name: { label: 'Product name', sub: 'middle section', field: 'description', color: '#000000' },
    flavor: { label: 'Flavor', sub: 'after last —', field: 'flavor', color: '#185FA5' },
    price: { label: 'Price', sub: 'standardPrice', field: 'price', color: '#000000' },
    upc: { label: 'UPC text', sub: 'upc field', field: 'upc', color: '#555555' },
};

const FIELD_KEYS = ['brand', 'name', 'flavor', 'price', 'barcode', 'upc'];
const FIELD_LABELS = {
    brand: 'Brand (red)',
    name: 'Product name',
    flavor: 'Flavor (blue)',
    price: 'Price',
    barcode: 'Barcode',
    upc: 'UPC number',
};

const DEFAULT_STYLE = {
    brand: { size: 24, color: '#cc2222', bold: true, italic: false },
    name: { size: 13, color: '#000000', bold: false, italic: false },
    flavor: { size: 24, color: '#185FA5', bold: true, italic: false },
    price: { size: 40, color: '#000000', bold: true, italic: false },
    upc: { size: 20, color: '#111827', bold: true, italic: false },
    showFields: { brand: true, name: true, flavor: true, price: true, barcode: true, upc: true },
    logoUrl: null,
    logoPos: 'top-right',
    logoSize: 50,
    badge: '',
    customBadgeText: '',
    customBadgeColor: '#7c3aed',
    labelBgColor: '#ffffff',
    bcHeight: 50,
    bcWidthPct: 92,
    padTop: 10,
    padSide: 12,
    rowGap: 3,
    singleLineRedText: false,
};

const debounce = (func, delay) => {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// ── Helpers ──
const parseName = (s) => {
    const parts = String(s || '').split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length <= 1) return { brand: s, name: '', flavor: '' };
    if (parts.length === 2) return { brand: parts[0], name: parts[1], flavor: '' };
    return { brand: parts[0], name: parts.slice(1, -1).join(' - '), flavor: parts[parts.length - 1] };
};

const parseProductNameParts = (productName) => {
    const parts = (productName || 'No Product Name').split(' - ').map((p) => p.trim()).filter(Boolean);
    let title = productName || 'No Product Name';
    let description = '';
    let flavor = '';
    if (parts.length >= 4) {
        title = parts.slice(0, 2).join(' - ');
        description = parts.slice(2, -1).join(' - ');
        flavor = parts.slice(-1)[0];
    } else if (parts.length === 3) {
        title = parts.slice(0, 2).join(' - ');
        flavor = parts[2];
    } else if (parts.length === 2) {
        title = parts.join(' - ');
    }
    return { title, description, flavor };
};

const mapProduct = (r) => {
    const raw = String(r.productName || r.name || '');
    const p = parseName(raw);
    return {
        productName: raw,
        brand: p.brand,
        name: p.name,
        flavor: p.flavor,
        upc: String(r.upc || r.sku || '').trim(),
        standardPrice: r.standardPrice ?? r.tierPrice ?? r.price ?? '',
        priceOverride: null,
        qty: 1,
        masterProductId: r.masterProductId ?? null,
        masterProductName: r.masterProductName ?? null,
        productId: r.id ?? r.productId ?? null,
        imageUrl: r.imageUrl ?? null,
        id: r.id ?? r.productId ?? r.upc,
    };
};

async function fetchProductsByUpc(upc) {
    const data = await apiRequest(`${STICKER_API}/products/?upc=${encodeURIComponent(upc)}`);
    return data.products || [];
}

async function fetchProductsBySearch(query, limit = 20) {
    const data = await apiRequest(`${STICKER_API}/products/?search=${encodeURIComponent(query)}&limit=${limit}`);
    return data.products || [];
}

async function fetchProductsBulk(upcs) {
    return await apiRequest(`${STICKER_API}/products/bulk/`, {
        method: 'POST',
        body: JSON.stringify({ upcs }),
    });
}

// ── PDF helpers (unchanged) ──
const RED_TEXT_MAX_FONT_PX = 24;
const RED_TEXT_MIN_FONT_PX = 6;
const RED_TEXT_SIDE_MARGIN_PX = 8;
const RED_TEXT_INNER_WIDTH_PX = 324;

const estimateRedTextFontSize = (text, maxPx = RED_TEXT_MAX_FONT_PX, minPx = RED_TEXT_MIN_FONT_PX) => {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return maxPx;
    const estimated = RED_TEXT_INNER_WIDTH_PX / (trimmed.length * 0.62);
    return Math.min(maxPx, Math.max(minPx, Math.round(estimated * 10) / 10));
};

const fitRedTextInner = (container, inner, maxPx = RED_TEXT_MAX_FONT_PX, minPx = RED_TEXT_MIN_FONT_PX) => {
    const maxWidth = container.clientWidth - RED_TEXT_SIDE_MARGIN_PX * 2;
    if (maxWidth <= 0) return null;
    inner.style.lineHeight = '1.15';
    const text = inner.textContent?.trim();
    if (!text) {
        inner.style.setProperty('font-size', `${maxPx}px`, 'important');
        return maxPx;
    }
    inner.style.fontSize = `${maxPx}px`;
    if (inner.scrollWidth <= maxWidth) {
        inner.style.setProperty('font-size', `${maxPx}px`, 'important');
        return maxPx;
    }
    let fontSize = Math.max(minPx, Math.floor((maxPx * maxWidth / inner.scrollWidth) * 10) / 10);
    inner.style.fontSize = `${fontSize}px`;
    if (inner.scrollWidth > maxWidth && fontSize > minPx) {
        fontSize = Math.max(minPx, Math.floor((fontSize * maxWidth / inner.scrollWidth) * 10) / 10);
        inner.style.fontSize = `${fontSize}px`;
    }
    inner.style.setProperty('font-size', `${fontSize}px`, 'important');
    inner.style.setProperty('line-height', '1.15', 'important');
    return fontSize;
};

const fitAllSingleLineRedText = (root) => {
    root.querySelectorAll('.stickerRedTextSingleLine').forEach((container) => {
        const inner = container.querySelector('.stickerRedTextInner');
        if (inner) fitRedTextInner(container, inner);
    });
};

const forceLayout = (element) => {
    void element.offsetHeight;
};

const preparePageForCapture = (pageWrapper) => {
    const a4Page = pageWrapper.querySelector('.a4Page');
    const saved = {
        wrapperWidth: pageWrapper.style.width,
        wrapperHeight: pageWrapper.style.height,
        a4Transform: a4Page?.style.transform ?? '',
    };
    pageWrapper.style.width = `${A4_WIDTH_PX}px`;
    pageWrapper.style.height = `${A4_HEIGHT_PX}px`;
    if (a4Page) a4Page.style.transform = 'scale(1)';
    return () => {
        pageWrapper.style.width = saved.wrapperWidth;
        pageWrapper.style.height = saved.wrapperHeight;
        if (a4Page) a4Page.style.transform = saved.a4Transform;
    };
};

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// ── Toggle ──
const Toggle = ({ checked, onChange }) => (
    <label className="relative inline-flex cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only sticker-toggle-cb" />
        <div className="sticker-toggle-track">
            <div className="sticker-toggle-thumb" />
        </div>
    </label>
);

// ── Main component ──
const Sticker = () => {
    const [excelData, setExcelData] = useState([]);
    const [userEdits, setUserEdits] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fileName, setFileName] = useState('No file loaded');
    const [infoMessage, setInfoMessage] = useState('');

    const [activeTab, setActiveTab] = useState('api');
    const [apiStatus, setApiStatus] = useState({ color: 'gray', text: 'Checking...' });
    const [searchMode, setSearchMode] = useState('upc');
    const [singleUpc, setSingleUpc] = useState('');
    const [bulkUpcs, setBulkUpcs] = useState('');
    const [nameQuery, setNameQuery] = useState('');
    const [nameResults, setNameResults] = useState([]);
    const [bulkResult, setBulkResult] = useState('');
    const [progress, setProgress] = useState(null);
    const [missingProducts, setMissingProducts] = useState([]);

    const [styleSettings, setStyleSettings] = useState(DEFAULT_STYLE);
    const [selectedField, setSelectedField] = useState(null);
    const [previewZoom, setPreviewZoom] = useState(0.5);
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

    const [priceModalIdx, setPriceModalIdx] = useState(null);
    const [priceInput, setPriceInput] = useState('');
    const [editModalIdx, setEditModalIdx] = useState(null);
    const [editForm, setEditForm] = useState({ brand: '', name: '', flavor: '', price: '', upc: '' });
    const [saveSetModal, setSaveSetModal] = useState(false);
    const [setNameInput, setSetNameInput] = useState('');
    const [savedSets, setSavedSets] = useState([]);

    const stickerPreviewAreaRef = useRef(null);
    const logoInputRef = useRef(null);
    const fileInputRef = useRef(null);

    // ── Persistence ──
    useEffect(() => {
        try {
            const savedData = localStorage.getItem('stickerGenerator_excelData');
            const savedEdits = localStorage.getItem('stickerGenerator_userEdits');
            const savedStyle = localStorage.getItem(STYLE_STORAGE_KEY);
            if (savedData) {
                setExcelData(JSON.parse(savedData));
                setInfoMessage('Loaded data from previous session.');
            }
            if (savedEdits) setUserEdits(JSON.parse(savedEdits));
            if (savedStyle) setStyleSettings({ ...DEFAULT_STYLE, ...JSON.parse(savedStyle) });
            setSavedSets(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) || '[]'));
        } catch (e) {
            console.error('Failed to load from localStorage', e);
        }
        checkServer();
    }, []);

    const saveToLocalStorage = useCallback((data, edits) => {
        try {
            localStorage.setItem('stickerGenerator_excelData', JSON.stringify(data));
            localStorage.setItem('stickerGenerator_userEdits', JSON.stringify(edits));
        } catch (e) {
            console.error('Failed to save data', e);
        }
    }, []);

    const persistStyle = useCallback((style) => {
        try {
            localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style));
        } catch (e) {
            console.error('Failed to save style', e);
        }
    }, []);

    const updateStyle = useCallback((patch) => {
        setStyleSettings((prev) => {
            const next = { ...prev, ...patch };
            persistStyle(next);
            return next;
        });
    }, [persistStyle]);

    const refreshPreview = useCallback(() => setPreviewRefreshKey((k) => k + 1), []);

    const checkServer = async () => {
        try {
            const data = await apiRequest(`${STICKER_API}/health/`);
            const count = data.active_product_count ?? 0;
            setApiStatus({ color: 'green', text: `Connected · ${count.toLocaleString()} products` });
        } catch (e) {
            const msg = e.message || 'API offline';
            if (msg.toLowerCase().includes('authenticated') || msg.includes('401')) {
                setApiStatus({ color: 'orange', text: 'Login required' });
            } else {
                setApiStatus({ color: 'red', text: 'Database offline' });
            }
        }
    };

    // ── Product management ──
    const addProducts = useCallback((prods) => {
        const existing = new Set(excelData.map((p) => p.upc));
        const newProds = prods.filter((p) => p.upc && !existing.has(p.upc));
        if (!newProds.length) return;
        const newData = [...excelData, ...newProds];
        setExcelData(newData);
        saveToLocalStorage(newData, userEdits);
        setInfoMessage(`Added ${newProds.length} product(s).`);
    }, [excelData, userEdits, saveToLocalStorage]);

    const removeProduct = (indexToRemove) => {
        const newData = excelData.filter((_, i) => i !== indexToRemove);
        const newEdits = Object.entries(userEdits).reduce((acc, [key, value]) => {
            const idx = parseInt(key, 10);
            if (idx < indexToRemove) acc[key] = value;
            else if (idx > indexToRemove) acc[idx - 1] = value;
            return acc;
        }, {});
        setExcelData(newData);
        setUserEdits(newEdits);
        saveToLocalStorage(newData, newEdits);
    };

    const clearAll = () => {
        if (!window.confirm('Clear all labels?')) return;
        setExcelData([]);
        setUserEdits({});
        saveToLocalStorage([], {});
        setInfoMessage('All labels cleared.');
        setFileName('No file loaded');
    };

    const setQty = (idx, qty) => {
        const q = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
        const newData = excelData.map((p, i) => (i === idx ? { ...p, qty: q } : p));
        setExcelData(newData);
        saveToLocalStorage(newData, userEdits);
    };

    const changeQty = (idx, delta) => setQty(idx, (excelData[idx]?.qty || 1) + delta);

    const handleFieldEdit = (index, field, content) => {
        const newEdits = { ...userEdits, [index]: { ...userEdits[index], [field]: content } };
        setUserEdits(newEdits);
        saveToLocalStorage(excelData, newEdits);
    };

    const setPriceOverride = (idx, val) => {
        const newData = excelData.map((p, i) => (i === idx ? { ...p, priceOverride: val } : p));
        setExcelData(newData);
        saveToLocalStorage(newData, userEdits);
    };

    // ── Search ──
    const searchSingleUPC = async () => {
        const upc = singleUpc.trim().replace(/\s/g, '');
        if (!upc) return;
        setLoading(true);
        try {
            const rows = await fetchProductsByUpc(upc);
            const prods = rows.map(mapProduct).filter((p) => p.upc || p.brand);
            if (!prods.length) {
                setInfoMessage(`No product found for: ${upc}`);
            } else {
                addProducts(prods);
                setSingleUpc('');
            }
        } catch (e) {
            setInfoMessage(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const bulkAPISearch = async (upcSource, { replace = false } = {}) => {
        const raw = upcSource ?? bulkUpcs;
        if (!raw.trim()) {
            setInfoMessage('Paste UPC codes first.');
            return;
        }
        const upcs = [...new Set(raw.split(/[\s,;]+/).map((u) => u.trim()).filter(Boolean))];
        if (!upcs.length) return;

        setLoading(true);
        setBulkResult('');
        setProgress({ pct: 10, label: 'Fetching from database...', found: 0 });

        try {
            const data = await fetchProductsBulk(upcs);
            const found = (data.products || []).map(mapProduct).filter((p) => p.upc || p.brand);
            const notFound = data.notFoundUPCs || [];
            setProgress({ pct: 100, label: `Found ${found.length} of ${upcs.length}`, found: found.length });
            setMissingProducts(notFound);

            if (!found.length) {
                setBulkResult('No products found.');
                return;
            }

            if (replace) {
                setExcelData(found);
                setUserEdits({});
                saveToLocalStorage(found, {});
            } else {
                addProducts(found);
            }
            setBulkResult(`✓ ${found.length} found${notFound.length ? ` · ${notFound.length} not found` : ''}`);
        } catch (e) {
            setInfoMessage(`Bulk search failed: ${e.message}`);
            setBulkResult('');
        } finally {
            setProgress(null);
            setLoading(false);
        }
    };

    const runNameSearch = async (query, { showLoading = false } = {}) => {
        const q = query.trim();
        if (!q) {
            setNameResults([]);
            return;
        }
        if (showLoading) setLoading(true);
        try {
            const rows = await fetchProductsBySearch(q, 20);
            setNameResults(rows.map(mapProduct).filter((p) => p.upc || p.brand));
        } catch (e) {
            setNameResults([]);
            if (showLoading) setInfoMessage(`Search error: ${e.message}`);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const searchByName = () => runNameSearch(nameQuery, { showLoading: true });

    const debouncedNameSearch = useCallback(
        debounce((query) => runNameSearch(query), 300),
        []
    );

    useEffect(() => {
        if (searchMode === 'name') {
            debouncedNameSearch(nameQuery);
        }
    }, [nameQuery, searchMode, debouncedNameSearch]);

    // ── File upload ──
    const handleFileSelect = (file) => {
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
                const prods = data
                    .map((r) => {
                        const raw = String(r.name || r.Name || r.productName || '');
                        const p = parseName(raw);
                        return {
                            productName: raw,
                            brand: p.brand,
                            name: p.name,
                            flavor: p.flavor,
                            upc: String(r.upc || r.UPC || '').trim(),
                            standardPrice: r.stdPrice || r.standardPrice || r.price || '',
                            priceOverride: null,
                            qty: 1,
                            id: r.upc || raw,
                        };
                    })
                    .filter((r) => r.brand || r.upc);
                const newData = [...excelData, ...prods.filter((p) => !excelData.some((e) => e.upc === p.upc))];
                setExcelData(newData);
                saveToLocalStorage(newData, userEdits);
                setInfoMessage(`Loaded ${prods.length} products from file.`);
            } catch (err) {
                setInfoMessage(`Could not read file: ${err.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

  const handleLogoUpload = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => updateStyle({ logoUrl: ev.target.result });
        reader.readAsDataURL(file);
    };

    // ── Sets ──
    const confirmSaveSet = () => {
        const name = setNameInput.trim();
        if (!name) return;
        const sets = [...savedSets, {
            name,
            date: new Date().toLocaleDateString(),
            upcs: excelData.map((p) => p.upc),
            count: excelData.length,
        }];
        localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(sets));
        setSavedSets(sets);
        setSaveSetModal(false);
        setSetNameInput('');
        setInfoMessage(`Saved set "${name}" with ${excelData.length} labels.`);
    };

    const loadSet = async (idx) => {
        const set = savedSets[idx];
        if (!set || !window.confirm(`Load "${set.name}" (${set.count} labels)? This replaces current labels.`)) return;
        setBulkUpcs(set.upcs.join('\n'));
        setActiveTab('api');
        await bulkAPISearch(set.upcs.join('\n'), { replace: true });
    };

    const deleteSet = (idx) => {
        const sets = savedSets.filter((_, i) => i !== idx);
        localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(sets));
        setSavedSets(sets);
    };

    // ── Modals ──
    const openPriceModal = (idx) => {
        const prod = excelData[idx];
        const current = prod.priceOverride != null ? prod.priceOverride : prod.standardPrice;
        setPriceInput(parseFloat(current || 0).toFixed(2));
        setPriceModalIdx(idx);
    };

    const openEditModal = (idx) => {
        const prod = excelData[idx];
        const edits = userEdits[idx] || {};
        const { title, description, flavor } = parseProductNameParts(prod.productName);
        setEditForm({
            brand: edits.title || title,
            name: edits.description || description,
            flavor: edits.flavor || flavor,
            price: prod.priceOverride != null ? prod.priceOverride : prod.standardPrice,
            upc: edits.upc || prod.upc || '',
        });
        setEditModalIdx(idx);
    };

    const applyEditModal = () => {
        if (editModalIdx == null) return;
        const idx = editModalIdx;
        handleFieldEdit(idx, 'title', editForm.brand.trim());
        handleFieldEdit(idx, 'description', editForm.name.trim());
        handleFieldEdit(idx, 'flavor', editForm.flavor.trim());
        handleFieldEdit(idx, 'upc', editForm.upc.trim());
        const newPrice = parseFloat(editForm.price);
        setPriceOverride(idx, isNaN(newPrice) ? null : newPrice);
        setEditModalIdx(null);
        refreshPreview();
    };

    // ── PDF (unchanged logic) ──
    const generatePDF = async () => {
        const previewArea = stickerPreviewAreaRef.current;
        if (!previewArea) return;

        const [jspdfModule, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);
        const { jsPDF } = jspdfModule;
        const html2canvas = html2canvasModule.default;

        const originalBackgroundColor = previewArea.style.backgroundColor;
        previewArea.style.backgroundColor = '#f3f4f6';
        setLoading(true);
        setLoadingMessage('Preparing...');
        await document.fonts.ready;
        await waitForNextFrame();
        await waitForNextFrame();

        const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
        const pages = previewArea.querySelectorAll('.pageWrapper');
        const singleLine = styleSettings.singleLineRedText;

        for (let i = 0; i < pages.length; i++) {
            setLoadingMessage(`Processing page ${i + 1} of ${pages.length}...`);
            const page = pages[i];
            const a4Page = page.querySelector('.a4Page');
            if (!a4Page) continue;
            const restorePage = preparePageForCapture(page);
            forceLayout(a4Page);
            if (singleLine) {
                fitAllSingleLineRedText(a4Page);
                forceLayout(a4Page);
                await waitForNextFrame();
            }
            const canvas = await html2canvas(a4Page, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (_clonedDoc, clonedA4Page) => {
                    clonedA4Page.style.transform = 'none';
                    clonedA4Page.style.boxShadow = 'none';
                    if (singleLine) {
                        forceLayout(clonedA4Page);
                        fitAllSingleLineRedText(clonedA4Page);
                        forceLayout(clonedA4Page);
                    }
                },
            });
            restorePage();
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
        }

        doc.save('labels_OL500WX_' + new Date().toISOString().slice(0, 10) + '.pdf');
        previewArea.style.backgroundColor = originalBackgroundColor;
        setLoading(false);
        setLoadingMessage('');
        setInfoMessage('PDF generated successfully.');
    };

    // ── Derived ──
    const expandedItems = useMemo(() => {
        return excelData.flatMap((item, originalIndex) =>
            Array.from({ length: item.qty || 1 }, () => ({ item, originalIndex }))
        );
    }, [excelData]);

    const pages = useMemo(() => {
        const numPages = Math.ceil(expandedItems.length / STICKERS_PER_PAGE) || 0;
        return Array.from({ length: numPages }, (_, i) =>
            expandedItems.slice(i * STICKERS_PER_PAGE, (i + 1) * STICKERS_PER_PAGE)
        );
    }, [expandedItems]);

    const totalLabels = expandedItems.length;
    const statusDotColor = {
        green: '#22c55e',
        orange: '#f59e0b',
        red: '#ef4444',
        gray: '#9ca3af',
    }[apiStatus.color] || '#9ca3af';

    const badgeText = styleSettings.badge === '__custom__'
        ? styleSettings.customBadgeText
        : styleSettings.badge;
    const badgeColor = styleSettings.badge === '__custom__'
        ? styleSettings.customBadgeColor
        : BADGE_COLORS[styleSettings.badge] || '#3b82f6';

    return (
        <div className="sticker-app">
            {/* Price modal */}
            {priceModalIdx != null && (
                <div className="sticker-modal-bg" onClick={() => setPriceModalIdx(null)}>
                    <div className="sticker-modal w-80" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold text-gray-800 mb-1">
                            {excelData[priceModalIdx]?.brand || excelData[priceModalIdx]?.productName}
                        </div>
                        <div className="text-xs text-gray-400 mb-4">Override price for this label only (ERP price unchanged)</div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl font-bold text-gray-400">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                className="flex-1 border-2 border-blue-400 rounded-xl px-3 py-2 text-2xl font-bold text-center focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const val = parseFloat(priceInput);
                                    if (!isNaN(val) && val >= 0) setPriceOverride(priceModalIdx, val);
                                    setPriceModalIdx(null);
                                }}
                                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold"
                            >
                                Apply
                            </button>
                            <button
                                onClick={() => {
                                    setPriceOverride(priceModalIdx, null);
                                    setPriceModalIdx(null);
                                }}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold"
                            >
                                Reset to ERP
                            </button>
                            <button onClick={() => setPriceModalIdx(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-500">✕</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {editModalIdx != null && (
                <div className="sticker-modal-bg" onClick={() => setEditModalIdx(null)}>
                    <div className="sticker-modal w-96" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-bold text-gray-800">✏️ Edit Label Text</div>
                            <button onClick={() => setEditModalIdx(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>
                        <div className="space-y-3">
                            {[
                                { key: 'brand', label: 'Brand (red)', className: 'text-red-600 font-bold' },
                                { key: 'name', label: 'Product Name', className: 'text-gray-800' },
                                { key: 'flavor', label: 'Flavor (blue)', className: 'text-blue-600' },
                            ].map(({ key, label, className }) => (
                                <div key={key}>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
                                    <input
                                        type="text"
                                        value={editForm[key]}
                                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                                        className={`mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 ${className}`}
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price</label>
                                <div className="flex items-center mt-1">
                                    <span className="text-gray-400 font-bold mr-1 text-lg">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editForm.price}
                                        onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">UPC</label>
                                <input
                                    type="text"
                                    value={editForm.upc}
                                    onChange={(e) => setEditForm((f) => ({ ...f, upc: e.target.value }))}
                                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={applyEditModal} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold">Apply Changes</button>
                            <button onClick={() => openEditModal(editModalIdx)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save set modal */}
            {saveSetModal && (
                <div className="sticker-modal-bg" onClick={() => setSaveSetModal(false)}>
                    <div className="sticker-modal w-80" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold text-gray-800 mb-4">💾 Save Label Set</div>
                        <input
                            type="text"
                            value={setNameInput}
                            onChange={(e) => setSetNameInput(e.target.value)}
                            placeholder="e.g. Aisle 5 or New Arrivals"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-4"
                        />
                        <div className="flex gap-2">
                            <button onClick={confirmSaveSet} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold">Save</button>
                            <button onClick={() => setSaveSetModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className="sticker-sidebar">
                <div className="sticker-sidebar-header">
                    <div className="sticker-sidebar-logo">101</div>
                    <div>
                        <div className="sticker-sidebar-title">Label Designer Pro</div>
                        <div className="sticker-sidebar-subtitle">OL500WX · 4×3&quot; · Letter · 6/sheet</div>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5" title="Connection status">
                        <span className="sticker-status-dot" style={{ backgroundColor: statusDotColor }} />
                        <span className="text-blue-100 text-xs">{apiStatus.text}</span>
                    </div>
                </div>

                <div className="sticker-tabs">
                    {[
                        { id: 'api', label: '🔍 Search' },
                        { id: 'labels', label: '🏷 Labels' },
                        { id: 'sets', label: '📦 Sets' },
                        { id: 'style', label: '🎨 Style' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            className={`sticker-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search tab */}
                {activeTab === 'api' && (
                    <div className="sticker-pane space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                            Product data is loaded from the <strong>101 Workspace database</strong> (synced product catalog). Search by UPC or product name.
                        </div>

                        <div>
                            <div className="sticker-section-label">Search Products</div>
                            <div className="flex gap-1.5 mb-2">
                                <button
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all sticker-mode-btn ${searchMode === 'upc' ? 'active' : 'border-gray-300 text-gray-500'}`}
                                    onClick={() => setSearchMode('upc')}
                                >
                                    By UPC
                                </button>
                                <button
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all sticker-mode-btn ${searchMode === 'name' ? 'active' : 'border-gray-300 text-gray-500'}`}
                                    onClick={() => setSearchMode('name')}
                                >
                                    By Name
                                </button>
                            </div>

                            {searchMode === 'upc' ? (
                                <>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            value={singleUpc}
                                            onChange={(e) => setSingleUpc(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && searchSingleUPC()}
                                            placeholder="Enter UPC..."
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-400"
                                        />
                                        <button onClick={searchSingleUPC} disabled={loading} className="px-3 py-2 bg-gray-800 hover:bg-blue-500 text-white rounded-lg text-xs font-bold">
                                            Go
                                        </button>
                                    </div>
                                    <textarea
                                        value={bulkUpcs}
                                        onChange={(e) => setBulkUpcs(e.target.value)}
                                        rows={5}
                                        placeholder="Paste multiple UPCs (one per line)..."
                                        className="w-full border border-gray-300 rounded-lg p-2 text-xs font-mono resize-y focus:outline-none focus:border-blue-400 leading-relaxed"
                                    />
                                    <button
                                        onClick={bulkAPISearch}
                                        disabled={loading}
                                        className="mt-2 w-full py-2 bg-gray-800 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader className="animate-spin h-4 w-4" /> : '🔍'} Search All &amp; Generate Labels
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="flex gap-2">
                                        <input
                                            value={nameQuery}
                                            onChange={(e) => setNameQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && searchByName()}
                                            placeholder="e.g. Red Bull, Qweys..."
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                                        />
                                        <button
                                            onClick={() => searchByName()}
                                            disabled={loading}
                                            className="px-3 py-2 bg-gray-800 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                                        >
                                            Go
                                        </button>
                                    </div>
                                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                        {nameResults.map((prod) => (
                                            <div key={prod.upc || prod.id} className="sticker-product-row">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-gray-800 truncate">{prod.brand || prod.productName}</div>
                                                    <div className="text-xs text-gray-400 truncate">{prod.flavor || prod.name}</div>
                                                </div>
                                                <div className="text-xs font-bold text-green-600">${parseFloat(prod.standardPrice || 0).toFixed(2)}</div>
                                                <button
                                                    onClick={() => addProducts([prod])}
                                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded-md font-bold"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        ))}
                                        {nameQuery && !nameResults.length && !loading && (
                                            <div className="text-xs text-gray-400 py-2">No results</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {bulkResult && <div className="mt-1.5 text-xs text-green-600 font-semibold">{bulkResult}</div>}
                            {infoMessage && <div className="text-xs text-gray-500 mt-1">{infoMessage}</div>}
                        </div>

                        {progress && (
                            <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{progress.label}</span>
                                    <span>{progress.pct}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-100">
                            <div className="sticker-section-label">Or Upload Excel / CSV</div>
                            <div
                                className="sticker-dropzone"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('drag-over');
                                    handleFileSelect(e.dataTransfer.files[0]);
                                }}
                            >
                                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileSelect(e.target.files[0])} />
                                <div className="text-xl text-gray-300 mb-1">📂</div>
                                <div className="text-xs text-gray-400">
                                    <span className="font-semibold text-gray-600">Click or drag</span> file<br />
                                    <span className="text-gray-300">{fileName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Labels tab */}
                {activeTab === 'labels' && (
                    <div className="sticker-pane-labels flex-1 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div className="sticker-section-label mb-0">Label Queue</div>
                            <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-600 font-semibold">Clear all</button>
                        </div>
                        {excelData.length === 0 ? (
                            <div className="text-xs text-gray-300 text-center py-8">No labels yet — search products first</div>
                        ) : (
                            excelData.map((prod, idx) => {
                                const { title, flavor } = parseProductNameParts(prod.productName);
                                const displayPrice = prod.priceOverride != null ? prod.priceOverride : prod.standardPrice;
                                const hasOverride = prod.priceOverride != null;
                                return (
                                    <div key={prod.upc || idx} className="sticker-product-row">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-red-600 truncate">{userEdits[idx]?.title || title}</div>
                                            <div className="text-xs text-gray-500 truncate">{userEdits[idx]?.flavor || flavor}</div>
                                            <button
                                                onClick={() => openPriceModal(idx)}
                                                className={`text-xs font-bold mt-0.5 hover:text-blue-500 ${hasOverride ? 'text-amber-600' : 'text-gray-700'}`}
                                            >
                                                ${parseFloat(displayPrice || 0).toFixed(2)}{hasOverride ? ' ✏️' : ''}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button className="sticker-qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                                            <input
                                                type="number"
                                                min={1}
                                                max={99}
                                                value={prod.qty || 1}
                                                onChange={(e) => setQty(idx, e.target.value)}
                                                className="text-xs font-bold w-10 text-center border border-gray-200 rounded-md py-0.5"
                                            />
                                            <button className="sticker-qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                                            <button onClick={() => removeProduct(idx)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Sets tab */}
                {activeTab === 'sets' && (
                    <div className="sticker-pane space-y-3">
                        <div className="sticker-section-label">Saved Label Sets</div>
                        <p className="text-xs text-gray-500 leading-relaxed">Save your current labels as a named set to reprint later.</p>
                        <button
                            onClick={() => { if (excelData.length) setSaveSetModal(true); else setInfoMessage('Add labels first.'); }}
                            className="w-full py-2 bg-gray-800 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                        >
                            💾 Save Current Labels as Set
                        </button>
                        {savedSets.length === 0 ? (
                            <div className="text-xs text-gray-300 text-center py-8">No saved sets yet</div>
                        ) : (
                            savedSets.map((set, i) => (
                                <div key={i} className="sticker-set-item">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-gray-800">{set.name}</div>
                                        <div className="text-xs text-gray-400">{set.count} labels · {set.date}</div>
                                    </div>
                                    <button onClick={() => loadSet(i)} className="text-xs bg-blue-500 text-white px-2.5 py-1 rounded-lg font-bold">Load</button>
                                    <button onClick={() => deleteSet(i)} className="text-xs text-red-300 hover:text-red-500 font-bold">✕</button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Style tab */}
                {activeTab === 'style' && (
                    <div className="sticker-pane space-y-4">
                        {/* Logo */}
                        <div>
                            <div className="sticker-section-label">Store Logo</div>
                            <div className="flex gap-2 items-center">
                                <div className="w-14 h-10 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden text-gray-300 text-xs">
                                    {styleSettings.logoUrl ? <img src={styleSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : 'None'}
                                </div>
                                <div className="flex-1">
                                    <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e.target.files[0])} />
                                    <button onClick={() => logoInputRef.current?.click()} className="w-full py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                        Upload Logo
                                    </button>
                                    <button onClick={() => updateStyle({ logoUrl: null })} className="mt-1 w-full py-1.5 border border-red-200 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-50">
                                        Remove
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Position</span>
                                <select
                                    value={styleSettings.logoPos}
                                    onChange={(e) => updateStyle({ logoPos: e.target.value })}
                                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                                >
                                    <option value="top-right">Top right</option>
                                    <option value="top-left">Top left</option>
                                    <option value="top-center">Top center</option>
                                </select>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Size</span>
                                <input type="range" min={20} max={100} step={5} value={styleSettings.logoSize} onChange={(e) => updateStyle({ logoSize: +e.target.value })} className="flex-1" />
                                <span className="text-xs font-bold w-6 text-right">{styleSettings.logoSize}</span>
                            </div>
                        </div>

                        {/* Badge */}
                        <div>
                            <div className="sticker-section-label">Badge Overlay</div>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {['', 'NEW', 'SALE', 'HOT', 'CLEARANCE'].map((b) => (
                                    <button
                                        key={b || 'none'}
                                        className={`sticker-badge-btn ${styleSettings.badge === b ? 'active' : ''}`}
                                        onClick={() => updateStyle({ badge: b, customBadgeText: b ? '' : styleSettings.customBadgeText })}
                                    >
                                        {b === '' ? 'None' : b === 'NEW' ? '🆕 NEW' : b === 'SALE' ? '🔥 SALE' : b === 'HOT' ? '⚡ HOT' : '💰 CLEARANCE'}
                                    </button>
                                ))}
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                                <div className="text-xs font-bold text-gray-500 uppercase">Custom Badge</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-10">Text</span>
                                    <input
                                        type="text"
                                        maxLength={12}
                                        value={styleSettings.customBadgeText}
                                        onChange={(e) => {
                                            const text = e.target.value;
                                            updateStyle({
                                                customBadgeText: text,
                                                badge: text ? '__custom__' : '',
                                            });
                                        }}
                                        placeholder="e.g. 2 FOR $5"
                                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-10">Color</span>
                                    <input type="color" value={styleSettings.customBadgeColor} onChange={(e) => updateStyle({ customBadgeColor: e.target.value, badge: styleSettings.customBadgeText ? '__custom__' : styleSettings.badge })} />
                                    <span className="text-xs text-gray-400">{styleSettings.customBadgeColor}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-10">BG</span>
                                    <input type="color" value={styleSettings.labelBgColor} onChange={(e) => updateStyle({ labelBgColor: e.target.value })} />
                                    <span className="text-xs text-gray-400">Label background</span>
                                </div>
                            </div>
                        </div>

                        {/* Field editor */}
                        <div>
                            <div className="sticker-section-label">Text Fields</div>
                            <div className="space-y-2">
                                {Object.entries(FIELD_META).map(([key, meta]) => (
                                    <div
                                        key={key}
                                        className={`sticker-field-btn ${selectedField === key ? 'sticker-fbtn-active' : ''}`}
                                        onClick={() => setSelectedField(key)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-3.5 h-3.5 rounded-full border" style={{ background: styleSettings[key]?.color || meta.color }} />
                                            <div>
                                                <div className="text-xs font-semibold text-gray-800">{meta.label}</div>
                                                <div className="text-xs text-gray-400">{meta.sub}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{styleSettings[key]?.size}px</div>
                                    </div>
                                ))}
                            </div>
                            {selectedField && styleSettings[selectedField] && (
                                <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-3">Editing: {FIELD_META[selectedField]?.label}</div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-12">Size</span>
                                            <input
                                                type="range"
                                                min={6}
                                                max={44}
                                                value={styleSettings[selectedField].size}
                                                onChange={(e) => updateStyle({
                                                    [selectedField]: { ...styleSettings[selectedField], size: +e.target.value },
                                                })}
                                                className="flex-1"
                                            />
                                            <span className="text-xs font-bold w-6 text-right">{styleSettings[selectedField].size}</span>
                                            <span className="text-xs text-gray-400">px</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-12">Color</span>
                                            <input
                                                type="color"
                                                value={styleSettings[selectedField].color}
                                                onChange={(e) => updateStyle({
                                                    [selectedField]: { ...styleSettings[selectedField], color: e.target.value },
                                                })}
                                            />
                                            <span className="text-xs text-gray-500 font-mono">{styleSettings[selectedField].color}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-12">Style</span>
                                            <button
                                                className={`px-3 py-1 border rounded-lg text-xs font-extrabold ${styleSettings[selectedField].bold ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 text-gray-600'}`}
                                                onClick={() => updateStyle({
                                                    [selectedField]: { ...styleSettings[selectedField], bold: !styleSettings[selectedField].bold },
                                                })}
                                            >
                                                B
                                            </button>
                                            <button
                                                className={`px-3 py-1 border rounded-lg text-xs italic ${styleSettings[selectedField].italic ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 text-gray-600'}`}
                                                onClick={() => updateStyle({
                                                    [selectedField]: { ...styleSettings[selectedField], italic: !styleSettings[selectedField].italic },
                                                })}
                                            >
                                                I
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Barcode */}
                        <div>
                            <div className="sticker-section-label">Barcode</div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-12">Height</span>
                                    <input type="range" min={20} max={100} step={2} value={styleSettings.bcHeight} onChange={(e) => updateStyle({ bcHeight: +e.target.value })} className="flex-1" />
                                    <span className="text-xs font-bold w-8 text-right">{styleSettings.bcHeight}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-12">Width %</span>
                                    <input type="range" min={50} max={100} step={2} value={styleSettings.bcWidthPct} onChange={(e) => updateStyle({ bcWidthPct: +e.target.value })} className="flex-1" />
                                    <span className="text-xs font-bold w-8 text-right">{styleSettings.bcWidthPct}</span>
                                </div>
                            </div>
                        </div>

                        {/* Spacing */}
                        <div>
                            <div className="sticker-section-label">Spacing</div>
                            <div className="space-y-2">
                                {[
                                    { key: 'padTop', label: 'Top pad' },
                                    { key: 'padSide', label: 'Side pad' },
                                    { key: 'rowGap', label: 'Row gap', max: 14 },
                                ].map(({ key, label, max = 30 }) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-12">{label}</span>
                                        <input type="range" min={key === 'rowGap' ? 0 : 2} max={max} value={styleSettings[key]} onChange={(e) => updateStyle({ [key]: +e.target.value })} className="flex-1" />
                                        <span className="text-xs font-bold w-8 text-right">{styleSettings[key]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Show/hide + single line */}
                        <div>
                            <div className="sticker-section-label">Show / Hide</div>
                            <div className="space-y-2">
                                {FIELD_KEYS.map((k) => (
                                    <div key={k} className="flex items-center justify-between">
                                        <span className="text-gray-700 text-xs">{FIELD_LABELS[k]}</span>
                                        <Toggle
                                            checked={styleSettings.showFields[k]}
                                            onChange={(v) => updateStyle({ showFields: { ...styleSettings.showFields, [k]: v } })}
                                        />
                                    </div>
                                ))}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                    <span className="text-gray-700 text-xs">Single-line red text</span>
                                    <Toggle
                                        checked={styleSettings.singleLineRedText}
                                        onChange={(v) => {
                                            updateStyle({ singleLineRedText: v });
                                            refreshPreview();
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom bar */}
                <div className="sticker-bottom-bar">
                    <div className="text-xs text-gray-400 flex justify-between items-center mb-2">
                        <span>{excelData.length} products</span>
                        <span className="text-blue-500 font-semibold">
                            {totalLabels} labels · {Math.ceil(totalLabels / STICKERS_PER_PAGE) || 0} pages
                        </span>
                    </div>
                    <button
                        onClick={generatePDF}
                        disabled={excelData.length === 0 || loading}
                        className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin h-4 w-4" /> : <Printer className="h-4 w-4" />}
                        Export PDF (OL500WX)
                    </button>
                </div>
            </div>

            {/* Right panel */}
            <div className="sticker-right-panel">
                <div className="sticker-preview-header">
                    <div className="text-sm font-semibold text-gray-700">
                        Preview{totalLabels > 0 ? ` — ${totalLabels} labels on ${pages.length} pages` : ''}
                    </div>
                    <div className="sticker-zoom-controls">
                        <span className="text-xs text-gray-400">Zoom</span>
                        <button className="sticker-zoom-btn" onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.1))}>−</button>
                        <input
                            type="range"
                            className="sticker-zoom-slider"
                            min={20}
                            max={130}
                            step={5}
                            value={Math.round(previewZoom * 100)}
                            onChange={(e) => setPreviewZoom(+e.target.value / 100)}
                        />
                        <button className="sticker-zoom-btn" onClick={() => setPreviewZoom((z) => Math.min(1.3, z + 0.1))}>+</button>
                        <span className="text-xs font-bold text-gray-600 w-9 text-center">{Math.round(previewZoom * 100)}%</span>
                        <button className="text-xs text-blue-500 hover:underline" onClick={() => setPreviewZoom(0.5)}>Reset</button>
                    </div>
                </div>

                {(loading || loadingMessage) && (
                    <div className="text-center py-4 flex items-center justify-center gap-2">
                        <Loader className="animate-spin h-5 w-5 text-blue-600" />
                        <span className="text-gray-600 text-sm">{loadingMessage || 'Processing...'}</span>
                    </div>
                )}

                <div ref={stickerPreviewAreaRef} className="previewArea">
                    <div key={previewRefreshKey}>
                        {pages.length === 0 ? (
                            <div className="sticker-empty-preview">
                                <div className="sticker-empty-preview-icon">🏷️</div>
                                <div className="font-semibold text-gray-400 mb-2">No labels yet</div>
                                <div className="text-xs text-gray-300">Search products → generate labels</div>
                            </div>
                        ) : (
                            pages.map((pageData, pageIndex) => (
                                <div key={pageIndex}>
                                    <div className="sticker-page-label">Page {pageIndex + 1} of {pages.length}</div>
                                    <StickerPage previewAreaRef={stickerPreviewAreaRef} userZoom={previewZoom}>
                                        {pageData.map(({ item, originalIndex }, itemIndex) => (
                                            <StickerItem
                                                key={`${originalIndex}-${itemIndex}`}
                                                item={item}
                                                index={originalIndex}
                                                edits={userEdits[originalIndex] || {}}
                                                onEdit={handleFieldEdit}
                                                onRemove={removeProduct}
                                                onEditClick={openEditModal}
                                                styleSettings={styleSettings}
                                                badgeText={badgeText}
                                                badgeColor={badgeColor}
                                            />
                                        ))}
                                    </StickerPage>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {missingProducts.length > 0 && (
                    <div className="px-4 pb-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                            <strong>{missingProducts.length} UPCs not found:</strong> {missingProducts.slice(0, 10).join(', ')}{missingProducts.length > 10 ? '...' : ''}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── StickerPage ──
const StickerPage = ({ children, previewAreaRef, userZoom = 1 }) => {
    const [fitScale, setFitScale] = useState(1);
    const pageWrapperRef = useRef(null);

    const updateScale = useCallback(() => {
        if (previewAreaRef.current) {
            const newScale = (previewAreaRef.current.clientWidth - 60) / A4_WIDTH_PX;
            setFitScale(newScale < 1 ? newScale : 1);
        }
    }, [previewAreaRef]);

    useEffect(() => {
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [updateScale]);

    const scale = fitScale * userZoom;
    const filledChildren = React.Children.toArray(children);
    while (filledChildren.length < STICKERS_PER_PAGE) {
        filledChildren.push(<div key={`placeholder-${filledChildren.length}`} className="sticker" />);
    }

    return (
        <div
            ref={pageWrapperRef}
            className="pageWrapper"
            style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${A4_HEIGHT_PX * scale}px` }}
        >
            <div className="a4Page" style={{ transform: `scale(${scale})` }}>
                <div className="stickerGrid">{filledChildren}</div>
            </div>
        </div>
    );
};

// ── StickerRedText ──
const StickerRedText = ({ className, content, field, index, onEdit, onPaste, singleLine, textStyle }) => {
    const containerRef = useRef(null);
    const innerRef = useRef(null);

    const estimatedFontSize = useMemo(
        () => (singleLine ? estimateRedTextFontSize(content, textStyle?.size || RED_TEXT_MAX_FONT_PX) : textStyle?.size || RED_TEXT_MAX_FONT_PX),
        [singleLine, content, textStyle?.size]
    );

    const refineFit = useCallback(() => {
        if (!singleLine || !containerRef.current || !innerRef.current) return;
        fitRedTextInner(containerRef.current, innerRef.current, textStyle?.size || RED_TEXT_MAX_FONT_PX);
    }, [singleLine, textStyle?.size]);

    const style = {
        color: textStyle?.color,
        fontWeight: textStyle?.bold ? 'bold' : 'normal',
        fontStyle: textStyle?.italic ? 'italic' : 'normal',
        fontSize: singleLine ? undefined : `${textStyle?.size || 24}px`,
    };

    const handleInput = (e) => {
        if (!singleLine) return;
        const size = estimateRedTextFontSize(e.currentTarget.textContent, textStyle?.size || RED_TEXT_MAX_FONT_PX);
        e.currentTarget.style.fontSize = `${size}px`;
    };

    if (!singleLine) {
        return (
            <div
                className={className}
                style={style}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEdit(index, field, e.currentTarget.textContent)}
                onPaste={onPaste}
            >
                {content}
            </div>
        );
    }

    return (
        <div ref={containerRef} className={className + ' stickerRedTextSingleLine'} style={style}>
            <span
                ref={innerRef}
                className="stickerRedTextInner"
                style={{ fontSize: `${estimatedFontSize}px`, lineHeight: 1.15 }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => { onEdit(index, field, e.currentTarget.textContent); refineFit(); }}
                onPaste={(e) => { onPaste(e); requestAnimationFrame(() => refineFit()); }}
                onInput={handleInput}
            >
                {content}
            </span>
        </div>
    );
};

// ── StickerItem ──
const StickerItem = ({ item, index, edits, onEdit, onRemove, onEditClick, styleSettings, badgeText, badgeColor }) => {
    const { title, description, flavor } = useMemo(() => parseProductNameParts(item.productName), [item.productName]);

    const displayPrice = item.priceOverride != null ? item.priceOverride : item.standardPrice;
    const upcValue = edits.upc || item.upc || 'N/A';
    const singleLine = styleSettings.singleLineRedText;

    const handlePaste = (e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    };

    const logoStyle = () => {
        if (!styleSettings.logoUrl) return null;
        const sz = styleSettings.logoSize;
        const lw = Math.round(sz * 1.5);
        const lh = Math.round(sz);
        const pos = styleSettings.logoPos;
        let left = 'auto';
        let right = '6px';
        let transform = 'none';
        if (pos === 'top-left') { left = '6px'; right = 'auto'; }
        if (pos === 'top-center') { left = '50%'; right = 'auto'; transform = 'translateX(-50%)'; }
        return { width: lw, height: lh, top: '4px', left, right, transform };
    };

    const textStyle = (key) => ({
        fontSize: `${styleSettings[key]?.size}px`,
        color: styleSettings[key]?.color,
        fontWeight: styleSettings[key]?.bold ? 'bold' : 'normal',
        fontStyle: styleSettings[key]?.italic ? 'italic' : 'normal',
        marginBottom: `${styleSettings.rowGap}px`,
    });

    const stickerPadding = {
        paddingTop: `${styleSettings.padTop}px`,
        paddingLeft: `${styleSettings.padSide}px`,
        paddingRight: `${styleSettings.padSide}px`,
        backgroundColor: styleSettings.labelBgColor,
    };

    const barcodeWidth = `${styleSettings.bcWidthPct}%`;

    return (
        <div className="sticker" style={stickerPadding}>
            <div className="sticker-edit-overlay" onClick={() => onEditClick(index)} title="Click to edit" />
            <button onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="removeBtn">
                <X size={14} />
            </button>

            {styleSettings.logoUrl && (
                <img src={styleSettings.logoUrl} alt="" className="sticker-logo" style={logoStyle()} />
            )}

            {badgeText && (
                <div className="sticker-badge-overlay" style={{ backgroundColor: badgeColor }}>{badgeText}</div>
            )}

            {styleSettings.showFields.brand && (
                <StickerRedText
                    className="stickerTitle"
                    content={(edits.title || title).toUpperCase()}
                    field="title"
                    index={index}
                    onEdit={onEdit}
                    onPaste={handlePaste}
                    singleLine={singleLine}
                    textStyle={styleSettings.brand}
                />
            )}

            {styleSettings.showFields.name && (
                <div
                    className="stickerDescription"
                    style={textStyle('name')}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onEdit(index, 'description', e.currentTarget.textContent)}
                    onPaste={handlePaste}
                >
                    {edits.description || description}
                </div>
            )}

            {styleSettings.showFields.flavor && (
                <StickerRedText
                    className="stickerFlavor"
                    content={edits.flavor || flavor}
                    field="flavor"
                    index={index}
                    onEdit={onEdit}
                    onPaste={handlePaste}
                    singleLine={singleLine}
                    textStyle={styleSettings.flavor}
                />
            )}

            {styleSettings.showFields.price && (
                <div className="stickerPrice" style={textStyle('price')}>
                    ${Number(displayPrice || 0).toFixed(2)}
                </div>
            )}

            {styleSettings.showFields.barcode && (
                <div className="barcode-wrap" style={{ width: barcodeWidth, height: styleSettings.bcHeight }}>
                    <Barcode value={upcValue.replace(/[^\w\d]/g, '') || '0'} />
                </div>
            )}

            {styleSettings.showFields.upc && (
                <div className="stickerUpc" style={textStyle('upc')}>
                    {upcValue}
                </div>
            )}
        </div>
    );
};

export default Sticker;
