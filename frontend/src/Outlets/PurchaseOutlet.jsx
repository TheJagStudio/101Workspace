import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Glossary from "../Components/Purchase/Glossary";
import Header from "../Components/Purchase/Header";
import ProductHistoryCard from "../Components/Purchase/ProductHistoryCard";
import Sidebar from "../Components/Purchase/Sidebar";
import Chatbot from "../Components/utils/Chatbot";
import { activeProductAtom, activeProductHistoryAtom, glossaryAtom, isSidebarOpenAtom } from "../Variables";
import { apiRequest } from "../utils/api";

const PurchaseOutlet = ({ logout }) => {
	const [activeProduct] = useAtom(activeProductAtom);
	const [activeProductHistory, setActiveProductHistory] = useAtom(activeProductHistoryAtom);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [glossary, setGlossary] = useAtom(glossaryAtom);
	const [isSidebarOpen] = useAtom(isSidebarOpenAtom);

	useEffect(() => {
		async function fetchActiveProductHistory() {
			if (!activeProduct.id) {
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/product-history/${activeProduct.id}/`);
				if (data.status === "success") {
					setActiveProductHistory(data?.data);
				} else {
					setError(data.message || "Login failed");
				}
			} catch (err) {
				setError("Network error");
			} finally {
				setLoading(false);
			}
		}
		fetchActiveProductHistory();
	}, [activeProduct]);
	return (
		<div className="flex">
			<Sidebar />
			<div className="flex-1">
				<Header logout={logout} />
				<div className="bg-[#f3f4f6] relative">
					<div className={"absolute top-0 left-0 w-full h-[calc(100vh-4rem)] bg-black/20 shadow-xl backdrop-blur z-30 flex items-center justify-center transition-all duration-500 " + (activeProductHistory?.id ? "opacity-100 visible" : "opacity-0 invisible")}>
						<div
							onClick={() => {
								setActiveProductHistory({});
							}}
							className="absolute top-0 left-0 w-full h-full"
						></div>
						{activeProductHistory?.id && (
							<ProductHistoryCard
								activeProduct={activeProductHistory}
								onClose={() => {
									setActiveProductHistory({});
								}}
							/>
						)}
					</div>
					<div className={"absolute top-0 left-0 w-full h-[calc(100vh-4rem)] bg-black/20 shadow-xl backdrop-blur z-30 flex items-center justify-center transition-all duration-500 " + (glossary?.open ? "opacity-100 visible" : "opacity-0 invisible")}>
						<div
							className="absolute top-0 left-0 w-full h-full"
							onClick={() =>
								setGlossary({
									open: false,
									tabData: null,
								})
							}
						></div>
						{glossary?.open && <Glossary setGlossary={setGlossary} glossary={glossary} />}
					</div>
					<Chatbot />
					<div className="p-5 h-[calc(100vh-4rem)] overflow-y-auto">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
};

export default PurchaseOutlet;
