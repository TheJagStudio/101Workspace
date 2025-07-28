import React, { useState, useEffect } from 'react'
import { Database, CheckCircle, Loader, X } from 'lucide-react'

const Toast = ({ message, onClose }) => (
    <div className="fixed top-4 right-4 z-50 animate-slideIn">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
            <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                        <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                            Products Sync Completed
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                            Successfully synced all products with the search engine. The changes will be reflected immediately in product searches.
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                            Total time: {message.time}s
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex border-l border-gray-200">
                <button
                    onClick={onClose}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-sky-600 hover:text-sky-500 focus:outline-none"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    </div>
);

const ProductSync = () => {
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('idle')
    const [products, setProducts] = useState([])
    const [startTime, setStartTime] = useState(0)

    useEffect(() => {
        if (status === 'completed') {
            setToastMessage({ time: Math.round((Date.now() - startTime) / 1000) });
            setShowToast(true);
            const timer = setTimeout(() => setShowToast(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [status, startTime])

    const startSync = async () => {
        const startTime = Date.now(); // Add this line at the start of the function
        setIsSyncing(true)
        setStatus('starting')
        try {
            const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/utility/sync-products/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                }
            });

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split("\n");
                buffer = lines.pop(); // keep incomplete line for next chunk

                for (let line of lines) {
                    line = line.trim();
                    try {
                        const data = JSON.parse(line);
                        setProgress(data.progress || 0);
                        setStatus(data.status || 'syncing');
                        if (data.products) {
                            setProducts(data.products);
                        }
                        if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setStatus('error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
            <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Controls Column */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <header className="text-left mb-6 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-800">Product Sync</h1>
                        <p className="text-gray-500 mt-1 text-sm">Sync your products with search engine</p>
                    </header>

                    <button
                        onClick={startSync}
                        disabled={isSyncing}
                        className={`w-full font-semibold py-2.5 px-6 rounded-md flex items-center justify-center ${isSyncing
                                ? 'bg-gray-200 cursor-not-allowed'
                                : 'bg-sky-600 hover:bg-sky-700 text-white'
                            }`}
                    >
                        {isSyncing ? (
                            <Loader className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                            <Database className="h-5 w-5 mr-2" />
                        )}
                        {isSyncing ? 'Syncing...' : 'Start Sync'}
                    </button>

                    {status === 'error' && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                            Sync failed. Please try again.
                        </div>
                    )}
                </div>

                {/* Preview Column */}
                <div className="lg:col-span-2">
                    <header className="text-left mb-6 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-800">Sync Progress</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {isSyncing ? `Syncing products... ${Math.round(progress)}%` : 'Ready to sync'}
                        </p>
                    </header>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        {/* Progress Bar */}
                        <div className="mb-8">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Synchronization Progress</span>
                                <span className="text-sky-600 font-semibold">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-600 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Product Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {products.map((product, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <div className="aspect-square bg-white rounded-md mb-3 overflow-hidden">
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Database className="w-8 h-8 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700 truncate">{product.name}</p>
                                </div>
                            ))}
                            {products.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <p className="text-sm text-gray-700">and 990 products more</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default ProductSync;