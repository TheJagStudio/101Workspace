import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { useAtom } from 'jotai';
import { searchAtom } from '../../../Variables';
import { apiRequest } from '../../../utils/api';
import * as XLSX from 'xlsx';
import { SheetIcon } from 'lucide-react';
import { Button } from "../../../Components/ui/button";
import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../Components/ui/popover";
import { Calendar } from "../../../Components/ui/calendar";
import { Label } from "../../../Components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../../../Components/ui/accordion";

const Loader = ({ height, width }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
        <g data-idx={1}>
            <circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} data-idx={2} transform="rotate(-72 50 50)" />
            <g data-idx={4} />
        </g>
    </svg>
);

const ClearanceLoss = () => {
    const [selectedDate, setSelectedDate] = useState("07/01/2025");
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useAtom(searchAtom);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    const [datePickerOpen, setDatePickerOpen] = useState(false);

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

    // Export to Excel handler
    function handleExportExcel() {
        if (!report || !report.monthlyBreakdown) return;
        const workbook = XLSX.utils.book_new();
        Object.entries(report.monthlyBreakdown).forEach(([month, data]) => {
            // Prepare rows for the sheet
            let rows = data.productLoss.map(prod => ({
                'Product ID': prod.productId,
                'Name': prod.name,
                'Loss': prod.loss,
                'Qty Sold @ Loss': prod.quantitySoldAtLoss,
                'Original Cost Min': prod.originalCostMin,
                'Original Cost Max': prod.originalCostMax,
                'Selling Price Min': prod.currentCostMin,
                'Selling Price Max': prod.currentCostMax,
            }));
            // add a total row at bottom
            if (data.productLoss.length > 0) {
                const totalLoss = data.productLoss.reduce((sum, prod) => sum + (prod.loss || 0), 0);
                const totalQty = data.productLoss.reduce((sum, prod) => sum + (prod.quantitySoldAtLoss || 0), 0);
                rows.push({
                    'Product ID': '',
                    'Name': 'Total',
                    'Loss': totalLoss,
                    'Qty Sold @ Loss': totalQty,
                    'Original Cost Min': '',
                    'Original Cost Max': '',
                    'Selling Price Min': '',
                    'Selling Price Max': '',
                });
            }
            const worksheet = XLSX.utils.json_to_sheet(rows);
            let sheetName = month.replace(/[:\\/?*[\]]/g, "").substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });
        const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        XLSX.writeFile(workbook, `Loss-Report-for-Clearance-products_${dateStr}.xlsx`);
    }

    return (
        <div className="px-5">
            <div className='flex items-center justify-between mb-4'>
                <p className="text-3xl font-semibold text-gray-700 mb-2">Monthly Clearance Loss Report</p>
                <div className="flex items-center gap-4">
                    {/* Shadcn Date Picker */}
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="date" className="px-1">Select Month</Label>
                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    id="date"
                                    className="w-44 justify-between font-normal hover:bg-white hover:ring-2 hover:ring-indigo-500 cursor-pointer"
                                >
                                    {new Date(selectedDate).toLocaleDateString()}
                                    <ChevronDownIcon />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate ? new Date(selectedDate) : undefined}
                                    captionLayout="dropdown"
                                    onSelect={date => {
                                        if (date) setSelectedDate(date);
                                        setDatePickerOpen(false);
                                    }}
                                    max={new Date()}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button
                        onClick={handleExportExcel}
                        variant="success"
                        disabled={!report}
                        className="flex gap-1 items-center mt-4 bg-green-700 hover:bg-green-800 cursor-pointer text-white"
                    >
                        <SheetIcon className='h-5 w-5' />
                        Export to Excel
                    </Button>
                </div>
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
                        <Accordion type="single" collapsible>
                            {Object.entries(report.monthlyBreakdown).map(([month, data]) => (
                                <AccordionItem key={month} value={month} className="bg-white rounded-lg shadow p-4 mb-2">
                                    <AccordionTrigger className="flex justify-between items-center cursor-pointer px-0 py-0 bg-transparent border-none hover:no-underline">
                                        <div>
                                            <span className="text-lg font-semibold">{month}</span>
                                            <span className="ml-4 text-lg text-red-600 font-bold">{data.totalLoss?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="mt-4">
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
                                                                className="p-2 text-center cursor-pointer select-none"
                                                                onClick={() => handleSort('originalCost')}
                                                            >
                                                                Original Cost
                                                                {sortConfig.key === 'originalCost' && (
                                                                    <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                                                                )}
                                                            </th>
                                                            <th
                                                                className="p-2 text-center cursor-pointer select-none"
                                                                onClick={() => handleSort('currentCost')}
                                                            >
                                                                Selling Price
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
                                                                <td className="p-2 text-center">{prod.quantitySoldAtLoss}</td>
                                                                {prod?.originalCostMin !== prod?.originalCostMax ? (<td className="p-2 text-right">{prod.originalCostMin?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} - {prod.originalCostMax?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>) : (
                                                                    <td className="p-2 text-center">{prod.originalCostMin?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                                                                )}
                                                                {prod?.currentCostMin !== prod?.currentCostMax ? (<td className="p-2 text-right">{prod.currentCostMin?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} - {prod.currentCostMax?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>) : (
                                                                    <td className="p-2 text-center">{prod.currentCostMin?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                                                                )}
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
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
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