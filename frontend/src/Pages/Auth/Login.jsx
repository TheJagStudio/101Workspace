import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtom } from 'jotai'
import { userAtom } from '../../Variables'
import { apiRequest } from '../../utils/api'

const Login = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate()
	const [, setUser] = useAtom(userAtom)

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const data = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/auth/login/`, {
				method: "POST",
				body: JSON.stringify({
					username: email,
					password: password,
				}),
			});
			if (data.status === "success") {
				// Store tokens in localStorage
				localStorage.setItem("accessToken", data.tokens.access);
				localStorage.setItem("refreshToken", data.tokens.refresh);

				// Set user info
				setUser(data.user_info);
				navigate("/");
			} else {
				setError(data.message || "Login failed");
			}
		} catch (err) {
			setError("Network error");
		}
		setLoading(false);
	};

	return (
		<div className="md:bg-[#f9fbfc] flex items-center justify-center h-screen">
			<div className="md:bg-white rounded-xl md:shadow-lg p-10 w-full max-w-md">
				<div className="flex flex-col items-center mb-6">
					<div className="p-2 bg-gradient-to-br from-red-50 to-red-100 border border-dashed border-red-500 rounded-lg flex items-center justify-center mb-2 absolute top-5 left-5">
						<img src="/static/images/101-logo.png" alt="Logo" className="w-auto h-12" />
						<p className="text-4xl font-semibold text-red-600">Workspace</p>
					</div>
					<h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
					<p className="text-gray-500 text-sm text-center">
						Glad to see you again 👋
						<br />
						Login to your account below
					</p>
				</div>
				<form className="space-y-3" onSubmit={handleSubmit}>
					<input type="email" placeholder="Enter Email..." className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
					<div className="relative">
						<input
							type={showPassword ? "text" : "password"}
							placeholder="Enter Password..."
							className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500 pr-10"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
						<button
							type="button"
							className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
							onClick={() => setShowPassword((prev) => !prev)}
							tabIndex={-1}
							aria-label={showPassword ? "Hide password" : "Show password"}
						>
							{showPassword ? (
								// Eye-off SVG
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 012.22-3.34M6.7 6.7A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.17 5.19M15 12a3 3 0 11-6 0 3 3 0 016 0zM3 3l18 18" />
								</svg>
							) : (
								// Eye SVG
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							)}
						</button>
					</div>
					{error && <div className="text-red-500 text-sm">{error}</div>}
					<button type="submit" className="w-full py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 mt-2" disabled={loading}>
						{loading ? "Logging in..." : "Login"}
					</button>
				</form>
				<div className="text-center mt-4 text-sm text-gray-500">
					Don't have an account?{" "}
					<a href="/signup" className="text-red-600 font-medium hover:underline">
						Sign up for Free
					</a>
				</div>
			</div>
		</div>
	);
}

export default Login