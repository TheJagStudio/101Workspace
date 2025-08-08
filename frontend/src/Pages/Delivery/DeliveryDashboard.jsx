import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TruckIcon, Package, CheckCircle, XCircle, BarChart3, Truck } from 'lucide-react'
import DeliveryTable from '../../Components/Delivery/DeliveryTable'
import { apiRequest } from '../../utils/api'
import { useAtom } from 'jotai'
import { userAtom } from '../../Variables'

const DeliveryDashboard = () => {
	const [dashboardData, setDashboardData] = useState(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState(null)
	const [user] = useAtom(userAtom)
	const navigate = useNavigate()

	useEffect(() => {
		const fetchDashboardData = async () => {
			setIsLoading(true)
			setError(null)
			try {
				const today = new Date()
				const dateStr = today.toISOString().slice(0, 10) // Format YYYY-MM-DD
				const url = `${import.meta.env.VITE_SERVER_URL}/api/delivery/dashboard-stats/?date=${dateStr}&user=${user?.email}&admin=${user?.permissions?.delivery_admin}`
				const data = await apiRequest(url, { method: 'GET' })
				setDashboardData(data)
			} catch (err) {
				setError('Failed to fetch dashboard data: ' + (err?.message || err))
				setDashboardData(null)
			} finally {
				setIsLoading(false)
			}
		}

		fetchDashboardData()
	}, [])

	const handleEditInvoice = (id) => {
		navigate(`/delivery/invoice/${id}`)
	}

	const handleUpdatePayment = (id) => {
		// Use the invoice number from the delivery data
		const delivery = processedTrucks.flatMap(truck => truck.invoices).find(invoice => invoice.id === id);
		if (delivery) {
			navigate(`/delivery/record-payment/${delivery.invoiceNumber}`);
		}
	}

	const handleScanInvoice = () => {
		navigate('/delivery/scan')
	}

	const handleCreateDelivery = () => {
		navigate('/delivery/create-delivery')
	}

	const handleViewAllDeliveries = () => {
		navigate('/delivery/deliveries')
	}

	if (isLoading && !dashboardData) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
			</div>
		)
	}

	const stats = dashboardData?.stats || {
		totalInvoices: 0,
		paidInvoices: 0,
		unpaidInvoices: 0,
		totalCases: 0
	}

	const trucks = dashboardData?.trucks || []

	// Remove the currentDeliverySheet logic and replace with individual truck processing
	const processedTrucks = trucks.map(truck => ({
		...truck,
		invoices: truck.deliveries.map(delivery => ({
			id: delivery.id,
			invoiceNumber: delivery.invoice,
			customerId: delivery.customer,
			customerName: delivery.customer,
			caseCount: delivery.box,
			paymentStatus: delivery.payment_status ? 'paid' : 'not_paid',
			checkAmount: delivery.checkAmount,
			cashAmount: delivery.cashAmount,
			dateCreated: delivery.insertedTimestamp,
			dateUpdated: delivery.deliveryTimestamp,
			status: delivery.status ? 'delivered' : 'pending',
		}))
	}))

	return (
		<div className="space-y-6 animate-fade-in">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.first_name + ' ' + user?.last_name || 'User'}</h1>
					<p className="mt-1 text-gray-500">
						{user?.role === 'manager' ? 'Manage your deliveries and track payments' : 'Track your deliveries and record payments'}
					</p>
				</div>
				<div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
					{user?.permissions?.delivery_admin && (<button
						onClick={handleScanInvoice}
						className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
					>
						<Package className="h-5 w-5" />
						Scan Invoice
					</button>)}
				</div>
			</div>

			{error && (
				<div className="bg-red-50 text-red-700 rounded-md p-3">{error}</div>
			)}

			<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="rounded-lg border border-gray-200 bg-white">
					<div className="p-6">
						<div className="flex flex-col md:flex-row items-center md:items-start">
							<div className="flex-shrink-0 bg-yellow-100 rounded-full p-3">
								<Package className="h-6 w-6 text-yellow-600" />
							</div>
							<div className="text-center md:ml-4">
								<h3 className="text-sm font-medium text-gray-500">Total Invoices</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalInvoices}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-lg border border-gray-200 bg-white">
					<div className="p-6">
						<div className="flex flex-col md:flex-row items-center md:items-start">
							<div className="flex-shrink-0 bg-green-100 rounded-full p-3">
								<CheckCircle className="h-6 w-6 text-green-600" />
							</div>
							<div className="text-center md:ml-4">
								<h3 className="text-sm font-medium text-gray-500">Paid Invoices</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">{stats.paidInvoices}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-lg border border-gray-200 bg-white">
					<div className="p-6">
						<div className="flex flex-col md:flex-row items-center md:items-start">
							<div className="flex-shrink-0 bg-red-100 rounded-full p-3">
								<XCircle className="h-6 w-6 text-red-600" />
							</div>
							<div className="text-center md:ml-4">
								<h3 className="text-sm font-medium text-gray-500">Unpaid Invoices</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">{stats.unpaidInvoices}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-lg border border-gray-200 bg-white">
					<div className="p-6">
						<div className="flex flex-col md:flex-row items-center md:items-start">
							<div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
								<BarChart3 className="h-6 w-6 text-blue-600" />
							</div>
							<div className="text-center md:ml-4">
								<h3 className="text-sm font-medium text-gray-500">Total Cases</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalCases}</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{processedTrucks.length > 0 && (
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<Truck className="mr-2 h-5 w-5 text-green-600" />
							<h2 className="text-lg font-semibold text-gray-900">Delivery Sheets</h2>
						</div>
						{user?.permissions?.delivery_admin && (<div>
							<button
								onClick={handleViewAllDeliveries}
								className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 px-3 py-1.5 text-sm"
							>
								View All
							</button>
						</div>)}
					</div>

					{processedTrucks.map((truck, index) => (
						<div key={truck.truckNo || index} className="rounded-lg border border-gray-200 bg-white">
							<div className="pt-6 px-6 pb-0">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div>
										<h3 className="text-lg font-medium text-gray-900">{truck.truckName}</h3>
										<div className="text-sm text-gray-500 space-x-4">
											<span>Truck No: {truck.truckNo}</span>
											<span>Driver: {truck.driver}</span>
											<span>{truck.deliveries.length} Deliveries</span>
											<span>Date: {new Date(dashboardData?.date).toLocaleDateString()}</span>
										</div>
									</div>
								</div>
							</div>
							<div className="p-6">
								<DeliveryTable
									invoices={truck.invoices}
									onEditInvoice={user?.role === 'manager' ? handleEditInvoice : undefined}
									onUpdatePayment={handleUpdatePayment}
									isManager={user?.role === 'manager'}
								/>
							</div>
						</div>
					))}
				</div>
			)}

			{processedTrucks.length === 0 && !isLoading && (
				<div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
					<Package className="mx-auto h-12 w-12 text-gray-400" />
					<h3 className="mt-2 text-lg font-medium text-gray-900">No deliveries found</h3>
					<p className="mt-1 text-gray-500">Get started by creating a new delivery sheet.</p>
					{user?.role === 'manager' && (
						<div className="mt-6">
							<button
								onClick={handleCreateDelivery}
								className="inline-flex items-center gap-2 rounded-md font-medium focus:outline-none transition-colors bg-green-600 text-white hover:bg-green-700 px-5 py-2 text-base"
							>
								<TruckIcon className="h-5 w-5" />
								Create Delivery
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default DeliveryDashboard