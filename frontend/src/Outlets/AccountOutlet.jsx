import { Outlet } from "react-router-dom";
import Header from "../Components/Accounts/Header";
import Sidebar from "../Components/Accounts/Sidebar";

const AccountOutlet = ({ logout }) => {
    let twCBg = "bg-pink-50 bg-pink-100 bg-pink-200 bg-pink-300 bg-pink-400 bg-pink-500 bg-pink-600 bg-pink-700 bg-pink-800 bg-pink-900 bg-pink-950";
    let twCBgHover = "hover:bg-pink-100 hover:bg-pink-200 hover:bg-pink-300 hover:bg-pink-400 hover:bg-pink-500 hover:bg-pink-600 hover:bg-pink-700 hover:bg-pink-800 hover:bg-pink-900 hover:bg-pink-950";
    let twCBorder = "border-pink-500 border-pink-600 border-pink-700 border-pink-800 border-pink-900 border-pink-950";
    let twCText = "text-pink-50 text-pink-100 text-pink-200 text-pink-300 text-pink-400 text-pink-500 text-pink-600 text-pink-700 text-pink-800 text-pink-900 text-pink-950";
    let twCTextHover = "hover:text-pink-100 hover:text-pink-200 hover:text-pink-300 hover:text-pink-400 hover:text-pink-500 hover:text-pink-600 hover:text-pink-700 hover:text-pink-800 hover:text-pink-900 hover:text-pink-950";
    let twCRing = "focus:ring-pink-500/25";
    return (
        <div className="flex max-w-screen">
            <Sidebar />
            <div className="flex-1 max-w-full">
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

export default AccountOutlet;
