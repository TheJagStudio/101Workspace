import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PaymentForm from '../../Components/Delivery/PaymentForm';
import { apiRequest } from '../../utils/api';

const RecordPayment = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchInvoice = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const url = `${import.meta.env.VITE_SERVER_URL}/api/delivery/invoice/${invoiceId}/`;
                const data = await apiRequest(url, { method: 'GET' });
                setInvoice(data);
            } catch (err) {
                setError(err?.message || 'Failed to fetch invoice data');
            } finally {
                setIsLoading(false);
            }
        };

        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId]);

    const handleSubmit = async (data) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const url = `${import.meta.env.VITE_SERVER_URL}/api/delivery/invoice/${invoiceId}/`;
            await apiRequest(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            navigate(-1);
        } catch (err) {
            setError(err?.message || 'Failed to update payment');
        } finally {
            setIsLoading(false);
        }
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