import React, { useState, useEffect, useRef } from 'react'

const CustomDropdown = ({ options, value, onChange, placeholder, optionUp }) => {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const ref = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selected = options.find(opt => opt.value === value)

    return (
        <div className="relative min-w-48 z-20" ref={ref}>
            <button
                type="button"
                className="border border-gray-300 focus:outline-none focus:border-indigo-500 rounded-md px-3 py-1.5 w-full text-left bg-white"
                onClick={() => setOpen(!open)}
            >

                {open ? (
                    <input
                        type="text"
                        placeholder="Search..."
                        className="h-fit w-32 focus:outline-none"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchTerm}
                        autoFocus
                    />
                ) : selected ? selected.label : <span className="text-gray-400">{options.length > 0 ? "Select " + placeholder : "No option available"}</span>}
                <svg className="w-4 h-4 float-right mt-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
            </button>
            {open && options.length > 0 && (
                <ul className={"absolute z-10 mt-1 w-fit max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg" + (optionUp ? " bottom-[105%]" : "")}>
                    {options.map(opt => {
                        if (searchTerm && !opt.label.toLowerCase().includes(searchTerm.toLowerCase())) {
                            return null
                        }
                        return (
                            <li
                                key={opt.value}
                                className={`px-3 py-1.5 cursor-pointer whitespace-nowrap hover:bg-indigo-100 border-b border-gray-200 ${opt.value === value ? 'bg-indigo-50' : ''}`}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                            >
                                {opt.label}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default CustomDropdown;