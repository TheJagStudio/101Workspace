import { Outlet } from "react-router-dom";
import Header from "../Components/SupplyChain/Header";
import Sidebar from "../Components/SupplyChain/Sidebar";

const SupplyChainOutlet = ({ logout }) => (
	<div className="flex">
		<Sidebar />
		<div className="flex-1 min-w-0">
			<Header logout={logout} />
			<div className="bg-[#f3f4f6]">
				<div className="p-5 h-[calc(100vh-4rem)] overflow-y-auto">
					<Outlet />
				</div>
			</div>
		</div>
	</div>
);

export default SupplyChainOutlet;
