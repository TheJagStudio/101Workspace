import React from "react";
import { LoaderPinwheel, RefreshCw, AlertTriangle } from "lucide-react";

export const Loader = ({ size = 32 }) => (
	<LoaderPinwheel className="animate-spin text-teal-600 mx-auto" size={size} />
);

export const RiskBadge = ({ level }) => {
	const colors = {
		critical: "bg-red-100 text-red-700",
		high: "bg-orange-100 text-orange-700",
		moderate: "bg-yellow-100 text-yellow-700",
		low: "bg-green-100 text-green-700",
		fast: "bg-green-100 text-green-700",
		normal: "bg-blue-100 text-blue-700",
		slow: "bg-red-100 text-red-700",
		top: "bg-teal-100 text-teal-700",
		average: "bg-blue-100 text-blue-700",
		below: "bg-orange-100 text-orange-700",
	};
	return (
		<span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[level] || "bg-gray-100 text-gray-700"}`}>
			{level || "—"}
		</span>
	);
};

export const SummaryCards = ({ items }) => (
	<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		{items.map((item) => (
			<div key={item.label} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-teal-500">
				<p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
				<p className="text-2xl font-bold text-gray-900 mt-1">{item.value ?? "—"}</p>
				{item.sub && <p className="text-xs text-gray-400 mt-1">{item.sub}</p>}
			</div>
		))}
	</div>
);

export const SimpleTable = ({ columns, rows, emptyMessage = "No data available", fixedLayout = false }) => (
	<div className="bg-white rounded-lg shadow-md overflow-x-auto">
		<table className={`min-w-full text-sm ${fixedLayout ? "w-full table-fixed" : ""}`}>
			<thead className="bg-teal-50 text-teal-900">
				<tr>
					{columns.map((col) => (
						<th
							key={col.key}
							className={`px-4 py-3 text-left font-semibold ${col.wrap ? "whitespace-normal" : "whitespace-nowrap"}`}
							style={col.width ? { width: col.width } : undefined}
						>
							{col.title}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows?.length ? rows.map((row, i) => (
					<tr key={row.id || i} className="border-t border-gray-100 hover:bg-gray-50">
						{columns.map((col) => {
							const value = col.render ? col.render(row) : row[col.key];
							return (
								<td
									key={col.key}
									className={`px-4 py-2 align-top ${col.wrap ? "whitespace-normal break-words" : "whitespace-nowrap"}`}
								>
									{value}
								</td>
							);
						})}
					</tr>
				)) : (
					<tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{emptyMessage}</td></tr>
				)}
			</tbody>
		</table>
	</div>
);

export const ErpErrorsBanner = ({ errors }) => {
	if (!errors || !Object.keys(errors).length) return null;
	return (
		<div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
			<AlertTriangle size={16} className="mt-0.5 shrink-0" />
			<div>
				<p className="font-medium">Partial ERP data — some sources unavailable</p>
				<ul className="mt-1 list-disc list-inside text-xs">
					{Object.entries(errors).map(([k, v]) => v && <li key={k}>{k}: {v}</li>)}
				</ul>
			</div>
		</div>
	);
};

const AnalyticsShell = ({ title, description, phase, loading, onRefresh, erpErrors, summary, children, filters }) => (
	<div>
		<div className="flex flex-wrap items-start justify-between gap-4 mb-6">
			<div>
				<div className="flex items-center gap-2">
					<h1 className="text-2xl font-bold text-gray-900">{title}</h1>
					{phase === 1 && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded font-medium">Priority</span>}
				</div>
				{description && <p className="text-gray-500 mt-1 text-sm max-w-2xl">{description}</p>}
			</div>
			{onRefresh && (
				<button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm">
					<RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
				</button>
			)}
		</div>
		{filters}
		<ErpErrorsBanner errors={erpErrors} />
		{loading ? (
			<div className="flex justify-center py-20"><Loader size={48} /></div>
		) : (
			<>
				{summary}
				{children}
			</>
		)}
	</div>
);

export default AnalyticsShell;

export const fmtCurrency = (v) => {
	if (v == null || v === "") return "—";
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));
};

export const fmtNumber = (v) => {
	if (v == null || v === "") return "—";
	return new Intl.NumberFormat("en-US").format(Number(v));
};

export const fmtPercent = (v) => {
	if (v == null || v === "") return "—";
	return `${Number(v).toFixed(1)}%`;
};
