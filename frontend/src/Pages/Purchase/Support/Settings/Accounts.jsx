import React, { useState } from "react";
import { userAtom } from "../../../../Variables";
import { useAtom } from "jotai";
import { apiRequest } from "../../../../utils/api";

const Accounts = () => {
	const [showPassword, setShowPassword] = useState(false);
	const [user] = useAtom(userAtom);

	// State for password change
	const [oldPassword, setOldPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState(null);
	const [error, setError] = useState(null);

	const handleChangePassword = async (e) => {
		e.preventDefault();
		setLoading(true);
		setMessage(null);
		setError(null);
		try {
			const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/auth/changePassword/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("access")}`,
				},
				body: JSON.stringify({
					old_password: oldPassword,
					new_password: newPassword,
				}),
			});
			if (data.status === "success") {
				setMessage("Password changed successfully.");
				setOldPassword("");
				setNewPassword("");
				// Optionally update tokens in localStorage
				if (data.tokens) {
					localStorage.setItem("access", data.tokens.access);
					localStorage.setItem("refresh", data.tokens.refresh);
				}
			} else {
				setError(data.message || "Failed to change password.");
			}
		} catch (err) {
			setError("Network error.");
		}
		setLoading(false);
	};

	return (
		<>
			<div className="pt-4">
				<h1 className="py-2 text-2xl font-semibold">Account settings</h1>
			</div>
			<hr className="my-4 text-gray-300" />
			<p className="py-2 text-xl font-semibold">Email Address</p>
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<p className="text-gray-600">
					Your email address is <strong>{user.email}</strong>
				</p>
				<button className="inline-flex text-sm font-semibold text-indigo-600 underline decoration-2">Change</button>
			</div>
			<hr className="my-4 text-gray-300" />
			<p className="py-2 text-xl font-semibold">Password</p>
			<div>
				<div className="flex gap-3 items-center">
					<div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
						<label htmlFor="current-password">
							<span className="text-sm text-gray-500">Current Password</span>
							<div className="relative flex overflow-hidden rounded-md border border-gray-400 transition focus-within:border-indigo-600">
								<input type={showPassword ? "text" : "password"} id="current-password" className="w-full flex-shrink appearance-none border-gray-300 bg-white py-2 px-4 text-base text-gray-700 placeholder-gray-400 focus:outline-none" placeholder={showPassword ? "Enter Password" : "•••••••••••"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
							</div>
						</label>
						<label htmlFor="new-password">
							<span className="text-sm text-gray-500">New Password</span>
							<div className="relative flex overflow-hidden rounded-md border border-gray-400 transition focus-within:border-indigo-600">
								<input type={showPassword ? "text" : "password"} id="new-password" className="w-full flex-shrink appearance-none border-gray-300 bg-white py-2 px-4 text-base text-gray-700 placeholder-gray-400 focus:outline-none" placeholder={showPassword ? "Enter Password" : "•••••••••••"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
							</div>
						</label>
					</div>
					{showPassword ? (
						<svg onClick={() => setShowPassword(false)} width={30} height={30} className="text-gray-800 bg-gray-100 p-1 rounded-lg mt-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path strokeWidth="1" stroke="currentColor" fill="currentColor" d="M2.034 11.82c2.134-5.505 8.326-8.237 13.83-6.103a10.7 10.7 0 0 1 6.102 6.102.5.5 0 0 1 0 .362c-2.134 5.504-8.326 8.236-13.83 6.102a10.7 10.7 0 0 1-6.102-6.102.5.5 0 0 1 0-.362m6.463 5.53a9.69 9.69 0 0 0 12.465-5.35 9.7 9.7 0 0 0-5.46-5.35C10.575 4.739 5.038 7.132 3.039 12a9.7 9.7 0 0 0 5.46 5.35M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m0-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
						</svg>
					) : (
						<svg onClick={() => setShowPassword(true)} width={30} height={30} className="text-gray-800 bg-gray-100 p-1 rounded-lg mt-5" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
							<path fill="currentColor" d="M230.888 162.813a8 8 0 1 1-13.856 8l-18.382-31.839a123.6 123.6 0 0 1-35.288 16.278l5.813 32.965a8 8 0 0 1-6.49 9.268 8 8 0 0 1-1.399.122 8 8 0 0 1-7.869-6.61l-5.718-32.428a136.3 136.3 0 0 1-39.488-.014l-5.717 32.427a8 8 0 0 1-7.869 6.613 8 8 0 0 1-1.398-.122 8 8 0 0 1-6.49-9.268l5.814-32.978a123.6 123.6 0 0 1-35.245-16.282l-18.49 32.026a8 8 0 1 1-13.855-8l19.497-33.77a148 148 0 0 1-18.682-19.299 8 8 0 1 1 12.446-10.054 128.7 128.7 0 0 0 21.245 20.923c.063.044.12.094.181.14A109.6 109.6 0 0 0 128 144a109.6 109.6 0 0 0 68.337-23.079c.053-.04.102-.081.156-.12a128.7 128.7 0 0 0 21.284-20.953 8 8 0 0 1 12.446 10.054 148 148 0 0 1-18.722 19.333Z" />
						</svg>
					)}
				</div>
				<p className="mt-2">
					Can't remember your current password.{" "}
					<a className="text-sm font-semibold text-indigo-600 underline decoration-2" href="#">
						Recover Account
					</a>
				</p>
				{message && <div className="mt-2 text-green-600">{message}</div>}
				{error && <div className="mt-2 text-red-600">{error}</div>}
				<button type="button" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white cursor-pointer" disabled={loading} onClick={handleChangePassword}>
					{loading ? "Saving..." : "Save Password"}
				</button>
			</div>
			<hr className="my-4 text-gray-300" />

			<div className="mb-10">
				<p className="py-2 text-xl font-semibold">Delete Account</p>
				<p className="inline-flex items-center rounded-full bg-rose-100 px-4 py-1 text-rose-600">
					<svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
					</svg>
					Proceed with caution
				</p>
				<p className="mt-2">Make sure you have taken backup of your account in case you ever need to get access to your data. We will completely wipe your data. There is no way to access your account after this action.</p>
				<button className="ml-auto text-sm font-semibold text-rose-600 underline decoration-2">Continue with deletion</button>
			</div>
		</>
	);
};

export default Accounts;
