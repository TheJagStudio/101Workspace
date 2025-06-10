import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Pages/Purchase/General/Dashboard";
import Login from "./Pages/Auth/Login";
import Signup from "./Pages/Auth/Signup";
import { useAtom } from "jotai";
import { userAtom } from "./Variables";
import { useEffect, useCallback,useState } from "react";
import { apiRequest } from "./utils/api";
import PurchaseOutlet from "./Outlets/PurchaseOutlet";
import Setting from "./Pages/Purchase/Support/Setting";
import NotFound from "./Pages/Auth/NotFound";
import Summary from "./Pages/Purchase/Inventory/Summary";
import PerformanceDash from "./Pages/Purchase/Inventory/PerformanceDash";
import Replenishment from "./Pages/Purchase/Inventory/Replenishment";
import Home from "./Pages/Home";
import TrackerOutlet from "./Outlets/TrackerOutlet";
import DeliveryOutlet from "./Outlets/DeliveryOutlet";
import DeliveryDashboard from "./Pages/Delivery/DeliveryDashboard";
import Deliveries from "./Pages/Delivery/Deliveries";
import ScanPage from "./Pages/Delivery/ScanPage";
import RecordPayment from "./Pages/Delivery/RecordPayment";
import DeliverySetting from "./Pages/Delivery/DeliverySetting";
import CreateDelivery from "./Pages/Delivery/CreateDelivery";
import DeliveryCustomer from "./Pages/Delivery/DeliveryCustomer";
import DeliveryReport from "./Pages/Delivery/DeliveryReport";
import PO from "./Pages/Purchase/General/PO";
import DustyInventory from "./Pages/Purchase/Inventory/DustyInventory";
import TrackerDashboard from "./Pages/Tracker/TrackerDashboard";
import TrackerMap from "./Pages/Tracker/TrackerMap";
import TrackerSettings from "./Pages/Tracker/TrackerSettings";
import TrackerAdminProfile from "./Pages/Tracker/TrackerAdminProfile";
import SalesmanHome from "./Pages/Tracker/SalesmanHome";
import SalesmanHistory from "./Pages/Tracker/SalesmanHistory";
import SalesmanProfile from "./Pages/Tracker/SalesmanProfile";

function App() {
	const [user, setUser] = useAtom(userAtom);

	const logout = useCallback(async () => {
		try {
			const refreshToken = localStorage.getItem("refreshToken");
			await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/auth/logout/`, {
				method: "POST",
				body: JSON.stringify({ refresh_token: refreshToken }),
			});
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			// Clear tokens and user state regardless of logout API success
			localStorage.removeItem("accessToken");
			localStorage.removeItem("refreshToken");
			setUser({
				username: "",
				email: "",
				first_name: "",
				last_name: "",
				is_active: false,
			});
		}
	}, [setUser]);

	useEffect(() => {
		const fetchUserInfo = async () => {
			try {
				const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/auth/me/`);
				if (data.status === "success") {
					setUser(data.user_info);
				} else {
					// If the request was successful but returned an error status
					await logout();
				}
			} catch (error) {
				console.error("Failed to fetch user info:", error);
				// Clear user state and tokens if request fails
				await logout();
			}
		};

		const token = localStorage.getItem("accessToken");
		if (token) {
			fetchUserInfo();
		} else {
			// No token found, make sure user state is cleared
			setUser({
				username: "",
				email: "",
				first_name: "",
				last_name: "",
				is_active: false,
			});
		}
	}, [setUser, logout]);

	// Make logout function available globally
	window.logout = logout;

	return (
		<Router>
			<Routes>
				<Route path="/" element={user?.is_active ? <Home /> : <Navigate to="/login" replace />} />
				<Route path="/login" element={user?.is_active ? <Navigate to="/" replace /> : <Login />} />
				<Route path="/signup" element={<Signup />} />
				<Route path="/purchase" element={user?.is_active ? <PurchaseOutlet logout={logout} /> : <Navigate to="/login" replace />}>
					<Route path="" element={<Dashboard />} />
					<Route path="po" element={<PO />} />
					<Route path="dashboard" element={<Dashboard />} />
					<Route path="summary" element={<Summary />} />
					<Route path="performance" element={<PerformanceDash />} />
					<Route path="replenishment" element={<Replenishment />} />
					<Route path="setting" element={<Setting />} />
					<Route path="dusty-inventory" element={<DustyInventory />} />
				</Route>
				<Route path="/tracker" element={user?.is_active ? <TrackerOutlet logout={logout} /> : <Navigate to="/login" replace />}>
					<Route path="admin/" element={<TrackerDashboard />} />
					<Route path="admin/tracker" element={<TrackerMap />} />
					<Route path="admin/settings" element={<TrackerSettings />} />
					<Route path="admin/profile" element={<TrackerAdminProfile />} />
					<Route path="salesman/home" element={<SalesmanHome />} />
					<Route path="salesman/history" element={<SalesmanHistory />} />
					<Route path="salesman/profile" element={<SalesmanProfile />} />
				</Route>
				<Route path="/delivery" element={user?.is_active ? <DeliveryOutlet logout={logout} /> : <Navigate to="/login" replace />} >
					<Route path="" element={<DeliveryDashboard />} />
					<Route path="deliveries" element={<Deliveries />} />
					<Route path="scan" element={<ScanPage />} />
					<Route path="record-payment/" element={<RecordPayment />} />
					<Route path="record-payment/:invoiceId" element={<RecordPayment />} />
					<Route path="settings" element={<DeliverySetting />} />
					<Route path="create-delivery" element={<CreateDelivery />} />
					<Route path="customers" element={<DeliveryCustomer />} />
					<Route path="reports" element={<DeliveryReport />} />
				</Route>
				{/* <Route path="*" element={<Navigate to="/404" replace />} /> */}
				<Route path="/404" element={<NotFound />} />
			</Routes>
		</Router>
	);
}

export default App;
