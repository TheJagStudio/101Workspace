import React, { useState, useEffect, useMemo, use } from 'react';
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
    const [totalDistance, setTotalDistance] = useState(0);
    const [duration, setDuration] = useState(0);
    const [checkpoints, setCheckpoints] = useState([]);
    const [reportDate, setReportDate] = useState(new Date());

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
                // console.log("Fetched salesmen data:", salesmenData?.["results"]);
                setSalesmen(salesmenData?.["results"] || []);
                // for (let i = 0; i < salesmenData?.["results"]?.length; i++) {
                //     try {
                //         let salesman = salesmenData["results"][i];
                //         let salesmanId = salesman.user.id;
                //         let { data: locationData, error } = await supabase2
                //             .from('salesman')
                //             .select("*")
                //             .eq('user_id', salesmanId)
                //             .limit(1);
                //         if (error) {
                //             console.error("Failed to fetch location data:", error);
                //         } else {
                //             salesman.current_location_lat = locationData[0].latitude;
                //             salesman.current_location_lng = locationData[0].longitude;
                //         }
                //     } catch (error) {
                //         console.error("Failed to fetch location data:", error);
                //     }
                // }

                // setLiveFeed(notificationsData?.["results"] || []);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const channels = supabase2.channel('custom-update-channel')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'salesman' },
                (payload) => {
                    // console.log('Change received!', payload?.new)
                    let newData = payload?.new;
                    // setSalesmen(prevSalesmen => {
                    //     const index = prevSalesmen.findIndex(s => s.user.id === newData.user_id);
                    //     if (index !== -1) {
                    //         const updatedSalesmen = [...prevSalesmen];
                    //         updatedSalesmen[index] = {
                    //             ...updatedSalesmen[index],
                    //             current_location_lat: newData.current_location_lat,
                    //             current_location_lng: newData.current_location_lng,
                    //             // add more fields if needed
                    //         };
                    //         return updatedSalesmen;
                    //     }
                    //     // Ensure newData matches the expected structure
                    //     return [
                    //         ...prevSalesmen,
                    //         {
                    //             ...newData,
                    //             user: { id: newData.user_id, username: newData.username || '' },
                    //         }
                    //     ];
                    // });
                    // setLiveFeed(prevFeed => {
                    //     return [...prevFeed, {
                    //         lat: newData.current_location_lat,
                    //         lng: newData.current_location_lng
                    //     }];
                    // });
                }
            )
            .subscribe();
        return () => {
            supabase2.removeChannel(channels);
        };
    }, []);
    useEffect(() => {
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; // metres
            const φ1 = lat1 * Math.PI / 180; // φ in radians
            const φ2 = lat2 * Math.PI / 180; // φ in radians
            const Δφ = (lat2 - lat1) * Math.PI / 180; // Δφ in radians
            const Δλ = (lon2 - lon1) * Math.PI / 180; // Δλ in radians

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c; // in metres
        }

        const KNNCluster = (points, k) => {
            if (points.length === 0) return [];
            if (k <= 0) return points;
            if (k >= points.length) return points;

            // KNN clustering logic here
            const clusters = [];
            const clusterCenters = [];
            const visited = new Set();
            for (let i = 0; i < points.length; i++) {
                if (visited.has(i)) continue;
                const cluster = [points[i]];
                visited.add(i);
                for (let j = i + 1; j < points.length; j++) {
                    if (visited.has(j)) continue;
                    const distance = calculateDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
                    if (distance < k) {
                        cluster.push(points[j]);
                        visited.add(j);
                    }
                }
                clusters.push(cluster);
            }
            // Calculate cluster centers
            for (const cluster of clusters) {
                const latSum = cluster.reduce((sum, point) => sum + point.lat, 0);
                const lngSum = cluster.reduce((sum, point) => sum + point.lng, 0);
                clusterCenters.push({
                    lat: latSum / cluster.length,
                    lng: lngSum / cluster.length
                });
            }
            return clusterCenters;
        }

        const findCheckPoints = (points, k, radius) => {
            if (!points || points.length === 0 || k < 0 || radius <= 0) {
                return [];
            }

            const checkPoints = [];

            for (let i = 0; i < points.length; i++) {
                let neighborCount = 0;
                for (let j = 0; j < points.length; j++) {
                    // Don't compare a point to itself
                    if (i === j) continue;

                    const distance = calculateDistance(
                        points[i].lat,
                        points[i].lng,
                        points[j].lat,
                        points[j].lng
                    );

                    if (distance <= radius) {
                        neighborCount++;
                    }
                }

                // If the point has at least 'k' neighbors, it's a check point.
                if (neighborCount >= k) {
                    checkPoints.push(points[i]);
                }
            }
            let clusteredPoints = KNNCluster(checkPoints, 50); // Adjust k as needed
            // merge close points
            clusteredPoints = clusteredPoints.reduce((acc, point) => {
                const existing = acc.find(p => calculateDistance(p.lat, p.lng, point.lat, point.lng) < 200);
                if (existing) {
                    existing.lat = (existing.lat + point.lat) / 2;
                    existing.lng = (existing.lng + point.lng) / 2;
                } else {
                    acc.push(point);
                }
                return acc;
            }, []);
            return clusteredPoints;
        };


        const fetchLiveFeed = async () => {
            let { data: tracker_locationpoint, error } = await supabase2
                .from('tracker_locationpoint')
                .select("*")
                .gte('timestamp', reportDate.toISOString().split('T')[0] + 'T00:00:00')
                .lte('timestamp', reportDate.toISOString().split('T')[0] + 'T23:59:59')
                .order('timestamp', { ascending: false })
                .eq('salesman_id', selectedSalesmanId ? selectedSalesmanId : searchParams.get('salesmanId'));

            let filteredFeed = [];
            for (const point of (tracker_locationpoint || [])) {
                const lat = Number(point.latitude || point.lat);
                const lng = Number(point.longitude || point.lng);
                filteredFeed.push({ lat, lng });
            }
            setLiveFeed(filteredFeed);

            const firstLocation = filteredFeed[0];
            const lastLocation = filteredFeed[filteredFeed.length - 1];
            const startTime = new Date(firstLocation?.timestamp || 0);
            const endTime = new Date(lastLocation?.timestamp || 0);
            setDuration(((endTime - startTime) / 1000 / 3600).toFixed(1)); // Duration in hours

            const totalDistance = filteredFeed.reduce((acc, point, index, arr) => {
                if (index === 0) return acc; // Skip the first point
                const prevPoint = arr[index - 1];
                return acc + calculateDistance(prevPoint.lat, prevPoint.lng, point.lat, point.lng);
            }, 0);
            setTotalDistance((totalDistance / 1609.34).toFixed(2));

            const clusteredPoints = findCheckPoints(filteredFeed, 10, 20); // Adjust k as needed
            setCheckpoints(clusteredPoints);
        }

        fetchLiveFeed()
    }, [selectedSalesmanId, searchParams, reportDate]);

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
                    title: s.user.first_name + ' ' + s.user.last_name,
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
                    <div>
                        <select
                            value={selectedSalesmanId || ''}
                            onChange={handleSelectSalesman}
                            className="p-2 border border-gray-300 rounded-md bg-white w-48"
                        >
                            <option value="">All Salesmen</option>
                            {salesmen.map(s => <option key={s.id} value={s.id}>{s.user.first_name} {s.user.last_name}</option>)}
                        </select>
                        <input
                            type="date"
                            value={reportDate.toISOString().split('T')[0]}
                            onChange={(e) => setReportDate(new Date(e.target.value))}
                            className="ml-4 p-2 border border-gray-300 rounded-md bg-white"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<CheckCircle size={24} />} title="Total Checkpoints" value={checkpoints.length} color="green" />
                    <StatCard icon={<Route size={24} />} title="Total Distance (miles)" value={totalDistance} color="blue" />
                    <StatCard icon={<Clock size={24} />} title="Total Duration (hours)" value={duration} color="gray" />
                </div>

                <Card className="flex-grow">
                    <CardContent className="h-full min-h-96 p-0">
                        <GoogleMapWrapper
                            center={mapCenter}
                            zoom={selectedSalesmanId ? 12 : 10}
                            markers={markers}
                            // polylines={polylines}
                            liveRoute={liveFeed}
                            checkpoints={checkpoints}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* <div className="lg:w-80 xl:w-96 flex-shrink-0">
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
            </div> */}
        </div>
    );
}

export default TrackerMap;