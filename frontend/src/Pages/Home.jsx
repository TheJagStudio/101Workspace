import React, { useState } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../Variables";
import { Link } from "react-router-dom";

const Home = () => {
	const [user] = useAtom(userAtom);
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const handleLogout = () => {
		if (logout) {
			logout();
		}
	};
	return (
		<div
			className="h-screen relative"
			style={{
				background: "repeating-linear-gradient(45deg, rgb(225 225 225), rgb(225 225 225) 10px, rgb(228 228 228) 12px, rgb(228 228 228) 20px, rgb(225 225 225) 22px)",
			}}
		>
			<div className="bg-white w-full p-3 px-5 h-fit flex items-center justify-between shadow-md">
				<div className="p-1 bg-gradient-to-br from-red-50 to-red-100 border border-dashed border-red-500 rounded-lg flex items-center justify-center w-fit ">
					<img src="/static/images/101-logo.png" alt="Logo" className="w-auto h-8" />
					<p className="text-2xl font-semibold text-red-600">Workspace</p>
				</div>
				<div>
					{/* Profile */}
					{user?.first_name && (
						<div className="relative">
							<button className="flex items-center gap-3" onClick={() => setShowProfileMenu(!showProfileMenu)}>
								<div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center border border-gray-200">
									<img src={user?.first_name ? "https://api.dicebear.com/9.x/micah/svg?seed=" + user?.first_name + " " + user?.last_name : "https://api.dicebear.com/9.x/micah/svg?seed=default"} className="w-full h-full object-cover rounded-full" />
								</div>
								<div className="flex flex-col items-start">
									<span className="text-sm font-medium text-gray-900 truncate w-32 text-left">
										{user?.first_name} {user?.last_name}
									</span>
									<span className="text-xs text-gray-400 truncate w-32 text-left">{user?.email}kjbkbkbbkjlnll</span>
								</div>
							</button>

							{/* Profile Dropdown Menu */}
							{showProfileMenu && (
								<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100">
									<button onClick={handleLogout} className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left">
										Logout
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
			<div className="p-10 sm:p-20 flex flex-row flex-wrap items-center justify-center sm:justify-start gap-5 select-none">
				<Link to="/tracker">
				<div className="bg-gradient-to-br from-orange-50 to-orange-200 shadow-md hover:shadow-xl shadow-orange-500/10 cursor-pointer border-b-4 border-r-4 hover:border-l-4 hover:border-t-4 hover:border-b-0 hover:border-r-0  border-orange-500 rounded-xl h-fit w-fit px-3 py-2 flex items-center justify-center transition-all">
					<img src="/static/images/101-logo-tracker.png" alt="Logo" className="w-auto h-16" />
					<p className="text-5xl font-semibold text-orange-600 ">Tracker</p>
				</div>
				</Link>
				<Link to="/purchase">
					<div className="bg-gradient-to-br from-indigo-50 to-indigo-200 shadow-md hover:shadow-xl shadow-indigo-500/10 cursor-pointer border-b-4 border-r-4 hover:border-l-4 hover:border-t-4 hover:border-b-0 hover:border-r-0  border-indigo-500 rounded-xl h-fit w-fit px-3 py-2 flex items-center justify-center transition-all">
						<img src="/static/images/101-logo-purchase.png" alt="Logo" className="w-auto h-16 " />
						<p className="text-5xl font-semibold text-indigo-600">Purchase</p>
					</div>
				</Link>
				<Link to="/delivery" className="bg-gradient-to-br from-green-50 to-green-200 shadow-md hover:shadow-xl shadow-green-500/10 cursor-pointer border-b-4 border-r-4 hover:border-l-4 hover:border-t-4 hover:border-b-0 hover:border-r-0  border-green-500 rounded-xl h-fit w-fit px-3 py-2 flex items-center justify-center transition-all">
					<img src="/static/images/101-logo-delivery.png" alt="Logo" className="w-auto h-16" />
					<p className="text-5xl font-semibold text-green-600">Delivery</p>
				</Link>
			</div>
		</div>
	);
};

export default Home;
