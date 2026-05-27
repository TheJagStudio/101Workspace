import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from "xlsx";
import { Search, X, Upload, Printer, Loader, Trash2 } from 'lucide-react';
import './Sticker.css';
import Barcode from '../../Components/Utility/Barcode'; // Import the new Barcode component

// A small utility for debouncing
const debounce = (func, delay) => {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

const Sticker = () => {
    // --- STATE MANAGEMENT ---
    const [excelData, setExcelData] = useState([]);
    const [userEdits, setUserEdits] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fileName, setFileName] = useState('Choose File');
    const [infoMessage, setInfoMessage] = useState('');

    // Search State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [bulkUpcInput, setBulkUpcInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [missingProducts, setMissingProducts] = useState([]);
    const [singleLineRedText, setSingleLineRedText] = useState(false);
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

    // --- REFS ---
    const stickerPreviewAreaRef = useRef(null);
    const searchInputRef = useRef(null);

    // --- CONSTANTS ---
    const A4_WIDTH_PX = 816;
    const A4_HEIGHT_PX = 1056;
    const STICKERS_PER_PAGE = 6;
    const DEFAULT_PRODUCT_IMAGE = "https://www.shutterstock.com/image-vector/default-ui-image-placeholder-wireframes-600nw-1037719192.jpg";

    // --- DATA PERSISTENCE ---
    useEffect(() => {
        try {
            const savedData = localStorage.getItem('stickerGenerator_excelData');
            const savedEdits = localStorage.getItem('stickerGenerator_userEdits');
            const savedSingleLineRedText = localStorage.getItem('stickerGenerator_singleLineRedText');
            if (savedData) {
                setExcelData(JSON.parse(savedData));
                setInfoMessage('Loaded data from previous session.');
            }
            if (savedEdits) setUserEdits(JSON.parse(savedEdits));
            if (savedSingleLineRedText === 'true') setSingleLineRedText(true);
        } catch (error) {
            console.error('Failed to load data from localStorage', error);
        }
    }, []);

    const refreshPreview = useCallback(() => {
        setPreviewRefreshKey((key) => key + 1);
    }, []);

    const handleSingleLineRedTextChange = (enabled) => {
        setSingleLineRedText(enabled);
        localStorage.setItem('stickerGenerator_singleLineRedText', String(enabled));
        refreshPreview();
    };

    const saveToLocalStorage = (data, edits) => {
        try {
            localStorage.setItem('stickerGenerator_excelData', JSON.stringify(data));
            localStorage.setItem('stickerGenerator_userEdits', JSON.stringify(edits));
        } catch (error) {
            console.error('Failed to save data to localStorage', error);
        }
    };

    // --- API & DATA HANDLING ---
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                setExcelData(jsonData);
                setUserEdits({});
                saveToLocalStorage(jsonData, {});
                setInfoMessage(`Successfully loaded ${jsonData.length} products.`);
            } catch (error) {
                console.error("Error reading Excel file:", error);
                setInfoMessage('Error: Invalid or corrupted file.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const addProduct = useCallback((product) => {
        setExcelData(prev => {
            const newData = [...prev, product];
            saveToLocalStorage(newData, userEdits);
            return newData;
        });
        setInfoMessage(`Added "${product.productName || 'product'}" to the sheet.`);
    }, [userEdits]);

    const removeProduct = (indexToRemove) => {
        const productName = excelData[indexToRemove]?.productName || 'product';

        // Filter out the product for immutable update
        const newData = excelData.filter((_, index) => index !== indexToRemove);

        // Adjust user edits to account for the removed index
        const newEdits = Object.entries(userEdits).reduce((acc, [key, value]) => {
            const idx = parseInt(key, 10);
            if (idx < indexToRemove) {
                acc[key] = value;
            } else if (idx > indexToRemove) {
                acc[idx - 1] = value;
            }
            return acc;
        }, {});

        setExcelData(newData);
        setUserEdits(newEdits);
        saveToLocalStorage(newData, newEdits);
        setInfoMessage(`Removed "${productName}" from the sheet.`);
    };

    const clearAll = () => {
        if (window.confirm('Are you sure you want to clear all products?')) {
            setExcelData([]);
            setUserEdits({});
            saveToLocalStorage([], {});
            setInfoMessage('All products have been cleared.');
            setFileName('Choose File');
        }
    };

    const handleFieldEdit = (index, field, content) => {
        const newEdits = {
            ...userEdits,
            [index]: { ...userEdits[index], [field]: content },
        };
        setUserEdits(newEdits);
        saveToLocalStorage(excelData, newEdits);
    };

    // --- SEARCH ---
    const performSearch = useCallback(debounce(async (query) => {
        if (!query.trim()) {
            setShowSearchResults(false);
            return;
        }
        setLoading(true);
        setLoadingMessage('Searching...');
        try {
            const response = await fetch(`https://purityai-typesense.hf.space/collections/101/documents/search?q=${encodeURIComponent(query)}&query_by=productName,upc,sku&sort_by=_text_match:desc&per_page=15`, {
                headers: { 'X-TYPESENSE-API-KEY': 'Hu52dwsas2AdxdE' }
            });
            const data = await response.json();
            setSearchResults(data.hits.map(hit => hit.document));
            setShowSearchResults(true);
        } catch (error) {
            console.error('Error searching products:', error);
            setInfoMessage('Search failed. Please try again.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, 300), []);

    useEffect(() => {
        performSearch(searchQuery);
    }, [searchQuery, performSearch]);

    const handleBulkSearch = async () => {
        const upcCodes = [...new Set(bulkUpcInput.split(/[\s,]+/).filter(Boolean))];
        if (upcCodes.length === 0) {
            setInfoMessage('Please enter at least one UPC code.');
            return;
        }

        setLoading(true);
        setLoadingMessage('Searching for UPCs...');
        setMissingProducts([]);
        const foundProducts = [];
        const missing = [];

        for (const upc of upcCodes) {
            try {
                const response = await fetch(`https://purityai-typesense.hf.space/collections/101/documents/search?q=${upc}&query_by=upc,sku&per_page=1`, {
                    headers: { 'X-TYPESENSE-API-KEY': 'Hu52dwsas2AdxdE' }
                });
                const data = await response.json();
                if (data.hits.length > 0) {
                    foundProducts.push(data.hits[0].document);
                } else {
                    missing.push(upc);
                }
            } catch (error) {
                missing.push(upc);
                console.error(`Error searching for UPC ${upc}:`, error);
            }
        }

        setExcelData(prev => {
            const newData = [...prev, ...foundProducts];
            saveToLocalStorage(newData, userEdits);
            return newData;
        });

        setMissingProducts(missing);
        setInfoMessage(`Added ${foundProducts.length} products. ${missing.length} UPCs not found.`);
        setLoading(false);
        setLoadingMessage('');
        setBulkUpcInput('');
    };

    // --- PDF GENERATION ---
    const generatePDF = async () => {
        const previewArea = stickerPreviewAreaRef.current;
        if (!previewArea) return;

        const [jspdfModule, html2canvasModule] = await Promise.all([
            import('jspdf'),
            import('html2canvas'),
        ]);
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

        for (let i = 0; i < pages.length; i++) {
            setLoadingMessage(`Processing page ${i + 1} of ${pages.length}...`);
            const page = pages[i];
            const a4Page = page.querySelector('.a4Page');
            if (!a4Page) continue;

            const restorePage = preparePageForCapture(page);
            forceLayout(a4Page);

            if (singleLineRedText) {
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
                    if (singleLineRedText) {
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

        doc.save('stickers.pdf');
        previewArea.style.backgroundColor = originalBackgroundColor;
        setLoading(false);
        setLoadingMessage('');
        setInfoMessage('PDF generated successfully.');
    };

    // --- DERIVED STATE & MEMOIZED VALUES ---
    const pages = useMemo(() => {
        const numPages = Math.ceil(excelData.length / STICKERS_PER_PAGE);
        return Array.from({ length: numPages }, (_, i) =>
            excelData.slice(i * STICKERS_PER_PAGE, (i + 1) * STICKERS_PER_PAGE)
        );
    }, [excelData]);

    // --- UI RENDERING ---
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- CONTROLS COLUMN --- */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <header className="text-left mb-6 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-800">Generator Controls</h1>
                        <p className="text-gray-500 mt-1 text-sm">Upload, search, and generate your stickers.</p>
                    </header>
                    <div className="space-y-6">
                        {/* File Upload */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">1. Upload Excel File</label>
                            <label className="relative cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md shadow-sm hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center">
                                <Upload className="h-5 w-5 mr-2 text-gray-400" />
                                <span>{fileName}</span>
                                <input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                            </label>
                            {infoMessage && <p className="text-xs text-gray-600 mt-2 h-fit">{infoMessage}</p>}
                        </div>

                        {/* Search */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                                2. Search & Add Products
                                <div className="flex items-center">
                                    <span className="text-xs text-gray-500 mr-2">Bulk UPC</span>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isBulkMode} onChange={(e) => setIsBulkMode(e.target.checked)} className="sr-only peer" />
                                        <div className="relative w-9 h-5 bg-gray-200 peer-checked:bg-sky-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                                    </label>
                                </div>
                            </label>

                            {!isBulkMode ? (
                                <div className="relative">
                                    <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by product name or SKU..." className="w-full bg-white border border-gray-300 rounded-md py-2 px-4 pr-10 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
                                    <div className="absolute right-2 top-2 flex items-center space-x-1">
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>}
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    {showSearchResults && (
                                        <div className="absolute mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto z-20">
                                            {loading && !searchResults.length ? <p className="p-3 text-sm text-center text-gray-500">Searching...</p> :
                                                searchResults.length > 0 ? (
                                                    <ul className="divide-y divide-gray-200">
                                                        {searchResults.map((product) => (
                                                            <li key={product.id} onClick={() => { addProduct(product); setShowSearchResults(false); setSearchQuery(''); }} className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3">
                                                                <img src={product.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={product.productName} className="w-12 h-12 object-contain border rounded-md flex-shrink-0" onError={(e) => { e.target.src = DEFAULT_PRODUCT_IMAGE; }} />
                                                                <div className="flex-grow">
                                                                    <p className="font-medium text-gray-800 text-sm">{product.productName}</p>
                                                                    <p className="text-xs text-gray-500">UPC: {product.upc}</p>
                                                                </div>
                                                                <span className="text-sky-600 font-semibold text-sm">${Number(product.standardPrice || 0).toFixed(2)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : <p className="p-3 text-sm text-center text-gray-500">No results found.</p>}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <textarea value={bulkUpcInput} onChange={(e) => setBulkUpcInput(e.target.value)} placeholder="Enter UPCs separated by commas, spaces, or new lines..." className="w-full border border-gray-300 rounded-md py-2 px-4 text-sm h-28 resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none" />
                                    <button onClick={handleBulkSearch} disabled={loading} className="w-full bg-sky-600 text-white text-sm px-4 py-2 rounded-md hover:bg-sky-700 flex items-center justify-center disabled:opacity-50">
                                        {loading ? <Loader className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />} Search & Add
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Display Options */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                                3. Display Options
                                <div className="flex items-center">
                                    <span className="text-xs text-gray-500 mr-2">Single-line red text</span>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={singleLineRedText}
                                            onChange={(e) => handleSingleLineRedTextChange(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="relative w-9 h-5 bg-gray-200 peer-checked:bg-sky-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                                    </label>
                                </div>
                            </label>
                            <p className="text-xs text-gray-500">
                                When enabled, red title and flavor text shrink to fit on one line instead of wrapping.
                            </p>
                        </div>

                        {/* Actions */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">4. Final Actions</label>
                            <div className="flex flex-col space-y-3">
                                <button onClick={generatePDF} disabled={excelData.length === 0 || loading} className={"w-full  text-white font-semibold py-2.5 px-6 rounded-md  flex items-center justify-center disabled:opacity-50 " + (excelData.length === 0 || loading ? 'cursor-not-allowed bg-gray-700 hover:bg-gray-800' : 'bg-sky-600 hover:bg-sky-700')}>
                                    <Printer className="h-5 w-5 mr-2" /> Print All Pages
                                </button>
                                <button onClick={clearAll} disabled={excelData.length === 0 || loading} className="w-full bg-red-600 text-white font-semibold py-2.5 px-4 rounded-md hover:bg-red-700 flex items-center justify-center disabled:opacity-50">
                                    <Trash2 className="h-5 w-5 mr-2" /> Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- PREVIEW COLUMN --- */}
                <div className="lg:col-span-2">
                    <header className="text-left mb-6 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-800">Sticker Preview</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {excelData.length > 0 ? `Showing ${excelData.length} stickers on ${pages.length} pages.` : "Your generated sticker sheets will appear here."}
                        </p>
                    </header>

                    {(loading || loadingMessage) && (
                        <div className="text-center my-8 flex items-center justify-center">
                            <Loader className="animate-spin h-8 w-8 text-sky-600 mr-3" />
                            <p className="text-gray-600">{loadingMessage || 'Processing...'}</p>
                        </div>
                    )}

                    <div ref={stickerPreviewAreaRef} className={`previewArea bg-gray-200/50 p-4 rounded-xl border border-gray-200 h-[80vh] overflow-y-auto`}>
                        <div key={previewRefreshKey}>
                            {pages.map((pageData, pageIndex) => (
                                <StickerPage key={pageIndex} previewAreaRef={stickerPreviewAreaRef}>
                                    {pageData.map((item, itemIndex) => {
                                        const globalIndex = pageIndex * STICKERS_PER_PAGE + itemIndex;
                                        return <StickerItem
                                            key={item.upc || globalIndex}
                                            item={item}
                                            index={globalIndex}
                                            edits={userEdits[globalIndex] || {}}
                                            onEdit={handleFieldEdit}
                                            onRemove={removeProduct}
                                            singleLineRedText={singleLineRedText}
                                        />
                                    })}
                                </StickerPage>
                            ))}
                        </div>
                    </div>

                    {missingProducts.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Missing Products</h3>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-800 mb-2">The following UPCs were not found:</p>
                                <ul className="list-disc list-inside text-sm text-yellow-700">
                                    {missingProducts.map(upc => <li key={upc}>UPC: {upc}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const StickerPage = ({ children, previewAreaRef }) => {
    const [scale, setScale] = useState(1);
    const pageWrapperRef = useRef(null);

    const A4_WIDTH_PX = 816;
    const A4_HEIGHT_PX = 1056;

    const updateScale = useCallback(() => {
        if (previewAreaRef.current) {
            const newScale = (previewAreaRef.current.clientWidth - 60) / A4_WIDTH_PX;
            setScale(newScale < 1 ? newScale : 1);
        }
    }, [previewAreaRef]);

    useEffect(() => {
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [updateScale]);

    const filledChildren = React.Children.toArray(children);
    while (filledChildren.length < 6) {
        filledChildren.push(<div key={`placeholder-${filledChildren.length}`} className={"sticker"}></div>);
    }

    return (
        <div
            ref={pageWrapperRef}
            className={"pageWrapper"}
            style={{
                width: `${A4_WIDTH_PX * scale}px`,
                height: `${A4_HEIGHT_PX * scale}px`
            }}
        >
            <div className={"a4Page"} style={{ transform: `scale(${scale})` }}>
                <div className={"stickerGrid"}>
                    {filledChildren}
                </div>
            </div>
        </div>
    );
};


const A4_PAGE_WIDTH_PX = 816;
const A4_PAGE_HEIGHT_PX = 1056;
const RED_TEXT_MAX_FONT_PX = 24;
const RED_TEXT_MIN_FONT_PX = 6;
const RED_TEXT_SIDE_MARGIN_PX = 8;
const RED_TEXT_INNER_WIDTH_PX = 324;

const estimateRedTextFontSize = (text, maxPx = RED_TEXT_MAX_FONT_PX, minPx = RED_TEXT_MIN_FONT_PX) => {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return maxPx;
    const charWidthFactor = 0.62;
    const estimated = RED_TEXT_INNER_WIDTH_PX / (trimmed.length * charWidthFactor);
    return Math.min(maxPx, Math.max(minPx, Math.round(estimated * 10) / 10));
};

const fitRedTextInner = (
    container,
    inner,
    maxPx = RED_TEXT_MAX_FONT_PX,
    minPx = RED_TEXT_MIN_FONT_PX
) => {
    const maxWidth = container.clientWidth - RED_TEXT_SIDE_MARGIN_PX * 2;
    if (maxWidth <= 0) return null;

    inner.style.lineHeight = '1.15';

    const text = inner.textContent?.trim();
    if (!text) {
        inner.style.setProperty('font-size', `${maxPx}px`, 'important');
        inner.dataset.fitFontSize = String(maxPx);
        return maxPx;
    }

    inner.style.fontSize = `${maxPx}px`;
    if (inner.scrollWidth <= maxWidth) {
        inner.style.setProperty('font-size', `${maxPx}px`, 'important');
        inner.dataset.fitFontSize = String(maxPx);
        return maxPx;
    }

    let fontSize = Math.max(
        minPx,
        Math.floor((maxPx * maxWidth / inner.scrollWidth) * 10) / 10
    );
    inner.style.fontSize = `${fontSize}px`;

    if (inner.scrollWidth > maxWidth && fontSize > minPx) {
        fontSize = Math.max(
            minPx,
            Math.floor((fontSize * maxWidth / inner.scrollWidth) * 10) / 10
        );
        inner.style.fontSize = `${fontSize}px`;
    }

    inner.style.setProperty('font-size', `${fontSize}px`, 'important');
    inner.style.setProperty('line-height', '1.15', 'important');
    inner.dataset.fitFontSize = String(fontSize);
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

    pageWrapper.style.width = `${A4_PAGE_WIDTH_PX}px`;
    pageWrapper.style.height = `${A4_PAGE_HEIGHT_PX}px`;
    if (a4Page) {
        a4Page.style.transform = 'scale(1)';
    }

    return () => {
        pageWrapper.style.width = saved.wrapperWidth;
        pageWrapper.style.height = saved.wrapperHeight;
        if (a4Page) {
            a4Page.style.transform = saved.a4Transform;
        }
    };
};

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const StickerRedText = ({ className, content, field, index, onEdit, onPaste, singleLine }) => {
    const containerRef = useRef(null);
    const innerRef = useRef(null);

    const estimatedFontSize = useMemo(
        () => (singleLine ? estimateRedTextFontSize(content) : RED_TEXT_MAX_FONT_PX),
        [singleLine, content]
    );

    const refineFit = useCallback(() => {
        if (!singleLine || !containerRef.current || !innerRef.current) return;
        fitRedTextInner(containerRef.current, innerRef.current);
    }, [singleLine]);

    const handleInput = (e) => {
        if (!singleLine) return;
        const size = estimateRedTextFontSize(e.currentTarget.textContent);
        e.currentTarget.style.fontSize = `${size}px`;
    };

    if (!singleLine) {
        return (
            <div
                className={className}
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
        <div ref={containerRef} className={className + ' stickerRedTextSingleLine'}>
            <span
                ref={innerRef}
                className="stickerRedTextInner"
                style={{ fontSize: `${estimatedFontSize}px`, lineHeight: 1.15 }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                    onEdit(index, field, e.currentTarget.textContent);
                    refineFit();
                }}
                onPaste={(e) => {
                    onPaste(e);
                    requestAnimationFrame(() => refineFit());
                }}
                onInput={handleInput}
            >
                {content}
            </span>
        </div>
    );
};

const StickerItem = ({ item, index, edits, onEdit, onRemove, singleLineRedText }) => {
    // Parse product name for title, description, and flavor
    const { title, description, flavor } = useMemo(() => {
        const productName = item.productName || 'No Product Name';
        const parts = productName.split(' - ').map(p => p.trim()).filter(Boolean);
        let title = productName, description = '', flavor = '';

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
    }, [item.productName]);

    const handlePaste = (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    return (
        <div className={"sticker"}>
            <button onClick={() => onRemove(index)} className={"removeBtn"}>
                <X size={16} />
            </button>

            <StickerRedText
                className="stickerTitle"
                content={edits.title || title}
                field="title"
                index={index}
                onEdit={onEdit}
                onPaste={handlePaste}
                singleLine={singleLineRedText}
            />

            <div
                className={"stickerDescription"}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEdit(index, 'description', e.currentTarget.textContent)}
                onPaste={handlePaste}
            >
                {edits.description || description}
            </div>

            <StickerRedText
                className="stickerFlavor"
                content={edits.flavor || flavor}
                field="flavor"
                index={index}
                onEdit={onEdit}
                onPaste={handlePaste}
                singleLine={singleLineRedText}
            />

            <div className={"stickerPrice"}>
                ${Number(item.standardPrice || 0).toFixed(2)}
            </div>

            <Barcode value={item.upc || 'N/A'} />

            <div className={"stickerUpc"}>
                {item.upc || 'N/A'}
            </div>
        </div>
    );
};

export default Sticker;