import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Gets the default headers for an authenticated API request.
 * @returns {Promise<Object>} The request headers.
 */
export const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
};

/**
 * Attempts to refresh the authentication token.
 * If it fails, it clears local credentials and throws a specific AuthError.
 * @returns {Promise<string>} The new access token.
 */
export const refreshToken = async () => {
  try {
    const refresh = await AsyncStorage.getItem('refreshToken');
    if (!refresh) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(
      `http://10.1.11.205:8000/api/auth/token/refresh/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      }
    );
    console.log(response.content);
    const data = await response.json();
    if (response.ok && data.access) {
      await AsyncStorage.setItem('accessToken', data.access);
      return data.access;
    } else {
      // If the refresh API call fails, it's a fatal authentication error.
      throw new Error('Failed to refresh token. Session has expired.');
    }
  } catch (error) {
    // Any failure in this process means the user is unauthenticated.
    // Clear the tokens.
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');

    // Create and throw a specific error that the UI layer can catch to trigger a logout.
    const authError = new Error(
      error.message || 'Your session has expired. Please log in again.'
    );
    authError.name = 'AuthError'; // This is the key for identifying the error type.
    throw authError;
  }
};

/**
 * Makes a generic, authenticated API request with automatic token refresh.
 * Throws an 'AuthError' on unrecoverable authentication failure.
 * Throws a standard Error for other API or network failures.
 *
 * @param {string} url The URL to request.
 * @param {Object} options The fetch options.
 * @returns {Promise<any>} The JSON response data.
 */
export const apiRequest = async (url, options = {}) => {
  try {
    options.headers = await getAuthHeaders();

    let response = await fetch(url, options);

    // If the token is expired (401), try to refresh it.
    if (response.status === 401) {
      const newToken = await refreshToken(); // This might throw an AuthError.

      // Retry the original request with the new token.
      options.headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, options);
      console.log(response.content);
    }

    // For any non-successful response, parse the JSON and throw an error.
    if (!response.ok) {
      try {
        const data = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses.
        const errorMessage =
          data.detail ||
          data.message ||
          data.error ||
          `Request failed with status ${response.status}`;

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data; // Attach full error response for more context if needed.

        throw error;
      } catch (error2) {
        throw response.text;
      }
    }

    // Handle successful responses with no content (e.g., DELETE request).
    if (response.status === 204) {
      return null;
    }

    // Return the JSON data from a successful response.
    return response.json();
  } catch (error) {
    // Re-throw the error so the calling component's .catch() block can handle it.
    // This will include network errors, AuthErrors, and other API errors.
    throw error;
  }
};
