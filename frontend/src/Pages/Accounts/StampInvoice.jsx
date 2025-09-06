import React, { useState, useRef } from 'react'
import Calendar from '../../Components/utils/Calendar'
import { Loader, Database, CheckCircle, X } from 'lucide-react'
import { set } from 'lodash';

const Toast = ({ message, onClose }) => {
	function downloadZip() {
		if (message?.zipUrl) {
			fetch(import.meta.env.VITE_SERVER_URL + message.zipUrl)
				.then(res => res.blob())
				.then(blob => {
					const url = window.URL.createObjectURL(blob)
					window.open(url, '_blank')
					setTimeout(() => window.URL.revokeObjectURL(url), 10000)
				})
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
								<button onClick={downloadZip} className="mt-2 inline-block text-pink-600 underline text-xs">
									Download ZIP
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

function StampInvoice() {
	const [startDate, setStartDate] = useState(null)
	const [endDate, setEndDate] = useState(null)
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
	const logRef = useRef([])

	const startSync = async () => {
		setIsSyncing(true)
		setStatus('starting')
		setProgress(0)
		setLog([])
		setErrorLog([])
		setZipUrl(null)
		setError(null)
		logRef.current = []
		try {
			const url = `${import.meta.env.VITE_SERVER_URL}/api/accounts/stamp-invoice/?startDate=${startDate}&endDate=${endDate}`
			const response = await fetch(url, { method: 'GET' })
			if (!response.body) throw new Error('No response body')
			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''
			const jsonRegex = /{[^}]*}(?={|$)/g // matches each JSON object

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
							setProgress(100)
							setStatus('completed')
							setZipUrl("/api/accounts/download-stamped-invoices/")
							setToastMessage({ zipUrl: "/api/accounts/download-stamped-invoices/" })
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
			fetch(import.meta.env.VITE_SERVER_URL + zipUrl)
				.then(res => res.blob())
				.then(blob => {
					const url = window.URL.createObjectURL(blob)
					window.open(url, '_blank')
					setTimeout(() => window.URL.revokeObjectURL(url), 10000)
				})
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
					<div className="mb-4">
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
					</div>
					<button
						onClick={startSync}
						disabled={isSyncing || !startDate || !endDate}
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
						{/* Log */}
						<div className="mb-2">
							<div className="text-xs text-gray-500 mb-1">Processed:</div>
							<ul className="text-xs text-gray-700 max-h-40 overflow-y-auto">
								{log?.map((item, idx) => (
									<li key={idx} className="mb-1">
										Customer: <span className="font-semibold">{item?.data?.customerName || item?.customerId}</span>
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
								<button onClick={downloadZip} className="text-pink-600 underline">
									Download Stamped Invoices ZIP
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