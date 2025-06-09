import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/utils/Card';
import { apiRequest } from '../../utils/api';
import { SlidersHorizontal, Bell, Database, Save } from 'lucide-react';

const TrackerSettings = () => {
    const [settings, setSettings] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/settings/')
            .then(setSettings)
            .catch(err => {
                console.error(err);
                setError('Failed to load settings.');
            });
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : parseInt(value, 10)
        }));
    };

    const handleSave = () => {
        setIsSaving(true);
        setError('');
        setSuccess('');
        apiRequest(import.meta.env.VITE_SERVER_URL + '/api/tracker/admin/settings/', {
            method: 'PUT',
            body: JSON.stringify(settings),
        })
        .then(updatedSettings => {
            setSettings(updatedSettings);
            setSuccess("Settings saved successfully!");
            setTimeout(() => setSuccess(''), 3000);
        })
        .catch(err => {
            console.error(err);
            setError("Failed to save settings.");
        })
        .finally(() => {
            setIsSaving(false);
        });
    };

    const SettingInput = ({ label, name, value, helpText, unit }) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="mt-1 relative rounded-md shadow-inner">
                <input type="number" name={name} id={name} value={value || 0} onChange={handleInputChange} className="focus:ring-orange-500 py-2 pl-4 border focus:border-orange-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md focus:outline-0" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">{unit}</span>
                </div>
            </div>
            {helpText && <p className="mt-2 text-xs text-gray-500">{helpText}</p>}
        </div>
    );

    const SettingToggle = ({ label, name, checked }) => (
        <div className="flex items-center justify-between">
            <span className="flex-grow flex flex-col"><span className="text-sm font-medium text-gray-900">{label}</span></span>
            <label htmlFor={name} className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id={name} name={name} checked={checked || false} onChange={handleInputChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full transition-all peer peer-focus:ring-4 peer-focus:ring-orange-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5  peer-checked:bg-orange-600"></div>
            </label>
        </div>
    );

    if (!settings) return <div>Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Admin Settings</h1>
            {error && <div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div>}
            {success && <div className="p-4 bg-green-100 text-green-700 rounded-md">{success}</div>}

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Tracking Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <SettingInput label="Location Update Interval" name="location_update_interval_minutes" value={settings.location_update_interval_minutes} helpText="Interval in minutes for location updates." unit="min" />
                    <SettingInput label="Checkpoint Threshold" name="checkpoint_threshold_minutes" value={settings.checkpoint_threshold_minutes} helpText="Time a salesman must stay to be a checkpoint." unit="min" />
                    <SettingInput label="Proximity Range" name="proximity_range_meters" value={settings.proximity_range_meters} helpText="Proximity range for location-based events." unit="m" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Bell /> Notifications</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <SettingToggle label="Salesman goes offline" name="notify_salesman_offline" checked={settings.notify_salesman_offline} />
                    <SettingToggle label="Low battery alerts" name="notify_low_battery_alerts" checked={settings.notify_low_battery_alerts} />
                    <SettingToggle label="Unusual route patterns" name="notify_unusual_route_patterns" checked={settings.notify_unusual_route_patterns} />
                    <SettingToggle label="Daily summary reports" name="notify_daily_summary_reports" checked={settings.notify_daily_summary_reports} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Database /> Data Management</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">Export Location Data (CSV)</button>
                    <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50 text-red-600">Clear Records Older Than 90 Days</button>
                    <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50 text-red-800">Reset All Settings to Default</button>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-orange-300">
                    <Save size={18} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}

export default TrackerSettings;