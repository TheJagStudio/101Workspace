import React, { useState, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../../Variables";
import { apiRequest } from "../../utils/api";
import { useNavigate } from "react-router-dom";

const Header = () => {
    const [user] = useAtom(userAtom);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef();
    const searchInputRef = useRef();
    const navigate = useNavigate();

    const handleLogout = () => window.logout();

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            let response  =  await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/tracker/admin/salesmen/?search=${encodeURIComponent(value)}`);
            setResults(Array.isArray(response["results"]) ? response["results"] : []);
            setLoading(false);
        }, 500);
    };

    const handleResultClick = (salesmanId) => {
        navigate(`/tracker/admin/tracker/?salesmanId=${salesmanId}`);
        setSearch('');
        setResults([]);
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
            <div className="flex items-center w-full sm:w-86 ml-5">
                {user?.salesmanType === 'admin' && (
                    <div className="relative w-full">
                        <input
                            type="text"
                            ref={searchInputRef}
                            placeholder="Search Salesman..."
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-10 pr-20 py-2 peer w-full rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:border-orange-500 text-sm"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-orange-500">
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-orange-500 text-xs bg-gray-100 peer-focus:bg-orange-50 px-2 py-0.5 rounded">⌘ + K</span>
                        
                        {search && (
                             <div className="absolute left-0 right-0 mt-2 py-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 h-fit w-full sm:w-64 overflow-hidden">
                                {loading && <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>}
                                {!loading && results.length === 0 && <div className="px-4 py-2 text-sm text-gray-500">No results found.</div>}
                                {results.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleResultClick(item.id)}
                                        className="flex items-center gap-2 w-full px-4 py-2 border-b border-gray-300 last:border-b-0 hover:bg-orange-50 cursor-pointer text-sm"
                                    >
                                        <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${item.user.first_name}${item.user.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban`} alt={item.user.username} className="w-9 h-9 rounded-full bg-orange-100" />
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-700">{item.user.first_name} {item.user.last_name}</span>
                                            <span className="text-xs text-gray-500">{item.phone_number}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="items-center gap-6 hidden sm:flex">
                {user?.username && (
                    <div className="relative">
                        <button className="flex items-center gap-3" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                             <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center border border-gray-200">
                                <img
                                    src={`https://api.dicebear.com/9.x/micah/svg?seed=${user.first_name}${user.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban`}
                                    className="w-full h-full object-cover rounded-full"
                                    alt={user.username}
                                />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</span>
                                <span className="text-xs text-gray-400">{user.email}</span>
                            </div>
                        </button>
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