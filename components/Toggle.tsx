import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
  return (
    <div className="flex items-center cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <div
          className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="ml-3 text-sm font-medium text-slate-700 select-none">{label}</span>}
    </div>
  );
};