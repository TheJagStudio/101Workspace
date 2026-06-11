import React, { useEffect, useState } from "react";
import { fetchEditFriction } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable } from "../components/AnalyticsShell";

const EditFriction = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [moduleId, setModuleId] = useState(1);
	const [recordId, setRecordId] = useState(1);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchEditFriction({ moduleId, recordId });
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, [moduleId, recordId]);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="System Concurrency & Edit Friction"
			description="Monitors records under edit mode to detect concurrent editing conflicts."
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpError ? { recordUnderEditMode: data.erpError } : null}
			filters={
				<div className="flex gap-4 mb-4">
					<label className="text-sm">Module ID: <input type="number" value={moduleId} onChange={(e) => setModuleId(Number(e.target.value))} className="border rounded px-2 py-1 w-20 ml-1" /></label>
					<label className="text-sm">Record ID: <input type="number" value={recordId} onChange={(e) => setRecordId(Number(e.target.value))} className="border rounded px-2 py-1 w-20 ml-1" /></label>
				</div>
			}
			summary={<SummaryCards items={[
				{ label: "Active Locks", value: s.activeLocks },
				{ label: "Has Conflict", value: s.hasConflict ? "Yes" : "No" },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "userId", title: "User ID" },
					{ key: "userName", title: "User" },
					{ key: "moduleId", title: "Module" },
					{ key: "recordId", title: "Record" },
				]}
				rows={Array.isArray(data?.editLocks) ? data.editLocks : []}
				emptyMessage="No active edit locks"
			/>
		</AnalyticsShell>
	);
};

export default EditFriction;
