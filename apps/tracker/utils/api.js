import { getDefaultStore } from 'jotai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorsAtom } from '../Variables';

const store = getDefaultStore();

// This function is now async because AsyncStorage is async
export const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
};

export const refreshToken = async () => {
  try {
    const refresh = await AsyncStorage.getItem('refreshToken');
    if (!refresh) {
      throw new Error('No refresh token available');
    }

    // Your environment variable should work fine in Expo
    const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    });

    const data = await response.json();
    if (data.access) {
      await AsyncStorage.setItem('accessToken', data.access);
      return data.access;
    } else {
      throw new Error('Failed to refresh token');
    }
  } catch (error) {
    // Clear tokens from async storage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');

    // Redirect to login screen using the navigation service
    // 'resetRoot' will clear the navigation stack, which is desired after a logout/token failure
    RootNavigation.resetRoot('Login'); // Make sure you have a screen named 'Login' in your navigator

    throw error;
  }
};

export const apiRequest = async (url, options = {}) => {
  try {
    // Must await the async getAuthHeaders function
    const authHeaders = await getAuthHeaders();
    options.headers = {
      ...options.headers,
      ...authHeaders,
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

    // The rest of the logic for error handling with Jotai remains the same as it's platform-agnostic.
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'An error occurred';
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
    // This Jotai logic also remains the same.
    if (!error.message.includes('An error occurred')) {
      const errorMessage = error.message || 'Unexpected error';

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
