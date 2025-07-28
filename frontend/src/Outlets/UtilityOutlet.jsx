import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../Components/Utility/Header";
import Sidebar from "../Components/Utility/Sidebar";
import { isSidebarOpenAtom } from "../Variables";
import { apiRequest } from "../utils/api";

const UtilityOutlet = ({ logout }) => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen] = useAtom(isSidebarOpenAtom);

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

export default UtilityOutlet;
