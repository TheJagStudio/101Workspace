import { Lightbulb, LightbulbOff } from 'lucide-react';
import React, { useState } from 'react'
import BarcodeScanner from "react-qr-barcode-scanner";

const Button = ({ children, onClick, icon, variant, isLoading, disabled }) => {
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
            disabled={isLoading || disabled}
            className={`${base} ${variants[variant || 'solid']} px-5 py-2 text-base`}
        >
            {icon}
            {isLoading ? 'Loading...' : children}
        </button>
    );
}

const Scanner = ({ onScanComplete }) => {
    const [barcode, setBarcode] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [manualInput, setManualInput] = useState('')
    const [scanError, setScanError] = useState(null)
    const [torchEnabled, setTorchEnabled] = useState(false)

    const startScanning = () => {
        setIsScanning(true)
        setScanError(null)
    }

    const stopScanning = () => {
        setIsScanning(false)
    }

    const handleBarcodeDetected = (result) => {
        if (result?.text) {
            setBarcode(result.text)
            setIsScanning(false)
            setScanError(null)
            onScanComplete({
                invoiceNumber: result.text,
                customerId: '2',
                customerName: 'NATUR INC'
            })
        }
    }

    const handleManualScan = () => {
        if (!manualInput) {
            setScanError('Please enter an invoice number')
            return
        }
        onScanComplete({
            invoiceNumber: manualInput,
            customerId: '2',
            customerName: 'NATUR INC'
        })
        setManualInput('')
        setScanError(null)
    }

    const onTorchSwitch = () => {
        setIsTorchOn(!isTorchOn)
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md mx-auto">
            <div className="text-center mb-6">
                <div className="mx-auto bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                    {/* QrCodeIcon replacement */}
                    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Scan Invoice Barcode</h2>
                <p className="text-gray-500 mt-1">Point the camera at the barcode to scan</p>
            </div>
            <div className="mb-2">
                <div className={`border-2 ${isScanning ? 'border-green-600 border-dashed animate-pulse' : 'border-gray-300'} rounded-lg h-fit overflow-hidden flex items-center justify-center bg-gray-50`}>
                    {isScanning ? (
                        <div className="w-full h-full flex flex-col items-center justify-center relative">
                            <BarcodeScanner
                                torch={torchEnabled}
                                onUpdate={(err, result) => {
                                    if (result) handleBarcodeDetected(result);
                                }}
                                facingMode="environment"
                                style={{ width: '100%', height: 'auto' }}
                                formats={['UPC_A', 'UPC_E', 'EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'CODE_93', 'ITF']}
                            />
                        </div>
                    ) : (
                        <div className="text-center px-4 py-10">
                            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mx-auto mb-2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                            <p className="text-gray-500">Ready to scan invoice barcode</p>
                        </div>
                    )}
                </div>
                {isScanning && (<div className='flex flex-row gap-2 items-center justify-center mt-2 w-full'>


                    <Button
                        onClick={onTorchSwitch}
                        variant={torchEnabled ? 'solid' : 'outline'}
                        icon={torchEnabled ? (<Lightbulb size={16} className="text-white" />) : (<LightbulbOff size={16} className="text-gray-400" />)}
                    >
                        {torchEnabled ? 'Turn Torch Off' : 'Turn Torch On'}
                    </Button>
                    <Button
                        onClick={stopScanning}
                        variant="outline"
                        className="mt-2"
                    >
                        Cancel
                    </Button>
                </div>)}
            </div>
            {scanError && (
                <div className="mb-4 flex items-center p-3 bg-red-50 text-red-700 rounded-md">
                    {/* AlertCircle icon */}
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2 flex-shrink-0" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <p className="text-sm">{scanError}</p>
                </div>
            )}
            <div className="flex flex-col space-y-4">
                <Button
                    onClick={startScanning}
                    disabled={isScanning}
                    icon={
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                    }
                >
                    {isScanning ? 'Stop Scanning...' : 'Start Scanning'}
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or enter manually</span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        className="flex-1 rounded-md focus:outline-none border border-gray-200 focus:border-green-600 px-2"
                        placeholder="Enter invoice number"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                    />
                    <Button onClick={handleManualScan} disabled={!manualInput}>
                        Submit
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default Scanner