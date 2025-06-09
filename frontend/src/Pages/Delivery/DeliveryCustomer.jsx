import React, { useState } from 'react'
import { Plus, Search, User, Phone, MapPin } from 'lucide-react'

let mockCustomers = [
    { id: '1', name: 'YAMA LLC', address: '123 Main St', contactPerson: 'John Doe', phoneNumber: '555-1234' },
    { id: '2', name: 'NATUR INC', address: '456 Oak Ave', contactPerson: 'Jane Smith', phoneNumber: '555-5678' },
    { id: '3', name: 'RVK 786 LLC', address: '789 Pine Rd', contactPerson: 'Mike Johnson', phoneNumber: '555-9012' },
    { id: '4', name: 'OLIVE MINIMART LLC', address: '101 Maple Dr', contactPerson: 'Sarah Williams', phoneNumber: '555-3456' },
    { id: '5', name: 'SMILES GLENWOOD INC', address: '202 Cedar Ln', contactPerson: 'Robert Brown', phoneNumber: '555-7890' },
];
const DeliveryCustomer = () => {
    const customers = mockCustomers;
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.contactPerson && customer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-500">Manage your customer information and delivery preferences</p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 px-5 py-2 text-base font-medium focus:outline-none transition-colors"
                    onClick={() => { }}
                >
                    <Plus size={20} />
                    Add Customer
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Customer Directory</h2>
                    <div className="relative w-64">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={20} className="text-gray-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-base"
                        />
                    </div>
                </div>
                <div className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCustomers.map(customer => (
                            <div
                                key={customer.id}
                                className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 transition-colors cursor-pointer"
                                onClick={() => { }}
                            >
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                                            <User className="w-6 h-6 text-primary-600" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-semibold text-gray-900 truncate">
                                            {customer.name}
                                        </p>
                                        {customer.contactPerson && (
                                            <p className="text-sm text-gray-500 flex items-center mt-1">
                                                <User size={16} className="mr-1" />
                                                {customer.contactPerson}
                                            </p>
                                        )}
                                        {customer.phoneNumber && (
                                            <p className="text-sm text-gray-500 flex items-center mt-1">
                                                <Phone size={16} className="mr-1" />
                                                {customer.phoneNumber}
                                            </p>
                                        )}
                                        {customer.address && (
                                            <p className="text-sm text-gray-500 flex items-center mt-1">
                                                <MapPin size={16} className="mr-1" />
                                                {customer.address}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeliveryCustomer