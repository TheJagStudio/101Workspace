import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { isSidebarOpenAtom, userAtom } from "../../Variables";
import { SearchIcon } from "lucide-react";

const Sidebar = () => {
	const [activeItem, setActiveItem] = useState("report");
	const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);
	const [user, setUser] = useAtom(userAtom);

	const handleItemClick = (item) => {
		setActiveItem(item);
	};

	// Add a mapping from path to sidebar item key
	const pathToItem = {
		"search": "search",
		"report": "Dashboard",
		"po-maker": "PoMaker",
		"po-list": "PoList",
		"summary": "Summary",
		"hot-product": "Hot Product",
		"replenishment": "Replenishment",
		"performance": "Performance",
		"dusty-inventory": "Dusty Inventory",
		"clearance-loss": "Clearance Loss",
		"setting": "Setting",
	};

	useEffect(() => {
		const path = window.location.pathname;
		const segments = path.split("/");
		const last = segments[segments.length - 1] || segments[segments.length - 2] || "";
		const mapped = pathToItem[last] || (last.charAt(0).toUpperCase() + last.slice(1));
		setActiveItem(mapped);
	}, [window.location.pathname]);

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
							<Link to="/purchase/search" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "search" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("search")}>
								<SearchIcon className={`w-5 h-5 mr-3 ${activeItem === "search" ? "text-indigo-500" : "text-gray-500"}`} />
								{!collapsed && "Search"}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/report" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Dashboard" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Dashboard")}>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 48 48"
									width={48}
									height={48}
									baseProfile="basic"
									className={`w-5 h-5 scale-110 mr-3 ${activeItem === "Dashboard" ? "text-indigo-500" : "text-gray-500"}`}
								>
									<path
										fill="currentColor"
										d="M30.7 7.27 28.33 9.1a7.97 7.97 0 0 0-6.697-3.092C17.313 6.2 14 9.953 14 14.277v9.143l10.5 6.12-1 1.72-11.706-6.827A1.6 1.6 0 0 1 11 23.051v-8.687C11 8.1 16.129 2.79 22.39 3.007A10.93 10.93 0 0 1 30.7 7.27"
									/>
									<path
										fill="currentColor"
										d="m12.861 9.833.4 2.967a7.97 7.97 0 0 0-6.026 4.254c-1.994 3.837-.4 8.582 3.345 10.745l7.918 4.571 10.55-6.033.99 1.726-11.765 6.724a1.6 1.6 0 0 1-1.594-.003l-7.523-4.343c-5.426-3.133-7.46-10.23-4.142-15.543a10.93 10.93 0 0 1 7.847-5.065"
									/>
									<path
										fill="currentColor"
										d="m6.161 26.563 2.77 1.137a7.97 7.97 0 0 0 .671 7.346c2.326 3.645 7.233 4.638 10.977 2.476l7.918-4.572.05-12.153 1.99.006-.059 13.551a1.6 1.6 0 0 1-.8 1.379l-7.523 4.343c-5.425 3.132-12.588 1.345-15.531-4.185a10.94 10.94 0 0 1-.463-9.328"
									/>
									<path
										fill="currentColor"
										d="m17.3 40.73 2.37-1.83a7.97 7.97 0 0 0 6.697 3.092C30.687 41.8 34 38.047 34 33.723V24.58l-10.5-6.12 1-1.72 11.706 6.827A1.6 1.6 0 0 1 37 24.949v8.687c0 6.264-5.13 11.574-11.39 11.358a10.94 10.94 0 0 1-8.31-4.264"
									/>
									<path
										fill="currentColor"
										d="m35.139 38.167-.4-2.967a7.97 7.97 0 0 0 6.026-4.254c1.994-3.837.4-8.582-3.345-10.745l-7.918-4.571-10.55 6.033-.99-1.726 11.765-6.724a1.6 1.6 0 0 1 1.594.003l7.523 4.343c5.425 3.132 7.459 10.229 4.141 15.543a10.93 10.93 0 0 1-7.846 5.065"
									/>
									<path
										fill="currentColor"
										d="m41.839 21.437-2.77-1.137a7.97 7.97 0 0 0-.671-7.346c-2.326-3.645-7.233-4.638-10.977-2.476l-7.918 4.572-.05 12.153-1.99-.006.059-13.551a1.6 1.6 0 0 1 .8-1.379l7.523-4.343c5.425-3.132 12.588-1.345 15.531 4.185a10.94 10.94 0 0 1 .463 9.328"
									/>
								</svg>
								{!collapsed && "AI Report"}
							</Link>
						</li>
						{user?.permissions?.purchase_PO && (<li className="mb-1">
							<Link to="/purchase/po-maker" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "PoMaker" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("PoMaker")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" className={`w-5 h-5 mr-3 ${activeItem === "PoMaker" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64l16 0c8.8 0 16 7.2 16 16l0 288c0 44.2 35.8 80 80 80l18.7 0c-1.8 5-2.7 10.4-2.7 16c0 26.5 21.5 48 48 48s48-21.5 48-48c0-5.6-1-11-2.7-16l197.5 0c-1.8 5-2.7 10.4-2.7 16c0 26.5 21.5 48 48 48s48-21.5 48-48c0-5.6-1-11-2.7-16l66.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-464 0c-8.8 0-16-7.2-16-16l0-288C128 35.8 92.2 0 48 0L32 0zM224 32c-17.7 0-32 14.3-32 32l0 224c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-224c0-17.7-14.3-32-32-32L224 32zM416 64l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32zm32 128c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-128 0z" />
								</svg>
								{!collapsed && "PO Maker"}
							</Link>
						</li>)}
						{user?.permissions?.purchase_PO && (<li className="mb-1">
							<Link to="/purchase/po-list" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "PoList" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("PoList")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={`w-5 h-5 mr-3 ${activeItem === "PoList" ? "text-indigo-500" : "text-gray-500"}`}>
									<path stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 13h3m-3 3h8m-8 4h8m-8 4h8m1-17V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v22s0 1 1 1h1m23 2h4a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6m2 27a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1z" />
								</svg>
								{!collapsed && "Generated POs"}
							</Link>
						</li>)}
						{/* <li className="mb-1">
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
						</li> */}
					</ul>
				</div>

				{user?.permissions?.purchase_Inventory && (<div className="py-4 border-b border-gray-200">
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
							<Link to="/purchase/hot-product" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Hot Product" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Hot Product")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={`w-5 h-5 scale-110 mr-3 ${activeItem === "Hot Product" ? "text-indigo-500" : "text-gray-500"}`}>
									<path
										fill="currentColor"
										d="M256.5 37.6c9.3-7.8 23.1-7.4 31.9.9 12.2 11.6 23.3 24.4 33.9 37.4 13.5 16.5 29.7 38.3 45.3 64.2 5.2-6.8 10-12.8 14.2-17.9 1.1-1.3 2.2-2.7 3.4-4.1C393 108.3 402.9 96 416 96c13.4 0 22.8 11.9 30.8 22.1q1.95 2.55 3.9 4.8c10.3 12.4 24 30.3 37.7 52.4 27.2 43.9 55.6 106.4 55.6 176.6 0 123.7-100.3 224-224 224S96 475.7 96 352c0-91.1 41.1-170 80.5-225 19.9-27.7 39.7-49.9 54.6-65.1 8.2-8.4 16.5-16.7 25.5-24.2zm129.3 160.7c-4.6 7.3-12.8 11.6-21.4 11.2s-16.4-5.4-20.3-13.2c-19-37.6-41.3-68.5-58.9-90.1-5.2-6.4-10-12-14.2-16.6-1.8 1.7-3.6 3.6-5.6 5.6-13.6 14-31.8 34.3-49.9 59.6-36.6 51-71.5 120.1-71.5 197 0 97.2 78.8 176 176 176s176-78.8 176-176c0-57.7-23.6-111.3-48.4-151.4-11.3-18.3-22.7-33.4-31.6-44.4-8.5 10.5-19.3 24.8-30.2 42.1zM321.7 480C258.5 480 208 439.4 208 370.8c0-47.5 33.2-86.5 51.5-104.3 6.3-6.1 16.1-5 21.5 1.9 16.2 20.5 48 60.9 65.3 83 6.2 7.9 18.1 8.2 24.7.5l25.2-29.3c6.5-7.6 18-6.9 22.5 2 25.3 46.2 14 105-28.1 134.4-21.1 14-43.5 21-68.8 21z"
									/>
								</svg>
								{!collapsed && (
									<>
										Hot Product<span className="ml-auto bg-orange-100 text-orange-600 rounded-full px-1 text-xl aspect-square w-7 h-7 pb-0.5 inline-flex items-center justify-center">★</span>
									</>
								)}
							</Link>
						</li>
						<li className="mb-1">
							<Link to="/purchase/replenishment" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Replenishment" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Replenishment")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={`w-5 h-5 scale-110 mr-3 ${activeItem === "Replenishment" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M341.7 135.6L277.3 200L310.7 233.4C323.2 245.9 323.2 266.2 310.7 278.7C298.2 291.2 277.9 291.2 265.4 278.7L232 245.3L135.6 341.7C132.7 344.6 130.5 348.2 129.3 352L450.8 352L504.5 298.3C509.4 293.4 512.1 286.8 512.1 280C512.1 273.2 509.4 266.5 504.5 261.7L378.3 135.6C373.5 130.7 366.9 128 360 128C353.1 128 346.5 130.7 341.7 135.6zM90.3 296.4L186.7 200L137.3 150.6C124.8 138.1 124.8 117.8 137.3 105.3C149.8 92.8 170.1 92.8 182.6 105.3L232 154.7L296.4 90.3C313.3 73.5 336.1 64 360 64C383.9 64 406.7 73.5 423.6 90.3L549.7 216.4C566.5 233.3 576 256.1 576 280C576 303.9 566.5 326.7 549.7 343.6L343.6 549.7C326.7 566.5 303.9 576 280 576C256.1 576 233.3 566.5 216.4 549.7L90.3 423.6C73.5 406.7 64 383.9 64 360C64 336.1 73.5 313.3 90.3 296.4zM544 608C508.7 608 480 579.3 480 544C480 518.8 512.6 464.4 531.2 435.3C537.2 425.9 550.7 425.9 556.7 435.3C575.4 464.4 607.9 518.8 607.9 544C607.9 579.3 579.2 608 543.9 608z" />
								</svg>
								{!collapsed && "Replenishment"}
							</Link>
						</li>
						{/* <li className="mb-1">
							<Link to="/purchase/performance" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Performance" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Performance")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`w-5 h-5 mr-3 ${activeItem === "Performance" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M24 32c13.3 0 24 10.7 24 24l0 352c0 13.3 10.7 24 24 24l416 0c13.3 0 24 10.7 24 24s-10.7 24-24 24L72 480c-39.8 0-72-32.2-72-72L0 56C0 42.7 10.7 32 24 32zM168 224c13.3 0 24 10.7 24 24l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24zm120-72l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24s24 10.7 24 24zm72-88c13.3 0 24 10.7 24 24l0 80c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-80c0-13.3 10.7-24 24-24zM480 88l0 240c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-240c0-13.3 10.7-24 24-24s24 10.7 24 24z" />
								</svg>
								{!collapsed && "Performance"}
							</Link>
						</li> */}
						{/* <li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Sell Through" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Sell Through")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={`w-5 h-5 mr-3 ${activeItem === "Sell Through" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M704 288h131.072a32 32 0 0 1 31.808 28.8L886.4 512h-64.384l-16-160H704v96a32 32 0 1 1-64 0v-96H384v96a32 32 0 0 1-64 0v-96H217.92l-51.2 512H512v64H131.328a32 32 0 0 1-31.808-35.2l57.6-576a32 32 0 0 1 31.808-28.8H320v-22.336C320 154.688 405.504 64 512 64s192 90.688 192 201.664v22.4zm-64 0v-22.336C640 189.248 582.272 128 512 128s-128 61.248-128 137.664v22.4h256zm201.408 483.84L768 698.496V928a32 32 0 1 1-64 0V698.496l-73.344 73.344a32 32 0 1 1-45.248-45.248l128-128a32 32 0 0 1 45.248 0l128 128a32 32 0 1 1-45.248 45.248" />
								</svg>
								{!collapsed && "Sell Through"}
							</Link>
						</li> */}
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
						<li className="mb-1">
							<Link to="/purchase/clearance-loss" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Clearance Loss" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Clearance Loss")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={`w-5 h-5 scale-110 mr-3 ${activeItem === "Clearance Loss" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M112 120C112 106.7 101.3 96 88 96C74.7 96 64 106.7 64 120L64 464C64 508.2 99.8 544 144 544L552 544C565.3 544 576 533.3 576 520C576 506.7 565.3 496 552 496L144 496C126.3 496 112 481.7 112 464L112 120zM384 360C384 373.3 394.7 384 408 384L520 384C533.3 384 544 373.3 544 360L544 248C544 234.7 533.3 224 520 224C506.7 224 496 234.7 496 248L496 302.1L385 191.1C375.6 181.7 360.4 181.7 351.1 191.1L272.1 270.1L201.1 199.1C191.7 189.7 176.5 189.7 167.2 199.1C157.9 208.5 157.8 223.7 167.2 233L255.2 321C264.6 330.4 279.8 330.4 289.1 321L368.1 242L462.2 336.1L408.1 336.1C394.8 336.1 384.1 346.8 384.1 360.1z" />
								</svg>
								{!collapsed && (
									<>
										Clearance Loss
									</>
								)}
							</Link>
						</li>
					</ul>
				</div>)}

				{user?.permissions?.purchase_Settings && (<div className="py-4">
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
						{/* <li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Security" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Security")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Security" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "Security"}
							</Link>
						</li> */}
						{/* <li className="mb-1">
							<Link to="#" className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors ${activeItem === "Help" ? "bg-indigo-50 text-indigo-500 font-bold" : "text-gray-800 hover:bg-gray-100"}`} onClick={() => handleItemClick("Help")}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-5 h-5 mr-3 ${activeItem === "Help" ? "text-indigo-500" : "text-gray-500"}`}>
									<path fill="currentColor" d="M10 14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm11-5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM10 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm11 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
								</svg>
								{!collapsed && "Help"}
							</Link>
						</li> */}
					</ul>
				</div>)}
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
							<p className="text-xs text-gray-600">Purchase</p>
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
