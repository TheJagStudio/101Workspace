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


    return (
         <div className="flex overflow-hidden">
            <Sidebar />
            <div className="flex-1">
                {user?.permissions?.tracker_Salesmen_List  && (<Header />)}
                <div className="bg-[#f3f4f6] relative">
                    <div className={"p-5 md:py-10 md:px-12 overflow-y-auto " + (user?.permissions?.tracker_Salesmen_List  ? "h-[calc(100vh-4rem)] " : "pt-8 h-screen")}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    )
};

export default TrackerOutlet;