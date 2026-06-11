import React, { useEffect, useState } from "react";
import { fetchQuotationPipeline } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency } from "../components/AnalyticsShell";

const QuotationPipeline = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchQuotationPipeline();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Quotation Pipeline Velocity"
			description="Tracks quotation aging and conversion velocity to identify stalled deals."
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Open Quotes", value: s.openQuotations },
				{ label: "Pipeline Value", value: fmtCurrency(s.totalPipelineValue) },
				{ label: "Slow Moving", value: s.slowMoving },
				{ label: "Avg Days Open", value: s.avgDaysOpen },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "customerName", title: "Customer" },
					{ key: "salesRep", title: "Sales Rep" },
					{ key: "amount", title: "Amount", render: (r) => fmtCurrency(r.amount) },
					{ key: "daysOpen", title: "Days Open" },
					{ key: "status", title: "Status" },
					{ key: "velocity", title: "Velocity", render: (r) => <RiskBadge level={r.velocity} /> },
				]}
				rows={data?.pipeline}
			/>
		</AnalyticsShell>
	);
};

export default QuotationPipeline;
