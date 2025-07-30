import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useAtom } from "jotai";
import { userAtom,isSidebarOpenAtom } from "../../Variables";

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useAtom(isSidebarOpenAtom);
    const [activeItem, setActiveItem] = useState("");
    const [user] = useAtom(userAtom);

    useEffect(() => {
        try {
            const path = location.pathname.split("/")[2];
            setActiveItem(path.charAt(0).toUpperCase() + path.slice(1));
        }
        catch (error) {
            console.error("Error setting active item:", error);
            setActiveItem("");
        }
    }, [location.pathname]);

    return (
        <div className={`absolute flex flex-col h-screen sm:relative bg-white shadow-lg shadow-gray-200 border-r border-gray-200 transition-all duration-300 z-50 ${collapsed ? "w-0 sm:w-20" : "w-screen sm:w-64"}`}>
            <div className="flex items-center h-16 px-2 border-b border-gray-200">
                <div className="flex items-center">
                    <img src="/static/images/101-logo-accounts.png" alt="Logo" className={`w-auto h-10 transition-all duration-300`} />
                    <span className={`text-3xl font-semibold text-pink-600 ml-1 transition-all duration-300 ${collapsed ? "hidden" : ""}`}>
                        Accounts
                    </span>
                </div>
                <div className={`ml-auto ${collapsed && "absolute top-5 -right-9"}`}>
                    <button
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="text-gray-400 hover:text-gray-600 border border-gray-300 rounded p-1 bg-white"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
                            <path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="py-4 border-b border-gray-200">
                    <div className={`text-xs text-gray-400 ${collapsed ? "px-2" : "px-4"} mb-2`}>
                        GENERAL
                    </div>
                    <ul>
                        {user?.permissions?.accounts_invoice && (
                            <li className="mb-1">
                                <button
                                    className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors w-full text-left ${location.pathname === "/accounts/invoice" ? "bg-pink-100 text-pink-700 font-bold" : "text-gray-800 hover:bg-gray-100"}`}
                                    onClick={() => {
                                        setActiveItem("Invoice");
                                        navigate("/accounts/invoice");
                                    }}
                                >
                                    <span className={`w-5 h-5 mr-3 flex items-center justify-center ${location.pathname === "/accounts/invoice" ? "text-pink-600" : "text-gray-500"}`}>
                                        <Receipt size={20} />
                                    </span>
                                    {!collapsed && "Invoice"}
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;