import React, { useEffect, useState } from "react";
import { fetchARRisk } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency } from "../components/AnalyticsShell";

const ARRisk = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchARRisk();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const buckets = data?.agingBuckets || {};
	const summary = data?.summary || {};

	return (
		<AnalyticsShell
			title="AR Risk & Credit Exposure"
			description="Customer aging analysis with credit limit exposure and high-risk account identification."
			phase={1}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={
				<>
					<SummaryCards items={[
						{ label: "Total AR", value: fmtCurrency(summary.totalAR) },
						{ label: "Customers", value: summary.customerCount },
						{ label: "High Risk", value: summary.highRiskCount },
						{ label: "Over 90 Days %", value: summary.over90Percent != null ? `${summary.over90Percent}%` : "—" },
					]} />
					<div className="grid grid-cols-5 gap-2 mb-6">
						{Object.entries(buckets).map(([k, v]) => (
							<div key={k} className="bg-white rounded shadow p-3 text-center">
								<p className="text-xs text-gray-500">{k}</p>
								<p className="font-bold text-blue-700">{fmtCurrency(v)}</p>
							</div>
						))}
					</div>
				</>
			}
		>
			<SimpleTable
				columns={[
					{ key: "customerName", title: "Customer" },
					{ key: "totalDue", title: "Total Due", render: (r) => fmtCurrency(r.totalDue) },
					{ key: "over90", title: "90+", render: (r) => fmtCurrency(r.over90) },
					{ key: "creditLimit", title: "Credit Limit", render: (r) => fmtCurrency(r.creditLimit) },
					{ key: "exposureRatio", title: "Exposure %", render: (r) => r.exposureRatio != null ? `${r.exposureRatio}%` : "—" },
					{ key: "riskLevel", title: "Risk", render: (r) => <RiskBadge level={r.riskLevel} /> },
				]}
				rows={data?.customers}
			/>
		</AnalyticsShell>
	);
};

export default ARRisk;
