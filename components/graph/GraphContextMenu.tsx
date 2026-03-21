import React, { useState, useRef, useEffect } from 'react';
import { Link as LinkIcon, Database, Trash2, Check, CornerDownLeft, X, Trash, Plus } from 'lucide-react';
import { GraphNode } from '../../types';
import { useTranslation } from '../../i18n';

interface GraphContextMenuProps {
  node: GraphNode;
  position: { x: number, y: number } | null;
  isDirectorMode: boolean;
  isConfirmingDelete: boolean;
  setIsConfirmingDelete: (val: boolean) => void;
  onUpdate: (node: GraphNode) => void;
  onDelete: (id: string) => void;
  onStartLinking: () => void;
  onClose: () => void;
}

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  node,
  position,
  isDirectorMode,
  isConfirmingDelete,
  setIsConfirmingDelete,
  onUpdate,
  onDelete,
  onStartLinking,
  onClose
}) => {
  const { t } = useTranslation();
  const [editingLabel, setEditingLabel] = useState(node.label);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [newMetaKey, setNewMetaKey] = useState("");
  const [newMetaValue, setNewMetaValue] = useState("");
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync label state if node changes externally
  useEffect(() => {
    setEditingLabel(node.label);
  }, [node.id, node.label]);

  if (!position) return null;

  const groupColors = ["#1a1a1a", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];
  const currentNodeColor = node.apparence?.fill || groupColors[(node.group || 0) % groupColors.length];

  const handleAddMeta = () => {
    if (!newMetaKey) return;
    const currentMeta = node.meta_data || {};
    onUpdate({ ...node, meta_data: { ...currentMeta, [newMetaKey]: newMetaValue } });
    setNewMetaKey(""); 
    setNewMetaValue("");
  };

  const handleRemoveMeta = (key: string) => {
    const currentMeta = { ...node.meta_data };
    delete currentMeta[key];
    onUpdate({ ...node, meta_data: currentMeta });
  };

  return (
    <div 
      className="absolute z-50 pointer-events-none flex flex-col items-center" 
      style={{ left: position.x, top: position.y - 30, transform: 'translate(-50%, -100%)' }}
    >
      <div className={`backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.15)] border rounded-2xl p-0.5 pointer-events-auto flex flex-col items-stretch animate-in zoom-in-95 fade-in duration-200 w-auto min-w-[260px] transition-all ${isConfirmingDelete ? 'border-red-400 bg-red-50/95' : (isDirectorMode ? 'bg-slate-800/95 border-slate-700 ring-1 ring-white/10' : 'bg-white/95 border-slate-200')}`}>
        <div className="flex items-center gap-1 p-0.5">
          {/* Label Editor */}
          <input 
            autoFocus 
            className={`px-2 py-1 text-xs font-bold bg-transparent border-none focus:ring-0 w-20 outline-none ${isDirectorMode ? 'text-slate-100' : 'text-slate-800'} ${isConfirmingDelete ? 'opacity-50' : ''}`} 
            value={editingLabel} 
            disabled={isConfirmingDelete} 
            onChange={(e) => { 
              setEditingLabel(e.target.value); 
              onUpdate({ ...node, label: e.target.value }); 
            }} 
            onKeyDown={(e) => { if(e.key === 'Enter') onClose(); }} 
            onMouseDown={(e) => e.stopPropagation()} 
          />
          
          <div className={`w-px h-5 mx-0.5 ${isDirectorMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
          
          {/* Color Swatches */}
          <div className={`flex gap-1.5 items-center px-1 ${isConfirmingDelete ? 'opacity-30 pointer-events-none' : ''}`}>
            {groupColors.map((color, idx) => (
              <button 
                key={idx} 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={() => onUpdate({ ...node, group: idx, apparence: { fill: color, stroke: "#b3b3b3" } })} 
                className={`w-4 h-4 rounded-lg transition-all hover:scale-110 hover:shadow-lg ${currentNodeColor?.toLowerCase() === color.toLowerCase() ? (isDirectorMode ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-800 scale-105 shadow-indigo-900/20' : 'ring-2 ring-indigo-500 ring-offset-2 scale-105 shadow-indigo-100') : ''}`} 
                style={{ backgroundColor: color }} 
              />
            ))}
            <div className={`w-px h-5 mx-0.5 ${isDirectorMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
            
            {/* Custom Color Picker */}
            <div className="relative flex items-center">
              <button 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={() => colorInputRef.current?.click()} 
                className={`w-6 h-6 rounded-xl border-2 transition-all hover:scale-110 shadow-sm ${isDirectorMode ? 'border-white/10' : 'border-slate-200'}`} 
                style={{ backgroundColor: currentNodeColor || "#fff" }} 
                title={t('context.custom_color')} 
              />
              <input 
                ref={colorInputRef} 
                type="color" 
                className="absolute opacity-0 w-0 h-0 pointer-events-none" 
                value={currentNodeColor?.startsWith('#') ? currentNodeColor : "#000000"} 
                onChange={(e) => { 
                  const color = e.target.value; 
                  onUpdate({ ...node, apparence: { ...node.apparence, fill: color, stroke: color } }); 
                }} 
              />
            </div>
          </div>
          
          <div className={`w-px h-5 mx-0.5 ${isDirectorMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
          
          {/* Action Buttons */}
          <div className="flex gap-0.5 items-center">
            {!isConfirmingDelete ? (
              <>
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); onStartLinking(); }} 
                  className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${isDirectorMode ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} 
                  title={t('context.create_link')}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); setIsMetaExpanded(!isMetaExpanded); }} 
                  className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${ isMetaExpanded ? (isDirectorMode ? 'text-emerald-400 bg-slate-700' : 'text-emerald-600 bg-emerald-50') : (isDirectorMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50') }`} 
                  title={t('context.edit_meta')}
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} 
                  className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${isDirectorMode ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`} 
                  title={t('context.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200 pr-1">
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id); onClose(); }} 
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <Check className="w-3 h-3" /> {t('context.confirm')} <CornerDownLeft className="w-3 h-3 opacity-70" />
                </button>
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} 
                  className={`p-1.5 rounded-xl transition-all ${isDirectorMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-200'}`} 
                  title={t('context.cancel')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Metadata Editor */}
        {isMetaExpanded && !isConfirmingDelete && (
          <div className={`border-t p-2 space-y-2 animate-in slide-in-from-bottom-2 duration-200 max-h-48 overflow-y-auto custom-scrollbar ${isDirectorMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>{t('context.meta_title')}</span>
            </div>
            <div className="space-y-1">
              {Object.entries(node.meta_data || {}).map(([k, v]) => (
                <div key={k} className={`flex items-center gap-1.5 p-1 rounded-md border group ${isDirectorMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-mono font-bold text-slate-500 w-14 truncate" title={k}>{k}:</span>
                  <span className={`text-[10px] flex-1 truncate ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`}>{String(v)}</span>
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={() => handleRemoveMeta(k)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                    <Trash className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-1.5 flex flex-col gap-1">
              <div className="flex gap-1">
                <input onMouseDown={(e) => e.stopPropagation()} className={`text-[9px] rounded px-1.5 py-0.5 flex-1 outline-none focus:ring-1 focus:ring-indigo-500 ${isDirectorMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200'}`} placeholder={t('context.key')} value={newMetaKey} onChange={(e) => setNewMetaKey(e.target.value)} />
                <input onMouseDown={(e) => e.stopPropagation()} className={`text-[9px] rounded px-1.5 py-0.5 flex-1 outline-none focus:ring-1 focus:ring-indigo-500 ${isDirectorMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200'}`} placeholder={t('context.value')} value={newMetaValue} onChange={(e) => setNewMetaValue(e.target.value)} />
                <button onMouseDown={(e) => e.stopPropagation()} onClick={handleAddMeta} className="bg-indigo-600 text-white rounded p-1 hover:bg-indigo-700 transition-colors">
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={`w-2.5 h-2.5 border-r border-b rotate-45 -mt-1.5 shadow-[2px_2px_5px_rgba(0,0,0,0.02)] transition-colors ${isConfirmingDelete ? 'bg-red-50 border-red-400' : (isDirectorMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}`} />
    </div>
  );
};
