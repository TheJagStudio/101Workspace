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
					<input type="password" placeholder="Enter Password..." className="border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-0 focus:border-red-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
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