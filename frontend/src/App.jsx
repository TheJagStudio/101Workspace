import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AIReport from "./Pages/Purchase/General/AIReport";
import Login from "./Pages/Auth/Login";
import Signup from "./Pages/Auth/Signup";
import { useAtom } from "jotai";
import { userAtom } from "./Variables";
import { useEffect, useCallback, useState } from "react";
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
import DeliveryCustomer from "./Pages/Delivery/DeliveryCustomer";
import DeliveryReport from "./Pages/Delivery/DeliveryReport";
import TruckManagement from "./Pages/Delivery/TruckManagement";
import DriverManagement from "./Pages/Delivery/DriverManagement";
import POMaker from "./Pages/Purchase/General/POMaker";
import DustyInventory from "./Pages/Purchase/Inventory/DustyInventory";
import TrackerDashboard from "./Pages/Tracker/TrackerDashboard";
import TrackerMap from "./Pages/Tracker/TrackerMap";
import TrackerSettings from "./Pages/Tracker/TrackerSettings";
import TrackerAdminProfile from "./Pages/Tracker/TrackerAdminProfile";
import SalesmanHome from "./Pages/Tracker/SalesmanHome";
import SalesmanHistory from "./Pages/Tracker/SalesmanHistory";
import SalesmanProfile from "./Pages/Tracker/SalesmanProfile";
import Notification from "./Components/utils/Notification";
import SearchProduct from "./Pages/Purchase/General/SearchProduct";
import POList from "./Pages/Purchase/General/POList";
import CatalogOutlet from "./Outlets/CatalogOutlet";
import UtilityOutlet from "./Outlets/UtilityOutlet";
import Sticker from "./Pages/Utility/Sticker";
import ProductSync from "./Pages/Utility/ProductSync";
import AccountOutlet from "./Outlets/AccountOutlet";
import Invoice from "./Pages/Accounts/Invoice";
import HotProduct from "./Pages/Purchase/Inventory/HotProduct";
import ClearanceLoss from "./Pages/Purchase/Inventory/ClearanceLoss";
import Catalog from "./Pages/Catalog/Catalog";
import ParLevel from "./Pages/Purchase/General/ParLevel";
import StampInvoice from "./Pages/Accounts/StampInvoice";
import SupplyChainOutlet from "./Outlets/SupplyChainOutlet";
import SupplyChainDashboard from "./Pages/SupplyChain/Dashboard";
import SCDustyInventory from "./Pages/SupplyChain/modules/DustyInventory";
import SCShrinkageAudit from "./Pages/SupplyChain/modules/ShrinkageAudit";
import SCDemandForecast from "./Pages/SupplyChain/modules/DemandForecast";
import SCVendorScorecard from "./Pages/SupplyChain/modules/VendorScorecard";
import SCAPAging from "./Pages/SupplyChain/modules/APAging";
import SCQuotationPipeline from "./Pages/SupplyChain/modules/QuotationPipeline";
import SCMarginPricing from "./Pages/SupplyChain/modules/MarginPricing";
import SCARRisk from "./Pages/SupplyChain/modules/ARRisk";
import SCFinancialPL from "./Pages/SupplyChain/modules/FinancialPL";
import SCTaxCompliance from "./Pages/SupplyChain/modules/TaxCompliance";
import SCSalesRepROI from "./Pages/SupplyChain/modules/SalesRepROI";
import SCLaborAllocation from "./Pages/SupplyChain/modules/LaborAllocation";
import SCEditFriction from "./Pages/SupplyChain/modules/EditFriction";
import SCRMAAnalysis from "./Pages/SupplyChain/modules/RMAAnalysis";
import SCCustomerChurn from "./Pages/SupplyChain/modules/CustomerChurn";

