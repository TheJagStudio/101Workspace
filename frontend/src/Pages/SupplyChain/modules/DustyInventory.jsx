import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { activeProductAtom, supplyChainSearchAtom } from "../../../Variables";
import { fetchDustyInventory } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, RiskBadge, fmtCurrency, fmtNumber } from "../components/AnalyticsShell";

const DustyInventory = () => {
	const [search, setSearch] = useAtom(supplyChainSearchAtom);
	const [, setActiveProduct] = useAtom(activeProductAtom);
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [pageLoading, setPageLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [daysThreshold, setDaysThreshold] = useState(90);

	const load = async ({ refresh = false, pageOnly = false } = {}) => {
		if (pageOnly) setPageLoading(true);
		else setLoading(true);
		try {
			const res = await fetchDustyInventory({
				page,
				pageSize: 20,
				daysThreshold,
				sortBy: "daysSinceLastSale",
				reverse: true,
				search: search.trim() || undefined,
				...(refresh ? { refresh: true } : {}),
			});
			setData(res.data);
		} catch (e) { console.error(e); }
		finally {
			setLoading(false);
			setPageLoading(false);
		}
	};

	useEffect(() => { load({ pageOnly: !!data }); }, [page]);

	useEffect(() => {
		setPage(1);
		load();
	}, [daysThreshold, search]);

	const summary = data?.summary || {};
	const pagination = data?.pagination || {};

	return (
		<AnalyticsShell
			title="Dusty Inventory Analysis"
			description={
				data?.cache?.cachedAt
					? `Slow-moving inventory report. Data cached ${new Date(data.cache.cachedAt).toLocaleString()} — refreshes weekly.`
					: "Slow-moving and obsolete inventory identified by last sale date, enriched with ERP valuation data."
			}
			phase={1}
			loading={loading}
			onRefresh={() => load({ refresh: true })}
			erpErrors={data?.erpErrors}
			filters={
				<div className="flex gap-4 mb-4 items-center flex-wrap">
					<label className="text-sm text-gray-600">Days without sale:
						<select value={daysThreshold} onChange={(e) => { setPage(1); setDaysThreshold(Number(e.target.value)); }} className="ml-2 border rounded px-2 py-1">
							<option value={60}>60</option><option value={90}>90</option><option value={120}>120</option><option value={180}>180</option>
						</select>
					</label>
					{search && (
						<button onClick={() => setSearch("")} className="text-sm text-teal-700 hover:underline">
							Clear search: &quot;{search}&quot;
						</button>
					)}
				</div>
			}
			summary={
				<SummaryCards items={[
					{ label: "Dusty SKUs", value: fmtNumber(summary.dustySkuCount) },
					{ label: "Total Qty", value: fmtNumber(summary.totalQuantity) },
					{ label: "Inventory Cost", value: fmtCurrency(summary.totalInventoryCost) },
					{ label: "Retail Value", value: fmtCurrency(summary.totalRetailValue) },
				]} />
			}
		>
			{pageLoading && <div className="text-center text-sm text-gray-400 py-2">Loading page…</div>}
			<PhotoProvider>
				<SimpleTable
					columns={[
						{
							key: "productName",
							title: "Product",
							render: (r) => (
								<div className="flex items-center gap-2 min-w-[220px]">
									<PhotoView src={r.imageUrl || "/static/images/default.png"}>
										<img
											src={r.imageUrl || "/static/images/default.png"}
											alt={r.productName}
											className="w-8 h-8 rounded object-cover shrink-0 cursor-zoom-in"
										/>
									</PhotoView>
									<div className="min-w-0">
										<a
											href={`https://erp.101distributorsga.com/product/${r.productId}/edit`}
											target="_blank"
											rel="noreferrer"
											className="text-teal-700 text-xs hover:underline"
										>
											({r.productId})
										</a>
										<p
											onClick={() => {
												setSearch(r.productName || "");
												setActiveProduct({ productId: r.productId, productName: r.productName, imageUrl: r.imageUrl });
											}}
											className="font-medium truncate cursor-pointer hover:text-teal-700 hover:underline"
											title={r.productName}
										>
											{r.productName}
										</p>
									</div>
								</div>
							),
						},
						{ key: "availableQuantity", title: "Qty", render: (r) => fmtNumber(r.availableQuantity) },
						{ key: "inventoryCost", title: "Cost Value", render: (r) => fmtCurrency(r.inventoryCost) },
						{ key: "daysSinceLastSale", title: "Days Since Sale", render: (r) => r.daysSinceLastSale ?? "Never" },
						{ key: "riskLevel", title: "Risk", render: (r) => <RiskBadge level={r.riskLevel} /> },
					]}
					rows={data?.items}
				/>
			</PhotoProvider>
			{pagination.totalPages > 1 && (
				<div className="flex justify-center gap-4 mt-4">
					<button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 bg-white border rounded disabled:opacity-40">Prev</button>
					<span className="py-2 text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
					<button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 bg-white border rounded disabled:opacity-40">Next</button>
				</div>
			)}
		</AnalyticsShell>
	);
};

export default DustyInventory;
