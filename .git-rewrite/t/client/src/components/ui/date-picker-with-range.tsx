import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DatePickerWithRangeProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerWithRange({
  value,
  onChange,
  placeholder = "Pick a date range",
  className = ""
}: DatePickerWithRangeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRange = () => {
    if (!value?.from && !value?.to) return placeholder;
    if (value.from && !value.to) return formatDate(value.from);
    if (value.from && value.to) {
      return `${formatDate(value.from)} - ${formatDate(value.to)}`;
    }
    return placeholder;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isDateInRange = (date: Date) => {
    if (!value?.from || !value?.to) return false;
    return date >= value.from && date <= value.to;
  };

  const isDateSelected = (date: Date) => {
    if (!value?.from && !value?.to) return false;
    const dateStr = date.toDateString();
    return dateStr === value?.from?.toDateString() || dateStr === value?.to?.toDateString();
  };

  const handleDateClick = (date: Date) => {
    if (selectingStart || !value?.from) {
      onChange?.({ from: date, to: undefined });
      setSelectingStart(false);
    } else {
      if (date < value.from) {
        onChange?.({ from: date, to: value.from });
      } else {
        onChange?.({ from: value.from, to: date });
      }
      setSelectingStart(true);
      setIsOpen(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className={value?.from || value?.to ? 'text-gray-900' : 'text-gray-500'}>
          {formatRange()}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-100 rounded"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-100 rounded"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Week days */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-xs text-center text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((date, index) => (
                <div key={index} className="h-8 w-8">
                  {date && (
                    <button
                      type="button"
                      onClick={() => handleDateClick(date)}
                      className={`w-full h-full text-xs rounded hover:bg-blue-100 transition-colors ${
                        isDateSelected(date)
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : isDateInRange(date)
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onChange?.(undefined);
                  setSelectingStart(true);
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
              <div className="text-xs text-gray-500">
                {selectingStart || !value?.from ? 'Select start date' : 'Select end date'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Example usage component
export default function DatePickerDemo() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Date Range Picker</h2>
      <DatePickerWithRange
        value={dateRange}
        onChange={setDateRange}
        placeholder="Select date range"
        className="w-full"
      />
      
      {dateRange?.from && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">Selected range:</p>
          <p className="font-medium">
            {dateRange.from.toLocaleDateString()} 
            {dateRange.to && ` - ${dateRange.to.toLocaleDateString()}`}
          </p>
        </div>
      )}
    </div>
  );
}