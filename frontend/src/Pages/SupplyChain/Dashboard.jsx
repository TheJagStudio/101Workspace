import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../../utils/supplyChainApi";
import AnalyticsShell, { Loader, fmtCurrency, fmtNumber } from "./components/AnalyticsShell";

const CATEGORY_COLORS = {
	Inventory: "border-l-indigo-500",
	Procurement: "border-l-purple-500",
	Sales: "border-l-blue-500",
	Financial: "border-l-emerald-500",
	Workforce: "border-l-orange-500",
	Customer: "border-l-pink-500",
};

const Dashboard = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchDashboard();
			setData(res.data);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	if (loading && !data) return <div className="flex justify-center py-20"><Loader size={48} /></div>;

	const kpis = data?.kpis || {};
	const modules = data?.modules || [];

	return (
		<AnalyticsShell
			title="Supply Chain Analytics"
			description="Comprehensive analytics suite covering inventory, procurement, sales, finance, workforce, and customer behavior."
			loading={false}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					{[
						{ label: "Inventory Value", value: fmtCurrency(kpis.inventoryRetailValue) },
						{ label: "Total AP", value: fmtCurrency(kpis.totalAP) },
						{ label: "Total AR", value: fmtCurrency(kpis.totalAR) },
						{ label: "Low Stock SKUs", value: fmtNumber(kpis.lowStockSkus) },
					].map((k) => (
						<div key={k.label} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-teal-500">
							<p className="text-xs text-gray-500 uppercase">{k.label}</p>
							<p className="text-2xl font-bold mt-1">{k.value}</p>
						</div>
					))}
				</div>
			}
		>
			{data?.phase1Modules?.length > 0 && (
				<div className="mb-8">
					<h2 className="text-lg font-semibold text-gray-800 mb-3">Priority Modules</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{data.phase1Modules.map((m) => (
							<Link key={m.id} to={m.path} className="bg-white rounded-lg shadow-md p-5 border-l-4 border-teal-500 hover:shadow-lg transition-shadow">
								<p className="font-bold text-gray-900">{m.name}</p>
								<p className="text-sm text-gray-500 mt-1">{m.category}</p>
							</Link>
						))}
					</div>
				</div>
			)}

			<h2 className="text-lg font-semibold text-gray-800 mb-3">All Modules</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{modules.map((m) => (
					<Link key={m.id} to={m.path} className={`bg-white rounded-lg shadow p-4 border-l-4 hover:shadow-md transition-shadow ${CATEGORY_COLORS[m.category] || "border-l-gray-400"}`}>
						<div className="flex justify-between items-start">
							<p className="font-semibold text-gray-900">{m.name}</p>
							{m.phase === 1 && <span className="text-xs text-teal-600 font-medium">P1</span>}
							{m.phase === 2 && <span className="text-xs text-purple-600 font-medium">P2</span>}
						</div>
						<p className="text-xs text-gray-400 mt-2">{m.category}</p>
					</Link>
				))}
			</div>
		</AnalyticsShell>
	);
};

export default Dashboard;
