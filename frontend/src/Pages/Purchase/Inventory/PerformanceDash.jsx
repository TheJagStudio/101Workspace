import React, { useEffect, useState } from "react";
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from "../../../utils/api";
import { useAtom } from "jotai";
import { isSidebarOpenAtom } from "../../../Variables";

const dropdownOptions = {
    reportType: [
        { value: "product", label: "Product" },
        { value: "supplier", label: "Supplier" },
        { value: "category", label: "Category" },
    ],
    measure: [
        { value: "all", label: "All inventory" },
        { value: "hand", label: "On-hand inventory" },
        { value: "low", label: "Low inventory" },
        { value: "out", label: "Out of stock" },
    ],
    sort: [
        { value: "closing_inventory", label: "Closing inventory" },
        { value: "revenue", label: "Revenue" },
        { value: "inventory_cost", label: "Inventory cost" },
    ]
};
const PerformanceDash = () => {
    const [reportType, setReportType] = useState("product");
    const [measure, setMeasure] = useState("all");
    const [sortBy, setSortBy] = useState("closing_inventory");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [tableData, setTableData] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);

    async function getData() {
        try {
            const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/inventory-summary/?report_type=${reportType}&measure=${measure}&start_date=${startDate}&end_date=${endDate}&sort_by=${sortBy}&page=${page}&page_size=${pageSize}`);
            setTableData(data["data"]);
        } catch (error) {
            setTableData([]);
            console.error("Error fetching inventory summary data:", error);
        }
    }

    // Helper function to format numbers as currency with commas
    function formatCurrency(value) {
        return value
            ? value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
            : "$0.00";
    }

    // Helper function to format numbers with commas (no currency)
    function formatNumber(value) {
        return value ? Number(value).toLocaleString("en-US") : "0";
    }

    useEffect(() => {
        getData();
    }, [page, pageSize]);

    return (
			<div className="px-5">
				<p className="text-3xl font-semibold text-gray-700"> Inventory Performance</p>
				<div className="bg-white w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1">
					<div className="flex flex-col">
						<label className="text-sm text-gray-600 mb-1">Report type</label>
						<CustomDropdown options={dropdownOptions.reportType} value={reportType} onChange={setReportType} placeholder="report type" />
					</div>

					<div className="flex flex-col">
						<label className="text-sm text-gray-600 mb-1">Measure</label>
						<CustomDropdown options={dropdownOptions.measure} value={measure} onChange={setMeasure} placeholder="measure" />
					</div>

					<div className="flex flex-col">
						<label className="text-sm text-gray-600 mb-1">Sort by</label>
						<CustomDropdown options={dropdownOptions.sort} value={sortBy} onChange={setSortBy} placeholder="sort by" />
					</div>

					<div className="flex flex-col">
						<label className="text-sm text-gray-600 mb-1">Start date</label>
						<input type="date" className="border border-gray-300 focus:outline-none focus:border-indigo-500 rounded-md px-3 py-1.5 w-48" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
					</div>
					<div className="flex flex-col">
						<label className="text-sm text-gray-600 mb-1">End date</label>
						<input type="date" className="border border-gray-300 focus:outline-none focus:border-indigo-500 rounded-md px-3 py-1.5 w-48" value={endDate} onChange={(e) => setEndDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
					</div>

					<button
						onClick={() => {
							getData();
						}}
						className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-700"
					>
						Search
					</button>
				</div>

				<div className={"mt-5 bg-white border-t border-gray-200 w-full h-[calc(100vh-23rem)] rounded-lg shadow-md overflow-y-scroll text-gray-700 transition-all duration-500 " + (collapsed ? "max-w-[calc(100vw-10rem)]" : "max-w-[calc(100vw-18rem)]")}>
					<table className="w-full " borderWidth={2}>
						<thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
							<tr className="border-b border-gray-200 bg-gray-100">
								<th className="w-[20%]"></th>
								<th className="text-center p-4 border-l border-gray-200">Total</th>
								<th colSpan={9} className="text-center p-4 border-l border-gray-200">
									Historical
								</th>
							</tr>
							<tr className="border-b border-gray-200 ">
								<th className="text-left p-4 flex items-center w-[20%]">Product</th>
								<th className="text-center p-4 border-l border-gray-200 whitespace-nowrap">Closing inventory</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Items sold per day</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Items sold</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Days cover</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Sell-through rate</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Revenue</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Gross profit</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Margin (%)</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Inventory cost</th>
								<th className="text-center p-4 border-l border-gray-200 text-sm">Retail value (excl. tax)</th>
							</tr>
							<tr className="font-semibold bg-gray-100">
								<td className="py-2 px-2 w-[20%]">Totals</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(180871)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(0)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(757665.43)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(0)}</td>
							</tr>
						</thead>
						<tbody className="h-64 overflow-y-auto">
							{tableData.map((item, index) => (
								<tr className={"hover:bg-indigo-50 border-b border-gray-200 " + (index % 2 === 0 ? "" : "bg-gray-100")} key={index}>
									<td className="py-2 px-2 w-[20%]">
										<div className="flex items-center">
											<img src={item?.imageUrl || "/static/images/default.png"} alt="" className="w-8 h-8 mr-2" />
											<p className="truncate">{item?.name}</p>
										</div>
									</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.closingInventory)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.itemsSoldPerDay)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.itemsSold)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.daysCover)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.sellThroughRate)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(item?.revenue)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(item?.grossProfit)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatNumber(item?.marginPercent)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(item?.inventoryCost)}</td>
									<td className="text-center py-2 px-2 border-l border-gray-200">{formatCurrency(item?.retailValueExclTax)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="flex items-center justify-between mt-5 gap-5">
					<div className="bg-white w-fit h-fit rounded-lg shadow-lg ml-auto">
						{/* add the pagination UI */}
						<div className="flex items-center justify-between p-2">
							<div className="flex items-center gap-2">
								<button onClick={() => setPage(page > 1 ? page - 1 : 1)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
									<svg width={20} height={20} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
										<path fill="currentColor" stroke="currentColor" strokeWidth={75} d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8z" />
									</svg>
								</button>
								<span className="text-sm text-gray-600">Page {page}</span>
								<button onClick={() => setPage(page + 1)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
									<svg width={20} height={20} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="rotate-180">
										<path fill="currentColor" stroke="currentColor" strokeWidth={75} d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8z" />
									</svg>
								</button>
							</div>
						</div>
					</div>
					<div className="bg-white w-fit h-fit rounded-lg shadow-lg p-2 flex items-center">
						{/* set page size */}
						<label className="text-sm text-gray-600 mr-2">Page Size:</label>
						<CustomDropdown
							options={[
								{ value: 10, label: "10" },
								{ value: 20, label: "20" },
								{ value: 50, label: "50" },
								{ value: 100, label: "100" },
							]}
							optionUp={true}
							value={pageSize}
							onChange={setPageSize}
							placeholder="Page Size"
						/>
					</div>
				</div>
			</div>
		);
};

export default PerformanceDash;
