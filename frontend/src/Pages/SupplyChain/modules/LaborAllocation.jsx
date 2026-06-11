import React, { useEffect, useState } from "react";
import { fetchLaborAllocation } from "../../../utils/supplyChainApi";
import AnalyticsShell, { SummaryCards, SimpleTable } from "../components/AnalyticsShell";

const LaborAllocation = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await fetchLaborAllocation();
			setData(res.data);
		} catch (e) { console.error(e); }
		finally { setLoading(false); }
	};

	useEffect(() => { load(); }, []);

	const s = data?.summary || {};

	return (
		<AnalyticsShell
			title="Labor Resource Allocation"
			description="Employee roster and clock-in status for workforce planning."
			phase={3}
			loading={loading}
			onRefresh={load}
			erpErrors={data?.erpErrors}
			summary={<SummaryCards items={[
				{ label: "Total Employees", value: s.totalEmployees },
				{ label: "Active", value: s.activeEmployees },
				{ label: "Departments", value: s.departments },
			]} />}
		>
			<SimpleTable
				columns={[
					{ key: "name", title: "Name" },
					{ key: "role", title: "Role" },
					{ key: "department", title: "Department" },
					{ key: "active", title: "Active", render: (r) => r.active ? "Yes" : "No" },
				]}
				rows={data?.roster}
			/>
		</AnalyticsShell>
	);
};

export default LaborAllocation;
