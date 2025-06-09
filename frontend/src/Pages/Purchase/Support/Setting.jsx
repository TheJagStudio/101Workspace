import React, { useState } from "react";
import Accounts from "./Settings/Accounts";
import Sync from "./Settings/Sync";

const TABS = [
	{ label: "Accounts", key: "accounts" },
	{ label: "Sync", key: "sync" },
	{ label: "Profile", key: "profile" },
	{ label: "Billing", key: "billing" },
	{ label: "Notifications", key: "notifications" },
	{ label: "Integrations", key: "integrations" },
];

const SettingPage = () => {
	const [activeTab, setActiveTab] = useState("accounts");

	const renderTabContent = () => {
		switch (activeTab) {
			case "accounts":
				return <Accounts />;
			case "sync":
				return <Sync />;
			case "profile":
				return <div>Profile Section (Coming Soon)</div>;
			case "billing":
				return <div>Billing Section (Coming Soon)</div>;
			case "notifications":
				return <div>Notifications Section (Coming Soon)</div>;
			case "integrations":
				return <div>Integrations Section (Coming Soon)</div>;
			default:
				return null;
		}
	};

	return (
		<div className="mx-4 min-h-screen max-w-screen-xl sm:mx-8 xl:mx-auto text-gray-700">
			<div className="grid grid-cols-8 pt-3 sm:grid-cols-10">
				{/* Mobile Dropdown */}
				<div className="relative w-64 sm:w-56 sm:hidden bg-white">
					<input className="peer hidden" type="checkbox" name="select-1" id="select-1" />
					<label htmlFor="select-1" className="flex w-full cursor-pointer select-none rounded-lg border border-gray-300 bg-white p-2 px-3 text-sm text-gray-700 ring-indigo-700 peer-checked:ring">
						{TABS.find((tab) => tab.key === activeTab)?.label}
					</label>
					<svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-0 top-3 ml-auto mr-5 h-4 text-slate-700 transition peer-checked:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
						<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
					<ul className="top-[110%] w-full max-h-0 select-none flex-col overflow-hidden rounded-b-lg shadow-md transition-all duration-300 peer-checked:max-h-56 peer-checked:py-3">
						{TABS.map((tab) => (
							<li
								key={tab.key}
								className={`cursor-pointer px-3 py-2 text-sm ${activeTab === tab.key ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-indigo-700 hover:text-white"}`}
								onClick={() => {
									setActiveTab(tab.key);
									document.getElementById("select-1").checked = false;
								}}
							>
								{tab.label}
							</li>
						))}
					</ul>
				</div>

				{/* Desktop Sidebar */}
				<div className="col-span-2 hidden sm:block">
					<ul className="sticky top-0 ">
						{TABS.map((tab) => (
							<li
								key={tab.key}
								className={`mt-5 cursor-pointer border-l-2 px-2 py-2 font-semibold transition
                                    ${activeTab === tab.key ? "border-l-indigo-700 text-indigo-700" : "border-transparent hover:border-l-indigo-700 hover:text-indigo-700"}`}
								onClick={() => setActiveTab(tab.key)}
							>
								{tab.label}
							</li>
						))}
					</ul>
				</div>

				{/* Tab Content */}
				<div className="col-span-8 overflow-hidden rounded-xl sm:bg-gradient-to-br sm:from-red-50/50 sm:via-white sm:to-green-50/50 sm:px-8 sm:border-t sm:border-white sm:shadow">{renderTabContent()}</div>
			</div>
		</div>
	);
};

export default SettingPage;
