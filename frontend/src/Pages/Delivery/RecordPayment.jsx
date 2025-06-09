import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PaymentForm from '../../Components/Delivery/PaymentForm';

let mockInvoices = [
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

const RecordPayment = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        if (invoiceId) {
            const foundInvoice = mockInvoices.find(inv => inv.invoiceNumber === invoiceId);
            if (foundInvoice) {
                setInvoice(foundInvoice);
                setError(null);
            } else {
                setError('Invoice not found');
            }
        }
        setIsLoading(false);
    }, [invoiceId]);

    const handleSubmit = async (data) => {
        // No update logic, just navigate back
        navigate(-1);
    };

    const handleCancel = () => {
        navigate(-1);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto mt-8 p-4 bg-red-50 rounded-md text-red-700">
                <p>{error}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 text-primary-600 hover:text-primary-800"
                >
                    Go back
                </button>
            </div>
        );
    }

    if (!invoice) {
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <PaymentForm
                invoice={invoice}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default RecordPayment;