import React, { useEffect, useState } from "react";
import { fetchSalesRepROI } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency } from "../components/AnalyticsShell";

const SalesRepROI = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchSalesRepROI();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Sales Rep ROI & Commission"
			description="Sales representative performance ranked by revenue, commission, and ROI."
			phase={3}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Sales Reps", value: s.repCount },
				{ label: "Total Sales", value: fmtCurrency(s.totalSales) },
				{ label: "Total Commission", value: fmtCurrency(s.totalCommission) },
				{ label: "Top Performer", value: s.topPerformer || "—" },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "salesRep", title: "Sales Rep" },
					{ key: "totalSales", title: "Sales", render: (r) => fmtCurrency(r.totalSales) },
					{ key: "commission", title: "Commission", render: (r) => fmtCurrency(r.commission) },
					{ key: "roi", title: "ROI", render: (r) => r.roi ?? "—" },
					{ key: "orderCount", title: "Orders" },
					{ key: "performance", title: "Rating", render: (r) => <RiskBadge level={r.performance} /> },
				]}
				rows={data?.salesReps}
			/>
		</AnalyticsShell>
	);
};

export default SalesRepROI;
