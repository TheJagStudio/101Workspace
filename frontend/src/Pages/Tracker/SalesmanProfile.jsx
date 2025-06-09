import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '../../Variables';
import { apiRequest } from '../../utils/api';
import { Briefcase, Phone, Mail, BarChart, CheckSquare, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/utils/Card';

const SalesmanProfile = () => {
    const [salesmanUser] = useAtom(userAtom);
    const [stats, setStats] = useState(null);

    // This assumes the userAtom contains the phone_number from the Salesman model,
    // which might require adjusting the /api/auth/me/ response.
    const salesman = {
        name: salesmanUser.username,
        role: 'Field Salesman',
        phone: salesmanUser.phone_number || 'N/A',
        email: salesmanUser.email
    };

    useEffect(() => {
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/salesman/stats/monthly/')
            .then(setStats)
            .catch(err => console.error("Failed to fetch monthly stats", err));
    }, []);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Profile</h1>

            <Card>
                <CardContent className="flex items-center space-x-4 pt-6">
                    <img className="w-20 h-20 rounded-full" src={`https://api.dicebear.com/9.x/micah/svg?seed=${salesman.name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban`} alt={salesman.name} />
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold">{salesman.name}</h2>
                        <div className="flex items-center text-sm text-gray-500"><Briefcase size={14} className="mr-2" />{salesman.role}</div>
                        <div className="flex items-center text-sm text-gray-500"><Phone size={14} className="mr-2" />{salesman.phone}</div>
                        <div className="flex items-center text-sm text-gray-500"><Mail size={14} className="mr-2" />{salesman.email}</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart /> This Month's Stats</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <CheckSquare className="mx-auto text-green-500" size={28} />
                        <p className="text-2xl font-bold mt-1">{stats ? stats.total_visits : '...'}</p>
                        <p className="text-sm text-gray-500">Total Visits</p>
                    </div>
                    <div>
                        <Calendar className="mx-auto text-blue-500" size={28} />
                        <p className="text-2xl font-bold mt-1">{stats ? stats.active_days : '...'}</p>
                        <p className="text-sm text-gray-500">Active Days</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default SalesmanProfile;