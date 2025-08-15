import React from 'react';
import { Check, DollarSign, Trash2, X } from 'lucide-react';
import "gridjs/dist/theme/mermaid.css";
import { useNavigate } from 'react-router-dom';
const DeliveryTable = ({ invoices = [] }) => {
    const navigate = useNavigate();

    // Group invoices by customer name
    const grouped = React.useMemo(() => {
        const map = {};
        console.log('Processing invoice for:', invoices);
        invoices.forEach(inv => {
            const name = inv.customerCompany + " (" + inv.customer + ")";
            if (!map[name]) {
                map[name] = {
                    customerName: name,
                    invoices: [],
                    paymentStatus: true
                };
            }
            map[name].invoices.push(inv);
            if (!inv.payment_status) {
                map[name].paymentStatus = false;
            }
        });
        return Object.values(map);
    }, [invoices]);

    return (
        <div className="overflow-x-auto rounded-xl orverflow-hidden border border-b-0 border-gray-200">
            <table className="w-full border-collapse md:table block text-center">
                <thead className="gridjs-thead md:table-header-group hidden">
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
                    {grouped.length === 0 ? (
                        <tr className="gridjs-tr md:table-row block mb-4 border-b md:!border-0">
                            <td colSpan={7} className="text-center py-4 gridjs-td block md:table-cell">No invoices found</td>
                        </tr>
                    ) : (
                        grouped.map((group, idx) => (
                            <>
                                {group.invoices.map((invoice, invIdx) => (
                                    <tr
                                        key={invoice.invoice}
                                        className={`gridjs-tr md:table-row block !border-b !border-gray-200 md:!border-0  md:rounded-lg shadow-none ${idx % 2 === 1 ? 'md:bg-gray-100/75' : 'md:!bg-transparent'}`}
                                    >
                                        {/* # column, only for first invoice of group */}
                                        {invIdx === 0 && (
                                            <td
                                                rowSpan={group.invoices.length}
                                                className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border md:!border-l-0 !border-gray-200 text-left`}
                                                data-label="#"
                                            >
                                                <span className="font-semibold md:hidden block text-gray-500">#</span>
                                                {idx + 1}
                                            </td>
                                        )}
                                        {/* Customer column, only for first invoice of group */}
                                        {invIdx === 0 && (
                                            <td
                                                rowSpan={group.invoices.length}
                                                className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border !border-gray-200 text-left`}
                                                data-label="Customer"
                                            >
                                                <span className="font-semibold md:hidden block text-gray-500">Customer</span>
                                                <span className="whitespace-wrap max-w-64 h-fit text-wrap text-right">{group.customerName}</span>
                                            </td>
                                        )}
                                        {/* Invoice No */}
                                        <td className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Invoice No">
                                            <span className="font-semibold md:hidden block text-gray-500">Invoice No</span>
                                            {invoice.invoice}
                                        </td>
                                        {/* Cases */}
                                        <td className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Cases">
                                            <span className="font-semibold md:hidden block text-gray-500">Cases</span>
                                            {invoice.box}
                                        </td>
                                        {/* Check */}
                                        <td className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Check">
                                            <span className="font-semibold md:hidden block text-gray-500">Check</span>
                                            {invoice.checkAmount ? `$${invoice.checkAmount.toFixed(2)}` : '-'}
                                        </td>
                                        {/* Cash */}
                                        <td className={`gridjs-td !bg-transparent md:table-cell px-4 py-2 md:px-0 md:py-2 flex items-center justify-between !border-0 md:!border !border-gray-200`} data-label="Cash">
                                            <span className="font-semibold md:hidden block text-gray-500">Cash</span>
                                            {invoice.cashAmount ? `$${invoice.cashAmount.toFixed(2)}` : '-'}
                                        </td>
                                        {/* Status - now per invoice */}
                                        <td
                                            className="gridjs-td !bg-transparent md:table-cell flex px-4 py-2 md:px-0 items-center justify-between !border-0 md:!border md:!border-r-0 !border-gray-200 "
                                            data-label="Status"
                                        >
                                            <span className="font-semibold md:hidden block text-gray-500">Status</span>
                                            {invoice.payment_status ? (
                                                <div className="md:w-28 md:mx-auto md:px-3 text-green-600 rounded-full md:bg-green-100 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                                    <Check className="inline" size={16} /> Paid
                                                </div>
                                            ) : (
                                                <div className="md:w-28 md:mx-auto md:px-3 text-red-600 rounded-full md:bg-red-100 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                                    <X className="inline" size={16} /> Not Paid
                                                </div>
                                            )}
                                        </td>
                                        {/* Action - now per invoice */}
                                        <td
                                            className="gridjs-td !bg-transparent md:table-cell flex px-4 py-2 md:px-0 items-center justify-between !border-0 md:!border md:!border-r-0 !border-gray-200 md:max-w-48"
                                            data-label="Action"
                                        >
                                            <span className="font-semibold md:hidden block text-gray-500">Action</span>
                                            <div className='flex flex-wrap items-center justify-end md:justify-center gap-2 w-fit'>
                                                {invoice.payment_status ? (
                                                    <button onClick={() => {
                                                        navigate(`/delivery/record-payment/${invoice.invoice}`);
                                                    }} className="w-fit px-2 md:mx-auto md:px-3 text-white border border-green-800 rounded-lg bg-green-600 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                                        <DollarSign className="inline" size={16} /> Update Payment
                                                    </button>
                                                ) : (
                                                    <button onClick={() => {
                                                        navigate(`/delivery/record-payment/${invoice.invoice}`);
                                                    }} className="w-fit px-2 md:mx-auto md:px-3 text-gray-700 border border-gray-300 rounded-lg md:bg-white md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                                        <DollarSign className="inline" size={16} /> Record Payment
                                                    </button>
                                                )}
                                                <button onClick={() => {
                                                    navigate(`/delivery/view-invoice/${invoice.invoice}`);
                                                }} className="w-fit px-2 py-1 md:mx-auto text-red-700 border border-red-300 rounded-lg bg-red-100 md:shadow-inner font-semibold flex justify-center items-center gap-1">
                                                    <Trash2 className="inline" size={16} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default DeliveryTable;