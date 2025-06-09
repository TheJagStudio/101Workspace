import React, { useState } from 'react';
import { DollarSign, CheckCircle, XCircle } from 'lucide-react';


const Button = ({ children, onClick, icon, variant, isLoading, disabled, type }) => {
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
            type={type || "button"}
            onClick={onClick}
            disabled={isLoading || disabled}
            className={`${base} ${variants[variant || 'solid']} px-5 py-2 text-base`}
        >
            {icon}
            {isLoading ? 'Loading...' : children}
        </button>
    );
};

const PaymentForm = ({ invoice, onSubmit, onCancel }) => {
    const [checkAmount, setCheckAmount] = useState(invoice.checkAmount ? invoice.checkAmount.toString() : '');
    const [cashAmount, setCashAmount] = useState(invoice.cashAmount ? invoice.cashAmount.toString() : '');
    const [paymentStatus, setPaymentStatus] = useState(invoice.paymentStatus || 'not_paid');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [errors, setErrors] = useState({});

    const validate = () => {
        const errs = {};
        if (checkAmount && parseFloat(checkAmount) < 0) errs.checkAmount = "Must be positive";
        if (cashAmount && parseFloat(cashAmount) < 0) errs.cashAmount = "Must be positive";
        if (!paymentStatus) errs.paymentStatus = "Required";
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setIsSubmitting(true);
        try {
            const formattedData = {
                checkAmount: checkAmount ? parseFloat(checkAmount) : undefined,
                cashAmount: cashAmount ? parseFloat(cashAmount) : undefined,
                paymentStatus,
            };
            await onSubmit(formattedData);
        } catch (error) {
            // handle error if needed
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                    Record Payment for Invoice #{invoice.invoiceNumber}
                </h2>
                <p className="text-gray-500 mt-1">
                    Customer: {invoice.customerName}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="checkAmount" className="block text-sm font-medium text-gray-700">
                            Check Amount
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                id="checkAmount"
                                step="0.01"
                                min="0"
                                className={`block w-full pl-7 pr-12 py-2 rounded-md border ${errors.checkAmount ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                                    }`}
                                placeholder="0.00"
                                value={checkAmount}
                                onChange={e => setCheckAmount(e.target.value)}
                            />
                            {errors.checkAmount && (
                                <span className="text-xs text-red-500">{errors.checkAmount}</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="cashAmount" className="block text-sm font-medium text-gray-700">
                            Cash Amount
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                id="cashAmount"
                                step="0.01"
                                min="0"
                                className={`block w-full pl-7 pr-12 py-2 rounded-md border ${errors.cashAmount ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                                    }`}
                                placeholder="0.00"
                                value={cashAmount}
                                onChange={e => setCashAmount(e.target.value)}
                            />
                            {errors.cashAmount && (
                                <span className="text-xs text-red-500">{errors.cashAmount}</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Status
                        </label>
                        <div className="flex space-x-4">
                            <label className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${paymentStatus === 'paid'
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}>
                                <input
                                    type="radio"
                                    value="paid"
                                    checked={paymentStatus === 'paid'}
                                    onChange={() => setPaymentStatus('paid')}
                                    className="sr-only"
                                />
                                <CheckCircle size={20} className={`mr-2 ${paymentStatus === 'paid' ? 'text-green-600' : 'text-gray-400'}`} />
                                <span>Paid</span>
                            </label>

                            <label className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${paymentStatus === 'not_paid'
                                    ? 'bg-red-50 border-red-200 text-red-800'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}>
                                <input
                                    type="radio"
                                    value="not_paid"
                                    checked={paymentStatus === 'not_paid'}
                                    onChange={() => setPaymentStatus('not_paid')}
                                    className="sr-only"
                                />
                                <XCircle size={20} className={`mr-2 ${paymentStatus === 'not_paid' ? 'text-red-600' : 'text-gray-400'}`} />
                                <span>Not Paid</span>
                            </label>
                        </div>
                        {errors.paymentStatus && (
                            <span className="text-xs text-red-500">{errors.paymentStatus}</span>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        icon={<DollarSign size={20} />}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Payment'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default PaymentForm;