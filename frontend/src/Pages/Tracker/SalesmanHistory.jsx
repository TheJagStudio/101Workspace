import React, { useState, useEffect, useMemo } from 'react';
import { History, Calendar, Clock, Route, CheckCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../Components/utils/Card';
import { apiRequest } from '../../utils/api';

const SalesmanHistory = () => {
    const [allActivities, setAllActivities] = useState([]);
    const [filter, setFilter] = useState('This Week');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const filters = ['Today', 'This Week', 'This Month', 'All Time'];

    useEffect(() => {
        setLoading(true);
        setError(null);
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/activity_history/')
            .then(data => {
                setAllActivities(data);
            })
            .catch(err => {
                setError('Failed to load history.');
                console.error(err);
            })
            .finally(() => setLoading(false));
    }, []);

    const filteredActivities = useMemo(() => {
        if (!allActivities.length) return [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return allActivities.filter(activity => {
            const activityDate = new Date(activity.date);
            if (filter === 'Today') {
                return activityDate.toDateString() === today.toDateString();
            }
            if (filter === 'This Week') {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                return activityDate >= weekStart;
            }
            if (filter === 'This Month') {
                return activityDate.getFullYear() === now.getFullYear() && activityDate.getMonth() === now.getMonth();
            }
            return true; // All Time
        });
    }, [allActivities, filter]);

    if (loading) return <div>Loading history...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Activity History</h1>
                <div>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-2 sm:mt-0 w-full sm:w-auto p-2 border border-gray-200 rounded-md bg-white">
                        {filters.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            </div>
            
            <ul className="space-y-4">
                {filteredActivities.length > 0 ? (
                    filteredActivities.map(activity => (
                        <li key={activity.id}>
                           <Card className="hover:shadow-md transition-shadow">
                                <CardContent>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Calendar size={16} className="text-gray-500"/>
                                                <h3 className="font-bold text-lg text-gray-800">{new Date(activity.date).toDateString()}</h3>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                                <div className="flex items-center"><Clock size={14} className="mr-1 text-gray-400"/> {activity.start_time?.substring(0,5) || 'N/A'} - {activity.end_time?.substring(0,5) || 'N/A'}</div>
                                                <div className="flex items-center"><CheckCircle size={14} className="mr-1 text-gray-400"/> {activity.checkpoints} Visits</div>
                                                <div className="flex items-center"><History size={14} className="mr-1 text-gray-400"/> {activity.duration || '0m'}</div>
                                                <div className="flex items-center"><Route size={14} className="mr-1 text-gray-400"/> {activity.distance.toFixed(1)} km</div>
                                            </div>
                                        </div>
                                        <button className="hidden sm:block p-2 rounded-full hover:bg-gray-100"><ChevronRight className="text-gray-500"/></button>
                                    </div>
                                </CardContent>
                            </Card>
                        </li>
                    ))
                ) : (
                    <p className="text-gray-500">No activities found for the selected period.</p>
                )}
            </ul>
        </div>
    );
}

export default SalesmanHistory;