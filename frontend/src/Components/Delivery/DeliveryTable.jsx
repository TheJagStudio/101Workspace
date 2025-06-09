import React from 'react';
import { Check, DollarSign, X } from 'lucide-react';
import "gridjs/dist/theme/mermaid.css";
const DeliveryTable = ({ invoices = [] }) => {
    return (
        <div className="overflow-x-auto rounded-xl orverflow-hidden border border-b-0 border-gray-200">
            <table className="w-full border-collapse md:table block text-center">
                <thead className="gridjs-thead md:table-header-group hidden md:table">
                    <tr className="gridjs-tr">
                        <th className="gridjs-th md:!py-2 md:!text-lg">#</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Customer</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Invoice No</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Cases</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Check</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Cash</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Status</th>
                        <th className="gridjs-th md:!py-2 md:!text-lg">Action</th>
                    </tr>
                </thead>
                <tbody className="md:table-row-group block">
                    {invoices.length === 0 ? (
                        <tr className="gridjs-tr md:table-row block mb-4 border-b md:!border-0">
                            <td colSpan={7} className="text-center py-4 gridjs-td md:!py-2 !bg-gradient-to-r from-gray-50 via-white to-white md:from-white block md:table-cell">No invoices found</td>
                        </tr>
                    ) : (
                        invoices.map((invoice, idx) => (
                            <tr
                                key={invoice.invoiceNumber || idx}
                                className="gridjs-tr md:table-row py-2 block !border-b !border-gray-200 md:!border-0 md:bg-transparent md:rounded-lg shadow-none"
                            >
                                <td className="gridjs-td md:!py-2 !bg-gradient-to-r from-gray-50 via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border md:!border-l-0 !border-gray-200" data-label="#">
                                    <span className="font-semibold md:hidden block text-gray-500">#</span>
                                    {idx + 1}
                                </td>
                                <td className={`gridjs-td md:!py-2 !bg-gradient-to-r ${invoice.paymentStatus === "paid" ? "from-green-100" : "from-red-100"} via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border !border-gray-200 text-left`} data-label="Customer">
                                    <span className="font-semibold md:hidden block text-gray-500">Customer</span>
                                    {invoice.customerName}
                                </td>
                                <td className={`gridjs-td md:!py-2 !bg-gradient-to-r ${invoice.paymentStatus === "paid" ? "from-green-100" : "from-red-100"} via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Invoice No">
                                    <span className="font-semibold md:hidden block text-gray-500">Invoice No</span>
                                    {invoice.invoiceNumber}
                                </td>
                                <td className={`gridjs-td md:!py-2 !bg-gradient-to-r ${invoice.paymentStatus === "paid" ? "from-green-100" : "from-red-100"} via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Cases">
                                    <span className="font-semibold md:hidden block text-gray-500">Cases</span>
                                    {invoice.caseCount}
                                </td>
                                <td className={`gridjs-td md:!py-2 !bg-gradient-to-r ${invoice.paymentStatus === "paid" ? "from-green-100" : "from-red-100"} via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Check">
                                    <span className="font-semibold md:hidden block text-gray-500">Check</span>
                                    {invoice.checkAmount ? `$${invoice.checkAmount.toFixed(2)}` : '-'}
                                </td>
                                <td className={`gridjs-td md:!py-2 !bg-gradient-to-r ${invoice.paymentStatus === "paid" ? "from-green-100" : "from-red-100"} via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Cash">
                                    <span className="font-semibold md:hidden block text-gray-500">Cash</span>
                                    {invoice.cashAmount ? `$${invoice.cashAmount.toFixed(2)}` : '-'}
                                </td>
                                <td className="gridjs-td md:!py-2 !bg-gradient-to-r from-gray-50 via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border md:!border-r-0 !border-gray-200 " data-label="Status">
                                    <span className="font-semibold md:hidden block text-gray-500">Status</span>
                                    {invoice.paymentStatus === 'paid' ? (
                                        <div className="md:w-28 md:mx-auto md:px-3 text-green-600 rounded-full md:bg-green-100 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                            <Check className="inline" size={16} /> Paid
                                        </div>
                                    ) : (
                                        <div className="md:w-28 md:mx-auto md:px-3 text-red-600 rounded-full md:bg-red-100 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                            <X className="inline" size={16} /> Not Paid
                                        </div>
                                    )}
                                </td>
                                <td className="gridjs-td md:!py-2 !bg-gradient-to-r from-gray-50 via-white to-white md:from-white md:table-cell block px-4 py-2 md:px-0 md:py-0 flex items-center justify-between !border-0 md:!border md:!border-r-0 !border-gray-200 " data-label="Status">
                                    <span className="font-semibold md:hidden block text-gray-500">Action</span>
                                    {invoice.paymentStatus === 'paid' ? (
                                        <div className="w-fit px-2 md:mx-auto md:px-3 text-gray-700 border border-gray-300 rounded-lg md:bg-white md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                            <DollarSign className="inline" size={16} /> Record Payment
                                        </div>
                                    ) : (
                                        <div className="w-fit px-2 md:mx-auto md:px-3 text-white border border-green-800 rounded-lg bg-green-600 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                            <DollarSign className="inline" size={16} /> Update Payment
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default DeliveryTable;
