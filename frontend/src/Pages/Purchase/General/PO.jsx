import { useState, useEffect, use } from 'react';
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from '../../../utils/api';
import { useAtom } from 'jotai';
import { glossaryAtom, isSidebarOpenAtom } from "../../../Variables";
import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


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

const VendorList = ({ data, setSelectedVendors, index }) => {
	const [openDropdown, setOpenDropdown] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [hoveredIndex, setHoveredIndex] = useState(0);
	const [selectedVendor, setSelectedVendor] = useState(data?.[0] || null);
	const [hoveredVendor, setHoveredVendor] = useState(data?.[0] || null);


	const handleSelect = (idx) => {
		setSelectedIndex(idx);
		setOpenDropdown(false);
	};

	useEffect(() => {
		setSelectedVendor(data?.[selectedIndex] || null);
		setHoveredVendor(data?.[hoveredIndex] || null);
	}, [selectedIndex, hoveredIndex]);

	useEffect(() => {
		setSelectedVendors((prev) => {
			const newVendors = [...prev];
			newVendors[index] = selectedIndex;
			return newVendors;
		});
	}, [selectedIndex]);

	if (!data || data.length === 0) return <span className="text-gray-400 w-full ml-2">No vendors</span>;
	if (data.length > 1) {
		return (
			<div className="relative w-full" onMouseLeave={() => setOpenDropdown(false)}>
				<button
					type="button"
					className={"flex items-center gap-2 w-full h-9 px-2 py-1 justify-between rounded border border-gray-300 text-left " + (selectedIndex !== 0 ? "border-red-400 bg-red-50" : "border-gray-300 bg-white hover:bg-gray-50")}
					onClick={() => setOpenDropdown((v) => !v)}
				>
					<span className="text-sm text-gray-700 text-left truncate">{selectedVendor?.name}</span>
					<span className="text-sm text-gray-700 mr-5 font-bold">{selectedVendor?.prices?.[0]?.price}</span>
					<svg className="w-4 h-4 absolute right-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{openDropdown && (
					<div className="absolute -left-1 z-20 pt-1 pl-1 w-full ">
						<div className='py-1 bg-white border border-gray-200 rounded shadow-xl max-h-40 overflow-auto'>
							{data.map((item, idx) => {
								return (
									<div
										key={idx}
										className={`flex items-center justify-between gap-2 px-2 py-1 border-b border-gray-200 cursor-pointer ${idx === selectedIndex ? "bg-indigo-500 text-white hover:bg-indigo-500" : "text-gray-700 hover:bg-indigo-100"}`}
										onClick={() => handleSelect(idx)}
										onMouseEnter={() => setHoveredIndex(idx)}
									>
										<span className="text-sm text-left truncate">{item?.name}</span>
										<span className="text-sm font-bold">{item?.prices?.[0]?.price}</span>
									</div>
								);
							})}
						</div>
					</div>
				)}
				{openDropdown && (
					<div className='absolute z-20 top-0 -left-0 pr-1 -translate-x-full'>
						<div className='flex flex-col min-w-32 w-fit p-2 h-46 bg-white border border-gray-200 rounded-md shadow-xl items-center justify-center'>
							<p className="text-gray-700 text-xs whitespace-nowrap font-bold">{hoveredVendor?.name}</p>
							<ResponsiveContainer width="100%" height="100%">
								<BarChart width={150} height={40} data={hoveredVendor?.prices && hoveredVendor?.prices.sort((a, b) => new Date(a.date) - new Date(b.date)).map(price => ({
									date: price.date,
									price: price.price,
								}))}>
									<Tooltip
										contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '2px', borderRadius: '4px', fontSize: '12px', gap: '2px' }}
										content={({ active, payload }) => {
											if (active && payload && payload.length) {
												return (
													<div className="flex flex-col w-fit h-fit p-1 font-semibold rounded bg-white shadow">
														<span className="text-gray-700 text-left text-xs">${payload[0]?.payload?.price}</span>
														<span className="text-gray-500 text-left text-xs ">{payload[0]?.payload?.date}</span>
													</div>
												);
											}
											return null;
										}}
										cursor="pointer"
									/>
									<Bar dataKey="price" fill="#615fff" />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</div>
				)}
			</div>
		);
	} else {
		return (
			<div className="flex items-center justify-between gap-2 px-2 py-1 w-full">
				<span className="text-sm text-gray-700 text-left truncate">{selectedVendor?.name}</span>
				<span className="text-sm text-gray-700 font-bold">{selectedVendor?.price}</span>
			</div>
		);
	}

}

