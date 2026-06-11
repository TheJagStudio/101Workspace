import React, { useEffect, useState } from "react";
import { fetchTaxCompliance } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, fmtCurrency } from "../components/AnalyticsShell";

const TaxCompliance = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async ({ refresh = false } = {}) => {
		setLoading(true);
		try {
			const res = await fetchTaxCompliance(refresh ? { refresh: true } : undefined);
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Multi-State Tax Compliance"
			description={
				data?.cache?.cachedAt
					? `Tax collection by state. Data cached ${new Date(data.cache.cachedAt).toLocaleString()} — refreshes weekly.`
					: "Tax collection by state with excise and purchase tax class analysis."
			}
			loading={loading}
			onRefresh={() => load({ refresh: true })}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Total Tax Collected", value: fmtCurrency(s.totalTaxCollected) },
				{ label: "States", value: s.stateCount },
				{ label: "Top State", value: s.topState || "—" },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "state", title: "State" },
					{ key: "taxCollected", title: "Tax Collected", render: (r) => fmtCurrency(r.taxCollected) },
					{ key: "transactionCount", title: "Transactions" },
				]}
				rows={data?.taxByState}
			/>
		</AnalyticsShell>
	);
};

export default TaxCompliance;
