import React, { useState, useEffect, useRef } from 'react'
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from '../../../utils/api';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { useAtom } from 'jotai';
import { searchAtom } from "../../../Variables";
import * as XLSX from "xlsx";
import { Trash, Trash2, Upload, Search, X, XIcon, Sheet, Loader2 } from 'lucide-react';

const CustomToast = ({ message, type, onClose }) => (
	<div className={`fixed top-5 right-5 z-[9999] px-4 py-2 rounded shadow-lg text-white transition-all duration-300
    ${type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-yellow-600"}`}>
		<span>{message}</span>
		<button className="ml-3 text-white font-bold" onClick={onClose}>×</button>
	</div>
);

const HotProduct = () => {
	const [loading, setLoading] = useState(false);
	const [categories, setCategories] = useState([]);
	const [currentMasterCategory, setCurrentMasterCategory] = useState(null);
	const [currentCategory, setCurrentCategory] = useState(null);
	const [currentSubCategory, setCurrentSubCategory] = useState(null);
	const [search, setSearch] = useAtom(searchAtom);

	// Table and pagination state
	const [tableData, setTableData] = useState([]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [totalPages, setTotalPages] = useState(0);

	// Modal state for adding hot products
	const [showAddModal, setShowAddModal] = useState(false);
	const [addLoading, setAddLoading] = useState(false);

	// Temporary table for UPCs/products to add
	const [tempProducts, setTempProducts] = useState([]);
	// Search inside modal
	const [modalSearchTerm, setModalSearchTerm] = useState("");
	const [modalSearchResults, setModalSearchResults] = useState([]);
	const modalDebounceRef = useRef();
	const modalSearchInputRef = useRef();

	// Excel import state
	const [excelImportLoading, setExcelImportLoading] = useState(false);

	// Custom toast state
	const [toast, setToast] = useState({ show: false, message: "", type: "success" });

	// Bulk remove state
	const [bulkRemoveMode, setBulkRemoveMode] = useState(false);
	const [selectedUPCs, setSelectedUPCs] = useState([]);

	// Loading state for export
	const [loadingExport, setLoadingExport] = useState(false);

	useEffect(() => {
		const fetchCategories = async () => {
			setLoading(true);
			try {
				const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/categories/`, {
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

	// Fetch hot products
	const getData = async () => {
		const categoryId = currentSubCategory || currentCategory || currentMasterCategory;
		setLoading(true);
		try {
			const response = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/?categoryId=${categoryId ? categoryId : ''}&page=${page}&page_size=${pageSize}`,
				{
					method: "GET",
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
			setTableData(response.products || []);
			setTotalPages(response.totalPages || 1);
			if (response.products?.length === 0 && page > 1) {
				setPage(1);
			}
		} catch (error) {
			console.error('Error fetching hot products:', error);
		} finally {
			setLoading(false);
		}
	};

	// Fetch data when page/pageSize changes
	useEffect(() => {
		getData();
		// eslint-disable-next-line
	}, [page, pageSize]);

	// Custom toast show function
	const showToast = (message, type = "success") => {
		setToast({ show: true, message, type });
		setTimeout(() => setToast({ show: false, message: "", type }), 2500);
	};

	// Add product from search result to temp table
	const handleAddTempProduct = (product) => {
		if (!product?.document?.upc) {
			showToast("Product does not have a UPC.", "error");
			return;
		}
		if (tempProducts.some(p => p.upc === product.document.upc)) {
			showToast("Product already added.", "warning");
			return;
		}
		setTempProducts(prev => [...prev, {
			upc: product.document.upc,
			name: product.document.productName,
			sku: product.document.sku,
			id: product.document.id,
			imageUrl: product.document.imageUrl
		}]);
		showToast("Product added to list.", "success");

	};

	// Remove product from temp table
	const handleRemoveTempProduct = (upc) => {
		setTempProducts(prev => prev.filter(p => p.upc !== upc));
	};

	// Helper function to fetch product details for a list of UPCs using Typesense
	const fetchProductsByUPCs = async (upcList) => {
		const foundProducts = [];
		const missingUPCs = [];
		for (const upc of upcList) {
			try {
				const response = await fetch(
					`https://purityai-typesense.hf.space/collections/101/documents/search?q=${encodeURIComponent(upc)}&query_by=upc,sku&per_page=1`,
					{ headers: { 'X-TYPESENSE-API-KEY': 'Hu52dwsas2AdxdE' } }
				);
				const data = await response.json();
				if (data.hits?.length > 0) {
					const doc = data.hits[0].document;
					foundProducts.push({
						upc: doc.upc,
						name: doc.productName,
						sku: doc.sku,
						id: doc.id,
						imageUrl: doc.imageUrl
					});
				} else {
					missingUPCs.push(upc);
				}
			} catch {
				missingUPCs.push(upc);
			}
		}
		return { foundProducts, missingUPCs };
	};

	// Excel import handler (fetch product details for UPCs)
	const handleExcelImport = async (event) => {
		const file = event.target.files[0];
		if (!file) return;
		setExcelImportLoading(true);
		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const data = new Uint8Array(e.target.result);
				const workbook = XLSX.read(data, { type: 'array' });
				const worksheet = workbook.Sheets[workbook.SheetNames[0]];
				const jsonData = XLSX.utils.sheet_to_json(worksheet);
				// Extract UPCs
				const upcList = [];
				jsonData.forEach(row => {
					const upc = row.upc || row.UPC || row.Upc;
					if (upc && !tempProducts.some(p => p.upc === upc)) {
						upcList.push(upc);
					}
				});
				// Fetch product details for UPCs
				const { foundProducts, missingUPCs } = await fetchProductsByUPCs(upcList);
				setTempProducts(prev => [...prev, ...foundProducts, ...missingUPCs.map(upc => ({ upc, name: "", sku: "", id: "", imageUrl: "" }))]);
				showToast(`Imported ${foundProducts.length} products. ${missingUPCs.length} UPCs not found.`, missingUPCs.length ? "warning" : "success");
			} catch (error) {
				showToast("Error reading file.", "error");
			} finally {
				setExcelImportLoading(false);
			}
		};
		reader.readAsArrayBuffer(file);
	};

	// Submit all UPCs in tempProducts
	const handleAddHotProducts = async () => {
		if (tempProducts.length === 0) {
			showToast("No products to add.", "error");
			return;
		}
		setAddLoading(true);
		try {
			const upcList = tempProducts.map(p => p.upc);
			const response = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/`,
				{
					method: "POST",
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ upcs: upcList }),
				}
			);
			if (response.notFoundUPCs?.length) {
				showToast(`Some UPCs not found: ${response.notFoundUPCs.join(", ")}`, "warning");
			} else {
				showToast("Hot products updated successfully.", "success");
			}
			setShowAddModal(false);
			setTempProducts([]);
			getData();
		} catch (error) {
			showToast("Error adding hot products.", "error");
		} finally {
			setAddLoading(false);
		}
	};

	// Remove hot product from backend and refresh table
	const handleRemoveHotProduct = async (upc) => {
		if (!upc) return;
		if (!window.confirm("Are you sure you want to remove this product from Hot Products?")) return;
		setLoading(true);
		try {
			const response = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/`,
				{
					method: "DELETE",
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ upcs: [upc] }),
				}
			);
			if (response.notFoundUPCs?.length) {
				showToast(`Some UPCs not found: ${response.notFoundUPCs.join(", ")}`, "warning");
			} else {
				showToast("Product removed from Hot Products.", "success");
			}
			getData();
		} catch (error) {
			showToast("Error removing product.", "error");
		} finally {
			setLoading(false);
		}
	};

	// Modal product search logic
	const handleModalSearchChange = (e) => {
		const value = e.target.value;
		setModalSearchTerm(value);

		if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current);

		modalDebounceRef.current = setTimeout(() => {
			if (value.trim().length === 0) {
				setModalSearchResults([]);
				return;
			}
			fetch(`${import.meta.env.VITE_SERVER_URL}/api/search-products/?query=${encodeURIComponent(value)}`)
				.then((res) => res.json())
				.then((data) => {
					setModalSearchResults(data || []);
				})
				.catch(() => setModalSearchResults([]));
		}, 300);
	};



	// Manual UPC Entry (fetch product details for UPCs)
	const handleManualUPCBlur = async (e) => {
		const upcs = e.target.value.split(/[\s,]+/).filter(Boolean);
		const newUPCs = upcs.filter(upc => !tempProducts.some(p => p.upc === upc));
		if (newUPCs.length === 0) return;
		setAddLoading(true);
		try {
			const { foundProducts, missingUPCs } = await fetchProductsByUPCs(newUPCs);
			setTempProducts(prev => [...prev, ...foundProducts, ...missingUPCs.map(upc => ({ upc, name: "", sku: "", id: "", imageUrl: "" }))]);
			showToast(`Added ${foundProducts.length} products. ${missingUPCs.length} UPCs not found.`, missingUPCs.length ? "warning" : "success");
		} catch {
			showToast("Error searching UPCs.", "error");
		} finally {
			setAddLoading(false);
		}
	};

	// Bulk select/deselect all
	const handleBulkSelectAll = (checked) => {
		if (checked) {
			setSelectedUPCs(tableData.map(item => item.upc));
		} else {
			setSelectedUPCs([]);
		}
	};

	// Individual select/deselect
	const handleBulkSelectOne = (upc, checked) => {
		setSelectedUPCs(prev =>
			checked ? [...prev, upc] : prev.filter(u => u !== upc)
		);
	};

	// Bulk remove handler
	const handleBulkRemoveHotProducts = async () => {
		if (selectedUPCs.length === 0) {
			showToast("No products selected.", "error");
			return;
		}
		if (!window.confirm(`Are you sure you want to remove ${selectedUPCs.length} products from Hot Products?`)) return;
		setLoading(true);
		try {
			const response = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/`,
				{
					method: "DELETE",
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ upcs: selectedUPCs }),
				}
			);
			if (response.notFoundUPCs?.length) {
				showToast(`Some UPCs not found: ${response.notFoundUPCs.join(", ")}`, "warning");
			} else {
				showToast("Selected products removed from Hot Products.", "success");
			}
			setBulkRemoveMode(false);
			setSelectedUPCs([]);
			getData();
		} catch (error) {
			showToast("Error removing products.", "error");
		} finally {
			setLoading(false);
		}
	};

	// Export to Excel handler
	const handleExportExcel = async () => {
		setLoadingExport(true);
		try {
			const categoryId = currentSubCategory || currentCategory || currentMasterCategory;
			const allPageSize = totalPages * pageSize || 1000;
			const response = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/?categoryId=${categoryId ? categoryId : ''}&page=1&page_size=${allPageSize}`,
				{
					method: "GET",
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
			const exportData = response.products || [];
			const worksheet = XLSX.utils.json_to_sheet(exportData);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "HotProducts");
			XLSX.writeFile(workbook, `HotProducts_${Date.now()}.xlsx`);
		} catch (error) {
			console.error("Export failed:", error);
		}
		setLoadingExport(false);
	};

	return (
		<div>
			{/* Custom Toast */}
			{toast.show && (
				<CustomToast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: "", type: toast.type })} />
			)}
			<div className='flex flex-row items-center justify-between'>

				<p className="text-3xl font-semibold text-gray-700">Hot Products</p>
				<div className='flex flex-row gap-2'>
					{/* Add Hot Products Button */}
					<div className="flex flex-col items-end">
						<button
							onClick={handleExportExcel}
							disabled={loadingExport}
							className="bg-green-600 text-white px-4 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-2"
							title="Export all data to Excel"
						>
							{loadingExport ? (
								<Loader2 className="animate-spin" />
							) : (
								<Sheet />
							)}
							Export to Excel
						</button>
					</div>
					<button
						onClick={() => setShowAddModal(true)}
						className="bg-green-600 text-white px-4 py-1.5 rounded-md hover:bg-green-700 cursor-pointer"
					>
						+ Add Products
					</button>

					{bulkRemoveMode ? (
						<button
							onClick={() => { setBulkRemoveMode(false); setSelectedUPCs([]); }}
							className="bg-gray-400 text-white px-3 py-1.5 rounded-md hover:bg-gray-500 cursor-pointer"
						>
							<XIcon className="w-4 h-4 inline-block mr-1" />
							Clear Selection
						</button>
					) : (<button
						onClick={() => { setBulkRemoveMode(true); setSelectedUPCs([]); }}
						className="bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 cursor-pointer"
						disabled={bulkRemoveMode}
					>
						<Trash2 className="w-4 h-4 inline-block mr-1" />
						Remove  Products
					</button>)}
					{/* Bulk Delete Button */}
					{bulkRemoveMode && selectedUPCs.length > 0 && (
						<button
							className="bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 font-semibold"
							onClick={handleBulkRemoveHotProducts}
							disabled={loading}
						>
							<Trash2 className="w-4 h-4 inline-block mr-1" />
							Delete Selected Products ({selectedUPCs.length})
						</button>
					)}
				</div>
			</div>

			<div className={"bg-white select-none w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1" + (loading ? " opacity-50 pointer-events-none" : "")}>
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
				<button
					onClick={getData}
					className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 cursor-pointer"
				>
					Search
				</button>

			</div>

			{/* Add Hot Products Modal */}
			{showAddModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
					<div className="bg-white rounded-lg shadow-lg p-6 w-[80%] md:w-[50%] max-h-[90vh] overflow-y-auto">
						<h2 className="text-lg font-semibold mb-2">Add Hot Products</h2>
						{/* Search Input */}
						<div className="mb-3">
							<label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
							<div className="relative">
								<input
									type="text"
									ref={modalSearchInputRef}
									placeholder="Search by name, UPC ..."
									value={modalSearchTerm}
									onChange={handleModalSearchChange}
									className="pl-10 pr-10 py-2 rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-500 text-sm w-full"
									disabled={addLoading}
								/>
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
									<Search className="w-4 h-4" />
								</span>
								{modalSearchTerm && (
									<button
										className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
										onClick={() => { setModalSearchTerm(""); setModalSearchResults([]); }}
										type="button"
									>
										<X className="w-4 h-4" />
									</button>
								)}
								{/* Search Results Dropdown */}
								{modalSearchResults?.length > 0 && (
									<div className="absolute left-0 right-0 mt-2 py-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 h-fit w-full max-h-60 overflow-y-auto">
										{modalSearchResults.map((item, idx) => (
											<div
												key={item?.document?.id || idx}
												className="flex flex-row gap-2 w-full items-center justify-start px-4 py-1 h-fit hover:bg-indigo-50 cursor-pointer text-sm"
												onClick={() => handleAddTempProduct(item)}
											>
												<img src={item?.document?.imageUrl || "/static/images/default.png"} alt={item?.document?.productName} className="w-10 h-10 rounded mr-2 inline-block" />
												<div className="flex flex-col">
													<span className="font-medium">{item?.document?.productName}</span>
													<span className="text-xs text-gray-500">UPC: {item?.document?.upc} | SKU: {item?.document?.sku}</span>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
						<div className='flex flex-row items-start justify-between w-full gap-2'>

							{/* Excel Import */}
							<div className="mb-3 w-[30%]">
								<label className="block text-sm font-medium text-gray-700 mb-1">Import Excel/CSV</label>
								<label className="relative cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center">
									<Upload className="h-5 w-5 mr-2 text-gray-400" />
									<span>Choose File</span>
									<input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={excelImportLoading || addLoading} />
								</label>
								{excelImportLoading && <p className="text-xs text-gray-500 mt-2">Importing...</p>}
							</div>
							{/* Manual UPC Entry */}
							<div className="mb-3 w-[70%]">
								<label className="block text-sm font-medium text-gray-700 mb-1">Add UPCs Manually</label>
								<textarea
									className="w-full border rounded p-2 mb-2 focus:outline-none focus:border-indigo-500"
									rows={2}
									placeholder="Enter UPCs separated by comma, space or newline"
									disabled={addLoading}
									onBlur={handleManualUPCBlur}
								/>
							</div>
						</div>
						{/* Temporary Table */}
						<div className="mb-3">
							<label className="block text-sm font-medium text-gray-700 mb-1">Products to Add</label>
							<div className="border rounded-md max-h-40 overflow-y-auto">
								<table className="w-full text-sm">
									<thead className='sticky top-0 z-10 border-b border-gray-300'>
										<tr className="bg-gray-100">
											<th className="px-2 py-1 text-left">UPC</th>
											<th className="px-2 py-1 text-left">Name</th>
											<th className="px-2 py-1 text-center">Remove</th>
										</tr>
									</thead>
									<tbody>
										{tempProducts.length > 0 ? tempProducts.map((p, idx) => (
											<tr key={p.upc} className='border-b border-gray-300 last:border-none'>
												<td className="px-2 py-1">{p?.upc}</td>
												<td className="px-2 py-1">{p?.name}</td>
												<td className="px-2 py-1 text-center">
													<button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveTempProduct(p?.upc)}>
														<Trash2 className="w-4 h-4" />
													</button>
												</td>
											</tr>
										)) : (
											<tr>
												<td colSpan={4} className="px-2 py-2 text-center text-gray-400">No products added yet.</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
						{/* Modal Actions */}
						<div className="flex gap-2 justify-end mt-4">
							<button
								onClick={() => { setShowAddModal(false); setTempProducts([]); }}
								className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400"
								disabled={addLoading}
							>Cancel</button>
							<button
								onClick={handleAddHotProducts}
								className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-700"
								disabled={addLoading || tempProducts.length === 0}
							>{addLoading ? "Adding..." : "Add All"}</button>
						</div>
					</div>
				</div>
			)}

			{/* Table Section */}
			<div className={"mt-5 relative bg-white border-t border-gray-300 w-full h-fit rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500"}>
				{loading && (
					<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={60} height={60} className="mx-auto animate-spin">
							<circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} />
						</svg>
					</div>
				)}
				<div className="h-fit min-h-32 max-h-[calc(100vh-23rem)] overflow-y-auto">
					<PhotoProvider>
						<table className={"w-full " + (loading ? "opacity-50 pointer-events-none" : "")}>
							<thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
								<tr className="border-b border-gray-300 bg-gray-100 leading-4">
									{bulkRemoveMode && (
										<th className="text-center py-4 px-1">
											<input
												className='cursor-pointer accent-indigo-500 h-4 w-4'
												type="checkbox"
												checked={selectedUPCs.length === tableData.length && tableData.length > 0}
												onChange={e => handleBulkSelectAll(e.target.checked)}
											/>
										</th>
									)}
									<th className="text-center py-4 px-1">SR</th>
									<th className="text-left p-4 border-l border-gray-300">Product</th>
									<th className="text-center p-4 border-l border-gray-300">UPC</th>
									<th className="text-center p-4 border-l border-gray-300">SKU</th>
									<th className="text-center p-4 border-l border-gray-300">Quantity</th>
									<th className="text-center p-4 border-l border-gray-300">Cost Price</th>
									<th className="text-center p-4 border-l border-gray-300">Retail Price</th>
								</tr>
							</thead>
							<tbody className="overflow-y-auto">
								{tableData?.map((item, index) => (
									<tr key={index} className={index % 2 === 0 ? "" : "bg-gray-100"}>
										{bulkRemoveMode && (
											<td className="py-2 px-1 w-fit text-center">
												<input
													type="checkbox"
													className='cursor-pointer accent-indigo-500 h-4 w-4'
													checked={selectedUPCs.includes(item.upc)}
													onChange={e => handleBulkSelectOne(item.upc, e.target.checked)}
												/>
											</td>
										)}
										<td className="py-2 px-1 w-fit text-center">{(page - 1) * pageSize + index + 1}</td>
										<td className="py-0 px-2 border-l border-gray-300 w-[40%] group">
											<div className="flex items-center ">
												{pageSize < 50 && (<PhotoView src={item?.imageUrl || "/static/images/default.png"}>
													<img
														src={item?.imageUrl ? item.imageUrl : '/static/images/default.png'}
														className="w-8 h-8 mr-2 cursor-pointer"
													/>
												</PhotoView>)}
												<a
													target="_blank"
													rel="noopener noreferrer"
													href={`https://erp.101distributorsga.com/product/${item?.id}/edit`}
													className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer"
												>
													({item?.id})
												</a>
												<p
													className="truncate line-clamp-1 group-hover:line-clamp-none whitespace-break-spaces h-6 group-hover:h-fit"
													onClick={() => {
														setSearch(item?.name);
														document.querySelector("#search")?.focus();
													}}
													title="Click to search for this product"
												>
													{item?.name}
												</p>
											</div>
										</td>
										<td className="py-2 px-2 text-center border-l border-gray-300">{item?.upc || "-"}</td>
										<td className="py-2 px-2 text-center border-l border-gray-300">{item?.sku || "-"}</td>
										<td className="py-2 px-2 text-center border-l border-gray-300">{item?.quantity ?? "-"}</td>
										<td className="py-2 px-2 text-center border-l border-gray-300">{item?.costPrice != null ? `$${item?.costPrice.toFixed(2)}` : "-"}</td>
										<td className="py-2 px-2 text-center border-l border-gray-300">{item?.retailPrice != null ? `$${item?.retailPrice.toFixed(2)}` : "-"}</td>
									</tr>
								))}
								{tableData?.length === 0 && !loading && (
									<tr>
										<td colSpan={9} className="text-center py-4 text-gray-500">No data available. First select a category and search.</td>
									</tr>
								)}
							</tbody>
						</table>
					</PhotoProvider>
				</div>

			</div>
			{/* Pagination Section */}
			{tableData?.length > 0 && !loading && (
				<div className="flex items-center justify-between mt-5 gap-5">
					<div className="bg-white w-fit h-fit rounded-lg shadow-lg ml-auto">
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

export default HotProduct