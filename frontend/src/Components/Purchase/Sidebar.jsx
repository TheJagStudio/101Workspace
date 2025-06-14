import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { isSidebarOpenAtom } from "../../Variables";

const Sidebar = () => {
	const [activeItem, setActiveItem] = useState("report");
	const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);

	const handleItemClick = (item) => {
		setActiveItem(item);
	};

	useEffect(() => {
		const path = window.location.pathname;
		const item = path.split("/").pop();
		setActiveItem(item.charAt(0).toUpperCase() + item.slice(1));
	}, []);

	return (
		<div className={`absolute flex flex-col h-screen sm:relative bg-white shadow-lg shadow-gray-200 border-r border-gray-200 transition-all duration-300 z-50  ${collapsed ? "w-0 sm:w-20 " : "w-screen sm:w-64 "}`}>
			<div className="flex items-center h-16 px-2 border-b border-gray-200">
				<div className="flex items-center">
					<img src="/static/images/101-logo-purchase.png" alt="Logo" className={"w-auto h-10 mb-0.5 rounded-full transition-all duration-300 opacity-90 "} />
					<span className={`text-3xl font-semibold text-indigo-600 ml-1 transition-all duration-300 ${collapsed ? "hidden" : ""}`}>Purchase</span>
				</div>
				<div className={`ml-auto ${collapsed && "absolute top-5 -right-9"}`}>
					<button onClick={() => setCollapsed((prev) => !prev)} className="text-gray-400 hover:text-gray-600 border border-gray-300 rounded p-1 bg-white" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
							<path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z" />
						</svg>
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="py-4 border-b border-gray-200">
					<div className={`text-xs text-gray-400 ${collapsed ? "px-2" : "px-4"} mb-2`}>GENERAL</div>
					<ul>
						<li className="mb-1">
							<Link to="/purchase/report" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Dashboard" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Dashboard")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Dashboard" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "AI Report"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/po" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Po" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Po")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" className={`w-5 h-5 mr-3 ${activeItem === "Po" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64l16 0c8.8 0 16 7.2 16 16l0 288c0 44.2 35.8 80 80 80l18.7 0c-1.8 5-2.7 10.4-2.7 16c0 26.5 21.5 48 48 48s48-21.5 48-48c0-5.6-1-11-2.7-16l197.5 0c-1.8 5-2.7 10.4-2.7 16c0 26.5 21.5 48 48 48s48-21.5 48-48c0-5.6-1-11-2.7-16l66.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-464 0c-8.8 0-16-7.2-16-16l0-288C128 35.8 92.2 0 48 0L32 0zM224 32c-17.7 0-32 14.3-32 32l0 224c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-224c0-17.7-14.3-32-32-32L224 32zM416 64l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32zm32 128c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-128 0z" />
								</svg>
								{!collapsed && "PO Maker"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Customers" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Customers")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Customers" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "Customers"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Message" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Message")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Message" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && (
									<>
										Message
										<span className="ml-auto bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">8</span>
									</>
								)}
							</Link>
						</li>
					</ul>
				</div>

				<div className="py-4 border-b border-gray-200">
					<div className={`text-xs text-gray-400 ${collapsed ? "px-2" : "px-4"} mb-2`}>INVENTORY</div>
					<ul>
						<li className="mb-1">
							<Link to="/purchase/summary" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Summary" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Summary")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`w-5 h-5 mr-3 ${activeItem === "Summary" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M192 80l0 88 272 0 0-72c0-8.8-7.2-16-16-16L192 80zm-48 0L64 80c-8.8 0-16 7.2-16 16l0 72 96 0 0-88zM48 216l0 80 96 0 0-80-96 0zm0 128l0 72c0 8.8 7.2 16 16 16l80 0 0-88-96 0zm144 88l256 0c8.8 0 16-7.2 16-16l0-72-272 0 0 88zM464 296l0-80-272 0 0 80 272 0zM0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96z" />
								</svg>
								{!collapsed && "Summary"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/replenishment" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Replenishment" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Replenishment")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`w-5 h-5 mr-3 ${activeItem === "Replenishment" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M418 187.1C391.2 124.1 328.7 80 256 80c-39.7 0-77.8 15.8-105.9 43.9l-4.1 4.1 35.7 35.7c6.6 6.6 10.3 15.6 10.3 25c0 19.5-15.8 35.3-35.3 35.3L40 224c-13.3 0-24-10.7-24-24L16 83.3C16 63.8 31.8 48 51.3 48c9.4 0 18.3 3.7 25 10.3L112 94.1l4.1-4.1C153.2 52.8 203.5 32 256 32c92.6 0 172.1 56.2 206.2 136.3c5.2 12.2-.5 26.3-12.7 31.5s-26.3-.5-31.5-12.7zM50 344.1c-5.2-12.2 .4-26.3 12.6-31.5s26.3 .4 31.5 12.6C121 388.1 183.4 432 256 432c39.7 0 77.8-15.8 105.9-43.9l4.1-4.1-35.7-35.7c-6.6-6.6-10.3-15.6-10.3-25c0-19.5 15.8-35.3 35.3-35.3L472 288c13.3 0 24 10.7 24 24l0 116.7c0 19.5-15.8 35.3-35.3 35.3c-9.4 0-18.3-3.7-25-10.3L400 417.9l-4.1 4.1C358.8 459.2 308.5 480 256 480c-92.5 0-171.8-56-206-135.9zM64 176l62.1 0L64 113.9 64 176zM448 336l-62.1 0L448 398.1l0-62.1z" />
								</svg>
								{!collapsed && "Replenishment"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/performance" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Performance" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Performance")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`w-5 h-5 mr-3 ${activeItem === "Performance" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M24 32c13.3 0 24 10.7 24 24l0 352c0 13.3 10.7 24 24 24l416 0c13.3 0 24 10.7 24 24s-10.7 24-24 24L72 480c-39.8 0-72-32.2-72-72L0 56C0 42.7 10.7 32 24 32zM168 224c13.3 0 24 10.7 24 24l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24zm120-72l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24s24 10.7 24 24zm72-88c13.3 0 24 10.7 24 24l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24zM480 88l0 240c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-240c0-13.3 10.7-24 24-24s24 10.7 24 24z" />
								</svg>
								{!collapsed && "Performance"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Sell Through" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Sell Through")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={`w-5 h-5 mr-3 ${activeItem === "Sell Through" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M704 288h131.072a32 32 0 0 1 31.808 28.8L886.4 512h-64.384l-16-160H704v96a32 32 0 1 1-64 0v-96H384v96a32 32 0 0 1-64 0v-96H217.92l-51.2 512H512v64H131.328a32 32 0 0 1-31.808-35.2l57.6-576a32 32 0 0 1 31.808-28.8H320v-22.336C320 154.688 405.504 64 512 64s192 90.688 192 201.664v22.4zm-64 0v-22.336C640 189.248 582.272 128 512 128s-128 61.248-128 137.664v22.4h256zm201.408 483.84L768 698.496V928a32 32 0 1 1-64 0V698.496l-73.344 73.344a32 32 0 1 1-45.248-45.248l128-128a32 32 0 0 1 45.248 0l128 128a32 32 0 1 1-45.248 45.248" />
								</svg>
								{!collapsed && "Sell Through"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/dusty-inventory" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Dusty Inventory" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Dusty Inventory")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`w-5 h-5 mr-3 ${activeItem === "Dusty Inventory" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M502.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128-15.8-15.8c-15.2-15.2-38.5-18.4-57.3-8l-32.5 18L380.4 288.1l18-32.5c10.4-18.7 7.1-42.1-8-57.3l-15.8-15.8 128-128c12.5-12.5 12.5-32.8 0-45.3zM187.5 151.8L16.4 246.9C6.3 252.5 0 263.2 0 274.8c0 8.5 3.4 16.6 9.3 22.6l43.2 43.2c2.1 2.1 5.3 2.9 8.2 1.9l52.1-17.4c6.3-2.1 12.2 3.9 10.1 10.1l-17.4 52.1c-1 2.9-.2 6 1.9 8.2L214.7 502.7c6 6 14.1 9.3 22.6 9.3c11.6 0 22.3-6.3 27.9-16.4l95.1-171.1L187.5 151.8z" />
								</svg>
								{!collapsed && (
									<>
										Dusty Inventory<span className="ml-auto bg-indigo-100 text-indigo-600 rounded-full px-1 text-xl aspect-square w-auto h-7 pb-0.5 inline-flex items-center justify-center">★</span>
									</>
								)}
							</Link>
						</li>
					</ul>
				</div>

				<div className="py-4">
					<div className={`text-xs text-gray-400 ${collapsed ? "px-2" : "px-4"} mb-2`}>SUPPORT</div>
					<ul>
						<li className="mb-1">
							<Link to="/purchase/setting" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Setting" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Setting")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Setting" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M19.9 12.66a1 1 0 0 1 0-1.32l1.28-1.44a1 1 0 0 0 .12-1.17l-2-3.46a1 1 0 0 0-1.07-.48l-1.88.38a1 1 0 0 1-1.15-.66l-.61-1.83a1 1 0 0 0-.95-.68h-4a1 1 0 0 0-1 .68l-.56 1.83a1 1 0 0 1-1.15.66L5 4.79a1 1 0 0 0-1 .48L2 8.73a1 1 0 0 0 .1 1.17l1.27 1.44a1 1 0 0 1 0 1.32L2.1 14.1a1 1 0 0 0-.1 1.17l2 3.46a1 1 0 0 0 1.07.48l1.88-.38a1 1 0 0 1 1.15.66l.61 1.83a1 1 0 0 0 1 .68h4a1 1 0 0 0 .95-.68l.61-1.83a1 1 0 0 1 1.15-.66l1.88.38a1 1 0 0 0 1.07-.48l2-3.46a1 1 0 0 0-.12-1.17ZM18.41 14l.8.9-1.28 2.22-1.18-.24a3 3 0 0 0-3.45 2L12.92 20h-2.56L10 18.86a3 3 0 0 0-3.45-2l-1.18.24-1.3-2.21.8-.9a3 3 0 0 0 0-4l-.8-.9 1.28-2.2 1.18.24a3 3 0 0 0 3.45-2L10.36 4h2.56l.38 1.14a3 3 0 0 0 3.45 2l1.18-.24 1.28 2.22-.8.9a3 3 0 0 0 0 3.98m-6.77-6a4 4 0 1 0 4 4 4 4 0 0 0-4-4m0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2" />
								</svg>
								{!collapsed && "Settings"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Security" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Security")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Security" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "Security"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Help" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Help")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Help" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "Help"}
							</Link>
						</li>
					</ul>
				</div>
			</div>

			<div className={`p-2 border-t border-gray-200 ${collapsed ? "hidden sm:block" : ""}`}>
				<div className={`flex items-center p-2 bg-white border border-gray-200 rounded-md hover:border-gray-200 transition-all ${collapsed ? "justify-center" : ""}`}>
					<div className="w-8 h-8 bg-teal-400 rounded-md flex items-center justify-center text-white">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-5 h-5 text-white">
							<path fill="currentColor" d="M96 128a128 128 0 1 0 256 0 128 128 0 1 0-256 0m94.5 200.2 18.6 31-33.3 123.9-36-146.9c-2-8.1-9.8-13.4-17.9-11.3C51.9 342.4 0 405.8 0 481.3c0 17 13.8 30.7 30.7 30.7h386.6c17 0 30.7-13.8 30.7-30.7 0-75.5-51.9-138.9-121.9-156.4-8.1-2-15.9 3.3-17.9 11.3l-36 146.9-33.3-123.9 18.6-31c6.4-10.7-1.3-24.2-13.7-24.2h-39.5c-12.4 0-20.1 13.6-13.7 24.2z" />
						</svg>
					</div>
					{!collapsed && (
						<div className="ml-2">
							<p className="text-sm font-medium">Team</p>
							<p className="text-xs text-gray-600">Sales</p>
						</div>
					)}
					<button className={`ml-auto text-gray-400 hover:text-gray-600 transition-colors ${collapsed ? "hidden" : ""}`}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-4 h-4 scale-x-75">
							<path d="M234 19.5c-5.8-4.7-14.1-4.7-20 0L54 147.5c-6.9 5.5-8 15.6-2.5 22.5s15.6 8 22.5 2.5l150-120 150 120c6.9 5.5 17 4.4 22.5-2.5s4.4-17-2.5-22.5L234 19.5zm160 345c6.9-5.5 8-15.6 2.5-22.5s-15.6-8-22.5-2.5l-150 120L74 339.5c-6.9-5.5-17-4.4-22.5 2.5s-4.4 17 2.5 22.5l160 128c5.8 4.7 14.1 4.7 20 0l160-128z" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
