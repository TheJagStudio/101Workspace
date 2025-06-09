import React, { useState } from 'react';
import { Bell, Lock, User, Truck, Building } from 'lucide-react';

const ProfileTab = ({ user }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-800">Profile Information</h2>
      <p className="text-gray-500">Update your account profile information</p>
    </div>
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500"
            defaultValue={user?.name}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500"
            defaultValue={user?.email}
            placeholder="your.email@example.com"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <input
          className="block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
          defaultValue={user?.role}
          disabled
        />
      </div>
      <div className="flex justify-end">
        <button
          className="inline-flex items-center px-5 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
);

const NotificationsTab = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-800">Notification Preferences</h2>
      <p className="text-gray-500">Choose how you want to receive notifications</p>
    </div>
    <div className="space-y-4">
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="email_notifications"
            type="checkbox"
            className="h-4 w-4 text-green-600 border-gray-300 rounded"
          />
        </div>
        <div className="ml-3">
          <label htmlFor="email_notifications" className="font-medium text-gray-700">
            Email Notifications
          </label>
          <p className="text-gray-500">Receive notifications about new deliveries and payments via email</p>
        </div>
      </div>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="push_notifications"
            type="checkbox"
            className="h-4 w-4 text-green-600 border-gray-300 rounded"
          />
        </div>
        <div className="ml-3">
          <label htmlFor="push_notifications" className="font-medium text-gray-700">
            Push Notifications
          </label>
          <p className="text-gray-500">Receive push notifications on your device</p>
        </div>
      </div>
    </div>
  </div>
);

const SecurityTab = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-800">Security Settings</h2>
      <p className="text-gray-500">Manage your account security preferences</p>
    </div>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
        <input
          type="password"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500"
          placeholder="Enter your current password"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input
            type="password"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500"
            placeholder="Enter new password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input
            type="password"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500"
            placeholder="Confirm new password"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          className="inline-flex items-center px-5 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          Update Password
        </button>
      </div>
    </div>
  </div>
);

const DeliverySettingsTab = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-800">Delivery Settings</h2>
      <p className="text-gray-500">Configure your delivery preferences</p>
    </div>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Default Delivery Method</label>
        <select className="block w-full rounded-md border border-gray-300 px-3 py-2">
          <option>Standard</option>
          <option>Express</option>
          <option>Same Day</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Window</label>
        <input
          type="text"
          className="block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="e.g. 9am - 6pm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Enable Delivery Notifications</label>
        <input type="checkbox" className="h-4 w-4 text-green-600 border-gray-300 rounded ml-2" />
      </div>
      <div className="flex justify-end">
        <button className="inline-flex items-center px-5 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors">
          Save Delivery Settings
        </button>
      </div>
    </div>
  </div>
);

const CompanyTab = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-800">Company Information</h2>
      <p className="text-gray-500">Update your company details</p>
    </div>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          className="block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Company Name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          className="block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Company Address"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
        <input
          className="block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Contact Number"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
        <input
          className="block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Tax ID"
        />
      </div>
      <div className="flex justify-end">
        <button className="inline-flex items-center px-5 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors">
          Save Company Info
        </button>
      </div>
    </div>
  </div>
);

const DeliverySetting = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const user = {
    id: '1',
    name: 'Delivery Manager',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'driver',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and application preferences</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white rounded-lg shadow p-4">
            <nav className="space-y-1">
              <button
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                  activeTab === 'profile'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                <User className="mr-3 h-5 w-5" />
                Profile
              </button>
              <button
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                  activeTab === 'notifications'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('notifications')}
              >
                <Bell className="mr-3 h-5 w-5" />
                Notifications
              </button>
              <button
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                  activeTab === 'security'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('security')}
              >
                <Lock className="mr-3 h-5 w-5" />
                Security
              </button>
              <button
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                  activeTab === 'delivery'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('delivery')}
              >
                <Truck className="mr-3 h-5 w-5" />
                Delivery Settings
              </button>
              <button
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                  activeTab === 'company'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('company')}
              >
                <Building className="mr-3 h-5 w-5" />
                Company
              </button>
            </nav>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-9 space-y-6">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'delivery' && <DeliverySettingsTab />}
          {activeTab === 'company' && <CompanyTab />}
        </div>
      </div>
    </div>
  );
};

export default DeliverySetting;