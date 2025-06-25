import { addDays } from "date-fns";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import Calendar from "../../../Components/utils/Calendar";
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from "../../../utils/api";
import { glossaryAtom, isSidebarOpenAtom } from "../../../Variables";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

const dropdownOptions = {
	reportType: [
		{ value: "product", label: "Product" },
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
		{ value: "gross_margin", label: "Gross Profit" },
		{ value: "inventory_cost", label: "Inventory cost" },
	],
};

const Loader = ({ height, width }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
		<g data-idx={1}>
			<circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} data-idx={2} transform="rotate(-72 50 50)" />
			<g data-idx={4} />
		</g>
	</svg>
);

const tabData = {
	historical: {
		tabInfo: "Historical measures are based on sales data within the selected date range.",
		measures: [
			{
				measure: "Items sold per day",
				definition: "Average number of items sold per day",
			},
			{
				measure: "Items sold",
				definition: "Total number of items sold minus returns",
			},
			{
				measure: "Days cover",
				definition: "Estimated number of days current inventory will last based on items sold per day",
			},
			{
				measure: "Avg. cost",
				definition: "Average cost of an item as at the end of the reporting period, calculated from the start of the item's lifecycle",
			},
		],
	},
	other: {
		tabInfo: "Historical measures are based on sales data within the selected date range.",
		measures: [
			{
				measure: "Closing inventory",
				definition: "Amount of inventory as at the end of the reporting period",
			},
			{
				measure: "Inbound inventory",
				definition: "Amount of incoming inventory from dispatched purchase orders and sent transfers",
			},
		],
	},
};

