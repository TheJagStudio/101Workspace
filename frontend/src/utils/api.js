import { useAtom } from "jotai";
import { errorsAtom } from "../Variables";
import { getDefaultStore } from "jotai";

const store = getDefaultStore();

export const getAuthHeaders = () => {
	const token = localStorage.getItem("accessToken");
	return {
		"Content-Type": "application/json",
		Authorization: token ? `Bearer ${token}` : "",
	};
};

export const refreshToken = async () => {
	try {
		const refresh = localStorage.getItem("refreshToken");
		if (!refresh) {
			throw new Error("No refresh token available");
		}

		const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/token/refresh/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refresh }),
		});

		const data = await response.json();
		if (data.access) {
			localStorage.setItem("accessToken", data.access);
			return data.access;
		} else {
			throw new Error("Failed to refresh token");
		}
	} catch (error) {
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		window.location.href = "/login";
		throw error;
	}
};

export const apiRequest = async (url, options = {}) => {
	try {
		options.headers = {
			...options.headers,
			...getAuthHeaders(),
		};

		let response = await fetch(url, options);

		if (response.status === 401) {
			const newToken = await refreshToken();

			options.headers = {
				...options.headers,
				Authorization: `Bearer ${newToken}`,
			};
			response = await fetch(url, options);
		}

		const data = await response.json();

		if (!response.ok) {
			const errorMessage = data.message || data.error || "An error occurred";
			const errorId = Date.now();

			store.set(errorsAtom, (prev) => {
				const errorExists = prev.some((e) => e.message === errorMessage && e.url === url);
				if (errorExists) {
					return prev;
				}
				return [
					...prev,
					{
						id: errorId,
						message: errorMessage,
						status: response.status,
						url: url,
					},
				];
			});

			throw new Error(errorMessage);
		}

		return data;
	} catch (error) {
		if (!error.message.includes("An error occurred")) {
			const errorMessage = error.message || "Unexpected error";

			store.set(errorsAtom, (prev) => {
				const errorExists = prev.some((e) => e.message === errorMessage && e.url === url);
				if (errorExists) {
					return prev;
				}
				return [
					...prev,
					{
						id: Date.now(),
						message: errorMessage,
						url: url,
					},
				];
			});
		}

		throw error;
	}
};
