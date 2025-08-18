import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lightbulb, LightbulbOff, Package, Trash2, Upload } from 'lucide-react'
import Scanner from '../../Components/Delivery/Scanner'
import { apiRequest } from '../../utils/api'
import CustomDropdown from '../../Components/utils/CustomDropdown'
import { useLocation } from 'react-router-dom'
import { set } from 'lodash'

const Button = ({ children, onClick, icon, variant, isLoading, disabled, className, showChildren }) => {
    const base =
        'inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors';
    const variants = {
        outline:
            'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
        solid:
            'bg-green-600 text-white hover:bg-green-700',
    };
    const disabledClass = 'opacity-50 cursor-not-allowed';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading || disabled}
            className={`${base} ${className || variants[variant || 'solid']} ${(isLoading || disabled) ? disabledClass : ''} px-2 py-2 text-base`}
        >
            <span >{icon}</span>
            <span className={!showChildren ? 'hidden sm:block' : ''}>{isLoading ? 'Loading...' : children}</span>
        </button>
    );
}

const ScanPage = () => {
    const navigate = useNavigate()
    const location = useLocation();
    const [scanResult, setScanResult] = useState(null)
    const [caseCount, setCaseCount] = useState(1)
    const [addingInvoice, setAddingInvoice] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    // Get truckId from URL param if present, else default to ""
    const urlParams = new URLSearchParams(location.search)
    const initialTruckId = urlParams.get('truckId') || null
    const [selectedTruck, setSelectedTruck] = useState(initialTruckId)
    const [selectedDriver, setSelectedDriver] = useState('')
    const [invoiceEntries, setInvoiceEntries] = useState([])
    const [scanningInvoice, setScanningInvoice] = useState(false)
    const [trucks, setTrucks] = useState([])
    const [drivers, setDrivers] = useState([])
    const [loadingTruckInfo, setLoadingTruckInfo] = useState(false)
    const [uploadingEntries, setUploadingEntries] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Load data from localStorage on component mount
    useEffect(() => {
        const savedEntries = localStorage.getItem('deliveryInvoiceEntries')
        const savedTruck = localStorage.getItem('selectedTruck')
        const savedDriver = localStorage.getItem('selectedDriver')

        if (savedEntries) {
            try {
                setInvoiceEntries(JSON.parse(savedEntries))
            } catch (e) {
                console.error('Error parsing saved entries:', e)
            }
        }

        if (savedTruck && !initialTruckId) setSelectedTruck(savedTruck)
        if (savedDriver && !initialTruckId) setSelectedDriver(savedDriver)
    }, [])

    // Save to localStorage whenever invoiceEntries changes
    useEffect(() => {
        localStorage.setItem('deliveryInvoiceEntries', JSON.stringify(invoiceEntries))
    }, [invoiceEntries])

    // Save truck and driver selections to localStorage
    useEffect(() => {
        if (selectedTruck) {
            localStorage.setItem('selectedTruck', selectedTruck)
            if (selectedDriver) {
                setSelectedDriver(JSON.parse(localStorage.getItem('truckDriverMap'))[selectedTruck] || '')
            }
        }
    }, [selectedTruck])

    useEffect(() => {
        if (selectedDriver) {
            localStorage.setItem('selectedDriver', selectedDriver)
            if (selectedDriver) {
                let init = JSON.parse(localStorage.getItem('truckDriverMap')) || {}
                localStorage.setItem('truckDriverMap', JSON.stringify({ ...init, [selectedTruck]: selectedDriver }))
            }
        }
    }, [selectedDriver])

    const fetchTruckInfo = async () => {
        setLoadingTruckInfo(true)
        try {
            const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/delivery/truck-info/`)
            const data = await response.json()
            setTrucks(data.trucks || [])
            setDrivers(data.drivers || [])
            if (initialTruckId) {
                setSelectedTruck(initialTruckId)
                const driverMap = JSON.parse(localStorage.getItem('truckDriverMap')) || {}
                console.log('Initial Driver ID:', driverMap)
                setSelectedDriver(driverMap[initialTruckId] || null)
            }
        } catch (err) {
            setError(`Failed to load truck/driver info: ${err.message}`)
        } finally {
            setLoadingTruckInfo(false)
        }
    }

    useEffect(() => {
        fetchTruckInfo()
    }, [location.search])

    const handleScanComplete = async (result) => {
        setScanningInvoice(true)
        setError(null)
        try {
            const invoiceData = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/scan-invoice/`, {
                method: 'POST',
                body: JSON.stringify({ invoiceId: result?.invoiceNumber }),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            // if error in response, set error state
            if (invoiceData?.error?.details) {
                setError("No invoice data found for this number")
            } else {
                // Remap the nested API response to match the UI fields
                const order = invoiceData?.orderDto || {};
                const customer = invoiceData?.customerDto || {};

                setScanResult({
                    invoiceNumber: result?.invoiceNumber,
                    orderId: order?.id || null,
                    customerId: customer?.id || order?.customerId || 'N/A',
                    customerName: customer?.name || customer?.company || 'Unknown Customer',
                    shippingType: order?.shippingStatusName || order?.shippingTypeName || 'N/A',
                    status: order?.status || 'N/A',
                    shippingDate: order?.shipTimestamp || null,
                    trackingNumber: order?.trackingNumber || null,
                    notes: order?.orderNotes || order?.notes || ''
                })
            }
        } catch (err) {
            setError(`Failed to scan invoice: ${err.message}`)
            setScanResult(null)
        } finally {
            setScanningInvoice(false)
        }
    }

    const handleAddInvoice = async () => {
        if (!scanResult) {
            setError('No scan result found')
            return
        }
        if (!selectedTruck || !selectedDriver) {
            setError('Please select both truck and driver')
            return
        }

        setAddingInvoice(true)
        setError(null)

        // Check if invoice already exists
        const exists = invoiceEntries.find(
            entry => entry.invoiceNumber === scanResult?.invoiceNumber
        )
        if (exists) {
            setError(`Invoice #${scanResult?.invoiceNumber} already exists`)
            setAddingInvoice(false)
            return
        }

        // Simulate adding invoice
        setTimeout(() => {
            const newEntry = {
                id: (invoiceEntries.length + 1).toString(),
                invoiceNumber: scanResult?.invoiceNumber,
                orderId: scanResult?.orderId,
                customerId: scanResult?.customerId,
                customerName: scanResult?.customerName,
                shippingType: scanResult?.shippingType,
                status: scanResult?.status,
                caseCount: caseCount,
                paymentStatus: 'not_paid',
                truckNo: selectedTruck,
                truckName: trucks.find(t => t.truckNo === selectedTruck)?.truckName,
                driverLicense: selectedDriver,
                driverName: drivers.find(d => d.driverLicense === selectedDriver)?.driverName,
                dateCreated: new Date().toISOString(),
                shippingDate: scanResult?.shippingDate,
                trackingNumber: scanResult?.trackingNumber,
                notes: scanResult?.notes
            }

            setInvoiceEntries([...invoiceEntries, newEntry])
            setSuccess(`Invoice #${scanResult?.invoiceNumber} added successfully`)
            setScanResult(null)
            setCaseCount(1)
            setTimeout(() => setSuccess(null), 2000)
            setAddingInvoice(false)
        }, 800)
    }

    const handleRemoveInvoice = (invoiceId) => {
        setInvoiceEntries(invoiceEntries.filter(entry => entry.id !== invoiceId))
    }

    const handleUploadAllEntries = async () => {
        if (invoiceEntries.length === 0) {
            setError('No invoices to upload')
            return
        }

        setUploadingEntries(true)
        setError(null)
        setSuccess(null)
        setUploadProgress(0)

        let successCount = 0
        let failedEntries = []

        for (let i = 0; i < invoiceEntries.length; i++) {
            const entry = invoiceEntries[i]
            setUploadProgress(Math.round(((i + 1) / invoiceEntries.length) * 100))

            try {
                await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/delivery/upload-delivery-entry/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        invoiceNumber: entry.invoiceNumber,
                        orderId: entry.orderId,
                        customerId: entry.customerId,
                        customerName: entry.customerName,
                        caseCount: entry.caseCount,
                        truckNo: entry.truckNo,
                        driverLicense: entry.driverLicense,
                        dateCreated: entry.dateCreated,
                        status: entry.status,
                        paymentStatus: entry.paymentStatus || 'not_paid'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                successCount++
            } catch (err) {
                console.error(`Failed to upload entry ${entry.invoiceNumber}:`, err)
                failedEntries.push({
                    invoiceNumber: entry.invoiceNumber,
                    error: err.message
                })
            }

            // Small delay between requests to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 200))
        }

        setUploadingEntries(false)
        setUploadProgress(0)

        if (successCount === invoiceEntries.length) {
            setSuccess(`Successfully uploaded all ${successCount} entries`)
            // Clear localStorage and state after successful upload
            setInvoiceEntries([])
            localStorage.removeItem('deliveryInvoiceEntries')
            localStorage.removeItem('selectedTruck')
            localStorage.removeItem('selectedDriver')
            setSelectedTruck('')
            setSelectedDriver('')
        } else if (successCount > 0) {
            setSuccess(`Uploaded ${successCount} of ${invoiceEntries.length} entries`)
            if (failedEntries.length > 0) {
                setError(`Failed entries: ${failedEntries.map(e => e.invoiceNumber).join(', ')}`)
            }
        } else {
            setError('Failed to upload any entries')
        }

        setTimeout(() => {
            setSuccess(null)
            setError(null)
        }, 5000)
    }

    const handleBackToScanner = () => {
        setScanResult(null)
        setError(null)
    }

    return (
        <div className="p-2 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-y-6 lg:gap-6">
                {/* Left Column - Scanner/Form */}
                <div className="space-y-4">
                    {!scanResult ? (
                        <div className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-xl font-semibold mb-4">Scan Invoice</h2>
                            {scanningInvoice && (
                                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                                    Scanning invoice...
                                </div>
                            )}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                                    {success}
                                </div>
                            )}
                            <Scanner onScanComplete={handleScanComplete} />
                        </div>
                    ) : (
                        <div className="rounded-lg border border-gray-200 bg-white">
                            <div className="pt-6 px-6 pb-0 flex flex-col gap-1">
                                <div className="font-semibold text-lg">Invoice Information</div>
                                <div className="text-gray-500 text-sm">Scanned invoice #{scanResult?.invoiceNumber}</div>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div className='flex items-center justify-between gap-2 sm:block'>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Invoice Number
                                        </label>
                                        <div className="p-1 border border-gray-300 rounded flex-1 bg-gray-50">
                                            {scanResult?.invoiceNumber}
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 sm:block'>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Order ID
                                        </label>
                                        <div className="p-1 border border-gray-300 rounded flex-1 bg-gray-50">
                                            {scanResult?.orderId || 'N/A'}
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 sm:block'>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer
                                        </label>
                                        <div className="p-1 border border-gray-300 rounded flex-1 bg-gray-50">
                                            {scanResult?.customerName}
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 sm:block'>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Shipping Type
                                        </label>
                                        <div className="p-1 border border-gray-300 rounded flex-1 bg-gray-50">
                                            {scanResult?.shippingType}
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2'>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <div className="p-1">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${scanResult?.status === 'Shipped'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-200 text-gray-800'
                                                }`}>
                                                {scanResult?.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="caseCount" className="block text-sm font-medium text-gray-700 mb-1">
                                            Number of Cases
                                        </label>
                                        <input
                                            type="number"
                                            id="caseCount"
                                            min={1}
                                            value={caseCount}
                                            onChange={(e) => setCaseCount(parseInt(e.target.value))}
                                            className="block w-full border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 focus:outline-none px-3 py-1"
                                        />
                                    </div>

                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                                            {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                                            {success}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 pb-6 pt-0 flex justify-start space-x-3">
                                <Button
                                    variant="outline"
                                    onClick={handleBackToScanner}
                                    icon={<ArrowLeft size={20} />}
                                    showChildren={false}
                                >
                                    Back to Scanner
                                </Button>
                                <Button
                                    onClick={handleAddInvoice}
                                    isLoading={addingInvoice}
                                    icon={<Package size={20} />}
                                    showChildren={true}
                                >
                                    Add Invoice
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Truck/Driver Selection and Table */}
                <div className="space-y-4 col-span-2">
                    {/* Truck and Driver Selection */}
                    <div className="rounded-lg border border-gray-200 bg-white">
                        <div className="pt-6 px-6 pb-0 flex flex-col gap-1">
                            <div className="font-semibold text-lg">Delivery Assignment</div>
                        </div>
                        <div className="p-6">
                            {loadingTruckInfo && (
                                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                                    Loading trucks and drivers...
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className='z-30'>
                                    <label htmlFor="truck" className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Truck
                                    </label>
                                    <CustomDropdown
                                        options={trucks.map(truck => ({
                                            value: truck.truckNo,
                                            label: truck.truckName
                                        }))}
                                        value={selectedTruck}
                                        onChange={setSelectedTruck}
                                        placeholder="Truck"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="driver" className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Driver
                                    </label>
                                    <CustomDropdown
                                        options={drivers.map(driver => ({
                                            value: driver.driverLicense,
                                            label: driver.driverName
                                        }))}
                                        value={selectedDriver}
                                        onChange={setSelectedDriver}
                                        placeholder="Driver"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Entries Table */}
                    <div className="rounded-lg border border-gray-200 bg-white">
                        <div className="pt-6 px-6 pb-0 flex flex-col gap-1">
                            <div className="font-semibold text-lg">Invoice Entries</div>
                            <div className="text-gray-500 text-sm">{invoiceEntries.length} invoices added</div>
                        </div>
                        <div className="p-6">
                            {invoiceEntries.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Package size={48} className="mx-auto mb-2 text-gray-300" />
                                    <p>No invoices scanned yet</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Invoice #
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Order ID
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Customer
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Cases
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {invoiceEntries.map((entry) => (
                                                <tr key={entry.id}>
                                                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                                        {entry.invoiceNumber}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">
                                                        {entry.orderId || 'N/A'}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">
                                                        {entry.customerName}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${entry.status === 'Shipped'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {entry.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">
                                                        {entry.caseCount}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-500">
                                                        <button
                                                            onClick={() => handleRemoveInvoice(entry.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Upload Section */}
                        {invoiceEntries.length > 0 && (
                            <div className="px-6 pb-6 pt-2 border-t border-gray-200 text-white">
                                <div className="flex flex-col gap-4">
                                    {uploadingEntries && (
                                        <div className="bg-green-50 p-4 rounded-md">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-green-700 font-medium">Uploading entries...</span>
                                                <span className="text-green-700 text-sm">{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-green-200 rounded-full h-2">
                                                <div
                                                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-gray-600">
                                            Ready to upload {invoiceEntries.length} entries to the database
                                        </div>
                                        <Button
                                            onClick={handleUploadAllEntries}
                                            isLoading={uploadingEntries}
                                            disabled={!selectedTruck || !selectedDriver}
                                            className="bg-green-600 hover:bg-green-700"
                                            icon={<Upload size={20} />}
                                        >
                                            {uploadingEntries ? 'Uploading...' : 'Upload All Entries'}
                                        </Button>
                                    </div>

                                    {(!selectedTruck || !selectedDriver) && (
                                        <div className="text-sm text-amber-600">
                                            Please select both truck and driver before uploading
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScanPage