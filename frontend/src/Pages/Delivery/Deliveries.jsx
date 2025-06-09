import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, Package, Calendar, MapPin } from 'lucide-react'
import DeliveryTable from '../../Components/Delivery/DeliveryTable'

// Mock data (copied from AdminDashboard.jsx)
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
  },
  {
    id: '2',
    date: '2025-06-01T00:00:00Z',
    truckId: '2',
    truckName: 'Truck 2',
    location: 'Uptown',
    driverId: '3',
    driverName: 'Driver Two',
    invoices: mockInvoices.slice(0, 3),
    status: 'pending'
  }
]

// Mock user (replace with your auth logic)
const mockUser = {
    id: '1',
    name: 'Delivery Manager',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'driver',
  }

// Inline Card, CardHeader, CardContent, CardFooter, Button components (copied from AdminDashboard.jsx)
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
const CardFooter = ({ className = '', children }) => (
  <div className={`px-6 pb-6 pt-0 ${className}`}>{children}</div>
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

const Deliveries = () => {
  const [deliverySheets, setDeliverySheets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [user] = useState(mockUser)
  const navigate = useNavigate()

  useEffect(() => {
    setIsLoading(true)
    setTimeout(() => {
      setDeliverySheets(mockDeliverySheets)
      setIsLoading(false)
    }, 800)
  }, [])

  const handleCreateDelivery = () => {
    navigate('/create-delivery')
  }

  const handleViewDelivery = (id) => {
    navigate(`/delivery/${id}`)
  }

  const handleEditInvoice = (id) => {
    navigate(`/invoice/${id}`)
  }

  const handleUpdatePayment = (id) => {
    navigate(`/record-payment/${id}`)
  }

  if (isLoading && deliverySheets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-gray-500">
            {user?.role === 'manager' 
              ? 'Manage delivery sheets and track all invoices' 
              : 'View your assigned deliveries and update payment status'}
          </p>
        </div>
        {user?.role === 'manager' && (
          <Button
            onClick={handleCreateDelivery}
            icon={<Plus size={20} />}
          >
            Create Delivery
          </Button>
        )}
      </div>

      {deliverySheets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No deliveries found</h3>
          <p className="mt-1 text-gray-500">Get started by creating a new delivery sheet.</p>
          {user?.role === 'manager' && (
            <div className="mt-6">
              <Button
                onClick={handleCreateDelivery}
                icon={<Plus size={20} />}
              >
                Create Delivery
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {deliverySheets.map((sheet) => (
            <Card key={sheet.id} className="bg-white">
              <CardHeader 
                title={
                  <div className="flex items-center">
                    <Truck className="mr-2 h-5 w-5 text-green-600" />
                    <span>{sheet.truckName}</span>
                  </div>
                }
                subtitle={
                  <div className="flex flex-col sm:flex-row sm:space-x-6 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      {new Date(sheet.date).toLocaleDateString()}
                    </span>
                    {sheet.location && (
                      <span className="flex items-center mt-1 sm:mt-0">
                        <MapPin className="mr-1 h-4 w-4" />
                        {sheet.location}
                      </span>
                    )}
                  </div>
                }
              />
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Total Invoices</p>
                    <p className="text-xl font-semibold">{sheet.invoices.length}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Total Cases</p>
                    <p className="text-xl font-semibold">
                      {sheet.invoices.reduce((sum, inv) => sum + inv.caseCount, 0)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Payment Status</p>
                    <p className="text-xl font-semibold">
                      {sheet.invoices.filter(inv => inv.paymentStatus === 'paid').length} / {sheet.invoices.length} Paid
                    </p>
                  </div>
                </div>

                <DeliveryTable 
                  invoices={sheet.invoices.slice(0, 3)} 
                  onEditInvoice={user?.role === 'manager' ? handleEditInvoice : undefined}
                  onUpdatePayment={handleUpdatePayment}
                  isManager={user?.role === 'manager'}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleViewDelivery(sheet.id)}
                >
                  View Full Delivery
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Deliveries