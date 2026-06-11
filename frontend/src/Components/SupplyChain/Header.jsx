import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { userAtom, activeProductAtom, supplyChainSearchAtom } from "../../Variables";

const Header = ({ logout }) => {
	const [user] = useAtom(userAtom);
	const [, setActiveProduct] = useAtom(activeProductAtom);
	const [search, setSearch] = useAtom(supplyChainSearchAtom);
	const [showMenu, setShowMenu] = useState(false);
	const [results, setResults] = useState([]);
	const debounceRef = useRef();
	const searchInputRef = useRef();

	const fetchResults = (value) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			if (!value.trim()) {
				setResults([]);
				return;
			}
			fetch(`${import.meta.env.VITE_SERVER_URL}/api/search-products/?query=${encodeURIComponent(value)}`)
				.then((res) => res.json())
				.then((data) => setResults(data || []))
				.catch(() => setResults([]));
		}, 300);
	};

	const handleSearchChange = (e) => {
		const value = e.target.value;
		setSearch(value);
		fetchResults(value);
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
		<header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-5 shadow-sm z-50">
			<Link to="/supply-chain" className="text-teal-700 font-semibold text-lg hidden lg:block shrink-0 ml-5">
				Supply Chain Analytics
			</Link>

			<div className="flex items-center flex-1 max-w-xl mx-4">
				<div className="relative w-full">
					<input
						type="text"
						ref={searchInputRef}
						placeholder="Search Products"
						value={search}
						onChange={handleSearchChange}
						autoComplete="off"
						className="w-full pl-10 pr-20 py-2 peer rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:border-teal-500 text-sm"
					/>
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-teal-500">
						<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
					</span>
					<span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded">⌘ + K</span>
					{results.length > 0 && (
						<div className="absolute left-0 right-0 mt-2 py-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
							{results.map((item, idx) => (
								<div
									key={item?.document?.id || idx}
									onClick={() => {
										setActiveProduct(item?.document || {});
										setSearch(item?.document?.productName || "");
										setResults([]);
									}}
									className="flex items-center gap-2 px-4 py-2 hover:bg-teal-50 cursor-pointer text-sm"
								>
									<img
										src={item?.document?.imageUrl || "/static/images/default.png"}
										alt={item?.document?.productName}
										className="w-10 h-10 rounded object-cover shrink-0"
									/>
									<div className="min-w-0">
										{item?.highlight?.productName?.snippet ? (
											<div dangerouslySetInnerHTML={{ __html: item.highlight.productName.snippet }} />
										) : (
											<div className="truncate">{item?.document?.productName}</div>
										)}
										{(item?.highlight?.sku?.snippet || item?.highlight?.upc?.snippet) && (
											<div
												className="text-xs text-gray-500 truncate"
												dangerouslySetInnerHTML={{ __html: item?.highlight?.sku?.snippet || item?.highlight?.upc?.snippet }}
											/>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="relative shrink-0">
				<button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
						<span className="text-teal-700 text-sm font-medium">{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
					</div>
					<span className="text-sm text-gray-700 hidden sm:inline">{user?.first_name} {user?.last_name}</span>
				</button>
				{showMenu && (
					<div className="absolute right-0 mt-2 w-40 bg-white rounded shadow-lg border z-50">
						<button onClick={logout} className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50">Logout</button>
					</div>
				)}
			</div>
		</header>
	);
};

export default Header;
