// import { useAtom } from "jotai";
// import { useEffect, useRef } from "react";
// import { Outlet, useNavigate } from "react-router-dom";
// import Header from "../Components/Tracker/Header";
// import Sidebar from "../Components/Tracker/Sidebar";
// import { userAtom, trackerSettingsAtom } from "../Variables";

// const TrackerOutlet = ({ logout }) => {
//     const [user] = useAtom(userAtom);
//     const [trackerSettings, setTrackerSettings] = useAtom(trackerSettingsAtom);
//     const navigate = useNavigate();
//     const trackingIntervalRef = useRef(null);

//     // Fetch tracker settings on mount
//     useEffect(() => {
//         async function fetchSettings() {
//             try {
//                 const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/tracker/admin/settings/`, {
//                     headers: {
//                         'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
//                         'Content-Type': 'application/json',
//                     },
//                 });
//                 if (res.ok) {
//                     const data = await res.json();
//                     setTrackerSettings(data);
//                 }
//             } catch (e) {
//                 // fallback to default
//             }
//         }
//         fetchSettings();
//     }, [setTrackerSettings]);

//     // Global ping logic (runs even if page changes)
//     useEffect(() => {
//         // Only run for salesman
//         if (!user?.is_salesman) return;

//         // Only send pings if tracking is ON (persisted in localStorage)
//         const isTracking = localStorage.getItem('tracker_is_tracking') === 'true';
//         if (!isTracking) return;

//         let isUnmounted = false;

//         // Save last ping time in localStorage to persist across refreshes
//         const LAST_PING_KEY = 'tracker_last_ping_time';

//         const sendPing = () => {
//             if (!navigator.geolocation) return;
//             navigator.geolocation.getCurrentPosition(
//                 (position) => {
//                     const { latitude, longitude } = position.coords;
//                     // Battery API (optional, fallback to 100)
//                     let battery = 100;
//                     if (navigator.getBattery) {
//                         navigator.getBattery().then(bat => {
//                             battery = Math.round(bat.level * 100);
//                             doPing(latitude, longitude, battery);
//                         });
//                     } else {
//                         doPing(latitude, longitude, battery);
//                     }
//                 },
//                 (error) => { },
//                 { enableHighAccuracy: true }
//             );
//         };

//         const doPing = (latitude, longitude, battery) => {
//             fetch(`${import.meta.env.VITE_SERVER_URL}/api/tracker/salesman/update_status/`, {
//                 method: 'POST',
//                 headers: {
//                     'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({ latitude, longitude, battery }),
//             });
//             // Save last ping time (ms since epoch)
//             localStorage.setItem(LAST_PING_KEY, Date.now().toString());
//         };

//         // Helper to check if enough time has passed since last ping
//         const shouldPing = () => {
//             const lastPing = parseInt(localStorage.getItem(LAST_PING_KEY), 10);
//             const now = Date.now();
//             const intervalMs = (trackerSettings?.location_update_interval_minutes || 3) * 60 * 1000;
//             if (!lastPing || (now - lastPing) >= intervalMs) {
//                 return true;
//             }
//             return false;
//         };

//         // On mount, only send ping if enough time has passed
//         if (shouldPing()) {
//             sendPing();
//         }

//         // Start interval
//         const intervalMs = (trackerSettings?.location_update_interval_minutes || 3) * 60 * 1000;
//         trackingIntervalRef.current = setInterval(() => {
//             if (!isUnmounted && shouldPing()) {
//                 sendPing();
//             }
//         }, intervalMs / 2); // check twice as often as interval for accuracy

//         return () => {
//             isUnmounted = true;
//             if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
//         };
//     }, [user?.is_salesman, trackerSettings?.location_update_interval_minutes]);

//     useEffect(() => {
//         if (user && user?.username !== "") {
//             if (!user?.is_salesman) {
//                 if (user?.is_superadmin) {
//                 } else {
//                     logout();
//                     console.error("User is not a salesman or superadmin, redirecting to login.");
//                 }
//             }
//             if (user?.salesmanType === "admin") {
//                 navigate("/tracker/admin");
//             } else {
//                 navigate("/tracker/salesman/home");
//             }
//         }
//     }, [user]);
//     return (
//         <div className="flex overflow-hidden">
//             <Sidebar />
//             <div className="flex-1">
//                 {user?.salesmanType === "admin" && (<Header />)}
//                 <div className="bg-[#f3f4f6] relative">
//                     <div className={"p-5 md:py-10 md:px-12 overflow-y-auto " + (user?.salesmanType === "admin" ? "h-[calc(100vh-4rem)] " : "pt-8 h-screen")}>
//                         <Outlet />
//                     </div>
//                 </div>
//             </div>
//         </div>
//     )
// };

// export default TrackerOutlet;



//  =================================================================


// /src/TrackerOutlet.js (or relevant component path)

import { useAtom } from "jotai";
import { useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "../Components/Tracker/Header";
import Sidebar from "../Components/Tracker/Sidebar";
import { userAtom, trackerSettingsAtom } from "../Variables";

// --- IndexedDB Helper ---
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('tracker-db', 1);
    request.onerror = () => reject('Error opening IndexedDB');
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('config')) {
            db.createObjectStore('config', { keyPath: 'key' });
        }
    };
    request.onsuccess = (event) => resolve(event.target.result);
});

const updateIdbConfig = async (config) => {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('config', 'readwrite');
        const store = transaction.objectStore('config');
        const request = store.put({ key: 'trackerConfig', ...config });
        request.onerror = () => reject('Error saving config to IndexedDB');
        request.onsuccess = () => resolve();
    });
};


const TrackerOutlet = ({ logout }) => {
    const [user] = useAtom(userAtom);
    const [trackerSettings, setTrackerSettings] = useAtom(trackerSettingsAtom);
    const navigate = useNavigate();

    // Fetch tracker settings from your server
    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/tracker/admin/settings/`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
                });
                if (res.ok) {
                    setTrackerSettings(await res.json());
                }
            } catch (e) { console.error("Could not fetch settings."); }
        }
        fetchSettings();
    }, [setTrackerSettings]);

    // This effect now manages the background sync registration
    const manageBackgroundSync = useCallback(async () => {
        // Feature check: Only run in browsers that support Periodic Background Sync
        const registration = await navigator.serviceWorker.ready;
        if (!('periodicSync' in registration)) {
            console.warn('Periodic Background Sync not supported. Tracking will only work while the app is open.');
            return;
        }

        // Determine if tracking should be active
        const isTrackingActive = localStorage.getItem('tracker_is_tracking') === 'true' && user?.is_salesman;

        if (isTrackingActive) {
            // Request permission. The browser might ask the user once.
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state !== 'granted') {
                console.error('Periodic Background Sync permission not granted.');
                return;
            }

            // Register the sync task
            const intervalMinutes = trackerSettings?.location_update_interval_minutes || 5;
            await registration.periodicSync.register('location-sync', {
                minInterval: intervalMinutes * 60 * 1000,
            });
            console.log(`[App] Background location sync registered with a ${intervalMinutes} minute interval.`);

            // Save config to IndexedDB for the service worker
            await updateIdbConfig({
                isTracking: true,
                isSalesman: user.is_salesman,
                accessToken: localStorage.getItem('accessToken'),
                apiUrl: `${import.meta.env.VITE_SERVER_URL}/api/tracker/salesman/update_status/`,
            });
        } else {
            // Unregister the sync task if tracking is off
            await registration.periodicSync.unregister('location-sync');
            console.log('[App] Background location sync unregistered.');

            // Update IndexedDB to reflect the change
            await updateIdbConfig({ isTracking: false });
        }
    }, [user?.is_salesman, trackerSettings?.location_update_interval_minutes]);

    useEffect(() => {
        // Run the logic when user or settings are loaded/changed
        if (user && trackerSettings) {
            manageBackgroundSync();
        }
    }, [user, trackerSettings, manageBackgroundSync]);


    // Effect for routing logic
    useEffect(() => {
        if (user && user?.username !== "") {
            if (!user?.is_salesman) {
                if (!user?.is_superadmin) {
                    logout();
                    console.error("User is not a salesman or superadmin, redirecting to login.");
                }
            }
            if (user?.salesmanType === "admin") {
                navigate("/tracker/admin");
            } else {
                navigate("/tracker/salesman/home");
            }
        }
    }, [user, navigate, logout]);


    return (
         <div className="flex overflow-hidden">
            <Sidebar />
            <div className="flex-1">
                {user?.salesmanType === "admin" && (<Header />)}
                <div className="bg-[#f3f4f6] relative">
                    <div className={"p-5 md:py-10 md:px-12 overflow-y-auto " + (user?.salesmanType === "admin" ? "h-[calc(100vh-4rem)] " : "pt-8 h-screen")}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    )
};

export default TrackerOutlet;