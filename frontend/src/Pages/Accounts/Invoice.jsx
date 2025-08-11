import { useAtom } from 'jotai';
import React, { useState, useEffect } from 'react';
import { isSidebarOpenAtom } from '../../Variables';
import { apiRequest } from '../../utils/api';
import CustomDropdown from '../../Components/utils/CustomDropdown';
import Calendar from '../../Components/utils/Calendar';
import { LoaderPinwheel, Send } from 'lucide-react';
import * as XLSX from 'xlsx';

const ColumnSettingsPopup = ({ visible, onClose, columns, onChange }) => {
    if (!visible) return null;

    return (
        <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded border border-gray-200 z-50">
            <div className="text-sm">
                {columns.map(column => (
                    <div key={column?.key} className="flex items-center p-2 hover:bg-gray-50">
                        <span className="w-6 flex justify-center">
                            <input
                                type="checkbox"
                                checked={column?.visible}
                                onChange={() => onChange(column?.key)}
                                className="w-4 h-4 text-pink-600 rounded accent-pink-600 border-gray-300"
                            />
                        </span>
                        <span className="px-2 cursor-pointer whitespace-nowrap" onClick={() => onChange(column?.key)}>
                            {column?.title}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex justify-between p-3 border-t border-gray-200">
                <button
                    onClick={() => onChange('reset')}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                >
                    Reset
                </button>
                <button
                    onClick={onClose}
                    className="px-2 py-1 text-sm text-white bg-pink-600 rounded hover:bg-pink-700"
                >
                    Ok
                </button>
            </div>
        </div>
    );
};

const Loader = ({ height, width, stroke = "#615fff" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
        <g>
            <circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke={stroke} fill="none" cy={50} cx={50} />
        </g>
    </svg>
);


const Invoice = () => {
    const [collapsed] = useAtom(isSidebarOpenAtom);
    const [invoiceData, setInvoiceData] = useState([]);
    const [pageSize, setPageSize] = useState(parseInt(localStorage.getItem('invoicePageSize')) || 20);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [dateFormat, setDateFormat] = useState('yyyy-MM-dd');
    const [loading, setLoading] = useState(false);
    const [columnSettings, setColumnSettings] = useState(JSON.parse(localStorage.getItem('invoiceColumnSettings')) || [
        { key: 'createdAt', title: 'Created At', visible: true },
        { key: 'invoiceNo', title: 'Invoice #', visible: true },
        { key: 'soNo', title: 'SO #', visible: true },
        { key: 'totalAmount', title: 'Total Amount', visible: true },
        { key: 'store', title: 'Store', visible: true },
        { key: 'customer', title: 'Customer', visible: true },
        { key: 'company', title: 'Company', visible: true },
        { key: 'dba', title: 'DBA', visible: true },
        { key: 'state', title: 'State', visible: true },
        { key: 'salesRep', title: 'Sales Rep', visible: true },
        { key: 'status', title: 'Status', visible: true },
        { key: 'shipping', title: 'Shipping', visible: true },
        { key: 'tags', title: 'Tags', visible: true },
        { key: 'dueBalance', title: 'Due Balance', visible: true },
        { key: 'dueDate', title: 'Due Date', visible: true }
    ]);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [loadingExport, setLoadingExport] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/accounts/invoices/?page=${currentPage - 1}&size=${pageSize}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`);
            setInvoiceData(data["result"]["content"] || []);
            setTotalPages(data["result"]["totalPages"] || 0);
            setLoading(false);
        };
        fetchData();
        localStorage.setItem('invoicePageSize', pageSize);
    }, [pageSize, currentPage, startDate, endDate]);

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const getTagClassNames = (tagColor) => {
        switch (tagColor) {
            case '#e2cb2f': // Delivery (yellow-ish)
                return 'bg-yellow-500 text-white';
            case '#FFA500': // Cash & Carry (orange)
                return 'bg-orange-500 text-white';
            case '#381fc9': // Shipping (purple)
                return 'bg-indigo-700 text-white';
            default:
                return 'bg-gray-200 text-gray-800';
        }
    };

    const getStatusClassNames = (status) => {
        switch (status) {
            case 'Pending Payment':
                return 'bg-orange-100 text-orange-700 border border-orange-200';
            case 'Completed':
                return 'bg-green-100 text-green-700 border border-green-200';
            default:
                return 'bg-gray-100 text-gray-700 border border-gray-200';
        }
    };

    const getShippingStatusClassNames = (status) => {
        switch (status) {
            case 'Pending Shipment':
                return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            case 'Shipped':
                return 'bg-pink-100 text-pink-700 border border-pink-200';
            default:
                return 'bg-gray-100 text-gray-700 border border-gray-200';
        }
    };

    const renderPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5; // Number of page buttons to show at once

        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(
                <li
                    key={i}
                    title={i.toString()}
                    className={`mr-2 h-8 min-w-8 flex items-center justify-center rounded-sm cursor-pointer ${currentPage === i ? 'bg-white border border-pink-700 font-semibold' : 'bg-white border border-transparent hover:bg-gray-100'
                        }`}
                >
                    <a
                        rel="nofollow"
                        className={`block px-2 py-1 ${currentPage === i ? 'text-pink-700' : 'text-gray-800'}`}
                        onClick={() => setCurrentPage(i)}
                    >
                        {i}
                    </a>
                </li>
            );
        }

        // Add ellipsis for pages beyond the current view
        if (startPage > 1) {
            pageNumbers.unshift(
                <li
                    key="ellipsis-prev"
                    title="Previous 5 Pages"
                    className="mr-2 h-8 min-w-8 flex items-center justify-center rounded-sm cursor-pointer hover:bg-gray-100"
                >
                    <a className="text-pink-600 px-2 py-1" onClick={() => setCurrentPage(Math.max(1, currentPage - maxPagesToShow))}>
                        <div className="relative">
                            <span className="text-gray-400 tracking-wider text-xs absolute inset-0 flex items-center justify-center">•••</span>
                            <svg viewBox="64 64 896 896" className="w-3 h-3 text-pink-700 opacity-0">
                                <path fill="currentColor" d="M533.2 492.3L277.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H188c-6.7 0-10.4 7.7-6.3 12.9L447.1 512 181.7 851.1A7.98 7.98 0 00188 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5zm304 0L581.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H492c-6.7 0-10.4 7.7-6.3 12.9L751.1 512 485.7 851.1A7.98 7.98 0 00492 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5z"></path>
                            </svg>
                        </div>
                    </a>
                </li>
            );
        }

        if (endPage < totalPages) {
            pageNumbers.push(
                <li
                    key="ellipsis-next"
                    title="Next 5 Pages"
                    className="mr-2 h-8 min-w-8 flex items-center justify-center rounded-sm cursor-pointer hover:bg-gray-100"
                >
                    <a className="text-pink-600 px-2 py-1" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + maxPagesToShow))}>
                        <div className="relative">
                            <span className="text-gray-400 tracking-wider text-xs absolute inset-0 flex items-center justify-center">•••</span>
                            <svg viewBox="64 64 896 896" className="w-3 h-3 text-pink-700 opacity-0">
                                <path fill="currentColor" d="M533.2 492.3L277.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H188c-6.7 0-10.4 7.7-6.3 12.9L447.1 512 181.7 851.1A7.98 7.98 0 00188 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5zm304 0L581.9 166.1c-3-3.9-7.7-6.1-12.6-6.1H492c-6.7 0-10.4 7.7-6.3 12.9L751.1 512 485.7 851.1A7.98 7.98 0 00492 864h77.3c4.9 0 9.6-2.3 12.6-6.1l255.3-326.1c9.1-11.7 9.1-27.9 0-39.5z"></path>
                            </svg>
                        </div>
                    </a>
                </li>
            );
        }

        // Always show the last page number if it's not already in the visible range
        if (endPage < totalPages && !pageNumbers.some(li => li.props.title === totalPages.toString())) {
            pageNumbers.push(
                <li
                    key={totalPages}
                    title={totalPages.toString()}
                    className={`mr-2 h-8 min-w-8 flex items-center justify-center rounded-sm cursor-pointer bg-white border border-transparent hover:bg-gray-100`}
                >
                    <a rel="nofollow" className="block px-2 py-1 text-gray-800" onClick={() => setCurrentPage(totalPages)}>
                        {totalPages}
                    </a>
                </li>
            );
        }

        return pageNumbers;
    };

    const handleColumnChange = (columnKey) => {
        if (columnKey === 'reset') {
            setColumnSettings(prev => prev.map(col => ({ ...col, visible: true })));
            return;
        }
        setColumnSettings(prev =>
            prev.map(col =>
                col.key === columnKey ? { ...col, visible: !col.visible } : col
            )
        );
        // add to localStorage
        localStorage.setItem('invoiceColumnSettings', JSON.stringify(columnSettings));
    };

    const renderTableHeader = () => (
        <tr className="text-xs text-gray-700 uppercase">
            <th scope="col" className="px-2 py-3 text-center font-semibold">
                Index
            </th>
            {columnSettings.map(column => column?.visible && (
                <th key={column?.key} scope="col" className="px-2 py-3 text-left font-semibold whitespace-nowrap">
                    <div className="flex items-center justify-between">
                        <span>{column?.title}</span>
                    </div>
                </th>
            ))}
        </tr>
    );

    return (
        <div className="relative">
            <div className={`text-gray-800 text-sm ${collapsed ? "max-w-[calc(100vw-8rem)]" : "max-w-[calc(100vw-18rem)]"} overflow-x-auto bg-white border border-zinc-100 rounded-xl`}>
                <div className="text-gray-800 border-b border-b-zinc-100 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-y-2">
                        <div className="flex-1 min-w-0 pr-2">
                            <h1 className="text-black text-xl">
                                Invoice List
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-2 items-center text-gray-800">
                                <span>Invoice Created At: </span>
                                <Calendar startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} dateFormat={dateFormat} onRight={true} accent={"pink"} />
                            </div>
                            <div>
                                <button onClick={async () => {
                                    setLoadingExport(true);
                                    const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/accounts/invoices/?page=${currentPage - 1}&size=1000000000${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`);
                                    // Export to Excel logic
                                    const ws = XLSX.utils.json_to_sheet(data["result"]["content"].map(item => {
                                        const formattedItem = {};
                                        columnSettings.forEach(col => {
                                            if (col.visible) {
                                                switch (col.key) {
                                                    case 'createdAt':
                                                        formattedItem[col.title] = formatTimestamp(item.insertedTimestamp);
                                                        break;
                                                    case 'invoiceNo':
                                                        formattedItem[col.title] = item.id;
                                                        break;
                                                    case 'soNo':
                                                        formattedItem[col.title] = item.salesOrderId || '';
                                                        break;
                                                    case 'totalAmount':
                                                        formattedItem[col.title] = `${item.totalAmount.toFixed(2)}`;
                                                        break;
                                                    case 'store':
                                                        formattedItem[col.title] = item.storeName;
                                                        break;
                                                    case 'customer':
                                                        formattedItem[col.title] = item.customerName;
                                                        break;
                                                    case 'company':
                                                        formattedItem[col.title] = item.companyName;
                                                        break;
                                                    case 'dba':
                                                        formattedItem[col.title] = item.dbaName;
                                                        break;
                                                    case 'state':
                                                        formattedItem[col.title] = item.state;
                                                        break;
                                                    case 'salesRep':
                                                        formattedItem[col.title] = item.salesRepName;
                                                        break;
                                                    case 'status':
                                                        formattedItem[col.title] = item.status;
                                                        break;
                                                    case 'shipping':
                                                        formattedItem[col.title] = item.shippingStatusName;
                                                        break;
                                                    case 'tags':
                                                        formattedItem[col.title] = item.orderTags ?
                                                            JSON.parse(item.orderTags).map(tag => tag.name).join(', ') : '';
                                                        break;
                                                    case 'dueBalance':
                                                        formattedItem[col.title] = `$${item.dueAmount.toFixed(2)}`;
                                                        break;
                                                    case 'dueDate':
                                                        formattedItem[col.title] = formatTimestamp(item.dueDate);
                                                        break;
                                                    default:
                                                        formattedItem[col.title] = item[col.key] || '';
                                                }
                                            }
                                        });
                                        return formattedItem;
                                    }));
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
                                    XLSX.writeFile(wb, `Invoices_${Date.now()}.xlsx`);
                                    setLoadingExport(false);
                                }} disabled={loading} type="button" className="h-8 bg-pink-700 disabled:bg-pink-100 text-white shadow-sm inline-flex items-center px-4 py-1 gap-2 border border-transparent rounded-sm hover:bg-pink-800">
                                    {loadingExport ? (<Loader height={20} width={20} stroke='white' />) : <Send className="w-4 h-4" />}
                                    <span>Export to Excel Invoice</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className='relative'>
                                    <button title="Column Setting"
                                        onClick={() => setShowColumnSettings(!showColumnSettings)}
                                        className="bg-white shadow-sm inline-flex items-center justify-center border border-gray-300 rounded w-8 h-8 hover:bg-gray-50"
                                    >
                                        <svg viewBox="64 64 896 896" className="w-4 h-4 text-gray-800">
                                            <path fill="currentColor" d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 009.3-35.2l-.9-2.6a443.74 443.74 0 00-79.7-137.9l-1.8-2.1a32.12 32.12 0 00-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 00-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 00-25.8 25.7l-15.8 85.4a351.86 351.86 0 00-99 57.4l-81.9-29.1a32 32 0 00-35.1 9.5l-1.8 2.1a446.02 446.02 0 00-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 00-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0035.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0025.8 25.7l2.7.5a449.4 449.4 0 00159 0l2.7-.5a32.05 32.05 0 0025.8-25.7l15.7-85a350 350 0 0099.7-57.6l81.3 28.9a32 32 0 0035.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35zM788.3 465.9c2.5 15.1 3.8 30.6 3.8 46.1s-1.3 31-3.8 46.1l-6.6 40.1 74.7 63.9a370.03 370.03 0 01-42.6 73.6L721 702.8l-31.4 25.8c-23.9 19.6-50.5 35-79.3 45.8l-38.1 14.3-17.9 97a377.5 377.5 0 01-85 0l-17.9-97.2-37.8-14.5c-28.5-10.8-55-26.2-78.7-45.7l-31.4-25.9-93.4 33.2c-17-22.9-31.2-47.6-42.6-73.6l75.5-64.5-6.5-40c-2.4-14.9-3.7-30.3-3.7-45.5 0-15.3 1.2-30.6 3.7-45.5l6.5-40-75.5-64.5c11.3-26.1 25.6-50.7 42.6-73.6l93.4 33.2 31.4-25.9c23.7-19.5 50.2-34.9 78.7-45.7l37.9-14.3 17.9-97.2c28.1-3.2 56.8-3.2 85 0l17.9 97 38.1 14.3c28.7 10.8 55.4 26.2 79.3 45.8l31.4 25.8 92.8-32.9c17 22.9 31.2 47.6 42.6 73.6L781.8 426l6.5 39.9zM512 326c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176zm79.2 255.2A111.6 111.6 0 01512 614c-29.9 0-58-11.7-79.2-32.8A111.6 111.6 0 01400 502c0-29.9 11.7-58 32.8-79.2C454 401.6 482.1 390 512 390c29.9 0 58 11.6 79.2 32.8A111.6 111.6 0 01624 502c0 29.9-11.7 58-32.8 79.2z"></path>
                                        </svg>
                                    </button>
                                    <ColumnSettingsPopup
                                        visible={showColumnSettings}
                                        onClose={() => setShowColumnSettings(false)}
                                        columns={columnSettings}
                                        onChange={handleColumnChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative overflow-x-auto w-full">
                    <div className="h-fit max-h-[70vh] min-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-zinc-100">
                            <thead className="bg-zinc-50 sticky top-0 z-10">
                                {renderTableHeader()}
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {!loading && invoiceData.map((invoice, index) => (
                                    <tr key={invoice.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                                        <td className="px-2 py-2 text-center">
                                            <span className="text-gray-600">{(currentPage - 1) * pageSize + index + 1}</span>
                                        </td>
                                        {columnSettings.map(column => column?.visible && (
                                            <td key={column?.key} className={`px-2 py-2 whitespace-nowrap ${column?.key === 'totalAmount' || column?.key === 'dueBalance' ? 'text-right' : ''}`}>
                                                {column?.key === 'createdAt' && formatTimestamp(invoice.insertedTimestamp)}
                                                {column?.key === 'invoiceNo' && (
                                                    <div className="flex items-center gap-2">
                                                        <a href={`https://erp.101distributorsga.com/sales/orders/${invoice.id}`} target='_blank' className="text-pink-600 flex flex-row flex-nowrap items-center justify-center gap-2 cursor-pointer hover:underline">{invoice.id}
                                                        </a>
                                                    </div>
                                                )}
                                                {column?.key === 'soNo' && invoice.salesOrderId && (
                                                    <a href={`https://erp.101distributorsga.com/salesOrder/orders/${invoice.salesOrderId}`} target='_blank' className="text-pink-600 cursor-pointer hover:underline">
                                                        {invoice.salesOrderId}
                                                    </a>
                                                )}
                                                {column?.key === 'totalAmount' && `$${invoice.totalAmount.toFixed(2)}`}
                                                {column?.key === 'store' && invoice.storeName}
                                                {column?.key === 'customer' && invoice.customerName}
                                                {column?.key === 'company' && invoice.companyName}
                                                {column?.key === 'dba' && invoice.dbaName}
                                                {column?.key === 'state' && invoice.state}
                                                {column?.key === 'salesRep' && invoice.salesRepName}
                                                {column?.key === 'status' && (
                                                    <span className={`inline-block px-2 py-1 text-xs rounded-sm ${getStatusClassNames(invoice.status)}`}>
                                                        {invoice.status}
                                                    </span>
                                                )}
                                                {column?.key === 'shipping' && (
                                                    <span className={`inline-block px-2 py-1 text-xs rounded-sm ${getShippingStatusClassNames(invoice.shippingStatusName)}`}>
                                                        {invoice.shippingStatusName}
                                                    </span>
                                                )}
                                                {column?.key === 'tags' && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {invoice.orderTags && JSON.parse(invoice.orderTags).map(tag => (
                                                            <span key={tag.id} className={`inline-block px-2 py-1 text-xs rounded-sm ${getTagClassNames(tag.colorCode)}`}>
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {column?.key === 'dueBalance' && `$${invoice.dueAmount.toFixed(2)}`}
                                                {column?.key === 'dueDate' && formatTimestamp(invoice.dueDate)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {loading && (<div rowSpan={15} className="px-4 py-2 text-center w-full h-32 flex items-center justify-center text-gray-500">
                            <LoaderPinwheel className="w-8 h-8 text-gray-400 animate-spin" />
                            <span className="ml-2">Loading invoices...</span>
                        </div>)}
                    </div>
                </div>
                <ul className="flex items-center justify-end my-4 px-4 text-sm text-gray-800">
                    <li title="Previous Page" className="mr-2 h-8 min-w-8 flex items-center justify-center rounded-sm">
                        <button
                            className="h-full w-full bg-transparent border border-transparent rounded-sm flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            <svg viewBox="64 64 896 896" className="w-3 h-3 text-gray-800 disabled:text-gray-400">
                                <path fill="currentColor" d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8a31.86 31.86 0 000 50.3l450.8 352.1c5.3 4.1 12.9.4 12.9-6.3v-77.3c0-4.9-2.3-9.6-6.1-12.6l-360-281 360-281.1c3.8-3 6.1-7.7 6.1-12.6z"></path>
                            </svg>
                        </button>
                    </li>

                    {renderPageNumbers()}

                    <li title="Next Page" className="h-8 min-w-8 flex items-center justify-center rounded-sm">
                        <button
                            className="h-full w-full bg-transparent border border-transparent rounded-sm flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            <svg viewBox="64 64 896 896" className="w-3 h-3 text-gray-800 disabled:text-gray-400">
                                <path fill="currentColor" d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"></path>
                            </svg>
                        </button>
                    </li>

                    <li className="ml-4">
                        <div className="relative h-8 inline-block">
                            <CustomDropdown
                                options={[{ label: '10 / page', value: 10 }, { label: '20 / page', value: 20 }, { label: '50 / page', value: 50 }, { label: '100 / page', value: 100 }, { label: '500 / page', value: 500 }]}
                                placeholder="10 / page"
                                optionUp={true}
                                value={pageSize}
                                className="h-full w-24 bg-white border border-neutral-300 rounded-sm px-2 pr-6 appearance-none focus:outline-none focus:border-pink-500"
                                onChange={setPageSize}
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"></path>
                                </svg>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>

        </div>
    );
};

export default Invoice;