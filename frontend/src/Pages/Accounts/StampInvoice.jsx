import React, { useState, useRef } from 'react'
import Calendar from '../../Components/utils/Calendar'
import { Loader, Database, CheckCircle, X } from 'lucide-react'
import { useAtom } from 'jotai';
import { accountWebsitesAtom } from '../../Variables';

const Toast = ({ message, onClose }) => {
	const [isDownloading, setIsDownloading] = useState(false);

	function downloadZip() {
		if (message?.zipUrl) {
			setIsDownloading(true);
			const token = localStorage.getItem("accessToken");
			fetch(import.meta.env.VITE_SERVER_URL + message.zipUrl, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
				.then(res => res.blob())
				.then(blob => {
					const url = window.URL.createObjectURL(blob)
					window.open(url, '_blank')
					setTimeout(() => window.URL.revokeObjectURL(url), 10000)
				})
				.finally(() => setIsDownloading(false))
		} else {
			alert("No ZIP file available for download.")
		}
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 w-96 animate-slideIn">
			<div className="max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
				<div className="flex-1 w-0 p-4">
					<div className="flex items-start">
						<div className="flex-shrink-0 pt-0.5">
							<CheckCircle className="h-10 w-10 text-green-500" />
						</div>
						<div className="ml-3 flex-1">
							<p className="text-sm font-medium text-gray-900">
								Stamped Invoices Completed
							</p>
							<p className="mt-1 text-sm text-gray-500">
								All selected invoices have been stamped and zipped.
							</p>
							{message?.zipUrl && (
								<button onClick={downloadZip} disabled={isDownloading} className="mt-2 inline-flex items-center gap-1.5 text-pink-600 underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">
									{isDownloading ? (
										<>
											<Loader className="h-3 w-3 animate-spin" />
											Downloading...
										</>
									) : (
										'Download ZIP'
									)}
								</button>
							)}
						</div>
					</div>
				</div>
				<div className="flex border-l border-gray-200">
					<button
						onClick={onClose}
						className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-pink-600 hover:text-pink-500 focus:outline-none"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</div>
		</div>
	)
};

const MIN_PAYMENT_DATE = '2019-01-01';

function parseInvoiceIds(raw) {
	if (!raw || !String(raw).trim()) return [];
	const seen = new Set();
	const ids = [];
	for (const part of String(raw).split(/[\n,;]+/)) {
		const id = part.trim();
		if (id && !seen.has(id)) {
			seen.add(id);
			ids.push(id);
		}
	}
	return ids;
}

function StampInvoice() {
	const [startDate, setStartDate] = useState(null)
	const [endDate, setEndDate] = useState(null)
	const [customerName, setCustomerName] = useState('')
	const [companyName, setCompanyName] = useState('')
	const [dbaName, setDbaName] = useState('')
	const [invoiceIdsText, setInvoiceIdsText] = useState('')
	const [appliedFilters, setAppliedFilters] = useState(null)
	const [dateFormat] = useState('yyyy-MM-dd')
	const [isSyncing, setIsSyncing] = useState(false)
	const [progress, setProgress] = useState(0)
	const [status, setStatus] = useState('idle')
	const [log, setLog] = useState([])
	const [errorLog, setErrorLog] = useState([])
	const [showToast, setShowToast] = useState(false)
	const [toastMessage, setToastMessage] = useState(null)
	const [zipUrl, setZipUrl] = useState(null)
	const [error, setError] = useState(null)
	const [isDownloading, setIsDownloading] = useState(false)
	const logRef = useRef([])
	const [selectedCompany, setSelectedCompany] = useAtom(accountWebsitesAtom);
	const [websiteUrl, setWebsiteUrl] = useState(selectedCompany !== "101GA" ? "https://erp.rivercitywholesale.com" : `https://erp.101distributorsga.com`);

	const parsedInvoiceIds = parseInvoiceIds(invoiceIdsText);
	const useInvoiceIdMode = parsedInvoiceIds.length > 0;

	const isDateBeforeMin = (dateStr) => {
		if (!dateStr) return false;
		return String(dateStr).slice(0, 10) < MIN_PAYMENT_DATE;
	};

	const startSync = async () => {
		const invoiceIds = parseInvoiceIds(invoiceIdsText);

		if (invoiceIds.length === 0) {
			if (!startDate || !endDate) {
				alert('Please select a payment date range, or enter invoice IDs to stamp.');
				return;
			}
			if (isDateBeforeMin(startDate) || isDateBeforeMin(endDate)) {
				alert(`Dates before ${MIN_PAYMENT_DATE} are not allowed. Please select a payment date range on or after January 1, 2019.`);
				return;
			}
		}

		const trimmedCustomer = customerName.trim();
		const trimmedCompany = companyName.trim();
		const trimmedDba = dbaName.trim();
		const filtersForRun = invoiceIds.length > 0
			? {
				mode: 'invoiceIds',
				invoiceIds,
				customerName: null,
				companyName: null,
				dbaName: null,
			}
			: {
				mode: 'filters',
				invoiceIds: null,
				customerName: trimmedCustomer || null,
				companyName: trimmedCompany || null,
				dbaName: trimmedDba || null,
			};

		setIsSyncing(true)
		setStatus('starting')
		setProgress(0)
		setLog([])
		setErrorLog([])
		setZipUrl(null)
		setError(null)
		setAppliedFilters(filtersForRun)
		logRef.current = []
		try {
			const token = localStorage.getItem("accessToken");
			const userInfo = JSON.parse(localStorage.getItem("101-userInfo") || "{}");
			const username = userInfo.username || "unknown";
			let url = `${import.meta.env.VITE_SERVER_URL}/api/accounts/stamp-invoice/?website=${selectedCompany}&username=${encodeURIComponent(username)}`
			if (invoiceIds.length > 0) {
				url += `&invoiceIds=${encodeURIComponent(invoiceIds.join(','))}`
			} else {
				url += `&startDate=${startDate}&endDate=${endDate}`
				if (trimmedCustomer) url += `&customerName=${encodeURIComponent(trimmedCustomer)}`
				if (trimmedCompany) url += `&companyName=${encodeURIComponent(trimmedCompany)}`
				if (trimmedDba) url += `&dbaName=${encodeURIComponent(trimmedDba)}`
			}
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			if (!response.body) throw new Error('No response body')
			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })

				let match
				while ((match = buffer.match(/^{[\s\S]*?}(?={|$)/))) {
					const jsonStr = match[0]
					try {
						const data = JSON.parse(jsonStr)
						if (data.status === 'processed') {
							if (typeof data.percent === 'number') {
								setProgress(Math.round(data.percent))
							}
							logRef.current.push(data)
							setLog([...logRef.current])
							setStatus('syncing')
						}
						if (data.zipUrl) {
							const userInfo = JSON.parse(localStorage.getItem("101-userInfo") || "{}");
							const username = userInfo.username || "unknown";
							setProgress(100)
							setStatus('completed')
							const downloadUrl = `/api/accounts/download-stamped-invoices/?username=${encodeURIComponent(username)}`;
							setZipUrl(downloadUrl)
							setToastMessage({ zipUrl: downloadUrl })
							setShowToast(true)
						}
						if (data.error) {
							setErrorLog(prev => [...prev, data.error])
						}
					} catch (e) {
						// ignore parse errors
					}
					buffer = buffer.slice(jsonStr.length)
				}
			}
		} catch (err) {
			setError('Sync failed. Please try again.')
			setStatus('error')
		} finally {
			setIsSyncing(false)
		}
	}

	function downloadZip() {
		if (zipUrl) {
			setIsDownloading(true);
			const token = localStorage.getItem("accessToken");
			fetch(import.meta.env.VITE_SERVER_URL + zipUrl, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
				.then(res => res.blob())
				.then(blob => {
					const url = window.URL.createObjectURL(blob)
					window.open(url, '_blank')
					setTimeout(() => window.URL.revokeObjectURL(url), 10000)
				})
				.finally(() => setIsDownloading(false))
		} else {
			alert("No ZIP file available for download.")
		}
	}

	return (
		<div className="p-4 sm:p-6 lg:p-8">
			{showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
			<div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Controls */}
				<div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
					<header className="text-left mb-6 pb-4 border-b border-gray-200">
						<h1 className="text-2xl font-bold text-gray-800">Stamp Invoice</h1>
						<p className="text-gray-500 mt-1 text-sm">Stamp invoices with PAID and download as ZIP</p>
					</header>
					<div className={`mb-4 ${useInvoiceIdMode ? 'opacity-50 pointer-events-none' : ''}`}>
						<span className="block text-sm text-gray-700 mb-1">Payment Date Range:</span>
						<Calendar
							startDate={startDate}
							endDate={endDate}
							setStartDate={setStartDate}
							setEndDate={setEndDate}
							dateFormat={dateFormat}
							onRight={false}
							accent="pink"
						/>
						<p className="mt-1 text-xs text-gray-400">Earliest allowed date: January 1, 2019</p>
					</div>
					<div className={`mb-4 space-y-3 ${useInvoiceIdMode ? 'opacity-50 pointer-events-none' : ''}`}>
						<div>
							<label className="block text-sm text-gray-700 mb-1" htmlFor="stamp-customer-name">
								Customer Name <span className="text-gray-400 font-normal">(optional)</span>
							</label>
							<input
								id="stamp-customer-name"
								type="text"
								value={customerName}
								onChange={(e) => setCustomerName(e.target.value)}
								disabled={isSyncing || useInvoiceIdMode}
								placeholder="e.g. John Doe"
								className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
							/>
						</div>
						<div>
							<label className="block text-sm text-gray-700 mb-1" htmlFor="stamp-company-name">
								Company Name <span className="text-gray-400 font-normal">(optional)</span>
							</label>
							<input
								id="stamp-company-name"
								type="text"
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								disabled={isSyncing || useInvoiceIdMode}
								placeholder="e.g. John Doe LLC"
								className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
							/>
						</div>
						<div>
							<label className="block text-sm text-gray-700 mb-1" htmlFor="stamp-dba-name">
								DBA Name <span className="text-gray-400 font-normal">(optional)</span>
							</label>
							<input
								id="stamp-dba-name"
								type="text"
								value={dbaName}
								onChange={(e) => setDbaName(e.target.value)}
								disabled={isSyncing || useInvoiceIdMode}
								placeholder="e.g. John Doe INC"
								className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
							/>
						</div>
					</div>
					<div className="mb-4">
						<label className="block text-sm text-gray-700 mb-1" htmlFor="stamp-invoice-ids">
							Invoice IDs <span className="text-gray-400 font-normal">(optional — overrides all filters above)</span>
						</label>
						<textarea
							id="stamp-invoice-ids"
							value={invoiceIdsText}
							onChange={(e) => setInvoiceIdsText(e.target.value)}
							disabled={isSyncing}
							rows={4}
							placeholder={"One ID per line, or comma-separated\ne.g.\n12345\n67890\nor 12345, 67890"}
							className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-y"
						/>
						{useInvoiceIdMode ? (
							<p className="mt-1 text-xs text-pink-600">
								{parsedInvoiceIds.length} invoice ID{parsedInvoiceIds.length === 1 ? '' : 's'} — date and name filters will be ignored.
							</p>
						) : (
							<p className="mt-1 text-xs text-gray-400">
								If provided, only these invoices are stamped. Date range and name filters are not used.
							</p>
						)}
					</div>
					<button
						onClick={startSync}
						disabled={isSyncing || (!useInvoiceIdMode && (!startDate || !endDate))}
						className={`w-full font-semibold py-2.5 px-6 rounded-md flex items-center justify-center ${isSyncing
							? 'bg-gray-200 cursor-not-allowed'
							: 'bg-pink-600 hover:bg-pink-700 text-white'
							}`}
					>
						{isSyncing ? (
							<Loader className="h-5 w-5 animate-spin mr-2" />
						) : (
							<Database className="h-5 w-5 mr-2" />
						)}
						{isSyncing ? 'Stamping...' : 'Start Stamping'}
					</button>
					{status === 'error' && (
						<div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
							{error}
						</div>
					)}
				</div>
				{/* Progress & Log */}
				<div className="lg:col-span-2">
					<header className="text-left mb-6 pb-4 border-b border-gray-200">
						<h1 className="text-2xl font-bold text-gray-800">Stamping Progress</h1>
						<p className="text-gray-500 mt-1 text-sm">
							{isSyncing
								? `Stamping invoices... ${progress}%`
								: status === 'completed'
									? 'Stamping completed'
									: 'Ready to stamp'}
						</p>
					</header>
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
						{/* Progress Bar */}
						<div className="mb-8">
							<div className="flex justify-between mb-2">
								<span className="text-gray-600">Progress</span>
								<span className="text-pink-600 font-semibold">{progress}%</span>
							</div>
							<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
								<div
									className="h-full bg-pink-600 transition-all duration-500"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
						{appliedFilters && (isSyncing || status === 'syncing' || status === 'completed' || status === 'starting') && (
							<div className="mb-4 p-3 bg-pink-50 border border-pink-100 rounded-md text-xs text-gray-700">
								{appliedFilters.mode === 'invoiceIds' ? (
									<>
										<div className="font-semibold text-pink-700 mb-1">Invoice ID mode (all other filters ignored):</div>
										<p className="mb-1">
											Stamping <span className="font-semibold">{appliedFilters.invoiceIds.length}</span> invoice
											{appliedFilters.invoiceIds.length === 1 ? '' : 's'} by ID.
										</p>
										<ul className="max-h-24 overflow-y-auto font-mono text-[11px] space-y-0.5">
											{appliedFilters.invoiceIds.map((id) => (
												<li key={id}>{id}</li>
											))}
										</ul>
									</>
								) : (
									<>
										<div className="font-semibold text-pink-700 mb-1">Filters applied for this run:</div>
										<ul className="space-y-0.5">
											<li>
												Customer Name:{' '}
												<span className="font-semibold">
													{appliedFilters.customerName || '— (not applied)'}
												</span>
											</li>
											<li>
												Company Name:{' '}
												<span className="font-semibold">
													{appliedFilters.companyName || '— (not applied)'}
												</span>
											</li>
											<li>
												DBA Name:{' '}
												<span className="font-semibold">
													{appliedFilters.dbaName || '— (not applied)'}
												</span>
											</li>
										</ul>
										{(appliedFilters.customerName || appliedFilters.companyName || appliedFilters.dbaName) ? (
											<p className="mt-1.5 text-gray-500">
												Matching invoices are loaded from Invoice List filters (customer / company / DBA) in the selected date range, then stamped.
											</p>
										) : (
											<p className="mt-1.5 text-gray-500">
												No name filters applied — all payments in the date range will be stamped.
											</p>
										)}
									</>
								)}
							</div>
						)}
						{/* Log */}
						<div className="mb-2">
							<div className="text-xs text-gray-500 mb-1">Processed:</div>
							<ul className="text-xs text-gray-700 max-h-40 overflow-y-auto">
								{log?.map((item, idx) => (
									<li key={idx} className="mb-1">
										{item?.data?.orderId && (
											<>Invoice: <span className="font-mono font-semibold">{item.data.orderId}</span> &mdash; </>
										)}
										Customer: <span className="font-semibold">{item?.data?.customerName || item?.customerId || 'N/A'}</span>
										{item?.data?.company && (
											<> &mdash; <span className="italic">{item?.data?.company}</span></>
										)}
										, Transaction: <span className="font-mono">{item?.transactionId}</span>
										{typeof item?.data?.paymentAmount === 'number' && (
											<> &mdash; <span className="text-green-700 font-semibold">${item?.data?.paymentAmount.toFixed(2)}</span></>
										)}
									</li>
								))}
								{log?.length === 0 && <li className="text-gray-400">No invoices processed yet.</li>}
							</ul>
						</div>
						{errorLog.length > 0 && (<div className="mb-2">
							<div className="text-xs text-gray-500 mb-1">Errors:</div>
							<ul className="text-xs text-gray-700 max-h-40 overflow-y-auto">
								{errorLog.map((error, idx) => (
									<li key={idx} className="mb-1">
										{error}
									</li>
								))}
							</ul>
						</div>)}
						{zipUrl && (
							<div className="mt-4">
								<button onClick={downloadZip} disabled={isDownloading} className="inline-flex items-center gap-2 text-pink-600 underline disabled:opacity-50 disabled:cursor-not-allowed">
									{isDownloading ? (
										<>
											<Loader className="h-4 w-4 animate-spin" />
											Downloading...
										</>
									) : (
										'Download Stamped Invoices ZIP'
									)}
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default StampInvoice