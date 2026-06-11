import React, { useEffect, useState } from "react";
import { fetchCustomerChurn } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge } from "../components/AnalyticsShell";

const CustomerChurn = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [inactiveDays, setInactiveDays] = useState(90);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchCustomerChurn({ inactiveDays });
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, [inactiveDays]);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Customer Churn Risk"
			description="Identifies customers at risk of churn based on order inactivity patterns."
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			filters={
				<label className="text-sm text-gray-600 mb-4 block">Inactive threshold (days):
					<select value={inactiveDays} onChange={(e) => setInactiveDays(Number(e.target.value))} className="ml-2 border rounded px-2 py-1">
						<option value={60}>60</option><option value={90}>90</option><option value={120}>120</option><option value={180}>180</option>
					</select>
				</label>
			}
			summary={<SummaryCards items={[
				{ label: "At Risk", value: s.atRiskCount },
				{ label: "Critical", value: s.criticalCount },
				{ label: "Threshold", value: `${s.inactiveDaysThreshold} days` },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "customerName", title: "Customer" },
					{ key: "lastOrderDate", title: "Last Order", render: (r) => r.lastOrderDate?.split("T")[0] || "Never" },
					{ key: "daysInactive", title: "Days Inactive", render: (r) => r.daysInactive ?? "—" },
					{ key: "riskLevel", title: "Risk", render: (r) => <RiskBadge level={r.riskLevel} /> },
				]}
				rows={data?.atRiskCustomers}
			/>
		</AnalyticsShell>
	);
};

export default CustomerChurn;
