import React, { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai';
import { isSidebarOpenAtom } from '../../../Variables';
import { apiRequest } from '../../../utils/api';
import { Copy, Search } from 'lucide-react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';


const Loader = ({ height, width }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
        <g data-idx={1}>
            <circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} data-idx={2} transform="rotate(-72 50 50)" />
            <g data-idx={4} />
        </g>
    </svg>
);
const SortIcon = ({ direction }) => (
    <span className="inline-block w-4 h-4 mb-2 ml-2 transition-all duration-200">
        {direction === 'asc' && (
            <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600" viewBox="-9 0 32 32">
                <path fill="#4f39f6" d="M 0.282 13.063 L 6.25 5.625 C 6.781 4.937 7.656 4.937 8.188 5.625 L 14.157 13.063 C 14.688 13.751 14.438 14.313 13.532 14.313 L 0.907 14.313 C 0.001 14.313 -0.249 13.75 0.282 13.063 Z M 14.156 18.938 L 8.187 26.376" />
                <path fill="currentColor" d="M 14.155 18.938 L 8.187 26.376 C 7.656 27.064 6.781 27.064 6.249 26.376 L 0.28 18.938 C -0.251 18.25 -0.001 17.688 0.905 17.688 L 13.53 17.688 C 14.436 17.688 14.686 18.251 14.155 18.938 Z" />
            </svg>
        )}
        {direction === 'desc' && (
            <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600" viewBox="-9 0 32 32">
                <path fill="currentColor" d="M 0.282 13.063 L 6.25 5.625 C 6.781 4.937 7.656 4.937 8.188 5.625 L 14.157 13.063 C 14.688 13.751 14.438 14.313 13.532 14.313 L 0.907 14.313 C 0.001 14.313 -0.249 13.75 0.282 13.063 Z M 14.156 18.938 L 8.187 26.376" />
                <path fill="#4f39f6" d="M 14.155 18.938 L 8.187 26.376 C 7.656 27.064 6.781 27.064 6.249 26.376 L 0.28 18.938 C -0.251 18.25 -0.001 17.688 0.905 17.688 L 13.53 17.688 C 14.436 17.688 14.686 18.251 14.155 18.938 Z" />
            </svg>
        )}
        {!direction && (
            <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600" viewBox="-9 0 32 32">
                <path fill="currentColor" d="M 0.282 13.063 L 6.25 5.625 C 6.781 4.937 7.656 4.937 8.188 5.625 L 14.157 13.063 C 14.688 13.751 14.438 14.313 13.532 14.313 L 0.907 14.313 C 0.001 14.313 -0.249 13.75 0.282 13.063 Z M 14.156 18.938 L 8.187 26.376" />
                <path fill="currentColor" d="M 14.155 18.938 L 8.187 26.376 C 7.656 27.064 6.781 27.064 6.249 26.376 L 0.28 18.938 C -0.251 18.25 -0.001 17.688 0.905 17.688 L 13.53 17.688 C 14.436 17.688 14.686 18.251 14.155 18.938 Z" />
            </svg>
        )}
    </span>
);


const FilterIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
    </svg>
);

const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);


