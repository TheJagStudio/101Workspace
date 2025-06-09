import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Battery, Wifi, WifiOff, Play, Square, Route, CheckCircle, Clock } from 'lucide-react';
import GoogleMapWrapper from '../../Components/map/GoogleMapWrapper';
import { apiRequest } from '../../utils/api';
import { userAtom } from '../../Variables';
import { useAtom } from 'jotai';

const SalesmanHome = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [battery, setBattery] = useState(100);
    const [signal, setSignal] = useState(navigator.onLine);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [salesmanLocation, setSalesmanLocation] = useState({ lat: 33.7879, lng: -84.2253 });
    const [todaysActivity, setTodaysActivity] = useState(null);
    const [todaysPlannedRoute, setTodaysPlannedRoute] = useState(null);
    const trackingIntervalRef = useRef(null);
    const [alerts, setAlerts] = useState([]);
    const [routeHistory, setRouteHistory] = useState([]);
    const [user] = useAtom(userAtom);

    const sendPing = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setSalesmanLocation({ lat: latitude, lng: longitude });

                const payload = { latitude, longitude, battery };
                apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/update_status/', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).then(() => {
                    console.log("PING: Location updated successfully.");
                    // Refresh today's activity after a successful ping
                    apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/activity/today/').then(setTodaysActivity);
                }).catch(err => console.error("PING failed:", err));
            },
            (error) => console.error("Geolocation error:", error),
            { enableHighAccuracy: true }
        );
    };

    // Initial fetch for current status and location
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setSalesmanLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => console.warn("Could not get initial location.")
        );

        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/activity/today/')
            .then((response) => {
                setTodaysActivity(response);
                setIsTracking(response?.is_tracking || false);
            })
            .catch(err => console.error("Could not fetch today's activity", err));

        // Listen to online/offline events
        const updateOnlineStatus = () => setSignal(navigator.onLine);
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // bring routeHistory from local storage
        const storedRouteHistory = localStorage.getItem('routeHistory');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (storedRouteHistory) {
            const parsedHistory = JSON.parse(storedRouteHistory);
            const filteredHistory = parsedHistory.filter(entry => new Date(entry.addedAt) > yesterday);
            setRouteHistory(filteredHistory);
            localStorage.setItem('routeHistory', JSON.stringify(filteredHistory));
        }

        // Fetch today's planned route
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/planned_routes/today/')
            .then(response => {
                setTodaysPlannedRoute(response);
            })
            .catch(err => {
                // Only log errors for 404s since it's expected when there's no route for today
                if (err.status !== 404) {
                    console.error("Failed to fetch today's planned route:", err);
                }
            });

        // No more tracking interval logic here; handled globally in TrackerOutlet

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);



    const handleToggleTracking = async () => {
        const newTrackingStatus = !isTracking;
        try {
            await apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/set_tracking_status/', {
                method: 'POST',
                body: JSON.stringify({ status: newTrackingStatus ? 'active' : 'offline' })
            });
            setIsTracking(newTrackingStatus);

            if (newTrackingStatus) {
                sendPing(); // Send initial ping immediately
                trackingIntervalRef.current = setInterval(sendPing, 180000); // 3 minutes
            } else {
                if (trackingIntervalRef.current) {
                    clearInterval(trackingIntervalRef.current);
                    trackingIntervalRef.current = null;
                }
            }
        } catch (error) {
            console.error("Failed to toggle tracking status:", error);
            alert("Could not update tracking status. Please check your connection.");
        }
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/tracker/salesman/places_search/?query=${encodeURIComponent(searchQuery)}`)
            .then(data => {
                if (data.status === 'OK') {
                    setSearchResults(data?.results?.map(place => ({
                        id: place?.place_id,
                        name: place?.name,
                        address: place?.formatted_address,
                        lat: place?.geometry.location.lat,
                        lng: place?.geometry.location.lng,
                    })));
                } else {
                    setSearchResults([]);
                }
            })
            .catch(err => {
                console.error(err);
                setAlerts(prev => [...prev, { type: 'error', message: 'Failed to search places.' }]);
                setSearchResults([]);
            });
    };

    const handleAddToRoute = (place, isBulk = false) => {
        const payload = {
            location_name: place?.name,
            address: place?.address,
            latitude: place?.lat,
            longitude: place?.lng,
        }; apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/planned_routes/add_stop/', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
            .then(() => {
                if (!isBulk) {
                    setAlerts(prev => [...prev, { type: 'success', message: `Added "${place?.name}" to your route!` }]);
                }
                // Refresh planned route after successful addition
                return apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/planned_routes/today/');
            })
            .then(response => {
                setTodaysPlannedRoute(response);
            })
            .catch(err => {
                console.error(err);
                setAlerts(prev => [...prev, { type: 'error', message: `Failed to add "${place?.name}" to route.` }]);
            });
        setRouteHistory(prev => [...prev, place?.id]); // Update route history immediately
        // add in local storage for persistence
        const newHistory = [...routeHistory, { id: place?.id, addedAt: new Date().toISOString() }];
        setRouteHistory(newHistory);
        localStorage.setItem('routeHistory', JSON.stringify(newHistory));
    };

    useEffect(() => {
        // get length of alerts and remove after 5 seconds
        if (alerts.length > 0) {
            const timeoutId = setTimeout(() => {
                setAlerts(prev => prev.slice(1)); // Remove the first alert after 5 seconds
            }, 2000);
            return () => clearTimeout(timeoutId);
        }
    }, [alerts]);

    return (
        <div className="flex flex-col h-full rounded-2xl">
            <div className="w-full mb-3 bg-white p-2 rounded-lg shadow-lg flex items-center border border-gray-300">
                <input type="text" placeholder="e.g., gas station near stone mountain" className="w-full bg-transparent focus:outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} className="p-2 bg-orange-500 text-white rounded-md">
                    <Search size={20} />
                </button>
            </div>
            <div className="relative h-2/3 mb-4 rounded-2xl overflow-hidden bg-gray-100 shadow-lg border border-gray-300">
                <GoogleMapWrapper
                    center={salesmanLocation}
                    zoom={14}
                    liveRoute={todaysActivity?.["route_coordinates_json"]}
                    todayRoute={todaysPlannedRoute?.stops?.map(stop => ({
                        id: stop.id,
                        lat: stop.latitude,
                        lng: stop.longitude,
                        title: stop.location_name
                    }))}
                />

                {searchResults.length > 0 && (
                    <div className="absolute top-1 left-1 right-1 border border-gray-300 bg-white rounded-xl shadow-xl shadow-black/25 overflow-hidden z-10">
                        <ul className="space-y-2 overflow-y-auto max-h-64 px-2">
                            {searchResults.map(place => (
                                <li key={place?.id} className="p-2 border-b border-gray-300 last:border-0 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{place?.name}</p>
                                        <p className="text-xs text-gray-500">{place?.address}</p>
                                    </div>
                                    {!routeHistory.includes(place?.id) &&
                                        (<button onClick={() => handleAddToRoute(place, false)} className="text-sm text-orange-600 font-bold">Add</button>)}
                                </li>
                            ))}
                        </ul>
                        {/* add a button to clear search results */}
                        <div className=" flex justify-between bg-gray-200 p-2">
                            <button onClick={() => {
                                searchResults.forEach(place => handleAddToRoute(place, true));
                                setSearchResults([]);
                                setAlerts(prev => [...prev, { type: 'success', message: 'Added all search results to your route!' }]);
                            }} className="text-gray-700 font-semibold bg-white py-0.5 px-2 rounded border border-gray-300">Add All</button>
                            <button onClick={() => setSearchResults([])} className="text-gray-700 font-semibold bg-white py-0.5 px-2 rounded border border-gray-300">Clear</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 p-4 space-y-4 bg-white rounded-2xl">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="flex flex-col items-center">
                        <span className={`font-bold text-lg ${isTracking ? 'text-green-600' : 'text-red-600'}`}>{isTracking ? "Active" : "Inactive"}</span>
                        <span className="text-xs text-gray-500">Tracking Status</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg text-gray-800 flex items-center">
                            <Battery className={`mr-1 ${battery < 20 ? 'text-red-500' : 'text-green-500'}`} size={20} /> {battery}%</span>
                        <span className="text-xs text-gray-500">Battery</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg text-gray-800">{signal ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />}</span>
                        <span className="text-xs text-gray-500">Signal</span>
                    </div>
                </div>

                <button onClick={handleToggleTracking} className={`w-full py-4 rounded-lg text-white font-bold text-lg flex items-center justify-center transition-colors ${isTracking ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                    {isTracking ? <Square size={24} className="mr-2" /> : <Play size={24} className="mr-2" />} {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                </button>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-2">Today's Activity</h3>
                    {todaysActivity ? (
                        <div className="flex justify-around text-sm">
                            <div className="flex items-center">
                                <CheckCircle size={16} className="text-blue-500 mr-2" />
                                <div>
                                    <p className="font-semibold">{todaysActivity?.checkpoints}</p>
                                    <p className="text-xs text-gray-500">Checkpoints</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Route size={16} className="text-purple-500 mr-2" />
                                <div>
                                    <p className="font-semibold">{todaysActivity?.distance?.toFixed(1)} km</p>
                                    <p className="text-xs text-gray-500">Distance</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Clock size={16} className="text-green-500 mr-2" />
                                <div>
                                    <p className="font-semibold">{todaysActivity?.duration || '0m'}</p>
                                    <p className="text-xs text-gray-500">Duration</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No activity recorded yet today.</p>
                    )}
                </div>
            </div>

            <div className='absolute bottom-0 left-0 right-0 p-4 shadow-lg'>
                {/* list of alerts */}
                {alerts?.map((alert, index) => {
                    let bg = '';
                    let text = '';
                    if (alert.type === 'success') {
                        bg = 'bg-green-100';
                        text = 'text-green-800';
                    } else if (alert.type === 'error') {
                        bg = 'bg-red-100';
                        text = 'text-red-800';
                    } else if (alert.type === 'warning') {
                        bg = 'bg-yellow-100';
                        text = 'text-yellow-800';
                    } else {
                        bg = 'bg-gray-100';
                        text = 'text-gray-800';
                    }


                    return (
                        <div key={index} className={`p-2 mb-2 rounded-lg ${bg} ${text}`}>
                            <div className="flex items-center">
                                {alert.type === 'warning' ? <Square size={16} className="mr-2" /> : alert.type === 'success' ? <CheckCircle size={16} className="mr-2" /> : <MapPin size={16} className="mr-2" />}
                                <span>{alert.message}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default SalesmanHome;