import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../utils/api";

const Signup = () => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);
		setError("");
		setSuccess("");

		try {
			const data = await apiRequest(
				`${import.meta.env.VITE_SERVER_URL}/api/auth/register/`,
				{
					method: "POST",
					body: JSON.stringify({
						username: email,
						email,
						password,
						firstName,
						lastName,
					}),
				}
			);

			if (data.status === "success") {
				setSuccess(data.message);
				setTimeout(() => {
					navigate("/login");
				}, 3000);
			} else {
				setError(data.message || "Registration failed");
			}
		} catch (err) {
			setError("Network error");
		}
		setLoading(false);
	};

	return (
		<div className="bg-[#f9fbfc] flex items-center justify-center min-h-screen py-6">
			<div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-md">
				<div className="flex flex-col items-center mb-6">
					<div className="p-2 bg-gradient-to-br from-red-50 to-red-100 border border-dashed border-red-500 rounded-lg flex items-center justify-center mb-2 absolute top-5 left-5">
						<img src="/static/images/101-logo.png" alt="Logo" className="w-auto h-12" />
						<p className="text-4xl font-semibold text-red-600">Workspace</p>
					</div>
					<h2 className="text-2xl font-semibold mb-1">Create Account</h2>
					<p className="text-gray-500 text-sm text-center">
						Get Started with Workspace101 🚀
						<br />
						Create your account below
					</p>
				</div>
				{success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">{success}</div>}
				<form className="space-y-3" onSubmit={handleSubmit}>
					<div className="grid grid-cols-2 gap-3">
						<input type="text" placeholder="First Name" className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-0 focus:border-red-500" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
						<input type="text" placeholder="Last Name" className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-0 focus:border-red-500" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
					</div>
					<input type="email" placeholder="Email Address" className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
					<div className="relative">
						<input type={showPassword ? "text" : "password"} placeholder="Password" className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
						<button type="button" className="absolute right-3 top-2 text-gray-500" onClick={() => setShowPassword(!showPassword)}>
							{showPassword ? "Hide" : "Show"}
						</button>
					</div>
					<div className="relative">
						<input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
						<button type="button" className="absolute right-3 top-2 text-gray-500" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
							{showConfirmPassword ? "Hide" : "Show"}
						</button>
					</div>
					{error && <div className="text-red-500 text-sm">{error}</div>}
					<button type="submit" className="w-full py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 mt-2" disabled={loading}>
						{loading ? "Creating Account..." : "Create Account"}
					</button>
				</form>
				<div className="text-center mt-4 text-sm text-gray-500">
					Already have an account?{" "}
					<a href="/login" className="text-red-600 font-medium hover:underline">
						Login here
					</a>
				</div>
			</div>
		</div>
	);
};

export default Signup;
