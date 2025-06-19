import { Outlet } from "react-router-dom";

const CatalogOutlet = ({ logout }) => {
	return (
		<div className="flex h-screen w-screen overflow-y-auto">
			<Outlet />
		</div>
	);
};

export default CatalogOutlet;
