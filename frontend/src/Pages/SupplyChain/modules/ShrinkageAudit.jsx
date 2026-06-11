import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { activeProductAtom, supplyChainSearchAtom } from "../../../Variables";
import { fetchShrinkageAudit, fetchShrinkageProductDetail } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable, fmtNumber } from "../components/AnalyticsShell";

const ShrinkageAudit = () => {
	const [activeProduct] = useAtom(activeProductAtom);
	const [search] = useAtom(supplyChainSearchAtom);
	const [data, setData] = useState(null);
	const [detail, setDetail] = useState(null);
	const [loading, setLoading] = useState(true);
	const [detailLoading, setDetailLoading] = useState(false);
	const productId = activeProduct?.productId || activeProduct?.id;

	const loadAdjustments = async () => {
		setLoading(true);
		try {
			const res = await fetchShrinkageAudit({});
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	const loadProductDetail = async ({ refresh = false } = {}) => {
		if (!productId) {
			setDetail(null);
			return;
		}
		setDetailLoading(true);
		try {
			const res = await fetchShrinkageProductDetail({
				productId,
				...(refresh ? { refresh: true } : {}),
			});
			setDetail(res.data);
		} catch (e) { console.error(e); }
		finally { setDetailLoading(false); }
	};

	const load = async ({ refresh = false } = {}) => {
		await Promise.all([
			loadAdjustments(),
			loadProductDetail({ refresh }),
		]);
	};

	useEffect(() => {
		loadAdjustments();
	}, []);

	useEffect(() => {
		loadProductDetail();
	}, [productId]);

	const adjustmentEvents = data?.shrinkageEvents || [];
	const logEvents = detail?.logEvents || [];
	const allEvents = [...adjustmentEvents, ...logEvents].slice(0, 100);
	const erpErrors = { ...(data?.erpErrors || {}), ...(detail?.erpErrors || {}) };
	const s = {
		totalVarianceUnits: (data?.summary?.totalVarianceUnits || 0) + logEvents.reduce((sum, e) => sum + Math.abs(e.quantity || 0), 0),
		adjustmentCount: data?.summary?.adjustmentCount || 0,
		auditCount: detail?.audits?.length || 0,
		logEntryCount: detail?.inventoryLog?.length || 0,
	};

	return (
		<AnalyticsShell
			title="Inventory Shrinkage & Audit Leakage"
			description={
				productId
					? `Adjustments load immediately; product log/audit loads separately${detail?.cache?.cachedAt ? ` (cached ${new Date(detail.cache.cachedAt).toLocaleString()})` : ""}${search ? ` — ${search}` : ""}.`
					: "Tracks inventory adjustments across all products. Search a product in the header for per-product log and audit detail."
			}
			loading={loading}
			onRefresh={() => load({ refresh: true })}
			erpErrors={erpErrors}
			summary={<SummaryCards items={[
				{ label: "Variance Units", value: fmtNumber(Math.round(s.totalVarianceUnits * 100) / 100) },
				{ label: "Adjustments", value: s.adjustmentCount },
				{ label: "Audit Records", value: s.auditCount },
				{ label: "Log Entries", value: s.logEntryCount, sub: productId && detailLoading ? "Loading…" : undefined },
			]} />}
		>
			{productId && detailLoading && !detail && (
				<div className="mb-4 p-3 bg-teal-50 border border-teal-100 rounded-lg text-sm text-teal-800">
					Loading product inventory log and audit trail…
				</div>
			)}
			<h3 className="text-md font-semibold mb-2">Shrinkage Events</h3>
			<SimpleTable
				fixedLayout
				columns={[
					{ key: "productName", title: "Product", wrap: true, width: "18%" },
					{ key: "quantity", title: "Qty", width: "7%" },
					{ key: "type", title: "Type", width: "10%" },
					{ key: "reason", title: "Reason", wrap: true, width: "50%" },
					{ key: "date", title: "Date", width: "15%" },
				]}
				rows={allEvents}
			/>
		</AnalyticsShell>
	);
};

export default ShrinkageAudit;
