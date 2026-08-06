import React, { useState, useRef, useEffect } from "react";
import { apiRequest } from '../../../../utils/api'

const syncItems = [
	{
		key: "all",
		label: "Sync All Data",
		info: "Sync all your data including products, categories, and business type.",
	},
	{
		key: "products",
		label: "Sync Products",
		info: "Sync your latest product data with the server.",
	},
	{
		key: "productsHistory",
		label: "Sync Products History",
		info: "Sync your product history data with the server.",
	},
	{
		key: "invoice",
		label: "Sync Invoices",
		info: "Sync your invoice data to keep billing information accurate.",
	},
	{
		key: "categories",
		label: "Sync Categories",
		info: "Sync all product categories to ensure up-to-date classification.",
	},
	{
		key: "businessType",
		label: "Sync Business Type",
		info: "Sync your business type information for accurate reporting.",
	},
	{
		key: "vendor",
		label: "Sync Vendor Data",
		info: "Sync your vendor information for accurate reporting.",
	},
	{
		key: "customer",
		label: "Sync Customer Data",
		info: "Sync your customer information for accurate reporting.",
	},
	{
		key:"search",
		label: "Search Data",
		info: "Sync your search data to ensure accurate search results.",
	}
];

const SyncPage = () => {
	const [loading, setLoading] = useState({
		products: false,
		productsHistory: false,
		categories: false,
		businessType: false,
		vendor: false,
		customer: false,
		search: false,
		invoice: false,
		all: false,
	});
	const [progress, setProgress] = useState({
		products: 0,
		productsHistory: 0,
		categories: 0,
		businessType: 0,
		vendor: 0,
		search: 0,
		customer: 0,
		invoice: 0,
		all: 0,
	});
	const [error, setError] = useState(null);
	const [backgroundSync, setBackgroundSync] = useState(false);
	const pollInterval = useRef(null);

	useEffect(() => {
		return () => {
			if (pollInterval.current) {
				clearInterval(pollInterval.current);
			}
		};
	}, []);

	const handleSync = async (key) => {
		try {
			setLoading((prev) => ({ ...prev, [key]: true }));
			setProgress((prev) => ({ ...prev, [key]: 0 }));
			setError(null);

			if (backgroundSync) {
				// Background mode: Start sync and poll for status
				const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/sync/sync-data/`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ syncType: key, background: true }),
				});

				const result = await response.json();
				if (result.status === "started") {
					// Start polling for progress
					const pollForProgress = async () => {
						const statusResponse = await fetch(
							`${import.meta.env.VITE_SERVER_URL}/api/sync/sync-data/?syncType=${key}`
						);
						const statusData = await statusResponse.json();

						if (typeof statusData.progress === "number") {
							setProgress((prev) => ({ ...prev, [key]: Math.min(100, statusData.progress) }));
						}

						if (statusData.done || statusData.status === "done") {
							setLoading((prev) => ({ ...prev, [key]: false }));
							if (pollInterval.current) {
								clearInterval(pollInterval.current);
								pollInterval.current = null;
							}
							if (statusData.error) {
								setError(`Error syncing ${key}: ${statusData.error}`);
							}
						}
					};

					// Poll every 2 seconds
					pollInterval.current = setInterval(pollForProgress, 2000);
					// Initial poll
					pollForProgress();
				}
			} else {
				// Real-time streaming mode (existing behavior)
				const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/sync/sync-data/`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ syncType: key }),
				});

				if (!response.body) {
					throw new Error("No response body");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let done = false;
				let buffer = "";

				while (!done) {
					const { value, done: streamDone } = await reader.read();
					done = streamDone;
					if (value) {
						buffer += decoder.decode(value, { stream: true });
						let lines = buffer.split("\n");
						buffer = lines.pop(); // keep incomplete line for next chunk

						for (let line of lines) {
							line = line.trim();
							if (line.startsWith("data:")) {
								const jsonStr = line.replace("data:", "").trim();
								if (jsonStr) {
									try {
										const data = JSON.parse(jsonStr);
										if (typeof data.progress === "number") {
											setProgress((prev) => ({
												...prev,
												[key]: Math.min(100, data.progress),
											}));
										}
										if (data.status === "done" || data.progress === 100) {
											setLoading((prev) => ({ ...prev, [key]: false }));
										}
									} catch (e) {
										// ignore parse errors
									}
								}
							}
						}
					}
				}
			}
		} catch (err) {
			setError("Failed to start sync process. Please try again.");
			setLoading((prev) => ({ ...prev, [key]: false }));
		}
	};

	return (
		<div className="py-4 ">
			<h1 className="text-2xl font-semibold mb-6">Sync Data</h1>
			
			{/* Background Sync Toggle */}
			<div className="mb-6 p-4 border rounded-lg shadow-sm bg-gray-50">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-gray-900">Background Sync Mode</p>
						<p className="text-gray-600 text-sm">
							Enable to run syncs in the background with throttled requests (reduces server load)
						</p>
					</div>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							checked={backgroundSync}
							onChange={(e) => setBackgroundSync(e.target.checked)}
							className="sr-only peer"
						/>
						<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
					</label>
				</div>
			</div>

			{error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
			{syncItems.map((item) => {
				// Special handling for "all"
				if (item.key === "all") {
					const allLoading = loading.products || loading.categories || loading.businessType || loading.invoice || loading.vendor || loading.customer || loading.search;
					const allProgress = (progress.products + progress.categories + progress.businessType + progress.invoice + progress.vendor + progress.customer + progress.search) / 7;
					const allCompleted = progress.products === 100 && progress.categories === 100 && progress.businessType === 100 && progress.invoice === 100 && progress.vendor === 100 && progress.customer === 100 && progress.search === 100 && !allLoading;

					return (
						<div key={item.key} className="mb-8 p-4 border border-dashed rounded-lg shadow-sm bg-white">
							<div className="flex items-center justify-between mb-2">
								<div>
									<p className="font-medium">{item.label}</p>
									<p className="text-gray-500 text-sm">{item.info}</p>
								</div>
								<button
									className={`px-4 py-2 rounded bg-indigo-600 text-white font-semibold ${allLoading ? "opacity-60 cursor-not-allowed" : ""}`}
									onClick={() => {
										const syncAll = async () => {
											await handleSync("products");
											await handleSync("categories");
											await handleSync("businessType");
											await handleSync("invoice");
											await handleSync("vendor");
											await handleSync("customer");
											await handleSync("search");
										};
										syncAll();
									}}
									disabled={allLoading}
								>
									{allLoading ? "Syncing..." : "Sync"}
								</button>
							</div>
							<div className="h-3 bg-gray-200 rounded mt-3 overflow-hidden">
								<div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${allProgress}%` }}></div>
							</div>
							{allCompleted && <p className="text-green-600 text-sm mt-2">Sync completed!</p>}
						</div>
					);
				}

				// Default for other items
				return (
					<div key={item.key} className="mb-8 p-4 border border-dashed rounded-lg shadow-sm bg-white">
						<div className="flex items-center justify-between mb-2">
							<div>
								<p className="font-medium">{item.label}</p>
								<p className="text-gray-500 text-sm">{item.info}</p>
							</div>
							<button className={`px-4 py-2 rounded bg-indigo-600 text-white font-semibold ${loading[item.key] ? "opacity-60 cursor-not-allowed" : ""}`} onClick={() => handleSync(item.key)} disabled={loading[item.key]}>
								{loading[item.key] ? "Syncing..." : "Sync"}
							</button>
						</div>
						<div className="h-3 bg-gray-200 rounded mt-3 overflow-hidden">
							<div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress[item.key]}%` }}></div>
						</div>
						{progress[item.key] === 100 && !loading[item.key] && <p className="text-green-600 text-sm mt-2">Sync completed!</p>}
					</div>
				);
			})}
		</div>
	);
};

export default SyncPage;
