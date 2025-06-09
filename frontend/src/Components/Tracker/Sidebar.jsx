import { useAtom } from "jotai";
import { History, MapPin, Settings, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { userAtom } from "../../Variables";

const Sidebar = () => {
    const [user] = useAtom(userAtom);
    const [role, setRole] = useState(user?.salesmanType); // 'admin' or 'salesman'
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(window.innerWidth < 640);
    const [activeItem, setActiveItem] = useState(role === "admin" ? "admin_salesmen" : "salesman_home");
    // Admin sidebar items
    const adminItems = [
        { icon: <Users size={20} />, text: "Salesmen", to: "/tracker/admin", key: "admin_salesmen", section: "MANAGE" },
        { icon: <MapPin size={20} />, text: "Global Tracker", to: "/tracker/admin/tracker", key: "admin_tracker", section: "MANAGE" },
        { icon: <Settings size={20} />, text: "Tracking Config", to: "/tracker/admin/settings", key: "admin_settings", section: "SETTINGS" },
        { icon: <User size={20} />, text: "Admin Profile", to: "/tracker/admin/profile", key: "admin_profile", section: "ACCOUNT" },
    ];

    // Salesman sidebar items
    const salesmanItems = [
        { icon: <MapPin size={20} />, text: "Tracking Map", to: "/tracker/salesman/home", key: "salesman_home", section: "GENERAL" },
        { icon: <History size={20} />, text: "History", to: "/tracker/salesman/history", key: "salesman_history", section: "GENERAL" },
        { icon: <User size={20} />, text: "Profile", to: "/tracker/salesman/profile", key: "salesman_profile", section: "ACCOUNT" },
    ];
    const [items, setItems] = useState(role === "admin" ? adminItems : salesmanItems);
    const [sections, setSections] = useState(Array.from(new Set(items.map((item) => item?.section))));

    useEffect(() => {
        setRole(user?.salesmanType);
    }, [user]);

    useEffect(() => {
        // Find the matching item key for the current path
        const currentPath = location.pathname;
        const found = items.find(item => currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to)));
        if (found) {
            setActiveItem(found.key);
        } else {
            setActiveItem(""); // fallback if no match
        }
    }, [location.pathname, items]);


    useEffect(() => {
        let currentLocation = window.location.pathname;
        if (currentLocation === "/tracker/admin") {
            setActiveItem("admin_salesmen");
        }
        else if (currentLocation.startsWith("/tracker/admin/tracker")) {
            setActiveItem("admin_tracker");
        }
        else if (currentLocation.startsWith("/tracker/admin/settings")) {
            setActiveItem("admin_settings");
        }
        else if (currentLocation.startsWith("/tracker/admin/profile")) {
            setActiveItem("admin_profile");
        }
        else if (currentLocation === "/tracker/salesman/home") {
            setActiveItem("salesman_home");
        }
        else if (currentLocation.startsWith("/tracker/salesman/history")) {
            setActiveItem("salesman_history");
        }
        else if (currentLocation.startsWith("/tracker/salesman/profile")) {
            setActiveItem("salesman_profile");
        }
        

    }, [location.pathname]);



    useEffect(() => {
        const newItems = role === "admin" ? adminItems : salesmanItems;
        setItems(newItems);
        setSections(Array.from(new Set(newItems.map((item) => item?.section))));
    }, [role]);

    return (
        <div className={`absolute flex flex-col h-screen sm:relative bg-white shadow-lg shadow-gray-200 border-r border-gray-200 transition-all duration-300 z-50 ${collapsed ? "w-0 sm:w-20" : "w-screen sm:w-64"}`}>
            <div className="flex items-center h-16 px-2 border-b border-gray-200">
                <div className="flex items-center">
                    <img src="/static/images/101-logo-tracker.png" alt="Logo" className={`w-auto h-10 transition-all duration-300`} />
                    <span className={`text-3xl font-semibold text-orange-600 ml-1 transition-all duration-300 ${collapsed ? "hidden" : ""}`}>Tracker</span>
                </div>
                <div className={`ml-auto ${collapsed && "absolute top-5 -right-9"}`}>
                    <button
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="text-gray-400 hover:text-gray-600 border border-gray-300 rounded p-1 bg-white"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z" /></svg>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sections.map((section) => (
                    <div key={section} className={`py-4 ${section !== sections[sections.length - 1] ? "border-b border-gray-200" : ""}`}>
                        <div className={`text-xs text-gray-400 ${collapsed ? "px-2 text-center" : "px-4"} mb-2 uppercase tracking-wider`}>{section}</div>
                        <ul>
                            {items.filter((item) => item?.section === section).map((item) => (
                                <li className="mb-1" key={item?.key}>
                                    <Link
                                        to={item?.to}
                                        className={`flex items-center ${collapsed ? "justify-center" : ""} px-4 py-2 transition-colors w-full text-left ${activeItem === item?.key ? "bg-orange-100 text-orange-700 font-bold" : "text-gray-800 hover:bg-gray-100"}`}
                                        onClick={() => {
                                            setActiveItem(item?.key);
                                        }}
                                    >
                                        <span className={`w-5 h-5 ${!collapsed && 'mr-3'} flex items-center justify-center ${activeItem === item?.key ? "text-orange-600" : "text-gray-500"}`}>{item?.icon}</span>
                                        {!collapsed && item?.text}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className={`p-2 border-t border-gray-200 ${collapsed ? "hidden sm:block" : ""}`}>
                <div className={`flex items-center p-2 bg-white border border-gray-200 rounded-md transition-all ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center text-white">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="ml-2">
                            <p className="text-sm font-medium capitalize">{role}</p>
                            <p className="text-xs text-gray-600">{role === "admin" ? "Management" : "Field Team"}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;