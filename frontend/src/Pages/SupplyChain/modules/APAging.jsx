import React, { useEffect, useState } from "react";
import { fetchAPAging } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency } from "../components/AnalyticsShell";

const APAging = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchAPAging();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const buckets = data?.agingBuckets || {};
	const summary = data?.summary || {};
	const outlook = data?.cashFlowOutlook || {};

	return (
		<AnalyticsShell
			title="AP Cash-Flow & Aging"
			description="Accounts payable aging analysis with cash-flow outlook and vendor risk scoring."
			phase={1}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={
				<>
					<SummaryCards items={[
						{ label: "Total AP", value: fmtCurrency(summary.totalAP) },
						{ label: "Vendors", value: summary.vendorCount },
						{ label: "Over 90 Days", value: fmtPercent(summary.over90Percent) },
						{ label: "Critical Vendors", value: summary.criticalVendors },
					]} />
					<div className="grid grid-cols-5 gap-2 mb-6">
						{Object.entries(buckets).map(([k, v]) => (
							<div key={k} className="bg-white rounded shadow p-3 text-center">
								<p className="text-xs text-gray-500">{k}</p>
								<p className="font-bold text-purple-700">{fmtCurrency(v)}</p>
							</div>
						))}
					</div>
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="bg-purple-50 rounded-lg p-4"><p className="text-xs text-purple-600">Due Next 30 Days</p><p className="text-xl font-bold">{fmtCurrency(outlook.dueNext30Days)}</p></div>
						<div className="bg-purple-50 rounded-lg p-4"><p className="text-xs text-purple-600">Due 31-60 Days</p><p className="text-xl font-bold">{fmtCurrency(outlook.dueNext60Days)}</p></div>
						<div className="bg-purple-50 rounded-lg p-4"><p className="text-xs text-purple-600">Due Beyond 90 Days</p><p className="text-xl font-bold">{fmtCurrency(outlook.dueBeyond90Days)}</p></div>
					</div>
				</>
			}
		>
			<SimpleTable
				columns={[
					{ key: "vendorName", title: "Vendor" },
					{ key: "current", title: "Current", render: (r) => fmtCurrency(r.current) },
					{ key: "days1To30", title: "1-30", render: (r) => fmtCurrency(r.days1To30) },
					{ key: "days31To60", title: "31-60", render: (r) => fmtCurrency(r.days31To60) },
					{ key: "days61To90", title: "61-90", render: (r) => fmtCurrency(r.days61To90) },
					{ key: "over90", title: "90+", render: (r) => fmtCurrency(r.over90) },
					{ key: "totalDue", title: "Total", render: (r) => fmtCurrency(r.totalDue) },
					{ key: "riskLevel", title: "Risk", render: (r) => <RiskBadge level={r.riskLevel} /> },
				]}
				rows={data?.vendors}
			/>
		</AnalyticsShell>
	);
};

const fmtPercent = (v) => v != null ? `${v}%` : "—";

export default APAging;
