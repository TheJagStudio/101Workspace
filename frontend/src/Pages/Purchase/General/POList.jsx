import { useState, useEffect } from 'react';
import Calendar from "../../../Components/utils/Calendar";
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from "../../../utils/api";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { BrushCleaning, Send, Sheet, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { set } from 'date-fns';


const dropdownOptions = {
	status: [
		{ value: "", label: "All Statuses" },
		{ value: "Pending", label: "Pending" },
		{ value: "Approved", label: "Approved" },
		{ value: "Rejected", label: "Rejected" },
		{ value: "Completed", label: "Completed" },
		{ value: "Cancelled", label: "Cancelled" },
	],
};

const Loader = ({ height, width, stroke = "#615fff" }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
		<g>
			<circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke={stroke} fill="none" cy={50} cx={50} />
		</g>
	</svg>
);

const statusColorMap = {
	pending: "bg-blue-100 text-blue-800 border-blue-200",
	approved: "bg-green-100 text-green-800 border-green-200",
	rejected: "bg-red-100 text-red-800 border-red-200",
	completed: "bg-indigo-100 text-indigo-800 border-indigo-200",
	cancelled: "bg-gray-200 text-gray-700 border-gray-300",
};

const POList = () => {
	const [searchTerm, setSearchTerm] = useState("");
	const [status, setStatus] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [loading, setLoading] = useState(false);
	const [poData, setPoData] = useState([]);
	const [searchTrigger, setSearchTrigger] = useState(0); // add this
	const [selectedPOId, setSelectedPOId] = useState(null);
	const [lineItems, setLineItems] = useState([]);
	const [lineItemsLoading, setLineItemsLoading] = useState(false);
	const [selectedPOs, setSelectedPOs] = useState(new Set());
	const [loadingExport, setLoadingExport] = useState(false);
	const [loadingDelete, setLoadingDelete] = useState(false);
	const [loadingPush, setLoadingPush] = useState(false);

	// Fetch PO data
	const fetchPOs = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (searchTerm) params.append("search", searchTerm);
			if (status) params.append("status", status);
			if (startDate) params.append("start", startDate);
			if (endDate) params.append("end", endDate);
			const res = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/po/?${params.toString()}`);
			setPoData(res.purchase_orders || []);
			if (res.purchase_orders && res.purchase_orders.length > 0) {
				setSelectedPOId(res.purchase_orders[0].id); // Select the first PO by default
				fetchLineItems(res.purchase_orders[0].id); // Fetch line items for the first PO
			}
		} catch (e) {
			setPoData([]);
			setSelectedPOId(null);
			setLineItems([]);
		}
		setLoading(false);
	};

	// Fetch line items for a PO
	const fetchLineItems = async (poId) => {
		setLineItems([]);
		setLineItemsLoading(true);
		try {
			const res = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/po-line-items/${poId}/`);
			setLineItems(res.line_items || []);
		} catch (e) {
			setLineItems([]);
		}
		setLineItemsLoading(false);
	};

	useEffect(() => {
		fetchPOs();
	}, [searchTrigger, status, startDate, endDate]);

	function formatCurrency(value) {
		value = Number(value);
		return value ? value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }) : "$0.00";
	}

	function formatDate(value) {
		if (!value) return "";
		const d = new Date(value);
		return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
	}

	// Selection logic for PO table
	function handlePOSelection(poId, isSelected) {
		setSelectedPOs(prev => {
			const newSet = new Set(prev);
			if (isSelected) {
				newSet.add(poId);
			} else {
				newSet.delete(poId);
			}
			return newSet;
		});
	}

	function handleSelectAllPOs() {
		if (selectedPOs?.size === poData.length) {
			setSelectedPOs(new Set());
		} else {
			setSelectedPOs(new Set(poData.map(po => po.id)));
		}
	}

	function clearPOSelection() {
		setSelectedPOs(new Set());
	}

	// Add this function for push action
	function handlePushPOs() {
		// Implement your push logic here
		// alert(`Pushing ${selectedPOs?.size} PO(s) to the ERP: [${Array.from(selectedPOs).join(', ')}]`);
		alert("This feature is not implemented yet. Please contact support for assistance.");
	}

	return (
		<div className="px-5">
			<p className="text-3xl font-semibold text-gray-700">Generated PO List</p>
			<div className={"bg-white select-none w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1"}>
				{/* Search Input */}
				<div className="relative flex-1 max-w-md">
					<input
						type="text"
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						placeholder="Search PO, vendor, etc..."
						className="w-full pl-10 pr-4 py-2 border border-gray-200 peer rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/75 focus:border-indigo-500 transition-all duration-200 placeholder-gray-400"
					/>
					<svg className="w-6 h-6 text-gray-300 absolute top-2 left-2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
					</svg>
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

				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Status</label>
					<CustomDropdown options={dropdownOptions.status} value={status} onChange={setStatus} placeholder="status" />
				</div>

				<div className="flex flex-col">
					<label className="text-sm text-gray-600 mb-1">Purchase Created At</label>
					<Calendar startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} dateFormat="yyyy-MM-dd" />
				</div>
				<button
					onClick={() => setSearchTrigger(t => t + 1)}
					className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-700"
				>
					Search
				</button>
			</div>

			{/* Selection summary bar */}
			{selectedPOs?.size > 0 && (
				<div className="bg-white w-full h-fit rounded-lg shadow-md mt-5 p-4 flex flex-row items-center justify-between">
					<div className="flex items-center gap-6">
						<div className="text-sm text-gray-600">
							<span className="font-semibold">{selectedPOs?.size}</span> POs selected
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={clearPOSelection}
							className="px-4 py-2 rounded-md font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
						>
							<BrushCleaning className="inline mr-1 mb-1 h-5 w-5" />
							Clear Selection
						</button>

						<button
							onClick={() => {
								// loop through selected POs and delete them
								if (window.confirm(`Are you sure you want to delete ${selectedPOs.size} selected PO(s)? This action cannot be undone.`)) {
									setLoadingDelete(true);
									selectedPOs.forEach(async (poId) => {
										try {
											await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/po/?po_id=${poId}`, { method: 'DELETE' });
											setPoData(prev => prev.filter(po => po.id !== poId));
											if (selectedPOId === poId) {
												setSelectedPOId(null);
												setLineItems([]);
											}
										} catch (error) {
											console.error(`Failed to delete PO ${poId}:`, error);
										}
									});
									setSelectedPOs(new Set());
									setLoadingDelete(false);
								}
							}}
							disabled={loadingDelete}
							className="px-4 py-2 rounded-md flex items-center gap-1 font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
						>
							{loadingDelete?(<Loader height={20} width={20} stroke='white' />):(<Trash2 className="inline mb-1 h-5 w-5" />)}
							Delete Selected
						</button>
						<button
							onClick={async () => {
								setLoadingExport(true);
								const selectedPOsArray = Array.from(selectedPOs);
								const dataToExport = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/po/`, {
									method: "POST",
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify({ poIds: selectedPOsArray, action: 'export' }),
								});
								const workbook = XLSX.utils.book_new();
								dataToExport.purchase_orders.forEach(po => {
									const worksheet = XLSX.utils.json_to_sheet(po.items);
									let sheetName = po.vendor;
									sheetName = sheetName.replace(/[:\\/?*[\]]/g, "").substring(0, 31);
									XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
								});
								XLSX.writeFile(workbook, `PurchaseOrders_${Date.now()}.xlsx`);
								setLoadingExport(false);
							}}
							disabled={loadingExport}
							className="px-4 py-2 rounded-md flex items-center gap-1 font-medium text-white bg-green-600 hover:bg-green-700 transition-colors cursor-pointer"
						>
							{loadingExport?(<Loader height={20} width={20} stroke='white' />):(<Sheet className="inline mb-1 h-5 w-5" />)}
							Export to Excel
						</button>
						<button
							onClick={handlePushPOs}
							className={`px-4 py-2 rounded-md flex items-center gap-1 font-medium text-white transition-colors bg-indigo-600 hover:bg-indigo-700 cursor-pointer`}
						>
							<Send className="inline mb-1 h-5 w-5" />
							Push to ERP
						</button>
					</div>
				</div>
			)}

			{/* Table */}
			<div className="mt-5 relative bg-white w-full border-t border-white h-full rounded-lg shadow-md overflow-y-auto text-gray-700 transition-all duration-500">
				{loading && (
					<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
						<Loader height={60} width={60} />
					</div>
				)}
				<div className="min-h-32 max-h-[calc(100vh-23rem)] overflow-y-auto ">
					<table className={"w-full relative " + (loading ? "opacity-50 pointer-events-none" : "")}>
						<thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
							<tr className="border-b border-gray-300 bg-gray-100 leading-4">
								<th className="text-center py-4 px-1">
									{/* Select All Checkbox */}
									<label className="inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={selectedPOs?.size === poData.length && poData.length > 0}
											onChange={handleSelectAllPOs}
											className="sr-only peer"
										/>
										<span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
                      						${selectedPOs?.size === poData.length && poData.length > 0
												? 'bg-indigo-600 border-indigo-600'
												: 'bg-white border-gray-300 peer-hover:border-indigo-400'
											}`}>
											{selectedPOs?.size === poData.length && poData.length > 0 && (
												<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
												</svg>
											)}
										</span>
									</label>
								</th>
								<th className="text-center py-4 px-1 border-l border-gray-300">PO ID</th>
								<th className="text-left p-4 border-l border-gray-300">Vendor</th>
								<th className="text-center p-4 border-l border-gray-300">Status</th>
								<th className="text-center p-4 border-l border-gray-300">Total Amount</th>
								<th className="text-center p-4 border-l border-gray-300">Total Quantity</th>
								<th className="text-center p-4 border-l border-gray-300">Created At</th>
							</tr>
						</thead>
						<tbody>
							{poData?.length > 0 ? poData?.map((po, idx) => {
								const statusKey = (po?.status || "").toLowerCase();
								const statusColor = statusColorMap[statusKey] || "bg-gray-100 text-gray-800";
								return (
									<tr
										key={po?.id}
										className={
											"hover:bg-indigo-50 border-b border-gray-300 cursor-pointer " +
											(idx % 2 === 0 ? "" : "bg-gray-50") +
											(selectedPOId === po?.id ? " !bg-indigo-100" : "")
										}
										onClick={() => {
											setSelectedPOId(po?.id);
											fetchLineItems(po?.id);
										}}
									>
										<td className="py-2 px-1 w-fit text-center" onClick={e => e.stopPropagation()}>
											{/* Row Checkbox */}
											<label className="inline-flex items-center cursor-pointer">
												<input
													type="checkbox"
													checked={selectedPOs?.has(po?.id)}
													onChange={e => handlePOSelection(po?.id, e.target.checked)}
													className="sr-only peer"
												/>
												<span className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors duration-200
                          							${selectedPOs?.has(po?.id)
														? 'bg-indigo-600 border-indigo-600'
														: 'bg-white border-gray-300 peer-hover:border-indigo-400'
													}`}>
													{selectedPOs?.has(po?.id) && (
														<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
														</svg>
													)}
												</span>
											</label>
										</td>
										<td className="text-center py-2 px-1 border-l border-gray-300">{po?.id}</td>
										<td className="py-2 px-4 border-l border-gray-300">
											<a href={`https://erp.101distributorsga.com/vendor/${po?.vendorId}/edit`} target="_blank" rel="noopener noreferrer" className='text-blue-600 hover:italic cursor-pointer'>({po?.vendorId}) </a>{po?.vendor}
										</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">
											<span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-semibold ${statusColor}`}>
												{po?.status.charAt(0).toUpperCase() + po?.status.slice(1)}
											</span>
										</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatCurrency(po?.totalAmount)}</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{po?.totalQuantity}</td>
										<td className="text-center py-2 px-2 border-l border-gray-300">{formatDate(po?.insertedTimestamp)}</td>
									</tr>
								);
							}) : !loading && (
								<tr>
									<td colSpan={7} className="text-center py-8 text-gray-500">
										No purchase orders found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Line Items Table */}
			{selectedPOId && (
				<div className="mt-8 bg-white w-full rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500">
					<div className="p-4 border-b border-gray-300 flex items-center justify-between gap-2">
						<span className="font-semibold text-lg">Line Items for PO #{selectedPOId} - {poData?.find(po => po.id === selectedPOId)?.vendor || "Unknown Vendor"}</span>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-100 border-b border-gray-300">
								<tr>
									<th className="text-center py-3 px-2">ID</th>
									<th className="border-l border-gray-300 text-left py-3 px-2">Product Name</th>
									<th className="border-l border-gray-300 text-left py-3 px-2">SKU</th>
									<th className="border-l border-gray-300 text-center py-3 px-2">Quantity</th>
									<th className="border-l border-gray-300 text-center py-3 px-2">Unit Price</th>
									<th className="border-l border-gray-300 text-center py-3 px-2">Total Price</th>
								</tr>
							</thead>
							<PhotoProvider>
								<tbody>
									{lineItems.length > 0 ? lineItems.map(item => (
										<tr key={item.id} className="border-b border-gray-200">
											<td className="text-center py-2 px-2">{item.id}</td>
											<td className="border-l border-gray-200 py-2 px-2 flex flex-row items-center justify-start">
												<PhotoView src={item?.imageUrl ? item?.imageUrl : '/static/images/default.png'}>
													<img
														src={item?.imageUrl ? item?.imageUrl : '/static/images/default.png'}
														alt={item?.productName}
														className="w-8 h-8 mr-2"

													/>
												</PhotoView>
												<a href={`https://erp.101distributorsga.com/product/${item.productId}/edit`} target='_blank' rel="noopener noreferrer" className='text-blue-500 hover:italic mr-1'>({item.productId})</a>{item.productName}</td>
											<td className="border-l border-gray-200 py-2 px-2">{item.sku}</td>
											<td className="border-l border-gray-200 text-center py-2 px-2">{item.quantity}</td>
											<td className="border-l border-gray-200 text-center py-2 px-2">{formatCurrency(item.unitPrice)}</td>
											<td className="border-l border-gray-200 text-center py-2 px-2">{formatCurrency(item.totalPrice)}</td>
										</tr>
									)) : !lineItemsLoading && (
										<tr>
											<td colSpan={7} className="text-center py-6 text-gray-500">
												No line items found for this PO.
											</td>
										</tr>
									)}
								</tbody>
							</PhotoProvider>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}

export default POList