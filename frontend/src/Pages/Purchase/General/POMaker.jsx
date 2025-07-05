import { useState, useEffect, use } from 'react';
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from '../../../utils/api';
import { useAtom } from 'jotai';
import { isSidebarOpenAtom, warningsAtom, infoAtom, searchAtom,successAtom } from "../../../Variables";
import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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


const VendorList = ({ data, setSelectedVendors, index }) => {
	const [openDropdown, setOpenDropdown] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [hoveredIndex, setHoveredIndex] = useState(0);
	const [selectedVendor, setSelectedVendor] = useState(null);
	const [hoveredVendor, setHoveredVendor] = useState(null);


	const handleSelect = (idx) => {
		setSelectedIndex(idx);
		setOpenDropdown(false);
	};

	useEffect(() => {
		setSelectedVendor(data?.[selectedIndex] || null);
		setHoveredVendor(data?.[hoveredIndex] || null);
	}, [selectedIndex, hoveredIndex]);
	useEffect(() => {
		setSelectedVendor(data?.[0] || null);
		setHoveredVendor(data?.[0] || null);
	}, []);

	useEffect(() => {
		setSelectedVendors((prev) => {
			const newVendors = [...prev];
			newVendors[index] = selectedIndex;
			return newVendors;
		});
	}, [selectedIndex]);

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
				<div className={"absolute -left-1 z-20  pl-1 w-full " + (index > 4 ? "bottom-full pb-1" : "top-full pt-1")}>
					<div className='py-1 bg-white border border-gray-300 rounded shadow-xl max-h-40 overflow-auto'>
						{data.map((item, idx) => {
							return (
								<div
									key={idx}
									className={`flex items-center justify-between gap-2 px-2 py-1 border-b last:border-b-0 border-gray-300 cursor-pointer ${idx === selectedIndex ? "bg-indigo-500 text-white hover:bg-indigo-500" : "text-gray-700 hover:bg-indigo-100"}`}
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
				<div className={'absolute z-20 -left-0 pr-1 -translate-x-full' + (index > 4 ? " bottom-0 pb-1" : " top-0")}>
					<div className='flex flex-col max-w-48 w-fit h-fit overflow-hidden bg-white border border-gray-300 rounded-md shadow-xl items-center justify-start'>
						<div className="text-gray-700 w-48 text-xs font-bold bg-gray-100 p-2 border-b border-gray-300 ">{hoveredVendor?.name}</div>
						<div className='flex flex-col items-center justify-start w-48 overflow-y-auto max-h-36'>
							{hoveredVendor?.prices && hoveredVendor?.prices.length > 0 ? hoveredVendor?.prices.map((price, index) => (
								<p key={index} className="text-gray-700 text-xs whitespace-nowrap font-bold even:bg-gray-100 text-left w-full mr-auto p-2">{price?.price} | {price?.date}</p>
							)) : (
								<p className="text-gray-500 text-xs whitespace-nowrap p-2">No price available</p>
							)}
						</div>
						{/* <ResponsiveContainer width="100%" height="100%">
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
							</ResponsiveContainer> */}

					</div>
				</div>
			)}
		</div>
	);


}

const POMaker = () => {
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useAtom(searchAtom);
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
	const [warnings, setWarnings] = useAtom(warningsAtom);
	const [info, setInfo] = useAtom(infoAtom);
	const [success, setSuccess] = useAtom(successAtom);
	const [selectedProducts, setSelectedProducts] = useState(new Set());
	const [productQuantities, setProductQuantities] = useState({});
	const [creatingPO, setCreatingPO] = useState(false);

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

	function handleProductSelection(productId, isSelected) {
		const newSelected = new Set(selectedProducts);
		if (isSelected) {
			newSelected.add(productId);
			// Set default quantity if not already set
			if (!productQuantities[productId]) {
				let item = tableData.find(product => product.id === productId);
				const calculatedQuantity = (item?.minQuantity - item?.availableQuantity) > 0 ? item?.minQuantity - item?.availableQuantity : 1;
				setProductQuantities(prev => ({
					...prev,
					[productId]: calculatedQuantity
				}));
			}
		} else {
			newSelected.delete(productId);
		}
		setSelectedProducts(newSelected);
	}

	function handleQuantityChange(productId, quantity) {
		setProductQuantities(prev => ({
			...prev,
			[productId]: Math.max(1, parseInt(quantity) || 1)
		}));
	}

	function handleSelectAll() {
		if (selectedProducts.size === tableData.length) {
			// Deselect all
			setSelectedProducts(new Set());
		} else {
			// Select all
			const allIds = new Set(tableData.map(item => item.id));
			setSelectedProducts(allIds);
			// Set default quantities for newly selected items
			const newQuantities = { ...productQuantities };
			tableData.forEach(item => {
				if (!newQuantities[item.id]) {
					const calculatedQuantity = (item.minQuantity - item.availableQuantity) > 0 ? item.minQuantity - item.availableQuantity : 1;
					newQuantities[item.id] = calculatedQuantity;
				}
			});
			setProductQuantities(newQuantities);
		}
	}

	async function createPurchaseOrders() {
		if (selectedProducts.size === 0) {
			setWarnings(prev => [...prev, { id: Date.now(), message: "Please select at least one product", status: 400 }]);
			return;
		}

		setCreatingPO(true);
		try {
			const selectedProductsData = [];
			const missingVendorProducts = [];
			
			tableData.forEach((item, tableIndex) => {
				if (selectedProducts.has(item.id)) {
					const selectedVendorIndex = selectedVendors[tableIndex];
					const selectedVendor = item.vendors && item.vendors[selectedVendorIndex];
					
					if (selectedVendor) {
						// Parse price to get numeric value
						let unitPrice = 0;
						if (selectedVendor.prices && selectedVendor.prices.length > 0) {
							const priceString = selectedVendor.prices[0].price;
							// Remove $ and convert to float
							unitPrice = parseFloat(priceString.toString().replace(/[$,]/g, '')) || 0;
						}
						
						const calculatedQuantity = (item.minQuantity - item.availableQuantity) > 0 ? item.minQuantity - item.availableQuantity : 1;
						selectedProductsData.push({
							product_id: item.id,
							vendor_id: selectedVendor.id,
							quantity: productQuantities[item.id] || calculatedQuantity,
							unit_price: unitPrice
						});
					} else {
						// Collect products without vendors
						missingVendorProducts.push(item.name);
					}
				}
			});

			// Show warnings for products without vendors
			if (missingVendorProducts.length > 0) {
				setWarnings(prev => [...prev, { 
					id: Date.now(), 
					message: `Please select vendors for: ${missingVendorProducts.join(', ')}`, 
					status: 400 
				}]);
			}

			if (selectedProductsData.length === 0) {
				setWarnings(prev => [...prev, { 
					id: Date.now(), 
					message: "No valid products with vendors selected", 
				 status: 400 
				}]);
				return;
			}

			// Show summary of what will be created
			const vendorGroups = selectedProductsData.reduce((acc, product) => {
				acc[product.vendor_id] = (acc[product.vendor_id] || 0) + 1;
				return acc;
			}, {});

			const vendorNames = tableData.reduce((acc, item) => {
				item.vendors?.forEach(vendor => {
					acc[vendor.id] = vendor.name;
				});
				return acc;
			}, {});

			const summary = Object.entries(vendorGroups).map(([vendorId, count]) => 
				`${vendorNames[vendorId]}: ${count} products`
			).join(', ');

			setInfo(prev => [...prev, { 
				id: Date.now(), 
				message: `Creating POs for: ${summary}`, 
				status: 200 
			}]);

			const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/po/`, {
				method: "POST",
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					selected_products: selectedProductsData
				})
			});

			if (response.success) {
				setSuccess(prev => [...prev, { 
					id: Date.now(), 
					message: `${response.message}`, 
					status: 200 
				}]);
				
				// Reset selections
				setSelectedProducts(new Set());
				setProductQuantities({});
				
				// Optionally refresh the data
				getData();
			} else {
				setWarnings(prev => [...prev, { id: Date.now(), message: response.error || "Failed to create POs", status: 400 }]);
			}
		} catch (error) {
			console.error('Error creating POs:', error);
			setWarnings(prev => [...prev, { id: Date.now(), message: "Error creating Purchase Orders", status: 500 }]);
		} finally {
			setCreatingPO(false);
		}
	}

	async function getData() {
		if (!currentMasterCategory) {
			setInfo(prev => [...prev, { id: Date.now(), message: "Please select a category", status: 400 }]);
			return;
		}
		setLoading(true);
		try {

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
			if (response.data.length === 0 && page > 1) {
				setPage(1)
			}
			setLoading(false);
		} catch (error) {
			console.error('Error fetching PO data:', error);
			setLoading(false);
		}
	};


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
		getData();
	}, [page, pageSize]);

	useEffect(() => {
		const vendorsByCategory = async () => {
			if (!currentCategory) return;
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
			} 
		}
		vendorsByCategory();
		setPage(1);
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

				{/* <div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Vendors</label>
					<CustomDropdown options={vendors.map(vendor => ({
						value: vendor.vendorId,
						label: vendor.name
					}))} value={vendors} onChange={setVendors} placeholder="measure" />
				</div> */}

				<button
					onClick={() => {
						getData();

					}}
					className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-700"
				>
					Search
				</button>
			</div>

			{/* Create PO Button Section */}
			{selectedProducts.size > 0 && (
				<div className="bg-white w-full h-fit rounded-lg shadow-md mt-5 p-4 flex flex-row items-center justify-between">
					<div className="flex items-center gap-6">
						<div className="text-sm text-gray-600">
							<span className="font-semibold">{selectedProducts.size}</span> products selected
						</div>
						<div className="text-sm text-gray-600">
							Total quantity: <span className="font-semibold">
								{Array.from(selectedProducts).reduce((sum, productId) => {
									const item = tableData.find(product => product.id === productId);
									const calculatedQuantity = (item?.minQuantity - item?.availableQuantity) > 0 ? item?.minQuantity - item?.availableQuantity : 1;
									return sum + (productQuantities[productId] || calculatedQuantity);
								}, 0)}
							</span>
						</div>
						<div className="text-sm text-gray-600">
							Estimated total: <span className="font-semibold">
								{formatCurrency(
									Array.from(selectedProducts).reduce((total, productId) => {
										const item = tableData.find(product => product.id === productId);
										if (item) {
											const calculatedQuantity = (item?.minQuantity - item?.availableQuantity) > 0 ? item?.minQuantity - item?.availableQuantity : 1;
											const quantity = productQuantities[productId] || calculatedQuantity;
											const selectedVendorIndex = selectedVendors[tableData.indexOf(item)] || 0;
											const selectedVendor = item.vendors?.[selectedVendorIndex];
											if (selectedVendor?.prices?.[0]?.price) {
												const price = parseFloat(selectedVendor.prices[0].price.toString().replace(/[$,]/g, '')) || 0;
												return total + (price * quantity);
											}
										}
										return total;
									}, 0)
								)}
							</span>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={() => {
								setSelectedProducts(new Set());
								setProductQuantities({});
							}}
							className="px-4 py-2 rounded-md font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
						>
							Clear Selection
						</button>
						<button
							onClick={createPurchaseOrders}
							disabled={creatingPO || selectedProducts.size === 0}
							className={`px-6 py-2 rounded-md font-medium transition-colors ${
								creatingPO 
									? "bg-gray-400 text-white cursor-not-allowed" 
									: "bg-green-600 text-white hover:bg-green-700"
							}`}
						>
							{creatingPO ? (
								<div className="flex items-center gap-2">
									<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
									</svg>
									Creating POs...
								</div>
							) : (
								"Create Purchase Orders"
							)}
						</button>
					</div>
				</div>
			)}
			<div className={"mt-5 relative bg-white border-t border-gray-300 w-full h-fit rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500 " + (collapsed ? "max-w-[calc(100vw-10rem)]" : "max-w-[calc(100vw-18rem)]")}>
				{loading && (
					<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
						<Loader height={60} width={60} />
					</div>
				)}
				<div className="h-fit min-h-32 max-h-[calc(100vh-23rem)] overflow-y-auto">
					{<table className={"w-full " + (loading ? "opacity-50 pointer-events-none" : "")}>
						<thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
							<tr className="border-b border-gray-300 bg-gray-100 leading-4">
								<th className="text-center py-4 px-1">
									<label className="inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={selectedProducts.size === tableData.length && tableData.length > 0}
											onChange={handleSelectAll}
											className="sr-only peer"
										/>
										<span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
											${selectedProducts.size === tableData.length && tableData.length > 0
												? 'bg-indigo-600 border-indigo-600'
												: 'bg-white border-gray-300 peer-hover:border-indigo-400'
											}`}>
											{selectedProducts.size === tableData.length && tableData.length > 0 && (
												<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
												</svg>
											)}
										</span>
									</label>
								</th>
								<th className="text-center py-4 px-1 border-l border-gray-300">SR</th>
								<th className="text-left p-4 border-l border-gray-300 w-[40%]">Product</th>
								<th className="text-center p-4 border-l border-gray-300">Available Quantity/<br />Min Quantity</th>
								<th className="text-center p-4 border-l border-gray-300">Quantity</th>
								<th className="text-center p-4 border-l border-gray-300">Cost Price</th>
								<th className="text-center p-4 border-l border-gray-300">
									Selling Price
								</th>
								<th className="text-center p-4 border-l border-gray-300">
									Profit Percentage
								</th>
								<th className="text-center p-4 border-l border-gray-300">Vendors</th>
							</tr>

						</thead>
						<PhotoProvider >
							<tbody className="overflow-y-auto">
								{tableData.map((item, index) => {
									const hasVendorIssue = selectedVendors[index] !== 0 && item.vendors?.length > 1;
									const isSelected = selectedProducts.has(item.id);
									const needsVendorSelection = isSelected && (!item.vendors || item.vendors.length === 0);
									
									return (
									<tr 
										className={`items-start border-b group ${
											index % 2 === 0 ? "" : "bg-gray-100"
										} ${
											hasVendorIssue ? " !bg-red-100 border-red-200 hover:!bg-red-200/75" : " border-gray-300 hover:bg-indigo-50"
										} ${
											isSelected ? " !bg-green-50 border-green-200 hover:!bg-green-200/75" : ""
										} ${
											needsVendorSelection ? " !bg-yellow-50 border-yellow-200" : ""
										}`} 
										key={index}
										title={needsVendorSelection ? "This product needs a vendor to be selected" : ""}
									>
										<td className="py-2 px-2 w-fit text-center">
											<label className="inline-flex items-center cursor-pointer">
												<input
													type="checkbox"
													checked={selectedProducts.has(item.id)}
													onChange={(e) => handleProductSelection(item.id, e.target.checked)}
													className="sr-only peer"
												/>
												<span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
													${selectedProducts.has(item.id)
														? 'bg-indigo-600 border-indigo-600'
														: 'bg-white border-gray-300 peer-hover:border-indigo-400'
													}`}>
													{selectedProducts.has(item.id) && (
														<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
														</svg>
													)}
												</span>
											</label>
										</td>
										<td className="py-2 px-1 w-fit text-center border-l border-gray-300">
											<p className="text-sm text-gray-600">{item.index}</p>
										</td>
										<td className={"py-2 px-2 w-[40%] border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>
											<div className="flex items-center">
												{pageSize <= 50 && <PhotoView src={item?.imageUrl ? item.imageUrl : '/static/images/default.png'}><img src={item?.imageUrl || "/static/images/default.png"} alt={item?.productName} className="w-8 h-8 mr-2 mix-blend-multiply" /></PhotoView>}
												<a target="_blank" href={"https://erp.101distributorsga.com/product/" + item?.id + "/edit"} className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer">
													({item?.id})
												</a>
												<p onClick={() => {
													setSearch(item?.name);
													document.querySelector("#search")?.focus();
												}}
												label={item?.name}
												className="truncate whitespace-break-spaces h-6 overflow-ellipsis">{item?.name}</p>
											</div>
										</td>
										<td className={"text-center py-2 px-2 border-l items-start " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>{formatNumber(item?.availableQuantity)}/{formatNumber(item?.minQuantity)}</td>
										<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>
											<input
												type="number"
												min="1"
												value={productQuantities[item.id] || ((item?.minQuantity - item?.availableQuantity) > 0 ? item?.minQuantity - item?.availableQuantity : 1)}
												onChange={(e) => handleQuantityChange(item.id, e.target.value)}
												disabled={!selectedProducts.has(item.id)}
												className="w-16 px-2 py-1 text-center border border-gray-300 bg-white rounded disabled:bg-gray-100 disabled:text-gray-400"
											/>
										</td>
										<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>{formatCurrency(item?.costPrice)}</td>
										<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>{formatCurrency(item?.standardPrice)}</td>
										<td className={"text-center py-2 px-2 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>{formatPercentage(item?.profitPercentage)}</td>
										<td className={"text-left py-1 px-1 border-l " + (selectedVendors[index] !== 0 ? "border-red-200" : "border-gray-300")}>
											{item?.vendors?.length > 1 && (<VendorList data={item?.vendors} setSelectedVendors={setSelectedVendors} index={index} />)}
											{item?.vendors?.length === 0 && (<span className="text-gray-400 w-full ml-2">No vendors</span>)}
											{item?.vendors?.length === 1 && (
												<div className="flex items-center justify-between gap-2 px-2 py-1 w-full">
													<span className="text-sm text-gray-700 text-left truncate">{item?.vendors?.[0]?.name}</span>
													<span className="text-sm text-gray-700 font-bold">{item?.vendors?.[0]?.price}</span>
												</div>
											)}
										</td>
									</tr>
								);
								})}
								{tableData.length === 0 && !loading && (
									<tr>
										<td colSpan={12} className="text-center py-4 text-gray-500">No data available. First select a vendor or category</td>
									</tr>
								)}
							</tbody>
						</PhotoProvider>
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

export default POMaker