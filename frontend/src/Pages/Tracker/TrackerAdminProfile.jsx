import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '../../Variables';
import { apiRequest } from '../../utils/api';
import { User, Shield, BarChart2, Users, Database, FileText, Activity, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/utils/Card';

const TrackerAdminProfile = () => {
    const [adminUser] = useAtom(userAtom);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/dashboard_stats/')
            .then(setStats)
            .catch(err => console.error("Failed to fetch dashboard stats", err));
    }, []);

    const adminActions = [
        { text: "Manage Salesmen", icon: <Users size={18} />, action: () => {} },
        { text: "System Backup", icon: <Database size={18} />, action: () => {} },
        { text: "Generate Reports", icon: <FileText size={18} />, action: () => {} },
        { text: "View System Logs", icon: <Activity size={18} />, action: () => {} },
        { text: "Database Status", icon: <Server size={18} />, action: () => {} },
    ];
    
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Admin Profile & System</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><User /> Profile Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <img className="w-20 h-20 rounded-full bg-orange-100" src={`https://api.dicebear.com/9.x/micah/svg?seed=${adminUser?.first_name}${adminUser?.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban`} alt={adminUser?.username} />
                            <div>
                                <h4 className="text-xl font-bold text-gray-900">{adminUser?.first_name} {adminUser?.last_name}</h4>
                                <p className="text-gray-500">{adminUser?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center text-sm">
                            <Shield size={16} className="text-gray-400 mr-2"/>
                            <span className="font-medium text-gray-700">Role:</span>
                            <span className="ml-2 text-gray-900 capitalize font-bold">{adminUser?.salesmanType}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 /> System Overview</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">Active Salesmen</span>
                            <span className="text-lg font-bold text-green-600">{stats ? `${stats.active_salesmen} / ${stats.total_salesmen}` : '...'}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">Data Points Today</span>
                            <span className="text-lg font-bold text-blue-600">{stats ? stats.location_points_today.toLocaleString() : '...'}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">Server Health</span>
                            <span className="px-3 py-1 text-sm font-semibold text-green-800 bg-green-100 rounded-full">Optimal</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Admin Actions</CardTitle></CardHeader>
                <CardContent>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {adminActions.map((action, index) => (
                            <li key={index}>
                                <button onClick={action.action} className="w-full flex items-center p-4 border border-gray-300 rounded-lg text-left hover:bg-gray-50 hover:border-orange-500 transition-all duration-200">
                                    <span className="text-orange-500 mr-3">{action.icon}</span>
                                    <span className="font-medium text-gray-700">{action.text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

export default TrackerAdminProfile;