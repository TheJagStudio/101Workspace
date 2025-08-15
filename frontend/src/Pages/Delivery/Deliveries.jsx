import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Calendar, MapPin, Package, Plus, Sheet, User2Icon } from 'lucide-react'
import {apiRequest} from '../../utils/api'
import DeliveryTable from '../../Components/Delivery/DeliveryTable'
import { useAtom } from 'jotai'
import { userAtom } from '../../Variables'
import * as XLSX from 'xlsx'

const Button = ({ children, onClick, icon, variant, size }) => {
	const base =
		'inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors text-nowrap';
	const variants = {
		outline:
			'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
		solid:
			'bg-green-600 text-white hover:bg-green-700',
	};
	const sizes = {
		sm: 'px-2 py-1.5 text-sm',
		md: 'px-2 py-2 text-base',
	};
	return (
		<button
			type="button"
			onClick={onClick}
			className={`${base} ${variants[variant || 'solid']} ${sizes[size || 'md']}`}
		>
			{icon}
			{children}
		</button>
	);
}

const Deliveries = () => {
	const [deliverySheets, setDeliverySheets] = useState([])
	const [isLoading, setIsLoading] = useState(false)
	const [loadingExport, setLoadingExport] = useState(false)
	const [user] = useAtom(userAtom)
	const [selectedDate, setSelectedDate] = useState(() => {
		const today = new Date()
		return today.toISOString().slice(0, 10)
	})
	const [error, setError] = useState(null)
	const navigate = useNavigate()

	useEffect(() => {
		const fetchDeliveries = async () => {
			setIsLoading(true)
			setError(null)
			try {
				const url = `${import.meta.env.VITE_SERVER_URL}/api/delivery/list-deliveries/?date=${selectedDate}`
				const data = await apiRequest(url, { method: 'GET' })
				setDeliverySheets(data["trucks"])
			} catch (err) {
				setError('Failed to fetch deliveries: ' + (err?.message || err))
				setDeliverySheets([])
			} finally {
				setIsLoading(false)
			}
		}
		fetchDeliveries()
	}, [selectedDate])

	const handleCreateDelivery = () => {
		navigate('/create-delivery')
	}

	const handleEditInvoice = (id) => {
		navigate(`/invoice/${id}`)
	}

	const handleUpdatePayment = (id) => {
		navigate(`/record-payment/${id}`)
	}

	const handleExportToExcel = async () => {
		setLoadingExport(true)
		try {
			const workbook = XLSX.utils.book_new()
			
			deliverySheets?.forEach(sheet => {
				// Prepare data for each truck
				const exportData = sheet?.deliveries.map(invoice => ({
					'Invoice Number': invoice.invoice,
					'Customer ID': invoice.customer,
					'Customer Name': invoice.customerName,
					'Customer Company': invoice.customerCompany,
					'Case Count': invoice.box,
					'Payment Status': invoice.payment_status === 'paid' ? 'Paid' : 'Not Paid',
					'Check Amount': invoice.checkAmount || 0,
					'Cash Amount': invoice.cashAmount || 0,
					'Total Amount': (invoice.checkAmount || 0) + (invoice.cashAmount || 0),
					'Status': invoice.status ? 'Delivered' : 'Pending',
					'Date Created': new Date(invoice.insertedTimestamp).toLocaleDateString(),
					'Date Updated': invoice.deliveryTimestamp ? new Date(invoice.deliveryTimestamp).toLocaleDateString() : '',
				}))

				// Create worksheet for this truck
				const worksheet = XLSX.utils.json_to_sheet(exportData)
				
				// Clean sheet name (remove invalid characters and limit length)
				let sheetName = `${sheet?.truckName}_${sheet?.date}`
				sheetName = sheetName.replace(/[:\\/?*[\]]/g, "").substring(0, 31)
				
				XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
			})

			// Generate filename with current date
			const filename = `Deliveries_${selectedDate.replace(/-/g, '')}.xlsx`
			XLSX.writeFile(workbook, filename)
		} catch (error) {
			console.error('Export failed:', error)
			// You might want to show an error message to the user
		} finally {
			setLoadingExport(false)
		}
	}

	if (isLoading && deliverySheets?.length === 0) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
					<p className="text-gray-500">
						{user?.role === 'manager'
							? 'Manage delivery sheets and track all invoices'
							: 'View your assigned deliveries and update payment status'}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<input
						type="date"
						value={selectedDate}
						onChange={e => setSelectedDate(e.target?.value)}
						className="border border-gray-300 w-fit bg-white rounded-md px-2 py-2 text-base focus:outline-none focus:ring-green-500 focus:border-green-500"
					/>
					{deliverySheets?.length > 0 && (
						<Button
							onClick={handleExportToExcel}
							icon={loadingExport ? (
								<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
							) : (
								<Sheet size={20} />
							)}
							variant="solid"
							disabled={loadingExport}
						>
							{loadingExport ? 'Exporting...' : 'Export to Excel'}
						</Button>
					)}
					{user?.role === 'manager' && (
						<Button
							onClick={handleCreateDelivery}
							icon={<Plus size={20} />}
						>
							Create Delivery
						</Button>
					)}
				</div>
			</div>

			{error && (
				<div className="bg-red-50 text-red-700 rounded-md p-3">{error}</div>
			)}

			{deliverySheets?.length === 0 ? (
				<div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
					<Package className="mx-auto h-12 w-12 text-gray-400" />
					<h3 className="mt-2 text-lg font-medium text-gray-900">No deliveries found</h3>
					<p className="mt-1 text-gray-500">Get started by creating a new delivery sheet?.</p>
					{user?.role === 'manager' && (
						<div className="mt-6">
							<Button
								onClick={handleCreateDelivery}
								icon={<Plus size={20} />}
							>
								Create Delivery
							</Button>
						</div>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6">
					{deliverySheets?.map((sheet) => (
						<div key={sheet?.id} className="rounded-lg border border-gray-200 bg-white">
							<div className="pt-6 px-6 pb-0 flex flex-col gap-1">
								<div className="flex items-center justify-start gap-5">
									<div className="flex items-center">
										<Truck className="mr-2 h-5 w-5 text-green-600" />
										<span>{sheet?.truckName}</span>
									</div>
									<div className="flex items-center">
										<User2Icon className="mr-2 h-5 w-5 text-green-600" />
										<span>{sheet?.driver}</span>
									</div>
								</div>
								<div className="text-gray-500 text-sm">
									<div className="flex flex-col sm:flex-row sm:space-x-6 text-sm text-gray-500">
										<span className="flex items-center">
											<Calendar className="mr-1 h-4 w-4" />
											{new Date(sheet?.date).toLocaleDateString()}
										</span>
										{sheet?.location && (
											<span className="flex items-center mt-1 sm:mt-0">
												<MapPin className="mr-1 h-4 w-4" />
												{sheet?.location}
											</span>
										)}
									</div>
								</div>
							</div>
							<div className="p-6">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
									<div className="bg-gray-50 p-3 rounded-lg">
										<p className="text-sm text-gray-500">Total Invoices</p>
										<p className="text-xl font-semibold">{sheet?.deliveries.length}</p>
									</div>
									<div className="bg-gray-50 p-3 rounded-lg">
										<p className="text-sm text-gray-500">Total Cases</p>
										<p className="text-xl font-semibold">
											{sheet?.deliveries.reduce((sum, inv) => sum + (inv.box || 0), 0)}
										</p>
									</div>
									<div className="bg-gray-50 p-3 rounded-lg">
										<p className="text-sm text-gray-500">Payment Status</p>
										<p className="text-xl font-semibold">
											{sheet?.deliveries.filter(inv => inv.payment_status === 'paid').length} / {sheet?.deliveries.length} Paid
										</p>
									</div>
								</div>

								<DeliveryTable
									invoices={sheet?.deliveries}
									onEditInvoice={user?.role === 'manager' ? handleEditInvoice : undefined}
									onUpdatePayment={handleUpdatePayment}
									isManager={user?.role === 'manager'}
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default Deliveries