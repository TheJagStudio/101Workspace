import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, MapPin, Battery, Calendar, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '../../Components/utils/Card';
import { apiRequest } from '../../utils/api';

const TrackerDashboard = () => {
    const [salesmen, setSalesmen] = useState([]);
    const [stats, setStats] = useState({ total_salesmen: 0, active_salesmen: 0, offline_salesmen: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const salesmenData = await apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/salesmen/');
                setSalesmen(Array.isArray(salesmenData["results"]) ? salesmenData["results"] : []); // Ensure array

                const statsData = await apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/dashboard_stats/');
                setStats(statsData);
            } catch (err) {
                setError('Failed to fetch dashboard data. Please try again later.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleTrackLive = (salesmanId) => {
        navigate(`/tracker/admin/tracker?salesmanId=${salesmanId}`);
    };

    const getStatusChip = (status) => {
        return status === 'active'
            ? <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">Active</span>
            : <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">Offline</span>;
    };

    const timeSince = (dateString) => {
        if (!dateString) return 'Never';
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    if (loading) return <div>Loading dashboard...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Salesmen Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={<Users size={24} />} title="Total Salesmen" value={stats?.total_salesmen} color="blue" />
                <StatCard icon={<UserCheck size={24} />} title="Active" value={stats?.active_salesmen} color="green" />
                <StatCard icon={<UserX size={24} />} title="Offline" value={stats?.offline_salesmen} color="red" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Salesmen</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 md:table-header-group hidden">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Salesman</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                    <th scope="col" className="px-6 py-3">Last Seen</th>
                                    <th scope="col" className="px-6 py-3">Info</th>
                                    <th scope="col" className="px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(salesmen || []).map(s => (
                                    <tr key={s.id} className="bg-white border md:border-0 md:border-b last:border-b-0 border-gray-300 hover:bg-gray-50 md:table-row grid grid-cols-2 items-center justify-between gap-3 p-2 mb-4 md:mb-0 rounded-lg md:rounded-none shadow md:shadow-none">
                                        <td className="md:px-6 md:py-4 font-medium text-gray-900 whitespace-nowrap md:table-cell block" data-label="Salesman">
                                            <div className="flex items-center space-x-3">
                                                <img className="w-10 h-10 rounded-full" src={`https://api.dicebear.com/9.x/micah/svg?seed=${s.user.first_name}${s.user.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban`} alt={s.user.username} />
                                                <div>
                                                    <div>{s.user.first_name} {s.user.last_name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center"><Phone size={12} className="mr-1" />{s.phone_number}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="md:px-6 md:py-4 md:table-cell block ml-auto md:ml-0" data-label="Status">{getStatusChip(s.status)}</td>
                                        <td className="md:px-6 md:py-4 md:table-cell block" data-label="Last Seen">{timeSince(s.last_seen)}</td>
                                        <td className="md:px-6 md:py-4 text-xs md:table-cell block ml-auto md:ml-0" data-label="Info">
                                            <div className="flex items-center space-x-2">
                                                <span title="Battery" className="flex items-center"><Battery size={14} className="mr-1" />{s.battery}%</span>
                                                <span title="Today's Visits" className="flex items-center"><Calendar size={14} className="mr-1" />{s.today_visits}</span>
                                            </div>
                                        </td>
                                        <td className="md:px-6 md:py-4 md:table-cell block" data-label="Action">
                                            <button onClick={() => handleTrackLive(s.id)} className="flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"><MapPin size={16} className="mr-1" /> Track Live</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default TrackerDashboard;