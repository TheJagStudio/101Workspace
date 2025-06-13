import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Truck,
    QrCode,
    ClipboardList,
    Users,
    Settings,
    CreditCard,
    BarChart
} from "lucide-react";

const Sidebar = () => {
    const { user } = {
        id: "1",
        name: "Delivery Manager",
        email: "manager@example.com",
        password: "manager123",
        role: "manager",
    };
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(true);
    const [activeItem, setActiveItem] = useState("");

    useEffect(() => {
        const path = location.pathname.split("/")[1];
        setActiveItem(path.charAt(0).toUpperCase() + path.slice(1));
    }, [location.pathname]);

    const managerItems = [
        {
            icon: <LayoutDashboard size={20} />,
            text: "Dashboard",
            to: "/delivery",
            section: "GENERAL",
        },
        {
            icon: <Truck size={20} />,
            text: "Deliveries",
            to: "/delivery/deliveries",
            section: "GENERAL",
        },
        {
            icon: <ClipboardList size={20} />,
            text: "Create Delivery",
            to: "/delivery/create-delivery",
            section: "GENERAL",
        },
        {
            icon: <QrCode size={20} />,
            text: "Scan Invoice",
            to: "/delivery/scan",
            section: "GENERAL",
        },
        {
            icon: <Users size={20} />,
            text: "Customers",
            to: "/delivery/customers",
            section: "SUPPORT",
        },
        {
            icon: <BarChart size={20} />,
            text: "Reports",
            to: "/delivery/reports",
            section: "SUPPORT",
        },
        {
            icon: <Settings size={20} />,
            text: "Settings",
            to: "/delivery/settings",
            section: "SUPPORT",
        },
    ];

    const driverItems = [
        {
            icon: <LayoutDashboard size={20} />,
            text: "Dashboard",
            to: "/delivery",
            section: "GENERAL",
        },
        {
            icon: <ClipboardList size={20} />,
            text: "My Deliveries",
            to: "/delivery/deliveries",
            section: "GENERAL",
        },
        {
            icon: <QrCode size={20} />,
            text: "Scan Invoice",
            to: "/delivery/scan",
            section: "GENERAL",
        },
        {
            icon: <CreditCard size={20} />,
            text: "Record Payment",
            to: "/delivery/record-payment",
            section: "GENERAL",
        },
        {
            icon: <Settings size={20} />,
            text: "Settings",
            to: "/delivery/settings",
            section: "SUPPORT",
        },
    ];

    const items = user?.role !== "admin" ? driverItems : managerItems;

    const sections = Array.from(new Set(items.map((item) => item?.section)));

    return (
        <div
            className={`absolute flex flex-col h-screen sm:relative bg-white shadow-lg shadow-gray-200 border-r border-gray-200 transition-all duration-300 z-50 ${collapsed ? "w-0 sm:w-20" : "w-screen sm:w-64"
                }`}
        >
            <div className="flex items-center h-16 px-2 border-b border-gray-200">
                <div className="flex items-center">
                    <img src="/static/images/101-logo-delivery.png" alt="Logo" className={`w-auto h-10 transition-all duration-300`} />
                    <span
                        className={`text-3xl font-semibold text-green-600 ml-1 transition-all duration-300 ${collapsed ? "hidden" : ""
                            }`}
                    >
                        Delivery
                    </span>
                </div>
                <div className={`ml-auto ${collapsed && "absolute top-5 -right-9"}`}>
                    <button
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="text-gray-400 hover:text-gray-600 border border-gray-300 rounded p-1 bg-white"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 448 512"
                            className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${collapsed ? "rotate-180" : ""
                                }`}
                        >
                            <path
                                fill="currentColor"
                                d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"
                            />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sections.map((section) => (
                    <div
                        key={section}
                        className={`py-4 ${section !== sections[sections.length - 1] ? "border-b border-gray-200" : ""}`}
                    >
                        <div
                            className={`text-xs text-gray-400 ${collapsed ? "px-2" : "px-4"
                                } mb-2`}
                        >
                            {section}
                        </div>
                        <ul>
                            {items
                                .filter((item) => item?.section === section)
                                .map((item) => (
                                    <li className="mb-1" key={item?.to}>
                                        <button
                                            className={`flex items-center ${collapsed ? "justify-center" : ""
                                                } px-4 py-2 transition-colors w-full text-left ${location.pathname === item?.to
                                                    ? "bg-green-100 text-green-700 font-bold"
                                                    : "text-gray-800 hover:bg-gray-100"
                                                }`}
                                            onClick={() => {
                                                setActiveItem(item?.text);
                                                navigate(item?.to);
                                            }}
                                        >
                                            <span
                                                className={`w-5 h-5 mr-3 flex items-center justify-center ${location.pathname === item?.to
                                                        ? "text-green-600"
                                                        : "text-gray-500"
                                                    }`}
                                            >
                                                {item?.icon}
                                            </span>
                                            {!collapsed && item?.text}
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className={`p-2 border-t border-gray-200 ${collapsed ? "hidden sm:block" : ""}`}>
                <div className={`flex items-center p-2 bg-white border border-gray-200 rounded-md hover:border-gray-200 transition-all ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center text-white">
                        <Truck className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="ml-2">
                            <p className="text-sm font-medium">Team</p>
                            <p className="text-xs text-gray-600">Delivery</p>
                        </div>
                    )}
                    <button className={`ml-auto text-gray-400 hover:text-gray-600 transition-colors ${collapsed ? "hidden" : ""}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-4 h-4 scale-x-75">
                            <path d="M234 19.5c-5.8-4.7-14.1-4.7-20 0L54 147.5c-6.9 5.5-8 15.6-2.5 22.5s15.6 8 22.5 2.5l150-120 150 120c6.9 5.5 17 4.4 22.5-2.5s4.4-17-2.5-22.5L234 19.5zm160 345c6.9-5.5 8-15.6 2.5-22.5s-15.6-8-22.5-2.5l-150 120L74 339.5c-6.9-5.5-17-4.4-22.5 2.5s-4.4 17 2.5 22.5l160 128c5.8 4.7 14.1 4.7 20 0l160-128z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;