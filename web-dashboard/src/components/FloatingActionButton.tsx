'use client';

import { useState, useRef, useEffect } from 'react';

interface FloatingActionButtonProps {
  onAddService: () => void;
}

export default function FloatingActionButton({ onAddService }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddService = () => {
    onAddService();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Popup Menu */}
      <div
        ref={menuRef}
        className={`absolute bottom-16 right-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 transform transition-all duration-300 ease-in-out ${
          isOpen 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
        }`}
      >
        <div className="py-2">
          <button
            onClick={handleAddService}
            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3 transition-colors duration-200"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Add New Service</div>
              <div className="text-xs text-gray-500">Create a new service offering</div>
            </div>
          </button>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          group relative w-14 h-14 bg-blue-600 hover:bg-blue-700 
          rounded-full shadow-lg hover:shadow-xl 
          flex items-center justify-center
          transform transition-all duration-300 ease-in-out
          ${isHovered ? 'scale-110' : 'scale-100'}
          ${isOpen ? 'rotate-45' : 'rotate-0'}
          focus:outline-none focus:ring-4 focus:ring-blue-300
          active:scale-95
        `}
        aria-label="Add service"
      >
        {/* Plus Icon */}
        <svg
          className={`w-6 h-6 text-white transition-transform duration-300 ${
            isOpen ? 'rotate-0' : 'rotate-0'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>

        {/* Ripple Effect */}
        <div className={`
          absolute inset-0 rounded-full bg-white opacity-0
          transform scale-0 transition-all duration-300
          ${isHovered ? 'opacity-20 scale-110' : 'opacity-0 scale-100'}
        `} />

        {/* Tooltip */}
        <div className={`
          absolute right-16 top-1/2 transform -translate-y-1/2
          bg-gray-900 text-white text-sm px-3 py-2 rounded-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none whitespace-nowrap
          after:content-[''] after:absolute after:top-1/2 after:left-full
          after:-translate-y-1/2 after:border-4 after:border-transparent
          after:border-l-gray-900
        `}>
          Add Service
        </div>
      </button>
    </div>
  );
}
