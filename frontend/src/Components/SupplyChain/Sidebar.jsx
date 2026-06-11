import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
	LayoutDashboard,
	Package,
	ShieldAlert,
	TrendingDown,
	Truck,
	Wallet,
	FileText,
	Percent,
	AlertCircle,
	BarChart3,
	Receipt,
	Users,
	Clock,
	Lock,
	RotateCcw,
	UserMinus,
} from "lucide-react";
import { useAtom } from "jotai";
import { isSidebarOpenAtom } from "../../Variables";

const NAV_SECTIONS = [
	{
		title: "OVERVIEW",
		items: [{ path: "/supply-chain", label: "Dashboard", icon: LayoutDashboard, exact: true }],
	},
	{
		title: "INVENTORY",
		items: [
			{ path: "/supply-chain/dusty-inventory", label: "Dusty Inventory", icon: Package, priority: true },
			{ path: "/supply-chain/shrinkage-audit", label: "Shrinkage & Audit", icon: ShieldAlert },
			{ path: "/supply-chain/demand-forecast", label: "Demand Forecast", icon: TrendingDown },
		],
	},
	{
		title: "PROCUREMENT",
		items: [
			{ path: "/supply-chain/vendor-scorecard", label: "Vendor Scorecard", icon: Truck },
			{ path: "/supply-chain/ap-aging", label: "AP Aging", icon: Wallet, priority: true },
		],
	},
	{
		title: "SALES & AR",
		items: [
			{ path: "/supply-chain/quotation-pipeline", label: "Quotation Pipeline", icon: FileText },
			{ path: "/supply-chain/margin-pricing", label: "Margin & Pricing", icon: Percent },
			{ path: "/supply-chain/ar-risk", label: "AR Risk", icon: AlertCircle, priority: true },
		],
	},
	{
		title: "FINANCIAL",
		items: [
			{ path: "/supply-chain/financial-pl", label: "P&L & Balance Sheet", icon: BarChart3 },
			{ path: "/supply-chain/tax-compliance", label: "Tax Compliance", icon: Receipt },
		],
	},
	{
		title: "WORKFORCE",
		items: [
			{ path: "/supply-chain/sales-rep-roi", label: "Sales Rep ROI", icon: Users },
			{ path: "/supply-chain/labor-allocation", label: "Labor Allocation", icon: Clock },
			{ path: "/supply-chain/edit-friction", label: "Edit Friction", icon: Lock },
		],
	},
	{
		title: "CUSTOMER",
		items: [
			{ path: "/supply-chain/rma-analysis", label: "RMA Analysis", icon: RotateCcw },
			{ path: "/supply-chain/customer-churn", label: "Customer Churn", icon: UserMinus },
		],
	},
];

const Sidebar = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);

	const isActive = (path, exact) => {
		if (exact) return location.pathname === path || location.pathname === `${path}/`;
		return location.pathname.startsWith(path);
	};

	return (
		<div className={`absolute flex flex-col h-screen sm:relative bg-white shadow-lg border-r border-gray-200 transition-all duration-300 z-50 ${collapsed ? "w-0 sm:w-20" : "w-screen sm:w-64"}`}>
			<div className="flex items-center h-16 px-2 border-b border-gray-200">
				<img src="/static/images/101-logo-supplychain.png" alt="Logo" className="w-auto h-8" />
				{!collapsed && <span className="text-xl font-semibold text-teal-600 ml-2">Supply Chain</span>}
				<div className={`ml-auto ${collapsed && "absolute top-5 -right-9"}`}>
					<button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-gray-600 border border-gray-300 rounded p-1 bg-white">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}>
							<path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z" />
						</svg>
					</button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto py-2">
				{NAV_SECTIONS.map((section) => (
					<div key={section.title} className="py-2 border-b border-gray-100">
						{!collapsed && <div className="text-xs text-gray-400 px-4 mb-1">{section.title}</div>}
						<ul>
							{section.items.map((item) => {
								const Icon = item.icon;
								const active = isActive(item.path, item.exact);
								return (
									<li key={item.path}>
										<Link
											to={item.path}
											className={`flex items-center w-full ${collapsed ? "justify-center" : ""} px-4 py-2 text-sm transition-colors ${active ? "bg-teal-50 text-teal-700 font-bold" : "text-gray-700 hover:bg-gray-50"}`}
										>
											<Icon size={18} className={`${collapsed ? "" : "mr-3 shrink-0"} ${active ? "text-teal-600" : "text-gray-400"}`} />
											{!collapsed && (
												<>
													{item.label}
													{item.priority && (
														<span className="ml-auto bg-teal-100 text-teal-600 rounded-full px-1 text-xl aspect-square w-7 h-7 pb-0.5 inline-flex items-center justify-center">
															★
														</span>
													)}
												</>
											)}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</div>
			{!collapsed && (
				<div className="p-3 border-t">
					<button onClick={() => navigate("/")} className="text-sm text-gray-500 hover:text-teal-600 w-full text-left">← Back to Workspace</button>
				</div>
			)}
		</div>
	);
};

export default Sidebar;
