import React, { useState, useEffect } from 'react'
import { UserIcon, Plus, Edit, Trash2, X, Check, Eye, EyeOff } from 'lucide-react'
import { apiRequest } from '../../utils/api'

const DriverManagement = () => {
    const [drivers, setDrivers] = useState([])
    const [activeTab, setActiveTab] = useState('list')
    const [editingDriver, setEditingDriver] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    
    const [formData, setFormData] = useState({
        driverLicense: '',
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        is_active: true
    })

    useEffect(() => {
        fetchDrivers()
    }, [])

    const fetchDrivers = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/drivers/`, {
                method: 'GET'
            })
            setDrivers(response.drivers || [])
        } catch (err) {
            setError('Failed to fetch drivers: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setFormData({
            ...formData,
            [e.target.name]: value
        })
    }

    const handleCreateDriver = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/drivers/`, {
                method: 'POST',
                body: JSON.stringify(formData)
            })
            
            if (response.success) {
                setSuccess('Driver created successfully')
                setFormData({
                    driverLicense: '',
                    username: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    password: '',
                    is_active: true
                })
                setActiveTab('list')
                fetchDrivers()
            }
        } catch (err) {
            setError('Failed to create driver: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleEditDriver = (driver) => {
        setEditingDriver(driver)
        setFormData({
            driverLicense: driver.driverLicense,
            username: driver.user?.username || '',
            email: driver.user?.email || '',
            first_name: driver.user?.first_name || '',
            last_name: driver.user?.last_name || '',
            password: '',
            is_active: driver.user?.is_active || true
        })
        setActiveTab('edit')
    }

    const handleUpdateDriver = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            // Don't send empty password
            const updateData = { ...formData }
            if (!updateData.password) {
                delete updateData.password
            }

            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/drivers/${editingDriver.id}/`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            })
            
            if (response.success) {
                setSuccess('Driver updated successfully')
                setFormData({
                    driverLicense: '',
                    username: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    password: '',
                    is_active: true
                })
                setEditingDriver(null)
                setActiveTab('list')
                fetchDrivers()
            }
        } catch (err) {
            setError('Failed to update driver: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteDriver = async (driverId) => {
        if (!confirm('Are you sure you want to delete this driver? This will also delete their user account.')) return
        
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/drivers/${driverId}/`, {
                method: 'DELETE'
            })
            
            if (response.success) {
                setSuccess('Driver deleted successfully')
                fetchDrivers()
            }
        } catch (err) {
            setError('Failed to delete driver: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleNewDriver = () => {
        setFormData({
            driverLicense: '',
            username: '',
            email: '',
            first_name: '',
            last_name: '',
            password: '',
            is_active: true
        })
        setEditingDriver(null)
        setActiveTab('create')
    }

    const handleCancel = () => {
        setFormData({
            driverLicense: '',
            username: '',
            email: '',
            first_name: '',
            last_name: '',
            password: '',
            is_active: true
        })
        setEditingDriver(null)
        setActiveTab('list')
    }

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [success])

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <UserIcon className="h-6 w-6 text-green-600" />
                        Driver Management
                    </h1>
                    <p className="mt-1 text-gray-500">Manage your delivery drivers</p>
                </div>
                {activeTab === 'list' && (
                    <button
                        onClick={handleNewDriver}
                        className="mt-4 md:mt-0 inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
                    >
                        <Plus className="h-5 w-5" />
                        Add New Driver
                    </button>
                )}
            </div>

            {/* Notifications */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    {success}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'list'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Driver List
                    </button>
                    {(activeTab === 'create' || activeTab === 'edit') && (
                        <button
                            onClick={() => setActiveTab(activeTab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'create' || activeTab === 'edit'
                                    ? 'border-green-500 text-green-600'
                                    : 'border-transparent text-gray-500'
                            }`}
                        >
                            {activeTab === 'create' ? 'Create Driver' : 'Edit Driver'}
                        </button>
                    )}
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'list' && (
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">All Drivers</h3>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                            </div>
                        ) : drivers.length === 0 ? (
                            <div className="text-center py-12">
                                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-medium text-gray-900">No drivers found</h3>
                                <p className="mt-1 text-gray-500">Get started by creating a new driver.</p>
                                <div className="mt-6">
                                    <button
                                        onClick={handleNewDriver}
                                        className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add New Driver
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Driver Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            License Number
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Username
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {drivers.map((driver) => (
                                        <tr key={driver.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {driver.driverName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {driver.driverLicense}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {driver.user?.username || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {driver.user?.email || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    driver.user?.is_active 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {driver.user?.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditDriver(driver)}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDriver(driver.id)}
                                                        className="text-red-600 hover:text-red-900 p-1"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Create/Edit Form */}
            {(activeTab === 'create' || activeTab === 'edit') && (
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">
                            {activeTab === 'create' ? 'Create New Driver' : 'Edit Driver'}
                        </h3>
                    </div>
                    <form onSubmit={activeTab === 'create' ? handleCreateDriver : handleUpdateDriver} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="driverLicense" className="block text-sm font-medium text-gray-700">
                                    Driver License Number *
                                </label>
                                <input
                                    type="text"
                                    id="driverLicense"
                                    name="driverLicense"
                                    value={formData.driverLicense}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., DL123456789"
                                />
                            </div>

                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., john.doe"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., john.doe@example.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                                    First Name *
                                </label>
                                <input
                                    type="text"
                                    id="first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., John"
                                />
                            </div>

                            <div>
                                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                                    Last Name *
                                </label>
                                <input
                                    type="text"
                                    id="last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., Doe"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password {activeTab === 'create' ? '*' : '(leave blank to keep current)'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required={activeTab === 'create'}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                        placeholder="Enter password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-gray-400" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {activeTab === 'edit' && (
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        name="is_active"
                                        checked={formData.is_active}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                                        Active
                                    </label>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 px-4 py-2 text-sm"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 px-4 py-2 text-sm"
                            >
                                <Check className="h-4 w-4" />
                                {activeTab === 'create' ? 'Create Driver' : 'Update Driver'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default DriverManagement
