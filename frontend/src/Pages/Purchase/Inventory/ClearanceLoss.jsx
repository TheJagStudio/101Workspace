import React, { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { useAtom } from 'jotai';
import { searchAtom } from '../../../Variables';
import { apiRequest } from '../../../utils/api';

const Loader = ({ height, width }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
        <g data-idx={1}>
            <circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} data-idx={2} transform="rotate(-72 50 50)" />
            <g data-idx={4} />
        </g>
    </svg>
);

const ClearanceLoss = () => {
    const [selectedDate, setSelectedDate] = useState("2025-07-01");
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedMonth, setExpandedMonth] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useAtom(searchAtom);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

    // Fetch report data when selectedDate changes
    useEffect(() => {
        async function fetchReport() {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams({
                    startDate: selectedDate
                });
                const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/clearance-loss-report/?${params}`);
                if (data) {
                    setReport(data);
                } else {
                    setError(data?.error || 'Failed to fetch report');
                }
            } catch (e) {
                setError('Network error');
            }
            setLoading(false);
        }
        fetchReport();
    }, [selectedDate]);

    // Sorting function
    function getSortedProducts(products) {
        if (!sortConfig.key) return products;
        return [...products].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            // Handle nulls for currentCost
            if (valA === null) valA = -Infinity;
            if (valB === null) valB = -Infinity;
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function handleSort(key) {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    }

    return (
        <div className="px-5">
            <div className='flex items-center justify-between mb-4'>
                <p className="text-3xl font-semibold text-gray-700 mb-2">Monthly Clearance Loss Report</p>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-white border rounded px-2 py-1"
                    max={format(new Date(), 'yyyy-MM-dd')}
                />
            </div>
            {loading && (
                <div className="flex justify-center items-center h-32">
                    <Loader height={40} width={40} />
                </div>
            )}
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {report && (
                <div>
                    <div className="mb-4">
                        <span className="text-lg font-semibold text-gray-700">Overall Total Loss: </span>
                        <span className="text-xl font-bold text-red-600">{report.overallTotalLoss?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                    </div>
                    <div className="flex flex-col gap-4">
                        {Object.entries(report.monthlyBreakdown).map(([month, data]) => (
                            <div key={month} className="bg-white rounded-lg shadow p-4">
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedMonth(expandedMonth === month ? null : month)}>
                                    <div>
                                        <span className="text-lg font-semibold">{month}</span>
                                        <span className="ml-4 text-red-600 font-bold">{data.totalLoss?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                    </div>
                                    <button className="text-indigo-500 hover:underline">
                                        {expandedMonth === month ? 'Hide Details' : 'Show Details'}
                                    </button>
                                </div>
                                {expandedMonth === month && (
                                    <div className="mt-4">
                                        <div className="relative bg-white w-full rounded-lg shadow-inner overflow-hidden text-gray-700">
                                            <PhotoProvider>
                                                <table className="w-full">
                                                    <thead className="sticky top-0 bg-white z-10 shadow-border-b">
                                                        <tr className="shadow-border-b bg-gray-100">
                                                            <th className="p-2 text-center">Image</th>
                                                            <th className="p-2 text-left">ID</th>
                                                            <th className="p-2 text-left">Name</th>
                                                            <th
                                                                className="p-2 text-right cursor-pointer select-none"
                                                                onClick={() => handleSort('loss')}
                                                            >
                                                                Loss
                                                                {sortConfig.key === 'loss' && (
                                                                    <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                                                                )}
                                                            </th>
                                                            <th
                                                                className="p-2 text-right cursor-pointer select-none"
                                                                onClick={() => handleSort('quantitySoldAtLoss')}
                                                            >
                                                                Qty Sold @ Loss
                                                                {sortConfig.key === 'quantitySoldAtLoss' && (
                                                                    <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                                                                )}
                                                            </th>
                                                            <th
                                                                className="p-2 text-right cursor-pointer select-none"
                                                                onClick={() => handleSort('originalCost')}
                                                            >
                                                                Original Cost
                                                                {sortConfig.key === 'originalCost' && (
                                                                    <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                                                                )}
                                                            </th>
                                                            <th
                                                                className="p-2 text-right cursor-pointer select-none"
                                                                onClick={() => handleSort('currentCost')}
                                                            >
                                                                Current Cost
                                                                {sortConfig.key === 'currentCost' && (
                                                                    <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                                                                )}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {getSortedProducts(data.productLoss).map((prod, idx) => (
                                                            <tr key={prod.productId} className={"group shadow-border-b " + (idx % 2 === 0 ? "" : "bg-gray-100")}>
                                                                <td className="p-2 text-center">
                                                                    <PhotoView src={prod.imageUrl || '/static/images/default.png'}>
                                                                        <img
                                                                            src={prod.imageUrl || '/static/images/default.png'}
                                                                            alt={prod.name}
                                                                            className="w-8 h-8 rounded shadow inline-block mix-blend-multiply"
                                                                        />
                                                                    </PhotoView>
                                                                </td>
                                                                <td className="p-2">
                                                                    <a
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        href={`https://erp.101distributorsga.com/product/${prod.productId}/edit`}
                                                                        className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer"
                                                                    >
                                                                        ({prod.productId})
                                                                    </a>
                                                                </td>
                                                                <td className="p-2">
                                                                    <span
                                                                        className="truncate whitespace-break-spaces h-6 group-hover:h-fit cursor-pointer"
                                                                        onClick={() => {
                                                                            setSearch(prod.name);
                                                                            document.querySelector("#search")?.focus();
                                                                        }}
                                                                    >
                                                                        {prod.name}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 text-right text-red-600">{prod.loss?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                                                                <td className="p-2 text-right">{prod.quantitySoldAtLoss}</td>
                                                                <td className="p-2 text-right">{prod.originalCost?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                                                                <td className="p-2 text-right">{prod.currentCost !== null ? prod.currentCost?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                                                            </tr>
                                                        ))}
                                                        {data.productLoss.length === 0 && (
                                                            <tr>
                                                                <td colSpan={7} className="p-2 text-center text-gray-500">No products found</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </PhotoProvider>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {Object.keys(report.monthlyBreakdown).length === 0 && (
                            <div className="text-gray-500">No monthly data available.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClearanceLoss;