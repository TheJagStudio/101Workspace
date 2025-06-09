import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Calendar, MapPin, User } from 'lucide-react'

// Mock data
const mockCustomers = [
  { id: '1', name: 'YAMA LLC', address: '123 Main St', contactPerson: 'John Doe', phoneNumber: '555-1234' },
  { id: '2', name: 'NATUR INC', address: '456 Oak Ave', contactPerson: 'Jane Smith', phoneNumber: '555-5678' },
  { id: '3', name: 'RVK 786 LLC', address: '789 Pine Rd', contactPerson: 'Mike Johnson', phoneNumber: '555-9012' },
  { id: '4', name: 'OLIVE MINIMART LLC', address: '101 Maple Dr', contactPerson: 'Sarah Williams', phoneNumber: '555-3456' },
  { id: '5', name: 'SMILES GLENWOOD INC', address: '202 Cedar Ln', contactPerson: 'Robert Brown', phoneNumber: '555-7890' },
]

const mockTrucks = [
  { id: '1', name: 'Truck 1', licensePlate: 'TR-1234', driverId: '2', driverName: 'Driver One' },
  { id: '2', name: 'Truck 2', licensePlate: 'TR-5678' },
  { id: '3', name: 'Truck 3', licensePlate: 'TR-9012' },
]

const mockInvoices = [
  { id: '1', invoiceNumber: '113007', customerId: '1', customerName: 'YAMA LLC', caseCount: 4, paymentStatus: 'not_paid', dateCreated: '2025-05-31T08:00:00Z' },
  { id: '2', invoiceNumber: '113019', customerId: '2', customerName: 'NATUR INC', caseCount: 8, paymentStatus: 'not_paid', dateCreated: '2025-05-31T08:15:00Z' },
  { id: '3', invoiceNumber: '112925', customerId: '3', customerName: 'RVK 786 LLC', caseCount: 3, paymentStatus: 'not_paid', dateCreated: '2025-05-31T08:30:00Z' },
  { id: '4', invoiceNumber: '113283', customerId: '4', customerName: 'OLIVE MINIMART LLC', caseCount: 3, paymentStatus: 'not_paid', dateCreated: '2025-05-31T08:45:00Z' },
  { id: '5', invoiceNumber: '113298', customerId: '5', customerName: 'SMILES GLENWOOD INC', caseCount: 5, checkAmount: 2343.64, paymentStatus: 'paid', dateCreated: '2025-05-31T09:00:00Z', dateUpdated: '2025-05-31T14:30:00Z' },
]

const initialDeliverySheets = [
  {
    id: '1',
    date: '2025-05-31T00:00:00Z',
    truckId: '1',
    truckName: 'Truck 1',
    location: 'Downtown',
    driverId: '2',
    driverName: 'Driver One',
    invoices: mockInvoices,
    status: 'in_progress'
  }
]

const CreateDelivery = () => {
  const navigate = useNavigate()
  const [deliverySheets, setDeliverySheets] = useState(initialDeliverySheets)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    truckId: '',
    location: '',
    driverId: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [formErrors, setFormErrors] = useState({})

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const validate = () => {
    const errs = {}
    if (!form.truckId) errs.truckId = 'Truck is required'
    if (!form.date) errs.date = 'Date is required'
    return errs
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    const errs = validate()
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsLoading(true)
    try {
      const selectedTruck = mockTrucks.find(t => t.id === form.truckId)
      const newSheet = {
        id: `sheet-${Date.now()}`,
        date: new Date(form.date).toISOString(),
        truckId: form.truckId,
        truckName: selectedTruck?.name || '',
        location: form.location,
        driverId: selectedTruck?.driverId || form.driverId || '',
        driverName: selectedTruck?.driverName || 'Assigned Driver',
        invoices: [],
        status: 'pending'
      }
      // Simulate API delay
      await new Promise(res => setTimeout(res, 500))
      setDeliverySheets([...deliverySheets, newSheet])
      setIsLoading(false)
      navigate('/deliveries')
    } catch (err) {
      setIsLoading(false)
      setError('Failed to create delivery sheet. Please try again.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Delivery</h1>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-800">Delivery Information</h3>
            <p className="text-sm text-gray-500 mt-0.5">Create a new delivery sheet for tracking invoices</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="truckId" className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <Truck className="mr-1 h-4 w-4" /> Truck
                </span>
              </label>
              <select
                id="truckId"
                name="truckId"
                className={`block w-full rounded-md p-2 border focus:outline-none focus:border-green-600 ${formErrors.truckId ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'} `}
                value={form.truckId}
                onChange={handleChange}
              >
                <option value="">Select a truck</option>
                {mockTrucks.map(truck => (
                  <option key={truck.id} value={truck.id}>
                    {truck.name} {truck.licensePlate ? `(${truck.licensePlate})` : ''}
                  </option>
                ))}
              </select>
              {formErrors.truckId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.truckId}</p>
              )}
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" /> Delivery Date
                </span>
              </label>
              <input
                type="date"
                id="date"
                name="date"
                className={`block w-full rounded-md p-2 border focus:outline-none focus:border-green-600 ${formErrors.date ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}`}
                value={form.date}
                onChange={handleChange}
              />
              {formErrors.date && (
                <p className="mt-1 text-sm text-red-600">{formErrors.date}</p>
              )}
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <MapPin className="mr-1 h-4 w-4" /> Location
                </span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                className="block w-full rounded-md p-2 border border-gray-300 focus:outline-none focus:border-green-600"
                placeholder="Enter delivery location"
                value={form.location}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="driverId" className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <User className="mr-1 h-4 w-4" /> Driver (if not assigned to truck)
                </span>
              </label>
              <input
                type="text"
                id="driverId"
                name="driverId"
                className="block w-full rounded-md p-2 border border-gray-300 focus:outline-none focus:border-green-600"
                placeholder="Enter driver ID if not assigned to truck"
                value={form.driverId}
                onChange={handleChange}
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md"
              onClick={() => navigate(-1)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateDelivery