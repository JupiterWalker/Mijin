
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Type, Lock, Unlock, Minus, Plus, Check, CornerDownLeft, X, ChevronsUp, ChevronsDown } from 'lucide-react';
import { EnvironmentLabel, EnvironmentZone } from '../../types';
import { useTranslation } from '../../i18n';

interface EnvironmentContextMenuProps {
  data: EnvironmentZone | EnvironmentLabel;
  type: 'zone' | 'label';
  position: { x: number, y: number } | null;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onOrder?: (id: string, direction: 'front' | 'back') => void;
  isConfirmingDelete?: boolean;
  setIsConfirmingDelete?: (val: boolean) => void;
}

export const EnvironmentContextMenu: React.FC<EnvironmentContextMenuProps> = ({
  data,
  type,
  position,
  onUpdate,
  onDelete,
  onClose,
  onOrder,
  isConfirmingDelete = false,
  setIsConfirmingDelete = () => {}
}) => {
  const { t } = useTranslation();
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  const [localText, setLocalText] = useState(type === 'zone' ? (data as EnvironmentZone).label : (data as EnvironmentLabel).text);
  const [localSize, setLocalSize] = useState(type === 'label' ? (data as EnvironmentLabel).fontSize : 12);

  useEffect(() => {
    setLocalText(type === 'zone' ? (data as EnvironmentZone).label : (data as EnvironmentLabel).text);
    if (type === 'label') {
      setLocalSize((data as EnvironmentLabel).fontSize);
    }
  }, [data, type]);

  if (!position) return null;

  // Consistent color palette with Node menu
  const colors = ["#1a1a1a", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];
  const currentColor = data.color || (type === 'zone' ? "rgba(59, 130, 246, 0.1)" : "#475569");
  const isLocked = type === 'zone' ? (data as EnvironmentZone).isLocked : false;

  const handleTextChange = (val: string) => {
    setLocalText(val);
    if (type === 'zone') {
      onUpdate({ ...data, label: val });
    } else {
      onUpdate({ ...data, text: val });
    }
  };

  const handleSizeChange = (val: number) => {
    const newSize = Math.max(8, Math.min(200, val));
    setLocalSize(newSize);
    if (type === 'label') {
      onUpdate({ ...data, fontSize: newSize });
    }
  };

  const handleColorChange = (color: string) => {
    onUpdate({ ...data, color });
  };

  // Alignment styles based on type
  // Label: Left aligned (Start) - Shifted so arrow aligns with x
  // Arrow center is ~17px from left (12px margin + 5px half-width). So translate -17px.
  const isLabel = type === 'label';
  const containerStyle: React.CSSProperties = isLabel ? {
    left: position.x,
    top: position.y - 10,
    transform: 'translate(-17px, -100%)', 
    alignItems: 'flex-start'
  } : {
    left: position.x,
    top: position.y - 10,
    transform: 'translate(-50%, -100%)', // Centered
    alignItems: 'center'
  };

  const arrowClass = isLabel ? 'ml-3' : ''; // Offset arrow for label mode

  return (
    <div 
      className="absolute z-50 pointer-events-none flex flex-col" 
      style={containerStyle}
    >
      <div className={`backdrop-blur-md bg-white/95 border border-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-2xl p-0.5 pointer-events-auto flex items-center animate-in zoom-in-95 fade-in duration-200 w-auto transition-all ${isConfirmingDelete ? 'border-red-400 bg-red-50/95' : ''}`}>
        
        {/* Section 1: Text Input */}
        <div className="flex items-center pl-2 pr-1 py-0.5">
          <Type className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
          <input 
            autoFocus
            className={`px-0 py-1 text-xs font-bold bg-transparent border-none focus:ring-0 w-24 outline-none text-slate-800 placeholder-slate-400 ${isConfirmingDelete ? 'opacity-50 pointer-events-none' : ''}`}
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Text..."
            onKeyDown={(e) => { if(e.key === 'Enter') onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isConfirmingDelete}
          />
        </div>
        
        <div className="w-px h-5 mx-0.5 bg-slate-200" />
        
        {/* Section 2: Colors */}
        <div className={`flex gap-1.5 items-center px-2 ${isConfirmingDelete ? 'opacity-30 pointer-events-none' : ''}`}>
          {colors.map((c, idx) => (
            <button 
              key={idx}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleColorChange(c)}
              className={`w-4 h-4 rounded-lg transition-all hover:scale-110 hover:shadow-lg ${currentColor === c ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105 shadow-indigo-100' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
          
          <div className="w-px h-5 mx-0.5 bg-slate-200" />

          {/* Custom Color */}
          <div className="relative flex items-center">
             <button 
               onMouseDown={(e) => e.stopPropagation()}
               onClick={() => colorInputRef.current?.click()}
               className="w-6 h-6 rounded-xl border-2 border-slate-200 transition-all hover:scale-110 shadow-sm"
               style={{ backgroundColor: currentColor || "#fff" }}
               title={t('context.custom_color')}
             />
             <input 
               ref={colorInputRef}
               type="color"
               className="absolute opacity-0 w-0 h-0"
               onChange={(e) => handleColorChange(e.target.value)}
             />
          </div>
        </div>

        <div className="w-px h-5 mx-0.5 bg-slate-200" />

        {/* Section 3: Type Specific (Size for Label, Lock & Layers for Zone) */}
        {type === 'label' && (
          <div className={`flex items-center gap-1 px-1 ${isConfirmingDelete ? 'opacity-30 pointer-events-none' : ''}`}>
            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleSizeChange(localSize - 2)}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input 
              type="number"
              value={localSize}
              onChange={(e) => handleSizeChange(parseInt(e.target.value) || 12)}
              className="w-8 text-center text-xs font-mono font-bold bg-transparent border-none focus:ring-0 outline-none text-slate-600 appearance-none m-0 p-0"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleSizeChange(localSize + 2)}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        {type === 'zone' && (
           <div className={`flex items-center px-1 gap-1 ${isConfirmingDelete ? 'opacity-30 pointer-events-none' : ''}`}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onOrder?.(data.id, 'front')}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                title="Bring to Front"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onOrder?.(data.id, 'back')}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                title="Send to Back"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 mx-0.5 bg-slate-200" />
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onUpdate({ ...data, isLocked: !isLocked })}
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${isLocked ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                title={isLocked ? "Unlock" : "Lock"}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
           </div>
        )}

        <div className="w-px h-5 mx-0.5 bg-slate-200" />

        {/* Section 4: Delete */}
        <div className="flex items-center px-1 pr-1.5">
          {!isConfirmingDelete ? (
            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200">
              <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { onDelete(data.id); onClose(); }}
                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Check className="w-3 h-3" /> {t('context.confirm')} <CornerDownLeft className="w-3 h-3 opacity-70" />
              </button>
              <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setIsConfirmingDelete(false)}
                className="p-1.5 rounded-xl transition-all text-slate-500 hover:bg-slate-200"
                title={t('context.cancel')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
      
      {/* Arrow */}
      <div className={`w-2.5 h-2.5 bg-white border-r border-b border-slate-200 rotate-45 -mt-1.5 shadow-[2px_2px_5px_rgba(0,0,0,0.02)] ${arrowClass} ${isConfirmingDelete ? 'bg-red-50 border-red-400' : ''}`}></div>
    </div>
  );
};
