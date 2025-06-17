import { useEffect, useState, useMemo } from "react";
import { apiRequest, getAuthHeaders } from "../../../utils/api";
import { Sparkles, Info, AlertTriangle, ShieldAlert, Check } from 'lucide-react';

// Helper to determine the icon and colors for the loading modal based on status type
const useStatusStyle = (type) => {
	return useMemo(() => {
		switch (type) {
			case 'warning':
				return {
					Icon: AlertTriangle,
					gradient: 'from-amber-50 to-amber-200',
					shadow: 'shadow-amber-200',
					border: 'border-amber-400',
					text: 'text-amber-800'
				};
			case 'error':
				return {
					Icon: ShieldAlert,
					gradient: 'from-red-100 to-red-200',
					shadow: 'shadow-red-200',
					border: 'border-red-400',
					text: 'text-red-800'
				};
			case 'info':
			default:
				return {
					Icon: Info,
					gradient: 'from-indigo-50 to-indigo-200',
					shadow: 'shadow-indigo-200',
					border: 'border-indigo-400',
					text: 'text-gray-700'
				};
			case 'status':
				return {
					Icon: Check,
					gradient: 'from-gray-100 to-gray-100',
					shadow: '',
					border: 'border-gray-200',
					text: 'text-gray-700'
				};
		}
	}, [type]);
};


const AIReport = () => {
	const [reportName, setReportName] = useState("Purchase Advice");
	const [theme, setTheme] = useState("indigo");
	const [report, setReport] = useState("");
	const [isStatusLoading, setIsStatusLoading] = useState(false);

	// State for the rich loading status
	const [loadingStatus, setLoadingStatus] = useState({
		title: "Initializing...",
		message: "Waiting for the workflow to start.",
		subMessage: "",
		type: "info" // 'info', 'warning', 'error'
	});
	const [progress, setProgress] = useState(0);
	const [totalCategories, setTotalCategories] = useState(11); // Based on python config
	const [processedCategories, setProcessedCategories] = useState(0);

	const { Icon, gradient, shadow, border, text } = useStatusStyle(loadingStatus.type);

	useEffect(() => {
		const fetchData = async () => {
			const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/ai-report/?reportName=${reportName}`, {
				method: "GET",
			});
			setReport(response.report);
		};
		fetchData();
	}, []);

	const handleGenerateNewReport = async () => {
		setIsStatusLoading(true);
		setProgress(0);
		setProcessedCategories(0);
		setLoadingStatus({ title: "Initializing...", message: "Connecting to the AI agency...", subMessage: "", type: "info" });

		try {
			const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/ai-report/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...getAuthHeaders(),
				},
				body: JSON.stringify({
					reportName,
					theme,
				}),
			});

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					setLoadingStatus(prev => ({ ...prev, title: "Finalizing Report", message: "Almost done..." }));
					break;
				}

				const text = decoder.decode(value, { stream: true });

				for (const line of text.split('|||')) {
					try {
						const data = JSON.parse(line);

						// Final report received
						if (data.report) {
							setReport(data.report);
							setIsStatusLoading(false);
							return;
						}

						// Structured status update
						if (data.type) {
							// Update progress bar when a new category starts
							if (data.phase === 'CATEGORY_START') {
								const newCount = processedCategories + 1;
								setProcessedCategories(newCount);
								setProgress(Math.round((newCount / totalCategories) * 100));
							}

							setLoadingStatus(prev => ({
								...prev,
								title: data.details?.category ? `Processing: ${data.details.category}` : prev.title,
								message: data.message || prev.message,
								subMessage: data.type === 'status' ? data.message : prev.subMessage,
								type: ['warning', 'status'].includes(data.type) ? data.type : prev.type,
							}));

							// On workflow failure, show message and stop.
							if (data.phase === 'WORKFLOW_FAILURE') {
								setLoadingStatus({ title: "Workflow Failed", message: data.message, subMessage: "", type: 'error' });
								// Keep modal open for a few seconds to show error
								setTimeout(() => setIsStatusLoading(false), 5000);
								return;
							}

							if (data.phase === 'FINAL_REPORT') {
								setLoadingStatus({ title: "Workflow Completed", message: "Report generation successful!", subMessage: "", type: 'status' });
								// Keep modal open for a few seconds to show success
								setReport(data.finalReport);
								setTimeout(() => setIsStatusLoading(false), 5000);
								return;
							}
						}

					} catch (e) {
						console.error("Error parsing stream data:", e, "Line:", line);
					}
				}
			}
		} catch (error) {
			console.error("Error generating report:", error);
			setLoadingStatus({ title: "Connection Error", message: "Failed to connect to the report generation service.", subMessage: error.message, type: 'error' });
			setTimeout(() => setIsStatusLoading(false), 5000);
		}
	}

	return (
		<div className="flex flex-row h-[calc(100vh-7rem)] w-full">
			<iframe
				srcDoc={report}
				className="w-full h-full"
				title="AI Report"
				sandbox="allow-scripts allow-same-origin"
				style={{ border: "none" }}
			/>

			<button onClick={handleGenerateNewReport} disabled={isStatusLoading} className="absolute top-14 right-14 inline-flex items-center justify-center gap-4 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
				<div className="absolute inset-0 duration-1000 opacity-20 transitiona-all bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 rounded-xl blur-lg filter group-hover:opacity-60 group-hover:duration-200" />
				<div className="group relative inline-flex items-center justify-center text-base rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-gray-600/30">
					<Sparkles className="h-5 w-5 mr-2" />
					{isStatusLoading ? 'Generating...' : 'Generate New Report'}
				</div>
			</button>

			{isStatusLoading && (
				<div className="absolute top-0 left-0 h-full w-full overflow-hidden flex items-center justify-center backdrop-blur-md bg-gray-900/25">
					<div className={`w-full max-w-xl p-6 relative rounded-2xl flex flex-col transition-all bg-gradient-to-br ${gradient} shadow-inner ${shadow} border ${border} border-dashed`}>
						<video src="https://cdn.dribbble.com/userupload/17608183/file/original-a9b30b0413131d806620dc5db95c99f1.mp4" autoPlay loop muted className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-20" />
						<div className="flex items-center mb-4">
							<Icon className={`h-8 w-8 mr-3 ${text}`} />
							<h1 className={`text-2xl font-bold ${text}`}>{loadingStatus.title}</h1>
						</div>

						<div className="text-left text-gray-800 z-10 w-full">
							<p className="text-lg font-medium text-gray-700">{loadingStatus.message}</p>
							<p className="text-sm text-indigo-900 truncate mt-1 h-5">{loadingStatus.subMessage}</p>

							{/* <div className="mt-4 w-full bg-white rounded-full h-2.5">
								<div
									className="bg-green-500 h-full rounded-full transition-all duration-500"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="text-right text-sm font-semibold text-gray-700 mt-1">{progress}% Complete</p> */}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AIReport;