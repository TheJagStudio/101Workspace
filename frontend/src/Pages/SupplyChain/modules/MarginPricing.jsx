import React, { useEffect, useState } from "react";
import { fetchMarginPricing } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency } from "../components/AnalyticsShell";

const MarginPricing = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchMarginPricing();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Margin Leakage & Tier Pricing"
			description="Identifies products with margin gaps vs targets and maps customer tier pricing diagnostics."
			phase={2}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Products w/ Leakage", value: s.productsWithLeakage },
				{ label: "Est. Leakage", value: fmtCurrency(s.estimatedLeakage) },
				{ label: "Avg Margin Gap", value: s.avgMarginGap != null ? `${s.avgMarginGap}%` : "—" },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "productName", title: "Product" },
					{ key: "expectedMargin", title: "Target %", render: (r) => `${r.expectedMargin}%` },
					{ key: "actualMargin", title: "Actual %", render: (r) => `${r.actualMargin}%` },
					{ key: "marginGap", title: "Gap %", render: (r) => `${r.marginGap}%` },
					{ key: "leakageAmount", title: "Leakage $", render: (r) => fmtCurrency(r.leakageAmount) },
					{ key: "severity", title: "Severity", render: (r) => <RiskBadge level={r.severity} /> },
				]}
				rows={data?.marginLeakage}
			/>
		</AnalyticsShell>
	);
};

export default MarginPricing;
