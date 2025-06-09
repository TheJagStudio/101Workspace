import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

const ProductCardPopup = ({ activeProduct, onClose }) => {
	const [activeTab, setActiveTab] = useState("priceHistory"); // 'priceHistory' or 'availableQuantity' or 'purchase

	if (!activeProduct) {
		return null; 
	}
	let totalSub = 0;
	
	const chartData = activeProduct.history.map((item) => {
		totalSub += item.quantity || 0;
		return {
			timestamp: new Date(item.timestamp).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }), // MM/DD/YYYY format
			retailPrice: parseFloat(item.retailPrice),
			costPrice: parseFloat(item.costPrice),
			quantity: item.quantity,
			totalSub: totalSub,
		};
	});

	const purchaseChartData = activeProduct.purchaseHistory.map((item) => {
		return {
			costPrice: item.costPrice ? parseFloat(item.costPrice) : 0,
			purchasedQuantity: item.purchasedQuantity || 0,
			purchaseOrderId: item.purchaseOrderId || "N/A",
			timestamp: new Date(item.timestamp).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }), // MM/DD/YYYY format
			totalCostPrice: item.totalCostPrice ? parseFloat(item.totalCostPrice) : 0,
			vendorName: item.vendorName || "Unknown Vendor",
		};
	});

	return (
		<div className="bg-white border border-dashed border-gray-300  rounded-lg shadow-xl p-6 w-full max-w-3xl relative">
			{/* Close Button */}
			<button onClick={onClose} className="absolute top-3 right-3 text-gray-600 hover:text-red-600 cursor-pointer text-2xl font-bold">
				&times;
			</button>

			{/* Product Details */}
			<div className="text-center mb-6 flex flex-row items-center justify-start gap-4">
				<img src={activeProduct.imageUrl || "/static/images/default.png"} alt={activeProduct.productName} className="w-36 h-36 object-contain mx-auto mb-4" />
				<div className="flex flex-col items-start text-left w-full">
					<h2 className="text-2xl font-bold text-gray-800 pr-5">{activeProduct.productName}</h2>
					<p className="text-gray-600 text-sm">
						<b>SKU:</b> {activeProduct.sku}
					</p>
					<p className="text-gray-600 text-sm">
						<b>UPC:</b> {activeProduct.upc}
					</p>
					<p className="text-gray-600 text-sm">
						<b>Product ID:</b> {activeProduct.id}
					</p>
					<p className="text-gray-600 text-sm">
						<b>Current Available Quantity:</b> {activeProduct.history[activeProduct.history.length - 1].availableQuantity}
					</p>
				</div>
			</div>

			{/* Tabs for Graphs */}
			<div className="flex justify-start mb-4 ml-20">
				<button onClick={() => setActiveTab("priceHistory")} className={`py-2 px-4 rounded-l-lg text-sm font-medium ${activeTab === "priceHistory" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"}`}>
					Price History
				</button>
				<button onClick={() => setActiveTab("totalSub")} className={`py-2 px-4 text-sm font-medium border-l border-r ${activeTab === "totalSub" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"}`}>
					Selling History
				</button>
				<button onClick={() => setActiveTab("purchase")} className={`py-2 px-4 rounded-r-lg text-sm font-medium ${activeTab === "purchase" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"}`}>
					Purchase History
				</button>
			</div>

			{/* Graph View */}
			<div className="h-80 w-full">
				<ResponsiveContainer width="100%" height="100%">
					{activeTab === "priceHistory" && (
						<LineChart
							data={chartData}
							margin={{
								top: 5,
								right: 30,
								left: 20,
								bottom: 5,
							}}
						>
							<CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
							<XAxis dataKey="timestamp" />
							<YAxis tickCount={15} />
							<Tooltip 
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										const data = payload[0].payload;
										return (
											<div className="bg-white p-3 rounded shadow text-xs border border-gray-200">
												<div><b>Date:</b> {data.timestamp}</div>
												<div><b>Retail Price:</b> ${data.retailPrice}</div>
												<div><b>Cost Price:</b> ${data.costPrice}</div>
												<div><b>Sold Quantity:</b> {data.quantity}</div>
											</div>
										);
									}
									return null;
								}}
							/>
							<Legend />
							<Line
								type="monotone"
								dataKey="retailPrice"
								stroke="#8884d8" // Indigo-like color
								activeDot={{ r: 8 }}
								name="Retail Price"
								dot={false}
							/>
							<Line
								type="monotone"
								dataKey="costPrice"
								stroke="#ff0000" // Red color
								activeDot={{ r: 8 }}
								name="Cost Price"
								dot={false}
							/>
						</LineChart>
					)}

					{activeTab === "totalSub" && (
						<LineChart
							data={chartData}
							margin={{
								top: 5,
								right: 30,
								left: 20,
								bottom: 5,
							}}
						>
							<CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
							<XAxis dataKey="timestamp" />
							<YAxis tickCount={15} />
							<Tooltip 
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										const data = payload[0].payload;
										return (
											<div className="bg-white p-3 rounded shadow text-xs border border-gray-200">
												<div><b>Date:</b> {data.timestamp}</div>
												<div><b>Total Sold Quantity:</b> {data.totalSub}</div>
												<div><b>Price:</b> ${data.retailPrice} - ${data.costPrice}</div>
												<div><b>Sold Quantity:</b> {data.quantity}</div>
											</div>
										);
									}
									return null;
								}}
							/>
							<Legend />
							<Line
								type="monotone"
								dataKey="totalSub"
								stroke="#82ca9d"
								activeDot={{ r: 8 }}
								name="Total Sold Quantity"
								dot={false}
							/>
						</LineChart>
					)}
					{activeTab === "purchase" && (
						<BarChart
							data={purchaseChartData}
							margin={{
								top: 5,
								right: 30,
								left: 20,
								bottom: 5,
							}}
						>
							<CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
							<XAxis dataKey="timestamp" />
							<YAxis tickCount={15} />
							<Legend />
							<Tooltip
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										const data = payload[0].payload;
										return (
											<div className="bg-white p-3 rounded shadow text-xs border border-gray-200">
												<div><b>Date:</b> {data.timestamp}</div>
												<div><b>Purchased Quantity:</b> {data.purchasedQuantity}</div>
												<div><b>Cost Price:</b> ${data.costPrice}</div>
												<div><b>Total Cost Price:</b> ${data.totalCostPrice}</div>
												<div><b>Vendor:</b> {data.vendorName}</div>
												<div><b>Purchase Order ID:</b> {data.purchaseOrderId}</div>
											</div>
										);
									}
									return null;
								}}
							/>
							<Bar
								dataKey="purchasedQuantity"
								fill="#8884d8"
								name="Purchased Quantity"
								barSize={30}
							/>
						</BarChart>
					)}
				</ResponsiveContainer>
			</div>
		</div>
	);
};

export default ProductCardPopup;
