import React from 'react';
import { Trash2 } from 'lucide-react';
import { GraphLink } from '../../types';

interface LinkControlsProps {
  link: GraphLink;
  position: { x: number, y: number } | null;
  isDirectorMode: boolean;
  onDelete: () => void;
}

export const LinkControls: React.FC<LinkControlsProps> = ({
  link,
  position,
  isDirectorMode,
  onDelete
}) => {
  if (!position) return null;

  return (
    <div 
      className="absolute z-50 pointer-events-auto flex items-center justify-center animate-in zoom-in-95 fade-in duration-200" 
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }} 
        className={`p-2 rounded-full shadow-xl border text-red-500 hover:scale-110 active:scale-95 transition-all group ${isDirectorMode ? 'bg-slate-800 border-slate-700 hover:bg-red-900/30' : 'bg-white border-slate-200 hover:bg-red-50'}`} 
        title="删除连接 (Del)"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};