const SearchProduct = () => {
    // --- State Management ---
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    // Search and Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Sorting State
    const [sortColumn, setSortColumn] = useState('insertedTimestamp');
    const [sortDirection, setSortDirection] = useState('desc');

    // UI State
    const [collapsed] = useAtom(isSidebarOpenAtom);
    const totalPages = Math.ceil(totalCount / limit);
    const [selectedItems, setSelectedItems] = useState(new Set());


    // --- Column Definitions ---
    // Defines table columns, their corresponding API field names, and whether they are sortable.
    const columns = [
        { header: "Product", key: 'productName', sortable: true, className: "min-w-0" },
        { header: "UPC", key: 'upc', sortable: true, className: "hidden md:table-cell" },
        { header: "Stock", key: 'availableQuantity', sortable: true, className: "text-center" },
        { header: "Price", key: 'standardPrice', sortable: true, className: "text-right" },
        { header: "Status", key: 'active', sortable: false, className: "text-center" },
        { header: "Date", key: 'insertedTimestamp', sortable: true, className: "hidden lg:table-cell" },
        { header: "Actions", key: null, sortable: false, className: "text-center w-20" },
    ];

    // --- Data Fetching ---

    // Using useCallback to memoize the function, preventing re-creation on every render.
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Construct the API URL with query parameters for search, pagination, and sorting.
            const offset = (currentPage - 1) * limit;
            const params = new URLSearchParams({
                search: debouncedSearchTerm,
                limit: limit,
                offset: offset,
                order: sortColumn,
                dir: sortDirection
            });

            // In a real app, VITE_SERVER_URL would be set in your .env file
            const serverUrl = import.meta.env.VITE_SERVER_URL + "/api/products"
            const data = await apiRequest(`${serverUrl}?${params.toString()}`);

            // Use the mock response
            setProducts(data.products);
            setTotalCount(data.total_count);

        } catch (error) {
            console.error("Failed to fetch products:", error);
            // Handle error state in UI if needed (e.g., show a toast notification)
            setProducts([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [currentPage, limit, debouncedSearchTerm, sortColumn, sortDirection]);

    // Effects
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Event Handlers
    const handleSort = (columnKey) => {
        if (!columnKey) return;

        if (sortColumn === columnKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const handleEdit = (product) => {
        alert(`Editing Product: ${product?.productName} (UPC: ${product?.upc})`);
    };

    const handleSelectItem = (productId) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedItems(newSelected);
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Search and Filter Bar */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 mb-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search products, UPC codes..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 peer rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/75 focus:border-indigo-500 transition-all duration-200 placeholder-gray-400"
                        />
                        <Search className="w-8 h-8 text-gray-300 absolute top-2 peer-focus:text-indigo-500 inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all" />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Filter Button */}
                    <button className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-gray-700 bg-white/80 hover:bg-white hover:border-gray-300 transition-all duration-200">
                        <FilterIcon />
                        <span className="ml-2">Filters</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
                        <Loader />
                    </div>
                )}

                <div className={`transition-all duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            {/* Header */}
                            <thead>
                                <tr className="border-b border-gray-200/50 bg-gray-50/50">
                                    <th className="w-12 px-6 py-4">
                                        <label className="inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedItems(new Set(products.map(p => p.id)));
                                                    } else {
                                                        setSelectedItems(new Set());
                                                    }
                                                }}
                                            />
                                            <span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
                                                    ${selectedItems.size === products.length
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'bg-white border-gray-300 peer-hover:border-indigo-400'
                                                }`}>
                                                {selectedItems.size === products.length && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </span>
                                        </label>
                                    </th>
                                    {columns.map(col => (
                                        <th
                                            key={col.key || col.header}
                                            className={`px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider ${col.className || ''
                                                } ${col.sortable ? 'cursor-pointer group hover:bg-gray-100/50' : ''}`}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                        >
                                            <div className="flex items-center justify-start">
                                                {col.header}
                                                {col.sortable && (
                                                    <SortIcon direction={sortColumn === col.key ? sortDirection : null} />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Body */}
                            <tbody className="divide-y divide-gray-200/50">
                                {products.length > 0 ? products.map((product, index) => (
                                    <tr
                                        key={product?.id}
                                        className={`group transition-all duration-200 ${selectedItems.has(product.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-indigo-50'
                                            }`}
                                    >
                                        {/* Custom Checkbox */}
                                        <td className="px-6 py-4">
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(product.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedItems(new Set(products.map(p => p.id)));
                                                        } else {
                                                            setSelectedItems(new Set());
                                                        }
                                                    }}
                                                    className="sr-only peer"
                                                />
                                                <span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
                                                    ${selectedItems.has(product.id)
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'bg-white border-gray-300 peer-hover:border-indigo-400'
                                                    }`}>
                                                    {selectedItems.has(product.id) && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </span>
                                            </label>
                                        </td>

                                        {/* Product */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-4">
                                                <div className="relative">

                                                    <PhotoProvider>
                                                        <PhotoView src={product?.imageUrl ? product.imageUrl : '/static/images/default.png'}>
                                                            <img
                                                                src={product?.imageUrl ? product.imageUrl : '/static/images/default.png'}
                                                                alt={product?.productName}
                                                                className="w-12 h-12 rounded-xl object-cover shadow-sm"

                                                            />
                                                        </PhotoView>
                                                    </PhotoProvider>
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">{(currentPage - 1) * limit + index + 1}</span>
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold max-w-96 text-gray-900 truncate">
                                                        {product?.productName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 md:hidden">
                                                        UPC: {product?.upc}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* UPC */}
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex items-center space-x-2">

                                                {product?.upc && (
                                                    <button
                                                        type="button"
                                                        className="p-1 rounded hover:bg-gray-200 transition cursor-pointer"
                                                        title="Copy UPC"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(product.upc);
                                                        }}
                                                    >
                                                        <Copy className="w-4 h-4 text-gray-500 hover:text-indigo-600 transition" />
                                                    </button>
                                                )}
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {product?.upc}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Stock */}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${product?.availableQuantity > 20
                                                    ? 'bg-green-100 text-green-800'
                                                    : product.availableQuantity > 0
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {product?.availableQuantity}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Price */}
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-lg font-bold text-gray-900">
                                                {formatPrice(product.standardPrice)}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${product?.active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product?.active ? 'bg-green-400' : 'bg-gray-400'
                                                    }`}></span>
                                                {product?.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>

                                        {/* Date */}
                                        <td className="px-6 py-4 hidden lg:table-cell">
                                            <span className="text-sm text-gray-600">
                                                {formatDate(product.insertedTimestamp)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="inline-flex items-center p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                                            >
                                                <EditIcon />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center space-y-3">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-900">No products found</h3>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding some products'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="border-t border-gray-200/50 bg-gray-50/30 px-6 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                <div className="text-sm text-gray-700">
                                    Showing <span className="font-semibold">{Math.min((currentPage - 1) * limit + 1, totalCount)}</span> to{' '}
                                    <span className="font-semibold">{Math.min(currentPage * limit, totalCount)}</span> of{' '}
                                    <span className="font-semibold">{totalCount}</span> results
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Previous
                                    </button>

                                    <div className="flex items-center space-x-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const page = i + 1;
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchProduct;