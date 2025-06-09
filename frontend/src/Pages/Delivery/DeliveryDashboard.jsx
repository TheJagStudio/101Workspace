import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TruckIcon, Package, CheckCircle, XCircle, BarChart3, Truck } from 'lucide-react'
import DeliveryTable from '../../Components/Delivery/DeliveryTable'

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
]

const mockDeliverySheets = [
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

// Mock user (replace with your auth logic)
const mockUser = { name: 'Admin', role: 'manager' }

// Inline Card, CardHeader, CardContent, Button components
const Card = ({ className = '', children }) => (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>{children}</div>
)
const CardHeader = ({ title, subtitle, action }) => (
    <div className="pt-6 px-6 pb-0 flex flex-col gap-1">
        <div className="flex items-center justify-between">
            <div>{title}</div>
            {action && <div>{action}</div>}
        </div>
        {subtitle && <div className="text-gray-500 text-sm">{subtitle}</div>}
    </div>
)
const CardContent = ({ className = '', children }) => (
    <div className={`p-6 ${className}`}>{children}</div>
)
const Button = ({ children, onClick, icon, variant, size }) => {
    const base =
        'inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors';
    const variants = {
        outline:
            'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
        solid:
            'bg-green-600 text-white hover:bg-green-700',
    };
    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-5 py-2 text-base',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${base} ${variants[variant || 'solid']} ${sizes[size || 'md']}`}
        >
            {icon}
            {children}
        </button>
    );
}

const DeliveryDashboard = () => {
  const [deliverySheets, setDeliverySheets] = useState([])
  const [currentDeliverySheet, setCurrentDeliverySheet] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [user] = useState(mockUser)
  const navigate = useNavigate()

  useEffect(() => {
    setIsLoading(true)
    setTimeout(() => {
      setDeliverySheets(mockDeliverySheets)
      setCurrentDeliverySheet(mockDeliverySheets[0])
      setIsLoading(false)
    }, 800)
  }, [])

  // Dashboard stats
  const getTotalInvoices = () => currentDeliverySheet?.invoices.length || 0
  const getPaidInvoices = () => currentDeliverySheet?.invoices.filter(inv => inv.paymentStatus === 'paid').length || 0
  const getUnpaidInvoices = () => currentDeliverySheet?.invoices.filter(inv => inv.paymentStatus === 'not_paid').length || 0
  const getTotalCases = () => currentDeliverySheet?.invoices.reduce((sum, inv) => sum + inv.caseCount, 0) || 0

  const handleEditInvoice = (id) => {
    navigate(`/invoice/${id}`)
  }

  const handleUpdatePayment = (id) => {
    navigate(`/record-payment/${id}`)
  }

  const handleScanInvoice = () => {
    navigate('/scan')
  }

  const handleCreateDelivery = () => {
    navigate('/create-delivery')
  }

  const handleViewAllDeliveries = () => {
    navigate('/deliveries')
  }

  if (isLoading && !currentDeliverySheet) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="mt-1 text-gray-500">
            {user?.role === 'manager' ? 'Manage your deliveries and track payments' : 'Track your deliveries and record payments'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleScanInvoice}
            icon={<Package className="h-5 w-5" />}
          >
            Scan Invoice
          </Button>
          {user?.role === 'manager' && (
            <Button
              variant="outline"
              onClick={handleCreateDelivery}
              icon={<TruckIcon className="h-5 w-5" />}
            >
              Create Delivery
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start">
              <div className="flex-shrink-0 bg-yellow-100 rounded-full p-3">
                <Package className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="text-center md:ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Invoices</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{getTotalInvoices()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start">
              <div className="flex-shrink-0 bg-green-100 rounded-full p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-center md:ml-4">
                <h3 className="text-sm font-medium text-gray-500">Paid Invoices</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{getPaidInvoices()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start">
              <div className="flex-shrink-0 bg-red-100 rounded-full p-3">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-center md:ml-4">
                <h3 className="text-sm font-medium text-gray-500">Unpaid Invoices</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{getUnpaidInvoices()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-center md:ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Cases</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{getTotalCases()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {currentDeliverySheet && (
        <Card className="bg-white">
          <CardHeader 
            title={
              <span className="flex items-center">
                <Truck className="mr-2 h-5 w-5 text-green-600" /> 
                Current Delivery Sheet
              </span>
            }
            subtitle={`Date: ${new Date(currentDeliverySheet.date).toLocaleDateString()} - Truck: ${currentDeliverySheet.truckName}`}
            action={
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleViewAllDeliveries}
              >
                View All
              </Button>
            }
          />
          <CardContent>
            <DeliveryTable 
              invoices={currentDeliverySheet.invoices}
              onEditInvoice={user?.role === 'manager' ? handleEditInvoice : undefined}
              onUpdatePayment={handleUpdatePayment}
              isManager={user?.role === 'manager'}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DeliveryDashboard