const Summary = () => {
	const [reportType, setReportType] = useState("product");
	const [measure, setMeasure] = useState("all");
	const [sortBy, setSortBy] = useState("closing_inventory");
	const [reverseSort, setReverseSort] = useState(true);
	const [subCategoryVisible, setSubCategoryVisible] = useState(false);
	const [startDate, setStartDate] = useState(new Date());
	const [endDate, setEndDate] = useState(addDays(new Date(), 7));
	const [tableData, setTableData] = useState([]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);
	const [totalClosingInventory, setTotalClosingInventory] = useState(0);
	const [totalRevenue, setTotalRevenue] = useState(0);
	const [totalGrossMargin, setTotalGrossMargin] = useState(0);
	const [totalInventoryCost, setTotalInventoryCost] = useState(0);
	const [loadingTotal, setLoadingTotal] = useState(false);
	const [loading, setLoading] = useState(true);
	const [totalPages, setTotalPages] = useState(0);
	const [openGlossary, setOpenGlossary] = useAtom(glossaryAtom);

	async function getData() {
		setLoading(true);
		try {
			const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/inventory-summary/?report_type=${reportType}&measure=${measure}&start_date=${startDate}&end_date=${endDate}&sort_by=${sortBy}&page=${page}&page_size=${pageSize}&dataType=child&reverse_sort=${reverseSort}&loadSubcategories=${subCategoryVisible}`);
			setTableData(data["data"]);
			setTotalPages(data["totalPages"]);
		} catch (error) {
			setTableData([]);
			console.error("Error fetching inventory summary data:", error);
		} finally {
			setLoading(false);
		}
	}

	function formatCurrency(value) {
		value = Number(value);
		return value ? value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }) : "$0.00";
	}

	function formatNumber(value) {
		return value ? Number(value).toLocaleString("en-US") : "0";
	}

	useEffect(() => {
		getData();
	}, [page, pageSize, reverseSort, sortBy, measure, reportType, subCategoryVisible]);

	useEffect(() => {
		async function totalData() {
			try {
				const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/inventory-summary/?report_type=${reportType}&measure=${measure}&start_date=${startDate}&end_date=${endDate}&sort_by=${sortBy}&page=${page}&page_size=${pageSize}&dataType=total`);
				setTotalClosingInventory(data["totalClosingInventory"]);
				setTotalRevenue(data["totalRevenue"]);
				setTotalInventoryCost(data["totalInventoryCost"]);
				setTotalGrossMargin(data["totalGrossMargin"]);
			} catch (error) {
				setTableData([]);
				console.error("Error fetching inventory summary data:", error);
			}
			setLoadingTotal(false);
		}
		setLoadingTotal(true);
		totalData();
	}, [measure]);

	useEffect(() => {
		setOpenGlossary({
			open: false,
			tabData: tabData,
		});
	}, []);

	return (
		<div className="px-5">
			<p className="text-3xl font-semibold text-gray-700"> Inventory Summary</p>
			<div className={"bg-white select-none w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1 " + (loading ? "opacity-50 pointer-events-none" : "")}>
				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Report type</label>
					<CustomDropdown options={dropdownOptions.reportType} value={reportType} onChange={setReportType} placeholder="report type" />
				</div>
				{reportType === "category" && (
					<svg
						className={"bg-indigo-500 px-2 py-1.5 rounded-md hover:bg-indigo-600 cursor-pointer" + (subCategoryVisible ? " text-white" : " text-gray-200 opacity-50")}
						onClick={() => {
							setSubCategoryVisible(!subCategoryVisible);
						}}
						width={40}
						height={40}
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x={9}
							y={2}
							width={6}
							height={6}
							rx={1}
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M4 18v-4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<circle
							cx={4}
							cy={20}
							r={2}
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<circle
							cx={20}
							cy={20}
							r={2}
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<circle
							cx={12}
							cy={20}
							r={2}
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M12 8v10"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}

				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Measure</label>
					<CustomDropdown options={dropdownOptions.measure} value={measure} onChange={setMeasure} placeholder="measure" />
				</div>

				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Sort by</label>
					<CustomDropdown options={dropdownOptions.sort} value={sortBy} onChange={setSortBy} placeholder="sort by" />
				</div>

				{/* button for reverse sorting */}

				<svg
					className="bg-indigo-500 text-white px-2 py-1.5 rounded-md hover:bg-indigo-600 cursor-pointer"
					onClick={() => {
						setReverseSort(!reverseSort);
					}}
					width={40}
					height={40}
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path fill="currentColor" fillOpacity={reverseSort ? "40%" : "100%"} d="M12.324 9H7.676c-.563 0-.878-.603-.53-1.014L9.468 5.24a.708.708 0 0 1 1.062 0l2.323 2.746c.349.411.033 1.014-.53 1.014" />
					<path fill="currentColor" fillOpacity={!reverseSort ? "40%" : "100%"} d="M7.676 11h4.648c.563 0 .879.603.53 1.014l-2.323 2.746a.708.708 0 0 1-1.062 0l-2.324-2.746C6.798 11.603 7.113 11 7.676 11" />
				</svg>
				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Analysis Period</label>
					<Calendar startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} dateFormat="yyyy-MM-dd" />
				</div>
				<button
					onClick={() => {
						getData();
					}}
					className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-700"
				>
					Search
				</button>
				{/* info button */}
				<svg
					width={30}
					height={30}
					onClick={() => {
						setOpenGlossary({
							open: true,
							tabData: tabData,
						});
					}}
					className="mb-1 text-indigo-500 ring-2 ring-offset-2 rounded-full cursor-pointer hover:scale-110"
					viewBox="0 0 48 48"
					xmlns="http://www.w3.org/2000/svg"
				>
					<circle fill="currentColor" cx={24} cy={24} r={21} />
					<path fill="#fff" d="M22 22h4v11h-4z" />
					<circle fill="#fff" cx={24} cy={16.5} r={2.5} />
				</svg>
			</div>

			<div className={"mt-5 relative bg-white border-t border-gray-300 w-full h-[calc(100vh-23rem)] rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500 " + (collapsed ? "max-w-[calc(100vw-10rem)]" : "max-w-[calc(100vw-18rem)]")}>
				{loading && (
					<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
						<Loader height={60} width={60} />
					</div>
				)}
				<div className="h-full overflow-y-auto">
					<table className={"w-full " + (loading ? "opacity-50 pointer-events-none" : "")} borderWidth={2}>
						<thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
							<tr className="border-b border-gray-300 bg-gray-100">
								<th className="w-fit"></th>
								<th className="w-[50%]"></th>
								<th className="text-center p-4 border-l border-gray-300">Total</th>
								<th colSpan={3} className="text-center p-4 border-l border-gray-300">
									Historical
								</th>
							</tr>
							<tr className="border-b border-gray-300 leading-4">
								<th className="text-center py-4 px-1">SR</th>
								<th className="text-left p-4 border-l border-gray-300 w-[50%]">Product</th>
								<th className="text-center p-4 border-l border-gray-300">Closing inventory</th>
								<th className="text-center p-4 border-l border-gray-300">
									Revenue <br />
									<span className="font-medium text-sm">(till day)</span>
								</th>
								<th className="text-center p-4 border-l border-gray-300">
									Gross Profit <br />
									<span className="font-medium text-sm">(till day)</span>
								</th>
								<th className="text-center p-4 border-l border-gray-300">Inventory cost</th>
							</tr>
							<tr className="font-semibold bg-gray-100">
								<td className="py-2 px-1 "></td>
								<td className="py-2 px-4 w-[50%] border-l border-gray-300">Totals</td>
								<td className="text-center py-2 px-2 border-l border-gray-300">{loadingTotal ? <Loader /> : formatNumber(totalClosingInventory)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-300">{loadingTotal ? <Loader /> : formatCurrency(totalRevenue)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-300">{loadingTotal ? <Loader /> : formatCurrency(totalGrossMargin)}</td>
								<td className="text-center py-2 px-2 border-l border-gray-300">{loadingTotal ? <Loader /> : formatCurrency(totalInventoryCost)}</td>
							</tr>
						</thead>
						<PhotoProvider>
							<tbody className="h-64 overflow-y-auto">
								{tableData.map((item, index) => (
									<tr className={"hover:bg-indigo-50 border-b border-gray-300 group " + (index % 2 === 0 ? "" : "bg-gray-100")} key={index}>
										<td className="py-2 px-1 w-fit text-center">
											<p className="text-sm text-gray-600">{item?.index}</p>
										</td>
										<td className="py-2 px-2 w-[50%] border-l border-gray-300">
											<div className="flex items-center">
												{pageSize <= 50 &&
													<PhotoView src={item?.imageUrl ? item.imageUrl : '/static/images/default.png'}>
														<img
															src={item?.imageUrl ? item.imageUrl : '/static/images/default.png'}
															alt={item?.productName}
															className="w-8 h-8 mr-2"

														/>
													</PhotoView>}

												<a target="_blank" href={"https://erp.101distributorsga.com/product/" + item?.id + "/edit"} className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer">
													({item?.id})
												</a>
												<p className="truncate whitespace-break-spaces h-6 group-hover:h-fit">{item?.name}</p>
											</div>
										</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatNumber(item?.closingInventory)}</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatCurrency(item?.revenue)}</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatCurrency(item?.grossProfit)}</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatCurrency(item?.inventoryCost)}</td>
									</tr>
								))}
								{tableData.length === 0 && !loading && (
									<tr>
										<td colSpan={6} className="text-center py-4 text-gray-500">No data available</td>
									</tr>
								)}
							</tbody>
						</PhotoProvider>
					</table>
				</div>
			</div>
			{tableData.length > 0 && !loading && (
				<div className={"flex items-center justify-between mt-5 gap-5" + (loading ? " opacity-50 pointer-events-none" : "")}>
					<div className="bg-white w-fit h-fit rounded-lg shadow-lg ml-auto">
						{/* add the pagination UI */}
						<div className="flex items-center justify-between p-2">
							<div className="flex items-center gap-2">
								<button onClick={() => setPage(page > 1 ? page - 1 : 1)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
									<svg width={20} height={20} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
										<path fill="currentColor" stroke="currentColor" strokeWidth={75} d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8z" />
									</svg>
								</button>
								<span className="text-sm text-gray-600">
									Page {page} of {totalPages}
								</span>
								<button onClick={() => setPage(page < totalPages ? page + 1 : totalPages)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
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
								{ value: 500, label: "500" },
							]}
							optionUp={true}
							value={pageSize}
							onChange={setPageSize}
							placeholder="Page Size"
						/>
					</div>
				</div>
			)}
		</div>
	);
};

export default Summary;
