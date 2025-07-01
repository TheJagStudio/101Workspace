import { apiRequest } from './api';

const TRACKER_API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker`;

// Salesmen API
export const fetchSalesmen = async () => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/salesmen/`);
        return response;
    } catch (error) {
        console.error('Error fetching salesmen:', error);
        throw error;
    }
};

export const fetchSalesman = async (id) => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/salesmen/${id}/`);
        return response;
    } catch (error) {
        console.error('Error fetching salesman:', error);
        throw error;
    }
};

export const updateSalesman = async (id, data) => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/salesmen/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        return response;
    } catch (error) {
        console.error('Error updating salesman:', error);
        throw error;
    }
};

export const updateMyLocation = async (locationData) => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/salesmen/update-my-location/`, {
            method: 'POST',
            body: JSON.stringify(locationData),
        });
        return response;
    } catch (error) {
        console.error('Error updating location:', error);
        throw error;
    }
};

export const toggleTracking = async () => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/salesmen/toggle-tracking/`, {
            method: 'POST',
        });
        return response;
    } catch (error) {
        console.error('Error toggling tracking:', error);
        throw error;
    }
};

// Location Points API
export const fetchLocationPoints = async (salesmanId = null) => {
    try {
        const url = salesmanId 
            ? `${TRACKER_API_BASE}/location-points/?salesman=${salesmanId}`
            : `${TRACKER_API_BASE}/location-points/`;
        const response = await apiRequest(url);
        return response;
    } catch (error) {
        console.error('Error fetching location points:', error);
        throw error;
    }
};

// Daily Activities API
export const fetchDailyActivities = async (salesmanId = null, date = null) => {
    try {
        let url = `${TRACKER_API_BASE}/daily-activities/`;
        const params = new URLSearchParams();
        
        if (salesmanId) params.append('salesman', salesmanId);
        if (date) params.append('date', date);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await apiRequest(url);
        return response;
    } catch (error) {
        console.error('Error fetching daily activities:', error);
        throw error;
    }
};

export const createDailyActivity = async (data) => {
    try {
        const response = await apiRequest(`${TRACKER_API_BASE}/daily-activities/`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return response;
    } catch (error) {
        console.error('Error creating daily activity:', error);
        throw error;
    }
};

// Admin Settings API