import React, { useEffect, useState } from "react";
import { fetchRMAAnalysis } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, fmtCurrency } from "../components/AnalyticsShell";

const RMAAnalysis = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchRMAAnalysis();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="RMA Reason Analysis"
			description="Return merchandise authorization breakdown by reason, customer, and product."
			phase={2}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Return Reasons", value: s.totalReturnReasons },
				{ label: "Top Reason", value: s.topReason || "—" },
				{ label: "Total Return $", value: fmtCurrency(s.totalReturnAmount) },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "reason", title: "Reason" },
					{ key: "quantity", title: "Qty" },
					{ key: "amount", title: "Amount", render: (r) => fmtCurrency(r.amount) },
					{ key: "count", title: "Occurrences" },
				]}
				rows={data?.reasonBreakdown}
			/>
		</AnalyticsShell>
	);
};

export default RMAAnalysis;
