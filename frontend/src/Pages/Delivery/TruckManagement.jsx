import React, { useState, useEffect } from 'react'
import { Truck, Plus, Edit, Trash2, X, Check } from 'lucide-react'
import { apiRequest } from '../../utils/api'

const TruckManagement = () => {
    const [trucks, setTrucks] = useState([])
    const [activeTab, setActiveTab] = useState('list')
    const [editingTruck, setEditingTruck] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    
    const [formData, setFormData] = useState({
        truckNo: '',
        truckName: ''
    })

    useEffect(() => {
        fetchTrucks()
    }, [])

    const fetchTrucks = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/trucks/`, {
                method: 'GET'
            })
            setTrucks(response.trucks || [])
        } catch (err) {
            setError('Failed to fetch trucks: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleCreateTruck = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/trucks/`, {
                method: 'POST',
                body: JSON.stringify(formData)
            })
            
            if (response.success) {
                setSuccess('Truck created successfully')
                setFormData({ truckNo: '', truckName: '' })
                setActiveTab('list')
                fetchTrucks()
            }
        } catch (err) {
            setError('Failed to create truck: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleEditTruck = (truck) => {
        setEditingTruck(truck)
        setFormData({
            truckNo: truck.truckNo,
            truckName: truck.truckName
        })
        setActiveTab('edit')
    }

    const handleUpdateTruck = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/trucks/${editingTruck.id}/`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            })
            
            if (response.success) {
                setSuccess('Truck updated successfully')
                setFormData({ truckNo: '', truckName: '' })
                setEditingTruck(null)
                setActiveTab('list')
                fetchTrucks()
            }
        } catch (err) {
            setError('Failed to update truck: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTruck = async (truckId) => {
        if (!confirm('Are you sure you want to delete this truck?')) return
        
        setLoading(true)
        setError(null)
        try {
            const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/trucks/${truckId}/`, {
                method: 'DELETE'
            })
            
            if (response.success) {
                setSuccess('Truck deleted successfully')
                fetchTrucks()
            }
        } catch (err) {
            setError('Failed to delete truck: ' + (err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    const handleNewTruck = () => {
        setFormData({ truckNo: '', truckName: '' })
        setEditingTruck(null)
        setActiveTab('create')
    }

    const handleCancel = () => {
        setFormData({ truckNo: '', truckName: '' })
        setEditingTruck(null)
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
                        <Truck className="h-6 w-6 text-green-600" />
                        Truck Management
                    </h1>
                    <p className="mt-1 text-gray-500">Manage your delivery trucks</p>
                </div>
                {activeTab === 'list' && (
                    <button
                        onClick={handleNewTruck}
                        className="mt-4 md:mt-0 inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
                    >
                        <Plus className="h-5 w-5" />
                        Add New Truck
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
                        Truck List
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
                            {activeTab === 'create' ? 'Create Truck' : 'Edit Truck'}
                        </button>
                    )}
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'list' && (
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">All Trucks</h3>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                            </div>
                        ) : trucks.length === 0 ? (
                            <div className="text-center py-12">
                                <Truck className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-medium text-gray-900">No trucks found</h3>
                                <p className="mt-1 text-gray-500">Get started by creating a new truck.</p>
                                <div className="mt-6">
                                    <button
                                        onClick={handleNewTruck}
                                        className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add New Truck
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Truck Number
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Truck Name
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {trucks.map((truck) => (
                                        <tr key={truck.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {truck.truckNo}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {truck.truckName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditTruck(truck)}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTruck(truck.id)}
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
                            {activeTab === 'create' ? 'Create New Truck' : 'Edit Truck'}
                        </h3>
                    </div>
                    <form onSubmit={activeTab === 'create' ? handleCreateTruck : handleUpdateTruck} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="truckNo" className="block text-sm font-medium text-gray-700">
                                    Truck Number *
                                </label>
                                <input
                                    type="text"
                                    id="truckNo"
                                    name="truckNo"
                                    value={formData.truckNo}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., T001"
                                />
                            </div>
                            <div>
                                <label htmlFor="truckName" className="block text-sm font-medium text-gray-700">
                                    Truck Name *
                                </label>
                                <input
                                    type="text"
                                    id="truckName"
                                    name="truckName"
                                    value={formData.truckName}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                                    placeholder="e.g., Delivery Truck 1"
                                />
                            </div>
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
                                {activeTab === 'create' ? 'Create Truck' : 'Update Truck'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default TruckManagement
