import { useState } from 'react';
import { SearchIcon } from 'lucide-react';

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
            className={`${base} ${variants[variant || 'solid']} px-2 py-2 text-base`}
        >
            {icon}
            {isLoading ? 'Loading...' : children}
        </button>
    );
}

const Scanner = ({ onScanComplete }) => {
    const [manualInput, setManualInput] = useState('')
    const [scanError, setScanError] = useState(null)

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
    return (
        <div className="bg-white">
            <div className="flex flex-col space-y-4">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        className="flex-1 rounded-md focus:outline-none border border-gray-200 focus:border-green-600 px-2"
                        placeholder="Enter invoice number"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                    />
                    <Button onClick={handleManualScan} icon={<SearchIcon />} disabled={!manualInput}>

                    </Button>
                </div>
            </div>
        </div>
    )
}

export default Scanner