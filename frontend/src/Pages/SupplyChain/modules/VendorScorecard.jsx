import React, { useEffect, useState } from "react";
import { fetchVendorScorecard } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, fmtCurrency } from "../components/AnalyticsShell";

const VendorScorecard = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchVendorScorecard();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Vendor Performance Scorecard"
			description="Composite vendor scoring based on on-time delivery, quality, and lead time metrics."
			phase={2}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Vendors", value: s.vendorCount },
				{ label: "Avg Score", value: s.avgScore },
				{ label: "Top Vendor", value: s.topVendor || "—" },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "vendorName", title: "Vendor" },
					{ key: "grade", title: "Grade", render: (r) => <span className="font-bold text-purple-700">{r.grade}</span> },
					{ key: "compositeScore", title: "Score" },
					{ key: "totalSpend", title: "Spend", render: (r) => fmtCurrency(r.totalSpend) },
					{ key: "orderCount", title: "Orders" },
					{ key: "onTimeRate", title: "On-Time %", render: (r) => `${r.onTimeRate}%` },
					{ key: "avgLeadTimeDays", title: "Lead Days" },
				]}
				rows={data?.scorecards}
			/>
		</AnalyticsShell>
	);
};

export default VendorScorecard;
