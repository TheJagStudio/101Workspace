import React from 'react'
import Sidebar from '../Components/Delivery/Sidebar'
import { Outlet } from 'react-router-dom'
import Header from '../Components/Delivery/Header'

const DeliveryOutlet = () => {
    return (
        <div className="flex overflow-hidden">
            <Sidebar />
            <div className="flex-1">
                <Header />
                <div className="bg-[#f3f4f6] relative">
                    <div className="p-5 md:py-10 md:px-12 h-[calc(100vh-4rem)] overflow-y-auto">
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeliveryOutlet