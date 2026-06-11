import React, { useEffect, useState } from "react";
import { fetchFinancialPL } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, fmtCurrency } from "../components/AnalyticsShell";

const FinancialPL = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchFinancialPL();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Segmented P&L & Balance Sheet"
			description="Profit and loss segmentation with balance sheet and expense breakdown."
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Net Profit", value: fmtCurrency(s.netProfit) },
				{ label: "Gross Margin", value: s.grossMarginPercent != null ? `${s.grossMarginPercent}%` : "—" },
				{ label: "Expense Categories", value: s.expenseCategories },
			]} />}
		>
			<h3 className="font-semibold mb-2">P&L Segments</h3>
			<SimpleTable
				columns={[
					{ key: "segment", title: "Segment" },
					{ key: "amount", title: "Amount", render: (r) => fmtCurrency(r.amount) },
					{ key: "percent", title: "% of Revenue", render: (r) => `${r.percent}%` },
				]}
				rows={data?.segments}
			/>
			<h3 className="font-semibold mt-6 mb-2">Top Expenses</h3>
			<SimpleTable
				columns={[
					{ key: "category", title: "Category" },
					{ key: "amount", title: "Amount", render: (r) => fmtCurrency(r.amount) },
					{ key: "date", title: "Date" },
				]}
				rows={data?.expenses}
			/>
		</AnalyticsShell>
	);
};

export default FinancialPL;
