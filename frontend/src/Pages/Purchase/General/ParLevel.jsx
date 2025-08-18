import React, { useState, useEffect, useRef } from 'react'
import CustomDropdown from "../../../Components/utils/CustomDropdown"
import { apiRequest } from "../../../utils/api"
import { useAtom } from "jotai"
import { successAtom } from '../../../Variables'
import { Loader, Loader2 } from 'lucide-react'
import { Search, X, Trash2, Upload } from 'lucide-react'

const typeOptions = [
    { value: "category", label: "Category" },
    { value: "product", label: "Product" }
];

const periodOptions = [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "3month", label: "3 Month" },
    { value: "6month", label: "6 Month" },
    { value: "year", label: "Year" }
];

// Helper: Convert flat category list to tree
function buildCategoryTree(categories) {
    const map = {};
    categories.forEach(cat => {
        map[cat?.categoryId] = { ...cat, children: [] };
    });
    // Sort parents alphabetically by name
    const parents = categories.filter(cat => !cat?.parentId);
    parents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const tree = [];
    categories.forEach(cat => {
        if (cat?.parentId && map[cat?.parentId]) {
            map[cat?.parentId].children.push(map[cat?.categoryId]);
        }
    });
    parents.forEach(parent => {
        tree.push(map[parent.categoryId]);
    });
    return tree;
}

// Helper: Recursively update parValueDays for all children
function updateChildrenParValue(node, value) {
    node.parValueDays = value;
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => updateChildrenParValue(child, value));
    }
}

// CategoryParLevelTree component (collapsible, input right, parent change propagates)
const CategoryParLevelTree = ({
    categories,
    parValues,
    onParValueChange,
    collapsedMap,
    setCollapsedMap,
    loadingSubmit
}) => {
    const handleCollapseToggle = (categoryId) => {
        setCollapsedMap(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }));
    };

    const renderTree = (nodes, level = 0) => (
        <ul className={(level === 0 ? "pl-0" : "pl-8") + " mt-2"}>
            {nodes.map(node => (
                <li key={node.categoryId} className="mb-2">
                    <div className="flex items-center gap-2">
                        {node.children && node.children.length > 0 && (
                            <button
                                type="button"
                                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-indigo-600"
                                onClick={() => handleCollapseToggle(node.categoryId)}
                                tabIndex={-1}
                            >
                                {collapsedMap[node.categoryId] ? (
                                    <span>&#9654;</span>
                                ) : (
                                    <span>&#9660;</span>
                                )}
                            </button>
                        )}
                        <span className="font-medium">{node.name}</span>
                        {/* add a ---  between name and input */}
                        <span className="mx-2 border-b border-dashed border-gray-400 flex-1"></span>
                        <input
                            type="number"
                            value={parValues[node.categoryId] ?? ""}
                            min={0}
                            className="border border-gray-300 bg-white px-2 py-1 rounded w-20 ml-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onChange={e => onParValueChange(node.categoryId, e.target.value, node)}
                            disabled={loadingSubmit}
                        />
                    </div>
                    {node.children && node.children.length > 0 && !collapsedMap[node.categoryId] && renderTree(node.children, level + 1)}
                </li>
            ))}
        </ul>
    );
    return renderTree(categories);
};

