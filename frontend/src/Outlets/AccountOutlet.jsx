import { Outlet } from "react-router-dom";
import Header from "../Components/Accounts/Header";
import Sidebar from "../Components/Accounts/Sidebar";

const AccountOutlet = ({ logout }) => {

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
