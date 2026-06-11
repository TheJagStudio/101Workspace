import React, { useEffect, useState } from "react";
import { fetchDemandForecast } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtNumber } from "../components/AnalyticsShell";

const DemandForecast = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchDemandForecast();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Demand Forecasting & Stockout Risk"
			description="Identifies products at risk of stockout based on committed quantity, incoming POs, and reorder points."
			phase={3}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "At Risk", value: s.totalAtRisk },
				{ label: "Critical", value: s.criticalCount },
				{ label: "Moderate", value: s.moderateCount },
			]} />}
		>
			<SimpleTable
				fixedLayout
				columns={[
					{
						key: "productName",
						title: "Product",
						wrap: true,
						width: "28%",
						render: (r) => (
							<div>
								{r.productId && (
									<a
										href={`https://erp.101distributorsga.com/product/${r.productId}/edit`}
										target="_blank"
										rel="noreferrer"
										className="text-teal-700 text-xs hover:underline"
									>
										({r.productId})
									</a>
								)}
								<p className="font-medium break-words">{r.productName || r.sku || r.upc || "—"}</p>
								{r.sku && r.productName !== r.sku && <p className="text-xs text-gray-400 break-words">{r.sku}</p>}
							</div>
						),
					},
					{ key: "reorderPoint", title: "Reorder", width: "8%", render: (r) => fmtNumber(r.reorderPoint) },
					{ key: "onHand", title: "On Hand", width: "9%", render: (r) => fmtNumber(r.onHand) },
					{ key: "committed", title: "Committed", width: "9%", render: (r) => fmtNumber(r.committed) },
					{ key: "incoming", title: "Incoming", width: "9%", render: (r) => fmtNumber(r.incoming) },
					{ key: "netAvailable", title: "Net Avail.", width: "9%", render: (r) => fmtNumber(r.netAvailable) },
					{ key: "daysOfCover", title: "Days Cover", width: "9%", render: (r) => r.daysOfCover ?? "—" },
					{ key: "stockoutRisk", title: "Risk", width: "9%", render: (r) => <RiskBadge level={r.stockoutRisk} /> },
				]}
				rows={data?.atRiskProducts}
			/>
		</AnalyticsShell>
	);
};

export default DemandForecast;