// Table for changed entries
const ChangedEntriesTable = ({ changedEntries }) => (
    <div className="bg-white rounded-lg shadow-md p-4">
        <p className="font-semibold text-lg mb-2">Changed Categories</p>
        <div className='max-h-96 overflow-y-auto relative'>
            <table className="w-full border border-gray-300 rounded-lg shadow-inner overflow-hidden ">
                <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="text-left px-2 py-2">Category ID</th>
                        <th className="text-left px-2 py-2">Name</th>
                        <th className="text-center px-2 py-2">Par Value (Days)</th>
                    </tr>
                </thead>
                <tbody>
                    {changedEntries.length > 0 ? changedEntries.map(cat => (
                        <tr key={cat?.categoryId} className="border-t border-gray-300">
                            <td className="px-2 py-2">{cat?.categoryId}</td>
                            <td className="px-2 py-2">{cat?.name}</td>
                            <td className="px-2 py-2 text-center">{cat?.parValueDays}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={3} className="text-center py-4 text-gray-400">No changes yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// Product Par Level Table
const ProductParLevelTable = ({
    products,
    parValues,
    onParValueChange,
    onRemove,
    loadingSubmit
}) => (
    <div className="bg-white rounded-lg shadow-md p-4">
        <p className="font-semibold text-lg mb-2">Product Par Levels</p>
        <div className='max-h-96 overflow-y-auto relative'>
            <table className="w-full border border-gray-300 rounded-lg shadow-inner overflow-hidden ">
                <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="text-left px-2 py-2">Product ID</th>
                        <th className="text-left px-2 py-2">Name</th>
                        <th className="text-center px-2 py-2">Par Value (Days)</th>
                        <th className="text-center px-2 py-2">Remove</th>
                    </tr>
                </thead>
                <tbody>
                    {products.length > 0 ? products.map(prod => (
                        <tr key={prod?.productId} className="border-t border-gray-300">
                            <td className="px-2 py-2">{prod?.productId}</td>
                            <td className="px-2 py-2">{prod?.productName}</td>
                            <td className="px-2 py-2 text-center">
                                <input
                                    type="number"
                                    value={parValues[prod.productId] ?? ""}
                                    min={0}
                                    className="border border-gray-300 bg-white px-2 py-1 rounded w-20 ml-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    onChange={e => onParValueChange(prod.productId, e.target.value)}
                                    disabled={loadingSubmit}
                                />
                            </td>
                            <td className="px-2 py-2 text-center">
                                <button className="text-red-500 hover:text-red-700" onClick={() => onRemove(prod.productId,0)}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center py-4 text-gray-400">No products yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// Add Product Modal for product type
const AddProductModal = ({
    show,
    onClose,
    onAddProducts,
    loading,
    tempProducts,
    setTempProducts
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const debounceRef = useRef();

    // Search logic (similar to HotProduct)
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (!value.trim()) {
                setSearchResults([]);
                return;
            }
            fetch(`${import.meta.env.VITE_SERVER_URL}/api/search-products/?query=${encodeURIComponent(value)}`)
                .then(res => res.json())
                .then(data => setSearchResults(data || []))
                .catch(() => setSearchResults([]));
        }, 300);
    };

    const handleAddTempProduct = (item) => {
        const prod = item.document;
        if (!prod?.productId) return;
        if (tempProducts.some(p => p.productId === prod.productId)) return;
        setTempProducts(prev => [...prev, {
            productId: prod.productId,
            productName: prod.productName,
            parValueDays: "",
            imageUrl: prod.imageUrl
        }]);
    };

    const handleRemoveTempProduct = (productId) => {
        setTempProducts(prev => prev.filter(p => p.productId !== productId));
    };

    return show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-lg shadow-lg p-6 w-[80%] md:w-[50%] min-h-[50vh] max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-2">Add Products</h2>
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name, UPC ..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-10 pr-10 py-2 rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-500 text-sm w-full"
                            disabled={loading}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <Search className="w-4 h-4" />
                        </span>
                        {searchTerm && (
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => { setSearchTerm(""); setSearchResults([]); }}
                                type="button"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        {searchResults?.length > 0 && (
                            <div className="absolute left-0 right-0 mt-2 py-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 h-fit w-full max-h-60 overflow-y-auto">
                                {searchResults.map((item, idx) => (
                                    <div
                                        key={item?.document?.productId || idx}
                                        className="flex flex-row gap-2 w-full items-center justify-start px-4 py-1 h-fit hover:bg-indigo-50 cursor-pointer text-sm"
                                        onClick={() => handleAddTempProduct(item)}
                                    >
                                        <img src={item?.document?.imageUrl || "/static/images/default.png"} alt={item?.document?.productName} className="w-10 h-10 rounded mr-2 inline-block" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item?.document?.productName}</span>
                                            <span className="text-xs text-gray-500">ID: {item?.document?.productId}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Temp Table */}
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Products to Add</label>
                    <div className="border rounded-md max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className='sticky top-0 z-10 border-b border-gray-300'>
                                <tr className="bg-gray-100">
                                    <th className="px-2 py-1 text-left">ID</th>
                                    <th className="px-2 py-1 text-left">Name</th>
                                    <th className="px-2 py-1 text-center">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tempProducts.length > 0 ? tempProducts.map((p, idx) => (
                                    <tr key={p.productId} className='border-b border-gray-300 last:border-none'>
                                        <td className="px-2 py-1">{p?.productId}</td>
                                        <td className="px-2 py-1">{p?.productName}</td>
                                        <td className="px-2 py-1 text-center">
                                            <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveTempProduct(p?.productId)}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="px-2 py-2 text-center text-gray-400">No products added yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-4">
                    <button
                        onClick={onClose}
                        className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400"
                        disabled={loading}
                    >Cancel</button>
                    <button
                        onClick={() => onAddProducts(tempProducts)}
                        className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-700"
                        disabled={loading || tempProducts.length === 0}
                    >Add All</button>
                </div>
            </div>
        </div>
    ) : null;
};

const ParLevel = () => {
    const [type, setType] = useState("category");
    const [period, setPeriod] = useState("3month");
    const [categoryData, setCategoryData] = useState([]);
    const [parValues, setParValues] = useState({});
    const [collapsedMap, setCollapsedMap] = useState({});
    const [changedEntries, setChangedEntries] = useState([]);
    const [successMessage, setSuccessMessage] = useAtom(successAtom);
    const [loadingTree, setLoadingTree] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [productData, setProductData] = useState([]);
    const [productParValues, setProductParValues] = useState({});
    const [productChangedEntries, setProductChangedEntries] = useState([]);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [tempProducts, setTempProducts] = useState([]);
    const [loadingAddProduct, setLoadingAddProduct] = useState(false);
    const [reloader, setReloader] = useState(false);

    // Fetch category par levels
    useEffect(() => {
        if (type === "category") {
            setLoadingTree(true);
            apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/?dataType=${type}&period=${period}`)
                .then(res => {
                    setCategoryData(res.data || []);
                    // Initialize parValues state
                    const initial = {};
                    (res.data || []).forEach(cat => {
                        initial[cat?.categoryId] = cat?.parValueDays ?? "";
                    });
                    setParValues(initial);
                    // Initialize all categories as collapsed by default
                    const collapsedInitial = {};
                    (res.data || []).forEach(cat => {
                        collapsedInitial[cat?.categoryId] = true;
                    });
                    setCollapsedMap(collapsedInitial);
                    setChangedEntries([]);
                })
                .finally(() => setLoadingTree(false));
        }
    }, [type]);

    // Fetch product par levels
    useEffect(() => {
        if (type === "product") {
            setLoadingTree(true);
            apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/?dataType=product&period=${period}`)
                .then(res => {
                    setProductData(res.data || []);
                    // Initialize parValues state
                    const initial = {};
                    (res.data || []).forEach(prod => {
                        initial[prod?.productId] = prod?.parValueDays ?? "";
                    });
                    setProductParValues(initial);
                    setProductChangedEntries([]);
                })
                .finally(() => setLoadingTree(false));
        }
    }, [type, period, reloader]);

    // Handler for parValueDays input change (parent change propagates to children)
    const handleParValueChange = (categoryId, value, node) => {
        value = value === "" ? "" : Number(value);
        // Build tree from flat list for propagation
        const tree = buildCategoryTree(
            categoryData.map(cat => ({
                ...cat,
                parValueDays: parValues[cat?.categoryId]
            }))
        );
        // Find node in tree
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.categoryId === categoryId) return n;
                if (n.children && n.children.length > 0) {
                    const found = findNode(n.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const targetNode = findNode(tree);
        if (targetNode) {
            updateChildrenParValue(targetNode, value);
            // Update parValues for all affected nodes
            const updatedParValues = { ...parValues };
            const collectIds = (n) => {
                updatedParValues[n.categoryId] = value;
                if (n.children && n.children.length > 0) {
                    n.children.forEach(collectIds);
                }
            };
            collectIds(targetNode);

            setParValues(updatedParValues);

            // Update changedEntries
            const changed = [];
            Object.keys(updatedParValues).forEach(id => {
                const orig = categoryData.find(cat => cat?.categoryId === Number(id));
                if (orig && String(orig.parValueDays) !== String(updatedParValues[id])) {
                    changed.push({
                        categoryId: orig.categoryId,
                        name: orig.name,
                        parValueDays: updatedParValues[id]
                    });
                }
            });
            setChangedEntries(changed);
        }
    };


    // Handler for product parValueDays input change
    const handleProductParValueChange = (productId, value) => {
        if (value !== "") {
            value = Number(value);
            const updatedParValues = { ...productParValues, [productId]: value };
            setProductParValues(updatedParValues);

            // Update changedEntries
            const changed = [];
            Object.keys(updatedParValues).forEach(id => {
                const orig = productData.find(prod => prod?.productId === Number(id));
                if (orig && String(orig.parValueDays) !== String(updatedParValues[id])) {
                    changed.push({
                        productId: orig.productId,
                        productName: orig.productName,
                        parValueDays: updatedParValues[id]
                    });
                }
            });
            setProductChangedEntries(changed);
        }
    };

    // Add products from modal to productData
    const handleAddProducts = (productsToAdd) => {
        setLoadingAddProduct(true);
        // Merge new products into productData
        const newProducts = productsToAdd.filter(p => !productData.some(prod => prod.productId === p.productId));
        setProductData(prev => [...prev, ...newProducts]);
        setProductParValues(prev => {
            const copy = { ...prev };
            newProducts.forEach(p => { copy[p.productId] = p.parValueDays ?? ""; });
            return copy;
        });
        setShowAddProductModal(false);
        setTempProducts([]);
        setLoadingAddProduct(false);
    };

    // Submit handler
    const handleSubmit = async () => {
        setLoadingSubmit(true);
        let response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/`, { method: 'POST', body: JSON.stringify({ changes: changedEntries, dataType: "category" }) })
        setChangedEntries([]);
        setSuccessMessage([...successMessage, { "id": Date.now(), "message": response?.message || "Changes saved successfully.", "status": response?.status || "success" }]);
        setLoadingSubmit(false);
        setReloader(!reloader); // Trigger re-fetch
    };

    // Submit handler for product
    const handleProductSubmit = async () => {
        setLoadingSubmit(true);
        let response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/`, {
            method: 'POST',
            body: JSON.stringify({ changes: productChangedEntries, dataType: "product" })
        });
        setProductChangedEntries([]);
        setSuccessMessage([...successMessage, { "id": Date.now(), "message": response?.message || "Changes saved successfully.", "status": response?.status || "success" }]);
        setLoadingSubmit(false);
        setReloader(!reloader); // Trigger re-fetch
    };

    // Build tree from flat category list
    const categoryTree = buildCategoryTree(
        categoryData.map(cat => ({
            ...cat,
            parValueDays: parValues[cat?.categoryId]
        }))
    );

    return (
        <div>
            {/* Top Filter Bar */}
            <div className="bg-white w-full h-fit rounded-lg shadow-md mt-2 p-4 flex flex-row gap-4 items-end">
                <div className="flex flex-col">
                    <label className="text-sm text-gray-600 mb-1">Type</label>
                    <CustomDropdown
                        options={typeOptions}
                        value={type}
                        onChange={setType}
                        placeholder="Type"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm text-gray-600 mb-1">Time Period</label>
                    <CustomDropdown
                        options={periodOptions}
                        value={period}
                        onChange={setPeriod}
                        placeholder="Time Period"
                    />
                </div>
                {/* Product type: Add Product & Submit Changes buttons */}
                {type === "product" && (
                    <div className="flex flex-row gap-2 ml-auto">
                        <button
                            className="px-4 bg-green-600 flex flex-nowrap gap-2 items-center justify-center text-white py-2 rounded-md hover:bg-green-700"
                            onClick={() => setShowAddProductModal(true)}
                            disabled={loadingSubmit}
                        >
                            + Add Product
                        </button>
                        <button
                            className="px-4 bg-indigo-600 flex flex-nowrap gap-2 items-center justify-center text-white py-2 rounded-md hover:bg-indigo-700"
                            onClick={handleProductSubmit}
                            disabled={productChangedEntries.length === 0 || loadingSubmit}
                        >
                            {loadingSubmit && <Loader2 className=' animate-spin' />}
                            Submit Changes
                        </button>
                    </div>
                )}
            </div>
            {/* Category ParLevel Tree & Changed Entries Table */}
            {type === "category" && (
                <div className="mt-6 flex flex-row gap-8 items-start">
                    <div className="flex-1 max-w-[50%]">
                        {loadingTree ? (
                            <div className="flex items-center justify-center h-40">
                                <span className="text-gray-500">Loading tree...</span>
                            </div>
                        ) : (
                            <CategoryParLevelTree
                                categories={categoryTree}
                                parValues={parValues}
                                onParValueChange={handleParValueChange}
                                collapsedMap={collapsedMap}
                                setCollapsedMap={setCollapsedMap}
                                loadingSubmit={loadingSubmit}
                            />
                        )}
                    </div>
                    <div className="flex-1 max-w-[50%]">
                        <ChangedEntriesTable changedEntries={changedEntries} />
                        <button
                            className="mt-4 px-4 mx-auto w-fit bg-indigo-600 flex flex-nowrap gap-2 items-center justify-center text-white py-2 rounded-md hover:bg-indigo-700"
                            onClick={handleSubmit}
                            disabled={changedEntries.length === 0 || loadingSubmit}
                        >
                            {loadingSubmit && <Loader2 className=' animate-spin' />}
                            Submit Changes
                        </button>
                    </div>
                </div>
            )}
            {/* Product ParLevel Table & Add Product Modal */}
            {type === "product" && (
                <div className="mt-6">
                    {loadingTree ? (
                        <div className="flex items-center justify-center h-40">
                            <span className="text-gray-500">Loading table...</span>
                        </div>
                    ) : (
                        <ProductParLevelTable
                            products={productData}
                            parValues={productParValues}
                            onParValueChange={handleProductParValueChange}
                            onRemove={handleProductParValueChange}
                            loadingSubmit={loadingSubmit}
                        />
                    )}
                    <AddProductModal
                        show={showAddProductModal}
                        onClose={() => setShowAddProductModal(false)}
                        onAddProducts={handleAddProducts}
                        loading={loadingAddProduct}
                        tempProducts={tempProducts}
                        setTempProducts={setTempProducts}
                    />
                </div>
            )}
        </div>
    )
}

export default ParLevel