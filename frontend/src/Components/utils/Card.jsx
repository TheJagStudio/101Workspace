import React from 'react';

export const Card = ({ children, className = '' }) => (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
        {children}
    </div>
);

export const CardHeader = ({ children, className = '' }) => (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
        {children}
    </div>
);

export const CardTitle = ({ children, className = '' }) => (
    <h3 className={`text-lg font-semibold text-gray-800 ${className}`}>
        {children}
    </h3>
);

export const CardContent = ({ children, className = '' }) => (
    <div className={`p-6 ${className}`}>
        {children}
    </div>
);

export const StatCard = ({ icon, title, value, color = 'gray' }) => {
    const colors = {
        green: { bg: 'bg-green-100', text: 'text-green-600' },
        blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
        red: { bg: 'bg-red-100', text: 'text-red-600' },
        gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
    };

    const colorClasses = colors[color] || colors.gray;

    return (
        <Card>
            <CardContent className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${colorClasses.bg}`}>
                    <div className={colorClasses.text}>{icon}</div>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
};