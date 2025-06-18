import { Outlet } from "react-router-dom";
import Header from "../Components/Purchase/Header";
import Sidebar from "../Components/Purchase/Sidebar";

const CatalogOutlet = ({ logout }) => {
	return (
		<div className="flex">
			<Sidebar />
			<div className="flex-1">
				<Header logout={logout} />
				<div className="bg-[#f3f4f6] relative">
					<div className="p-5 h-[calc(100vh-4rem)] overflow-y-auto">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
};

export default CatalogOutlet;