const PO = () => {
	const [reportType, setReportType] = useState("product");
	const [measure, setMeasure] = useState("all");
	const [loading, setLoading] = useState(false);
	const [categories, setCategories] = useState([]);
	const [currentMasterCategory, setCurrentMasterCategory] = useState(null);
	const [currentCategory, setCurrentCategory] = useState(null);
	const [currentSubCategory, setCurrentSubCategory] = useState(null);
	const [currentVendor, setCurrentVendor] = useState(null);
	const [vendors, setVendors] = useState([]);
	const [tableData, setTableData] = useState([]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);
	const [totalPages, setTotalPages] = useState(0);
	const [selectedVendors, setSelectedVendors] = useState([]);

	function formatCurrency(value) {
		value = Number(value);
		return value ? value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }) : "$0.00";
	}

	function formatNumber(value) {
		return value ? Number(value).toLocaleString("en-US") : "0";
	}

	function formatPercentage(value) {
		return value ? `${Number(value).toFixed(2)}%` : "0.00%";
	}

	async function getData() {
		if (!currentMasterCategory) {
			alert("Please select a category");
			return;
		}
		setLoading(true);
		const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/po-maker/?page=${page}&page_size=${pageSize}&categoryId=${currentSubCategory ? currentSubCategory : currentCategory ? currentCategory : currentMasterCategory}&vendor=${currentVendor || ''}`, {
			method: "GET",
			headers: {
				'Content-Type': 'application/json',
			},
		})
		setTableData(response.data || []);
		let selectedVendorsTemp = [];
		for (let i = 0; i < response.data.length; i++) {
			selectedVendorsTemp.push(0);
		}
		setSelectedVendors(selectedVendorsTemp);
		setTotalPages(response["totalPages"]);
		setLoading(false);
	}


	useEffect(() => {
		const fetchCategories = async () => {
			setLoading(true);
			try {
				const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/categories/`, {
					method: "GET",
					headers: {
						'Content-Type': 'application/json',
					},
				});
				setCategories(response.data || []);
			} catch (error) {
				console.error('Error fetching categories:', error);
			} finally {
				setLoading(false);
			}
		};
		fetchCategories();
	}, []);

	useEffect(() => {
		if (currentMasterCategory) {
			getData();
		}
	}, [currentMasterCategory, currentCategory, currentSubCategory, currentVendor, page, pageSize]);

	useEffect(() => {
		const vendorsByCategory = async () => {
			if (!currentCategory) return;
			setLoading(true);
			try {
				const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/vendors-by-category/${currentCategory}/`, {
					method: "GET",
					headers: {
						'Content-Type': 'application/json',
					},
				});
				setVendors(response.data || []);
			} catch (error) {
				console.error('Error fetching vendors:', error);
			} finally {
				setLoading(false);
			}
		}
		vendorsByCategory();
	}, [currentCategory, currentSubCategory]);



	return (
		<div className='px-5'>
			<p className="text-3xl font-semibold text-gray-700">PO Maker</p>
			<div className={"bg-white select-none w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1 " + (loading ? "opacity-50 pointer-events-none" : "")}>
				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Master Categories</label>
					<CustomDropdown
						options={categories.map((category) => ({
							value: category?.categoryId,
							label: category?.name
						}))}
						value={currentMasterCategory}
						onChange={setCurrentMasterCategory}
						placeholder="master category"
					/>
				</div>
				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Categories</label>
					<CustomDropdown
						options={
							currentMasterCategory
								? (categories.find(cat => cat.categoryId === currentMasterCategory)?.subcategories || []).map((subcategory) => ({
									value: subcategory?.categoryId,
									label: subcategory?.name
								}))
								: []
						}
						value={currentCategory}
						onChange={setCurrentCategory}
						placeholder="Category"
					/>
				</div>
				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Sub Categories</label>
					<CustomDropdown
						options={
							currentCategory
								? (
									categories.find(cat => cat.categoryId === currentMasterCategory)?.subcategories?.find(sub => sub.categoryId === currentCategory)
										?.subcategories || []
								).map(subsubcategory => ({
									value: subsubcategory?.categoryId,
									label: subsubcategory?.name
								}))
								: []
						}
						value={currentSubCategory}
						onChange={setCurrentSubCategory}
						placeholder="Sub Category"
					/>
				</div>

				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Vendors</label>
					<CustomDropdown options={vendors.map(vendor => ({
						value: vendor.vendorId,
						label: vendor.name
					}))} value={vendors} onChange={setVendors} placeholder="measure" />
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
			<div className={"mt-5 relative bg-white border-t border-gray-200 w-full h-[calc(100vh-23rem)] rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500 " + (collapsed ? "max-w-[calc(100vw-10rem)]" : "max-w-[calc(100vw-18rem)]")}>
				{loading && (
					<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
						<Loader height={60} width={60} />
					</div>
				)}
				<div className="h-full overflow-y-auto">
					{<table className={"w-full " + (loading ? "opacity-50 pointer-events-none" : "")} borderWidth={2}>
						<thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
							<tr className="border-b border-gray-200 bg-gray-100 leading-4">
								<th className="text-center py-4 px-1">SR</th>
								<th className="text-left p-4 border-l border-gray-200 w-[50%]">Product</th>
								<th className="text-center p-4 border-l border-gray-200">Cost Price</th>
								<th className="text-center p-4 border-l border-gray-200">
									Selling Price
								</th>
								<th className="text-center p-4 border-l border-gray-200">
									Profit Percentage
								</th>
								<th className="text-center p-4 border-l border-gray-200">Vendors</th>
							</tr>

						</thead>
						<tbody className="h-64 overflow-y-auto">
							{tableData.map((item, index) => (
								<tr className={"items-start border-b group " + (index % 2 === 0 ? "" : "bg-gray-100") + (selectedVendors[index] !== 0 ? " !bg-red-100 border-red-200 hover:!bg-red-200/75" : " border-gray-200 hover:bg-indigo-50")} key={index}>
									<td className="py-2 px-1 w-fit text-center">
										<p className="text-sm text-gray-600">{item.index}</p>
									</td>
									<td className={"py-2 px-2 w-[50%] border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-200")}>
										<div className="flex items-center">
											{pageSize <= 50 && <img src={item?.imageUrl || "/static/images/default.png"} alt="" className="w-8 h-8 mr-2" />}
											<a target="_blank" href={"https://erp.101distributorsga.com/product/" + item?.id + "/edit"} className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer">
												({item?.id})
											</a>
											<p className="truncate whitespace-break-spaces h-6 group-hover:h-fit">{item?.name}</p>
										</div>
									</td>
									<td className={"text-center py-2 px-2 border-l items-start " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-200")}>{formatNumber(item?.costPrice)}</td>
									<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-200")}>{formatCurrency(item?.standardPrice)}</td>
									<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-200")}>{formatPercentage(item?.profitPercentage)}</td>
									<td className={"text-left py-1 px-1 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-200")}>
										<VendorList data={item?.vendors} setSelectedVendors={setSelectedVendors} index={index} />
									</td>
								</tr>
							))}
							{tableData.length === 0 && !loading && (
								<tr>
									<td colSpan={10} className="text-center py-4 text-gray-500">No data available. First select a vendor or category</td>
								</tr>
							)}
						</tbody>
					</table>}
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
	)
}

export default PO