export const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const refreshToken = async () => {
    try {
        const refresh = localStorage.getItem('refreshToken');
        if (!refresh) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh })
        });

        const data = await response.json();
        if (data.access) {
            localStorage.setItem('accessToken', data.access);
            return data.access;
        } else {
            throw new Error('Failed to refresh token');
        }
    } catch (error) {
        // If refresh fails, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw error;
    }
};

export const apiRequest = async (url, options = {}) => {
    try {
        options.headers = {
            ...options.headers,
            ...getAuthHeaders()
        };

        let response = await fetch(url, options);

        if (response.status === 401) {
            // Try to refresh the token
            const newToken = await refreshToken();
            
            // Retry the original request with the new token
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${newToken}`
            };
            response = await fetch(url, options);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
};
