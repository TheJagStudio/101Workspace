import React, { useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, Download, Calendar } from 'lucide-react';


const invoices = [
  { 
    id: '1', 
    invoiceNumber: '113007', 
    customerId: '1', 
    customerName: 'YAMA LLC', 
    caseCount: 4, 
    paymentStatus: 'not_paid', 
    dateCreated: '2025-05-31T08:00:00Z'
  },
  { 
    id: '2', 
    invoiceNumber: '113019', 
    customerId: '2', 
    customerName: 'NATUR INC', 
    caseCount: 8, 
    paymentStatus: 'not_paid', 
    dateCreated: '2025-05-31T08:15:00Z'
  },
  { 
    id: '3', 
    invoiceNumber: '112925', 
    customerId: '3', 
    customerName: 'RVK 786 LLC', 
    caseCount: 3, 
    paymentStatus: 'not_paid', 
    dateCreated: '2025-05-31T08:30:00Z'
  },
  { 
    id: '4', 
    invoiceNumber: '113283', 
    customerId: '4', 
    customerName: 'OLIVE MINIMART LLC', 
    caseCount: 3, 
    paymentStatus: 'not_paid', 
    dateCreated: '2025-05-31T08:45:00Z'
  },
  { 
    id: '5', 
    invoiceNumber: '113298', 
    customerId: '5', 
    customerName: 'SMILES GLENWOOD INC', 
    caseCount: 5, 
    checkAmount: 2343.64,
    paymentStatus: 'paid', 
    dateCreated: '2025-05-31T09:00:00Z',
    dateUpdated: '2025-05-31T14:30:00Z'
  },
];
const deliverySheets = [
  {
    id: '1',
    date: '2025-05-31T00:00:00Z',
    truckId: '1',
    truckName: 'Truck 1',
    location: 'Downtown',
    driverId: '2',
    driverName: 'Driver One',
    invoices: invoices,
    status: 'in_progress'
  }
];
const DeliveryReport = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const totalDeliveries = deliverySheets.length;
  const totalInvoices = invoices.length;
  const totalPaid = invoices.filter(inv => inv.paymentStatus === 'paid').length;
  const totalCases = invoices.reduce((sum, inv) => sum + inv.caseCount, 0);
  const totalRevenue = invoices
    .filter(inv => inv.paymentStatus === 'paid')
    .reduce((sum, inv) => sum + (inv.checkAmount || 0) + (inv.cashAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500">Track delivery performance and payment statistics</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 px-5 py-2 text-base font-medium focus:outline-none transition-colors"
          onClick={() => {}}
        >
          <Download size={20} />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 flex items-start">
            <div className="flex-shrink-0 bg-primary-100 rounded-full p-3">
              <Package className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Cases</h3>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{totalCases}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 flex items-start">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Deliveries</h3>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{totalDeliveries}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 flex items-start">
            <div className="flex-shrink-0 bg-green-100 rounded-full p-3">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                ${totalRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 flex items-start">
            <div className="flex-shrink-0 bg-purple-100 rounded-full p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Payment Rate</h3>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {totalInvoices ? Math.round((totalPaid / totalInvoices) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Delivery Trends</h2>
              <p className="text-gray-500 text-sm">Number of deliveries over time</p>
            </div>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-gray-500">
            Chart placeholder - Delivery trends over time
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Payment Analytics</h2>
              <p className="text-gray-500 text-sm">Payment methods and status distribution</p>
            </div>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-gray-500">
            Chart placeholder - Payment distribution
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
              <p className="text-gray-500 text-sm">Latest deliveries and payments</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {deliverySheets.slice(0, 5).map(sheet => (
              <div key={sheet.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Delivery completed for {sheet.truckName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(sheet.date).toLocaleDateString()} • {sheet.invoices.length} invoices
                  </p>
                </div>
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {sheet.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryReport;