export const mockSalesmen = [
    {
        id: 1,
        user: { id: 101, username: 'John Doe' },
        phone_number: '111-222-3333',
        status: 'active',
        last_seen: new Date(new Date().getTime() - 2 * 60 * 1000).toISOString(), // 2 mins ago
        current_location_lat: 34.0522,
        current_location_lng: -118.2437,
        battery: 85,
        today_visits: 5,
    },
    {
        id: 2,
        user: { id: 102, username: 'Jane Smith' },
        phone_number: '444-555-6666',
        status: 'active',
        last_seen: new Date(new Date().getTime() - 5 * 60 * 1000).toISOString(), // 5 mins ago
        current_location_lat: 34.0600,
        current_location_lng: -118.2500,
        battery: 45,
        today_visits: 3,
    },
    {
        id: 3,
        user: { id: 103, username: 'Mike Johnson' },
        phone_number: '777-888-9999',
        status: 'offline',
        last_seen: new Date(new Date().getTime() - 65 * 60 * 1000).toISOString(), // 65 mins ago
        current_location_lat: 34.0450,
        current_location_lng: -118.2300,
        battery: 15,
        today_visits: 7,
    },
    {
        id: 4,
        user: { id: 104, username: 'Sarah Williams' },
        phone_number: '123-456-7890',
        status: 'active',
        last_seen: new Date(new Date().getTime() - 1 * 60 * 1000).toISOString(), // 1 min ago
        current_location_lat: 34.0555,
        current_location_lng: -118.2600,
        battery: 95,
        today_visits: 1,
    }
];

export const mockDailyActivities = [
    {
        id: 1,
        salesmanId: 1,
        date: '2023-10-26',
        checkpoints: 12,
        duration: '8h 15m',
        distance: 45.2,
        start_time: '09:00',
        end_time: '17:15',
    },
    {
        id: 2,
        salesmanId: 1,
        date: '2023-10-25',
        checkpoints: 10,
        duration: '7h 30m',
        distance: 38.7,
        start_time: '09:30',
        end_time: '17:00',
    },
     {
        id: 3,
        salesmanId: 2,
        date: '2023-10-26',
        checkpoints: 8,
        duration: '6h 45m',
        distance: 29.1,
        start_time: '10:00',
        end_time: '16:45',
    },
];

export const mockRouteHistory = {
    1: [ // For John Doe
        { lat: 34.0522, lng: -118.2437 },
        { lat: 34.0535, lng: -118.2465 },
        { lat: 34.0550, lng: -118.2480 },
        { lat: 34.0565, lng: -118.2500 },
    ],
    2: [ // For Jane Smith
        { lat: 34.0600, lng: -118.2500 },
        { lat: 34.0585, lng: -118.2525 },
        { lat: 34.0570, lng: -118.2550 },
    ]
};

export const mockLiveActivityFeed = [
    {
        id: 1,
        salesmanName: 'John Doe',
        message: 'Checked in at "Alpha Wholesale".',
        timestamp: new Date(new Date().getTime() - 10 * 60 * 1000).toISOString(),
        type: 'checkpoint',
    },
    {
        id: 2,
        salesmanName: 'Mike Johnson',
        message: 'Went offline. Last seen near Downtown.',
        timestamp: new Date(new Date().getTime() - 65 * 60 * 1000).toISOString(),
        type: 'offline',
    },
    {
        id: 3,
        salesmanName: 'Jane Smith',
        message: 'Battery is low (15%).',
        timestamp: new Date(new Date().getTime() - 5 * 60 * 1000).toISOString(),
        type: 'alert',
    },
    {
        id: 4,
        salesmanName: 'Sarah Williams',
        message: 'Location updated.',
        timestamp: new Date(new Date().getTime() - 1 * 60 * 1000).toISOString(),
        type: 'location',
    },
];

export const mockAdminSettings = {
    location_update_interval_minutes: 3,
    checkpoint_threshold_minutes: 15,
    proximity_range_meters: 50,
    notify_salesman_offline: true,
    notify_low_battery_alerts: true,
    notify_unusual_route_patterns: false,
    notify_daily_summary_reports: true,
};