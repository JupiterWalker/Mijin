import React, { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  error?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  icon, 
  actions, 
  error, 
  defaultOpen = false, 
  children 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-4 transition-all">
      <div 
        className={`flex justify-between items-center p-3 cursor-pointer select-none transition-colors ${isOpen ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2 text-slate-700 font-semibold text-sm">
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>{actions}</div>
      </div>
      {isOpen && (
        <div className="p-4 bg-white space-y-3 animate-in fade-in duration-300">
          {error && (
            <div className="bg-red-50 text-red-600 text-[10px] p-2 rounded border border-red-200 flex items-start animate-in slide-in-from-top-1">
              <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