const Loader = ({ height, width, stroke = "#615fff" }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={width || 16} height={height || 16} className="mx-auto animate-spin">
		<g>
			<circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke={stroke} fill="none" cy={50} cx={50} />
		</g>
	</svg>
);

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
			localStorage.removeItem("101-userInfo");
			setUser({
				username: "",
				email: "",
				first_name: "",
				last_name: "",
				is_active: false,
			});
			window.location.href = "/login";
		}
	}, [setUser]);

	useEffect(() => {
		const fetchUserInfo = async () => {
			try {
				const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/auth/me/`);
				if (data.status === "success") {
					localStorage.setItem("101-userInfo", JSON.stringify(data.user_info));
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
			if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
				// Redirect to login if no token and not already on login/signup page
				window.location.href = "/login";
			}
		}
	}, [setUser, logout]);

	// Make logout function available globally
	window.logout = logout;
	if (user?.username === "" && window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
		return <div className="w-screen h-screen">
			<div className="flex items-center justify-center h-full">
				<Loader height={64} width={64} stroke="#ed1f24" />
			</div>
		</div>;
	}
	return (
		<Router>
			<Notification />
			<Routes>
				<Route path="/" element={user?.is_active ? <Home logout={logout} /> : <Navigate to="/login" replace />} />
				<Route path="/login" element={user?.is_active ? <Navigate to="/" replace /> : <Login />} />
				{/* <Route path="/signup" element={<Signup />} /> */}
				<Route path="/purchase" element={user?.is_active ? <PurchaseOutlet logout={logout} /> : <Navigate to="/login" replace />}>
					{user?.permissions?.purchase_PO && (<Route path="" element={<AIReport />} />)}
					<Route path="search" element={<SearchProduct />} />
					{user?.permissions?.purchase_PO && (<Route path="po-maker" element={<POMaker />} />)}
					{user?.permissions?.purchase_PO && (<Route path="po-list" element={<POList />} />)}
					{user?.permissions?.purchase_PO && (<Route path="par-level" element={<ParLevel />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="report" element={<AIReport />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="summary" element={<Summary />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="hot-product" element={<HotProduct />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="clearance-loss" element={<ClearanceLoss />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="performance" element={<PerformanceDash />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="replenishment" element={<Replenishment />} />)}
					{user?.permissions?.purchase_Inventory && (<Route path="dusty-inventory" element={<DustyInventory />} />)}
					{user?.permissions?.purchase_Settings && (<Route path="setting" element={<Setting />} />)}
				</Route>
				<Route path="/tracker" element={user?.is_active ? <TrackerOutlet logout={logout} /> : <Navigate to="/login" replace />}>
					{user?.permissions?.tracker_Salesmen_List && (<Route path="admin/" element={<TrackerDashboard />} />)}
					{user?.permissions?.tracker_Global_View && (<Route path="admin/tracker" element={<TrackerMap />} />)}
					{user?.permissions?.tracker_config && (<Route path="admin/settings" element={<TrackerSettings />} />)}
					{user?.permissions?.tracker_Admin_Profile && (<Route path="admin/profile" element={<TrackerAdminProfile />} />)}
					{user?.permissions?.tracker_Map && (<Route path="salesman/home" element={<SalesmanHome />} />)}
					{user?.permissions?.tracker_History && (<Route path="salesman/history" element={<SalesmanHistory />} />)}
					{user?.permissions?.tracker_Profile && (<Route path="salesman/profile" element={<SalesmanProfile />} />)}
				</Route>
				<Route path="/delivery" element={user?.is_active ? <DeliveryOutlet logout={logout} /> : <Navigate to="/login" replace />} >
					<Route path="" element={<DeliveryDashboard />} />
					<Route path="deliveries" element={<Deliveries />} />
					{user?.permissions?.delivery_admin && (<Route path="scan" element={<ScanPage />} />)}
					<Route path="record-payment/" element={<RecordPayment />} />
					<Route path="record-payment/:invoiceId" element={<RecordPayment />} />
					{user?.permissions?.delivery_admin && (<Route path="trucks" element={<TruckManagement />} />)}
					{user?.permissions?.delivery_admin && (<Route path="drivers" element={<DriverManagement />} />)}
					{/* {user?.permissions?.delivery_admin && (<Route path="settings" element={<DeliverySetting />} />)} */}
					{/* {user?.permissions?.delivery_admin && (<Route path="customers" element={<DeliveryCustomer />} />)} */}
					{/* {user?.permissions?.delivery_admin && (<Route path="reports" element={<DeliveryReport />} />)} */}
				</Route>
				<Route path="/catalog" element={user?.is_active ? <CatalogOutlet /> : <Navigate to="/login" replace />} >
					<Route index element={<Catalog />} />
				</Route>
				<Route path="/utility" element={user?.is_active ? <UtilityOutlet logout={logout} /> : <Navigate to="/login" replace />} >
					{user?.permissions?.utility_sticker && (<Route path="sticker" element={<Sticker />} />)}
					{user?.permissions?.utility_product_sync && (<Route path="product-sync" element={<ProductSync />} />)}
				</Route>
				<Route path="/accounts" element={user?.is_active ? <AccountOutlet logout={logout} /> : <Navigate to="/login" replace />} >
					<Route index element={<Navigate to="invoice" replace />} />
					{user?.permissions?.accounts_invoice && (<Route path="invoice" element={<Invoice />} />)}
					{user?.permissions?.accounts_invoice && (<Route path="stamp-invoice" element={<StampInvoice />} />)}
				</Route>
				<Route path="/supply-chain" element={user?.is_active ? <SupplyChainOutlet logout={logout} /> : <Navigate to="/login" replace />}>
					{user?.permissions?.supplychain && (<Route index element={<SupplyChainDashboard />} />)}
					{user?.permissions?.supplychain && (<Route path="dusty-inventory" element={<SCDustyInventory />} />)}
					{user?.permissions?.supplychain && (<Route path="shrinkage-audit" element={<SCShrinkageAudit />} />)}
					{user?.permissions?.supplychain && (<Route path="demand-forecast" element={<SCDemandForecast />} />)}
					{user?.permissions?.supplychain && (<Route path="vendor-scorecard" element={<SCVendorScorecard />} />)}
					{user?.permissions?.supplychain && (<Route path="ap-aging" element={<SCAPAging />} />)}
					{user?.permissions?.supplychain && (<Route path="quotation-pipeline" element={<SCQuotationPipeline />} />)}
					{user?.permissions?.supplychain && (<Route path="margin-pricing" element={<SCMarginPricing />} />)}
					{user?.permissions?.supplychain && (<Route path="ar-risk" element={<SCARRisk />} />)}
					{user?.permissions?.supplychain && (<Route path="financial-pl" element={<SCFinancialPL />} />)}
					{user?.permissions?.supplychain && (<Route path="tax-compliance" element={<SCTaxCompliance />} />)}
					{user?.permissions?.supplychain && (<Route path="sales-rep-roi" element={<SCSalesRepROI />} />)}
					{user?.permissions?.supplychain && (<Route path="labor-allocation" element={<SCLaborAllocation />} />)}
					{user?.permissions?.supplychain && (<Route path="edit-friction" element={<SCEditFriction />} />)}
					{user?.permissions?.supplychain && (<Route path="rma-analysis" element={<SCRMAAnalysis />} />)}
					{user?.permissions?.supplychain && (<Route path="customer-churn" element={<SCCustomerChurn />} />)}
				</Route>
				<Route path="*" element={<Navigate to="/404" replace />} />
				<Route path="/404" element={<NotFound />} />
			</Routes>
		</Router>
	);
}

export default App;
