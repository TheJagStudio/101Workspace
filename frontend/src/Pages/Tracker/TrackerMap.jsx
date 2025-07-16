import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Map, MapPin, CheckCircle, AlertTriangle, RadioTower, Route, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '../../Components/utils/Card';
import GoogleMapWrapper from '../../Components/map/GoogleMapWrapper';
import { apiRequest } from '../../utils/api';
import { createClient } from '@supabase/supabase-js';

const supabase2 = createClient(
    import.meta.env.VITE_SUPABASE_URL_SECOND,
    import.meta.env.VITE_SUPABASE_ANON_KEY_SECOND
);



const TrackerMap = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSalesmanId, setSelectedSalesmanId] = useState(null);
    const [salesmen, setSalesmen] = useState([]);
    const [liveFeed, setLiveFeed] = useState([]);
    const [routeHistory, setRouteHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const salesmanId = searchParams.get('salesmanId');
        if (salesmanId) {
            setSelectedSalesmanId(parseInt(salesmanId));
        }
    }, [searchParams]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [salesmenData, notificationsData] = await Promise.all([
                    apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/salesmen/'),
                    apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/notifications/')
                ]);
                setSalesmen(salesmenData?.["results"] || []);
                // setLiveFeed(notificationsData?.["results"] || []);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchLiveFeed = async () => {
            let { data: tracker_locationpoint, error } = await supabase2
                .from('tracker_locationpoint')
                .select("*")
                .eq('salesman_id', selectedSalesmanId ? selectedSalesmanId : searchParams.get('salesmanId'));
            let feedArray = [];
            for (let i = 0; i < (tracker_locationpoint?.length || 0); i++) {
                const lat = Number(tracker_locationpoint[i].latitude);
                const lng = Number(tracker_locationpoint[i].longitude);
                if (isFinite(lat) && isFinite(lng)) {
                    feedArray.push({ lat, lng });
                }
            }
            setLiveFeed(feedArray);
            console.log("Live feed fetched:", feedArray);
        }

        fetchData();
        fetchLiveFeed();


        const channels = supabase2.channel('custom-update-channel')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'salesman' },
                (payload) => {
                    // console.log('Change received!', payload?.new)
                    let newData = payload?.new;
                    setSalesmen(prevSalesmen => {
                        const index = prevSalesmen.findIndex(s => s.user.id === newData.user_id);
                        if (index !== -1) {
                            const updatedSalesmen = [...prevSalesmen];
                            updatedSalesmen[index] = {
                                ...updatedSalesmen[index],
                                current_location_lat: newData.current_location_lat,
                                current_location_lng: newData.current_location_lng,
                                // add more fields if needed
                            };
                            return updatedSalesmen;
                        }
                        // Ensure newData matches the expected structure
                        return [
                            ...prevSalesmen,
                            {
                                ...newData,
                                user: { id: newData.user_id, username: newData.username || '' },
                            }
                        ];
                    });
                    setLiveFeed(prevFeed => {
                        return [...prevFeed, {
                            lat: newData.current_location_lat,
                            lng: newData.current_location_lng
                        }];
                    });
                }
            )
            .subscribe();
        return () => {
            supabase2.removeChannel(channels);
        };
    }, []);

    useEffect(() => {
        if (!selectedSalesmanId) {
            setRouteHistory([]);
            return;
        }

        const fetchRouteHistory = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const routeData = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/tracker/admin/salesmen/${selectedSalesmanId}/route_history/?date=${today}`);
                setRouteHistory(Array.isArray(routeData?.["results"]) ? routeData?.["results"] : []);
            } catch (error) {
                console.error("Failed to fetch route history:", error);
                setRouteHistory([]);
            }
        };

        fetchRouteHistory();
    }, [selectedSalesmanId]);

    const handleSelectSalesman = (e) => {
        const id = e.target.value ? parseInt(e.target.value) : null;
        setSelectedSalesmanId(id);
        if (id) {
            setSearchParams({ salesmanId: id });
        } else {
            setSearchParams({});
        }
    };

    const markers = useMemo(() => {
        if (salesmen) {
            const salesmenToDisplay = selectedSalesmanId
                ? salesmen?.filter(s => s?.id === selectedSalesmanId)
                : salesmen;

            return salesmenToDisplay
                ?.filter(s => s?.current_location_lat && s?.current_location_lng)
                ?.map(s => ({
                    id: s.id,
                    lat: s.current_location_lat,
                    lng: s.current_location_lng,
                    title: s.user.username,
                    icon: {
                        url: s.status === 'active' ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    }
                }));
        }
    }, [salesmen, selectedSalesmanId]);


    const mapCenter = useMemo(() => {
        if (selectedSalesmanId) {
            const salesman = salesmen?.find(s => s.id === selectedSalesmanId);
            if (salesman && salesman.current_location_lat) {
                return { lat: salesman.current_location_lat, lng: salesman.current_location_lng };
            }
        }
        return null
    }, [salesmen, selectedSalesmanId]);

    const FeedIcon = ({ type }) => {
        switch (type) {
            case 'checkpoint': return <CheckCircle className="text-green-500" size={18} />;
            case 'offline': case 'low_battery': return <AlertTriangle className="text-yellow-500" size={18} />;
            case 'online': return <RadioTower className="text-blue-500" size={18} />;
            default: return <MapPin className="text-gray-500" size={18} />;
        }
    };

    if (loading) return <div>Loading Tracker...</div>;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
            <div className="flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">Global Tracker</h1>
                    <select
                        value={selectedSalesmanId || ''}
                        onChange={handleSelectSalesman}
                        className="p-2 border border-gray-300 rounded-md bg-white w-48"
                    >
                        <option value="">All Salesmen</option>
                        {salesmen.map(s => <option key={s.id} value={s.id}>{s.user.first_name} {s.user.last_name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<CheckCircle size={24} />} title="Total Checkpoints" value="N/A" color="green" />
                    <StatCard icon={<Route size={24} />} title="Total Distance (km)" value="N/A" color="blue" />
                    <StatCard icon={<Clock size={24} />} title="Avg. Duration" value="N/A" color="gray" />
                </div>

                <Card className="flex-grow">
                    <CardContent className="h-full p-0">
                        <GoogleMapWrapper
                            center={ mapCenter}
                            zoom={selectedSalesmanId ? 16 : 10}
                            markers={markers}
                            // polylines={polylines}
                            liveRoute={liveFeed}
                        />
                    </CardContent>
                </Card>
            </div>

            <div className="lg:w-80 xl:w-96 flex-shrink-0">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Map size={20} /> Live Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-y-auto">
                        <ul className="space-y-4">
                            {liveFeed?.map(item => (
                                <li key={item?.id} className="flex items-start space-x-3">
                                    <div><FeedIcon type={item?.event_type} /></div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{item?.salesman?.user?.username || 'System'}</p>
                                        <p className="text-sm text-gray-600">{item?.message}</p>
                                        <p className="text-xs text-gray-400">{new Date(item?.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </li>
                            ))}
                            {liveFeed?.length === 0 && <p className="text-sm text-gray-500">No recent activity.</p>}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default TrackerMap;