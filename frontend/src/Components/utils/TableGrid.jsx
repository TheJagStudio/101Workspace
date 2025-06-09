import React, { useRef, useEffect } from "react";
import { Grid } from "gridjs";
import "gridjs/dist/theme/mermaid.css";

const TableGrid = ({ data }) => {
	const gridRef = useRef(null);

	let grid = new Grid({
		data: data,
		columns: Object.keys(data[0] || {}).map((key) => ({
			id: key,
			name: key,
		})),
		responsive: {
			0: { stack: false },
			600: { stack: true },
		},
		pagination: {
			limit: 20,
			summary: true,
		},
		sort: {
			multiColumn: true,
		},
		search: true,
		resizable: true,
		fixedHeader: true,
		height: '400px',
	});
	useEffect(() => {
		if (gridRef.current) {
			grid.render(gridRef.current);
		}
	}, [data]);
	return <div ref={gridRef}></div>;
};

export default TableGrid;
