import React, { useState, useRef, useEffect } from "react";
import { Truck } from "lucide-react";

const user = {
    id: "1",
    name: "Delivery Manager",
    email: "manager@example.com",
    password: "manager123",
    role: "manager",
};

const Header = () => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const debounceRef = useRef();
    const searchInputRef = useRef();

    const handleLogout = () => {
        window.location.href = "/login";
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (value.trim().length === 0) {
                setResults([]);
                return;
            }
            // Dummy fetch for demonstration; replace with actual endpoint if needed
            fetch(`/api/search-deliveries?query=${encodeURIComponent(value)}/`)
                .then((res) => res.json())
                .then((data) => {
                    setResults(data || []);
                })
                .catch(() => setResults([]));
        }, 300);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            if ((isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k")) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className="h-16 bg-white border-b border-gray-200 shadow-lg flex items-center justify-between px-6 z-50">
            {/* Logo and Search Bar */}
            <div className="flex items-center w-full sm:w-86 ml-5">
                <div className="relative w-full">
                    <input
                        type="text"
                        ref={searchInputRef}
                        placeholder="Search Deliveries"
                        onChange={handleSearchChange}
                        className="pl-10 pr-20 py-2 peer w-full rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-indigo-500">
                        {/* Search Icon */}
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-indigo-500 text-xs bg-gray-100 peer-focus:bg-indigo-50 px-2 py-0.5 rounded">⌘ + K</span>
                    {/* Search Results Dropdown */}
                    {results?.length > 0 && (
                        <div className="absolute hidden peer-focus:block hover:block left-0 right-0 mt-2 py-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 h-fit w-full sm:w-[150%] overflow-hidden">
                            {results.map((item, idx) => (
                                <div
                                    key={item?.id || idx}
                                    className="flex flex-row flex-nowrap gap-2 w-full items-center justify-start px-4 py-1 h-12 hover:bg-indigo-50 cursor-pointer text-sm"
                                >
                                    <img src={item?.imageUrl || "/static/images/default.png"} alt={item?.name} className="w-10 h-10 rounded mr-2 inline-block" />
                                    <div className="truncate-2">{item?.name || "Delivery"}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Right Side Icons and Profile */}
            <div className="items-center gap-6 hidden sm:flex">
                {/* Icons */}
                <div className="flex items-center gap-4 text-gray-500">
                    {/* Bell Icon */}
                    <button className="hover:text-gray-700">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                    </button>
                    {/* Plus Icon */}
                    <button className="hover:text-gray-700">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
                {/* Profile */}
                {user?.name && (
                    <div className="relative">
                        <button className="flex items-center gap-3" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center border border-gray-200">
                                <img
                                    src={"https://api.dicebear.com/9.x/micah/svg?seed=" + encodeURIComponent(user?.name)}
                                    className="w-full h-full object-cover rounded-full"
                                    alt={user?.name}
                                />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium text-gray-900">{user?.name}</span>
                                <span className="text-xs text-gray-400">{user?.email}</span>
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
    );
};

export default Header;