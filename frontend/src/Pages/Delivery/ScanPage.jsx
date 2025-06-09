import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lightbulb, LightbulbOff, Package } from 'lucide-react'
import Scanner from '../../Components/Delivery/Scanner'

// Mock data for delivery sheet and user
const mockDeliverySheet = {
    id: '1',
    truckId: '1',
    truckName: 'Truck 1',
    driverId: '2',
    driverName: 'Driver One',
    invoices: [
        {
            id: '1',
            invoiceNumber: '113007',
            customerId: '1',
            customerName: 'YAMA LLC',
            caseCount: 4,
            paymentStatus: 'not_paid',
            dateCreated: '2025-05-31T08:00:00Z'
        }
    ]
}
const mockUser = { name: 'Admin', role: 'manager' }

// Inline Card, CardHeader, CardContent, CardFooter, Button components
const Card = ({ className = '', children }) => (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>{children}</div>
)
const CardHeader = ({ title, subtitle }) => (
    <div className="pt-6 px-6 pb-0 flex flex-col gap-1">
        <div className="font-semibold text-lg">{title}</div>
        {subtitle && <div className="text-gray-500 text-sm">{subtitle}</div>}
    </div>
)
const CardContent = ({ className = '', children }) => (
    <div className={`p-6 ${className}`}>{children}</div>
)
const CardFooter = ({ className = '', children }) => (
    <div className={`px-6 pb-6 pt-0 ${className}`}>{children}</div>
)
const Button = ({ children, onClick, icon, variant, isLoading }) => {
    const base =
        'inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors';
    const variants = {
        outline:
            'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
        solid:
            'bg-green-600 text-white hover:bg-green-700',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className={`${base} ${variants[variant || 'solid']} px-5 py-2 text-base`}
        >
            {icon}
            {isLoading ? 'Loading...' : children}
        </button>
    );
}


const ScanPage = () => {
    const navigate = useNavigate()
    const [scanResult, setScanResult] = useState(null)
    const [caseCount, setCaseCount] = useState(1)
    const [addingInvoice, setAddingInvoice] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [deliverySheet, setDeliverySheet] = useState(mockDeliverySheet)

    const handleScanComplete = (result) => {
        setScanResult(result)
        setError(null)
    }

    const handleAddInvoice = async () => {
        if (!scanResult) {
            setError('No scan result found')
            return
        }
        if (!deliverySheet) {
            setError('No active delivery sheet found')
            return
        }
        setAddingInvoice(true)
        setError(null)
        // Simulate check for existing invoice
        const exists = deliverySheet.invoices.find(
            inv => inv.invoiceNumber === scanResult?.invoiceNumber
        )
        if (exists) {
            setError(`Invoice #${scanResult?.invoiceNumber} already exists in this delivery sheet`)
            setAddingInvoice(false)
            return
        }
        // Simulate adding invoice
        setTimeout(() => {
            setDeliverySheet({
                ...deliverySheet,
                invoices: [
                    ...deliverySheet.invoices,
                    {
                        id: (deliverySheet.invoices.length + 1).toString(),
                        invoiceNumber: scanResult?.invoiceNumber,
                        customerId: scanResult?.customerId,
                        customerName: scanResult?.customerName,
                        caseCount: caseCount,
                        paymentStatus: 'not_paid',
                        truckId: deliverySheet.truckId,
                        truckName: deliverySheet.truckName,
                        driverId: deliverySheet.driverId,
                        driverName: deliverySheet.driverName,
                        dateCreated: new Date().toISOString()
                    }
                ]
            })
            setSuccess(`Invoice #${scanResult?.invoiceNumber} added successfully`)
            setScanResult(null)
            setCaseCount(1)
            setTimeout(() => setSuccess(null), 2000)
            setAddingInvoice(false)
        }, 800)
    }

    const handleCancel = () => {
        navigate(-1)
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {!scanResult ? (
                <Scanner onScanComplete={handleScanComplete} />
            ) : (
                <Card className="bg-white animate-scale">
                    <CardHeader
                        title="Invoice Information"
                        subtitle={`Scanned invoice #${scanResult?.invoiceNumber}`}
                    />
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Invoice Number
                                </label>
                                <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                                    {scanResult?.invoiceNumber}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Customer
                                </label>
                                <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                                    {scanResult?.customerName}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="caseCount" className="block text-sm font-medium text-gray-700 mb-1">
                                    Number of Cases
                                </label>
                                <input
                                    type="number"
                                    id="caseCount"
                                    min="1"
                                    value={caseCount}
                                    onChange={(e) => setCaseCount(parseInt(e.target.value) || 1)}
                                    className="block w-full border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 focus:outline-none px-3 py-1"
                                />
                            </div>
                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-md">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="p-3 bg-green-50 text-green-700 rounded-md">
                                    {success}
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddInvoice}
                            isLoading={addingInvoice}
                            icon={<Package size={20} />}
                        >
                            Add Invoice
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}

export default ScanPage