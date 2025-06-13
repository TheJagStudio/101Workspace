import { useState } from 'react'
import {
    format, addDays, startOfMonth, endOfMonth, subMonths, addMonths, getDaysInMonth, getDay, isSameDay, isBefore, isAfter, startOfDay
} from 'date-fns';

import { CalculatorIcon, ChevronLeft, ChevronRight } from 'lucide-react';


const DateInputGroup = ({ startDate, endDate, onFocus }) => {
    const dateFormat = "MM/dd/yyyy";

    return (
        <div className="flex items-center border border-gray-300 rounded-md">
            <input
                type="text"
                value={startDate ? format(startDate, dateFormat) : ''}
                onFocus={onFocus}
                readOnly
                className="p-1 w-26 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-l-md"
                placeholder="Start Date"
            />
            <span className="px-1 text-gray-500">{">>"}</span>
            <input
                type="text"
                value={endDate ? format(endDate, dateFormat) : ''}
                onFocus={onFocus}
                readOnly
                className="p-1 w-26 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="End Date"
            />
            <div className="p-2 text-gray-500">
                <CalculatorIcon className="h-5 w-5" />
            </div>
        </div>
    );
};

const CalendarDropdown = ({
    onClose,
    predefinedRanges,
    onPredefinedRangeSelect,
    currentMonth,
    nextMonth,
    prevMonth,
    startDate,
    endDate,
    onDateSelect
}) => {
    // Dropdown positioning and styling
    return (
        <div
            className="absolute top-full mt-1 w-full min-w-[600px] bg-white border border-gray-200 rounded-md shadow-lg flex z-50"
            onClick={(e) => e.stopPropagation()}
        >
            <PredefinedRanges
                ranges={predefinedRanges}
                onSelect={onPredefinedRangeSelect}
            />
            <DualCalendarView
                currentMonth={currentMonth}
                nextMonth={nextMonth}
                prevMonth={prevMonth}
                startDate={startDate}
                endDate={endDate}
                onDateSelect={onDateSelect}
            />
            {/* You might want a close button or click outside to close */}
        </div>
    );
};

const PredefinedRanges = ({ ranges, onSelect }) => {
    const [selectedRange, setSelectedRange] = useState(null);
    return (
        <div className="w-1/4 p-1 border-r border-gray-200 max-h-[250px] overflow-y-auto">
            <ul className="space-y-2">
                {ranges.map((item) => (
                    <li key={item.label}>
                        <button
                            onClick={() => {
                                onSelect(item.range);
                                setSelectedRange(item.label);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm rounded-md focus:outline-none ${
                                selectedRange === item.label
                                    ? 'bg-indigo-500 text-white'
                                    : 'text-gray-700 hover:bg-indigo-500 hover:text-white'
                            }`}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const DualCalendarView = ({
    currentMonth, // Date object for the left calendar's month
    prevMonth,
    nextMonth,
    onDateSelect,
    startDate,
    endDate
}) => {
    const rightMonth = addMonths(currentMonth, 1);

    return (
        <div className="flex-1 p-4">
            <div className="flex justify-between items-center mb-4">
                {/* Month navigation - these would typically call functions to change currentMonth */}
                <button onClick={()=>{
                    for (let i = 0; i < 12; i++) {
                        setCurrentMonth(subMonths(currentMonth, 1));
                        prevMonth();
                    }
                }} className="p-1 w-7 relative hover:bg-gray-100 rounded-full focus:outline-none flex items-center">
                    <ChevronLeft className="h-5 w-5 text-gray-600 -translate-x-1" />
                    <ChevronLeft className="h-5 w-5 text-gray-600 absolute top-1 left-1.5" />
                </button>
                <button onClick={() => {
                    prevMonth();
                    setCurrentMonth(prevMonth());
                }} className="p-1 hover:bg-gray-100 rounded-full focus:outline-none">
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h3 className="text-lg font-semibold text-gray-800">
                    {format(currentMonth, 'MMM yyyy')}
                </h3>
                {/* Separator or spacer for the two month names */}
                <h3 className="text-lg font-semibold text-gray-800">
                    {format(rightMonth, 'MMM yyyy')}
                </h3>
                <button onClick={() => {
                    nextMonth();
                    setCurrentMonth(nextMonth());
                    }} className="p-1 hover:bg-gray-100 rounded-full focus:outline-none">
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
                <button onClick={()=>{
                    // change to next year
                    for (let i = 0; i < 12; i++) {
                        setCurrentMonth(addMonths(currentMonth, 1));
                        nextMonth();
                    }
                }} className="p-1 w-7 relative hover:bg-gray-100 rounded-full focus:outline-none flex items-center">
                    <ChevronRight className="h-5 w-5 text-gray-600 absolute top-1 left-2" />
                    <ChevronRight className="h-5 w-5 text-gray-600 -translate-x-0.5" />
                </button>
            </div>
            <div className="flex space-x-4">
                <MonthView
                    monthDate={currentMonth}
                    onDateSelect={onDateSelect}
                    startDate={startDate}
                    endDate={endDate}
                />
                <MonthView
                    monthDate={rightMonth}
                    onDateSelect={onDateSelect}
                    startDate={startDate}
                    endDate={endDate}
                />
            </div>
        </div>
    );
};

const MonthView = ({ monthDate, onDateSelect, startDate, endDate }) => {
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDayOfMonth = getDay(startOfMonth(monthDate)); // 0 (Sun) - 6 (Sat)
    const today = startOfDay(new Date());

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="p-1.5 text-center"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const isSelectedStart = startDate && isSameDay(currentDate, startDate);
        const isSelectedEnd = endDate && isSameDay(currentDate, endDate);
        const isInRange = startDate && endDate && isAfter(currentDate, startDate) && isBefore(currentDate, endDate);
        const isToday = isSameDay(currentDate, today);

        let cellClasses = "h-6 w-6 pt-0.5 text-center text-sm rounded-full cursor-pointer";

        if (isToday && !isSelectedStart && !isSelectedEnd && !isInRange) {
            cellClasses += " bg-gray-200 text-gray-800";
        } else {
            cellClasses += " hover:bg-indigo-100";
        }

        if (isSelectedStart || isSelectedEnd) {
            cellClasses += " bg-indigo-600 text-white hover:bg-indigo-700";
        } else if (isInRange) {
            cellClasses += " bg-indigo-200 text-indigo-700 hover:bg-indigo-300";
        } else {
            cellClasses += " text-gray-700";
        }

        days.push(
            <div
                key={day}
                className={cellClasses}
                onClick={() => onDateSelect(currentDate)}
            >
                {day}
            </div>
        );
    }

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div className="w-1/2">
            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayLabels.map(label => (
                    <div key={label} className="text-center text-xs font-medium text-gray-500">
                        {label}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days}
            </div>
        </div>
    );
};



const Calendar = ({startDate, endDate, setStartDate, setEndDate,dateFormat}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const handleDateSelect = (date) => {
        if (!startDate || (startDate && endDate)) {
            // use dateFormat 
            setStartDate(format(date, dateFormat));
            setEndDate(null);
        } else {
            if (date < startDate) {
                setEndDate(format(startDate, dateFormat));
                setStartDate(format(date, dateFormat));
            } else {
                setEndDate(format(date, dateFormat));
            }
            setIsOpen(false); // Optionally close after selecting a range
        }
    };

    const predefinedRanges = [
        { label: 'Today', range: () => ({ startDate: new Date(), endDate: new Date() }) },
        { label: 'Yesterday', range: () => ({ startDate: addDays(new Date(), -1), endDate: addDays(new Date(), -1) }) },
        { label: 'Last 7 Days', range: () => ({ startDate: addDays(new Date(), -6), endDate: new Date() }) },
        { label: 'Last 30 Days', range: () => ({ startDate: addDays(new Date(), -29), endDate: new Date() }) },
        { label: 'This Month', range: () => ({ startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) }) },
        { label: 'Last Month', range: () => ({ startDate: startOfMonth(subMonths(new Date(), 1)), endDate: endOfMonth(subMonths(new Date(), 1)) }) },
        {label: 'Last 6 Months', range: () => ({ startDate: startOfMonth(subMonths(new Date(), 6)), endDate: endOfMonth(new Date()) }) },
        {label: 'Current Quarter', range: () => {
            const currentDate = new Date();
            const quarter = Math.floor(currentDate.getMonth() / 3);
            const startMonth = quarter * 3;
            const startDate = new Date(currentDate.getFullYear(), startMonth, 1);
            const endDate = endOfMonth(new Date(currentDate.getFullYear(), startMonth + 2, getDaysInMonth(new Date(currentDate.getFullYear(), startMonth + 2))));
            return { startDate, endDate };
        }},
        {label: 'Last Quarter', range: () => {
            const currentDate = new Date();
            const quarter = Math.floor(currentDate.getMonth() / 3) - 1;
            const startMonth = quarter * 3;
            const startDate = new Date(currentDate.getFullYear(), startMonth, 1);
            const endDate = endOfMonth(new Date(currentDate.getFullYear(), startMonth + 2, getDaysInMonth(new Date(currentDate.getFullYear(), startMonth + 2))));
            return { startDate, endDate };
        }},
        {label: 'This Year', range: () => ({ startDate: new Date(new Date().getFullYear(), 0, 1), endDate: new Date(new Date().getFullYear(), 11, 31) }) },
        {label: 'Last Year', range: () => ({ startDate: new Date(new Date().getFullYear() - 1, 0, 1), endDate: new Date(new Date().getFullYear() - 1, 11, 31) }) },
        {label: ' To Date', range: () => ({ startDate: new Date(2019, 1, 1), endDate: new Date() }) }
    ];

    const handlePredefinedRangeSelect = (rangeFunc) => {
        const { startDate: newStart, endDate: newEnd } = rangeFunc();
        setStartDate(format(newStart, dateFormat));
        setEndDate(format(newEnd, dateFormat));
        setIsOpen(false); // Optionally close
    };

    const nextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };


    return (
        <div className="relative font-sans">
            <DateInputGroup
                startDate={startDate}
                endDate={endDate}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && (
                <CalendarDropdown
                    onClose={() => setIsOpen(false)}
                    predefinedRanges={predefinedRanges}
                    onPredefinedRangeSelect={handlePredefinedRangeSelect}
                    currentMonth={currentMonth}
                    nextMonth={nextMonth}
                    prevMonth={prevMonth}
                    startDate={startDate}
                    endDate={endDate}
                    onDateSelect={handleDateSelect}
                />
            )}
        </div>
    );
}

export default Calendar