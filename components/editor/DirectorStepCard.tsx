import React from 'react';
import { Play, Trash2, Type, Link as LinkIcon, Timer, Box, Activity, Flag } from 'lucide-react';
import { AtomicStep, ThemeConfig, GraphData } from '../../types';

interface DirectorStepCardProps {
  step: AtomicStep;
  index: number;
  subIndex?: number;
  isDirectorMode: boolean;
  graphData: GraphData;
  themeData: ThemeConfig;
  onRunStep: (step: AtomicStep) => void;
  onDelete: (index: number, subIndex?: number) => void;
  onUpdate: (index: number, prop: string, value: any, subIndex?: number) => void;
}

export const DirectorStepCard: React.FC<DirectorStepCardProps> = ({
  step,
  index,
  subIndex,
  isDirectorMode,
  graphData,
  themeData,
  onRunStep,
  onDelete,
  onUpdate
}) => {
  return (
    <div className={`border rounded-xl p-3 shadow-sm transition-all group/card relative ${isDirectorMode ? 'bg-slate-800/40 border-slate-700 hover:border-purple-500/50' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isDirectorMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            {subIndex !== undefined ? `${index + 1}.${subIndex + 1}` : index + 1}
          </div>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isDirectorMode ? 'text-purple-400 bg-purple-900/40 border border-purple-500/20' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>Atomic Step</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <button onClick={() => onRunStep(step)} className={`p-1 rounded ${isDirectorMode ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'}`} title="Preview Step">
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
          <button onClick={() => onDelete(index, subIndex)} className={`p-1 rounded ${isDirectorMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-50'}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`p-1.5 rounded border ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <label className="text-[9px] text-slate-500 block mb-0.5 font-bold uppercase tracking-widest">FROM</label>
          <span className={`text-[11px] font-bold truncate block ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`}>{graphData.nodes.find(n => n.id === step.from)?.label || step.from}</span>
        </div>
        <div className={`p-1.5 rounded border ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <label className="text-[9px] text-slate-500 block mb-0.5 font-bold uppercase tracking-widest">TO</label>
          <span className={`text-[11px] font-bold truncate block ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`}>{graphData.nodes.find(n => n.id === step.to)?.label || step.to}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className={`flex items-center gap-2 rounded border px-2 py-1.5 ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <Type className="w-3.5 h-3.5 text-slate-500" />
          <input 
            className={`text-[11px] bg-transparent border-none focus:ring-0 flex-1 p-0 ${isDirectorMode ? 'text-slate-300 placeholder-slate-600' : 'text-slate-700 placeholder-slate-400'}`} 
            value={step.label || ""} 
            placeholder="Action Label (e.g. 'Processing Data')"
            onChange={(e) => onUpdate(index, 'label', e.target.value, subIndex)}
          />
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
             <div className={`flex-1 flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <LinkIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
               <select 
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.linkStyle || ""} 
                 onChange={(e) => onUpdate(index, 'linkStyle', e.target.value, subIndex)}
               >
                 <option value="">Default Link</option>
                 {Object.keys(themeData.linkStyles).map(k => <option key={k} value={k} className={isDirectorMode ? 'bg-slate-800' : ''}>{k}</option>)}
               </select>
             </div>
             <div className={`flex-1 flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Timer className="w-3 h-3 text-slate-500 flex-shrink-0" />
               <input 
                 type="number" step="0.1"
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.duration || 1} 
                 onChange={(e) => onUpdate(index, 'duration', parseFloat(e.target.value), subIndex)}
               />
             </div>
          </div>

          <div className="flex items-center gap-1.5">
             <div className={`flex-[2] flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Box className="w-3 h-3 text-indigo-400 flex-shrink-0" />
               <select 
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.targetNodeState || ""} 
                 onChange={(e) => onUpdate(index, 'targetNodeState', e.target.value, subIndex)}
               >
                 <option value="">Impact: None</option>
                 {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className={isDirectorMode ? 'bg-slate-800' : ''}>{k}</option>)}
               </select>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
             <div className={`flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Activity className="w-3 h-3 text-amber-500 flex-shrink-0" />
               <select 
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.processingNodeState || ""} 
                 onChange={(e) => onUpdate(index, 'processingNodeState', e.target.value, subIndex)}
               >
                 <option value="">Processing: None</option>
                 {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className={isDirectorMode ? 'bg-slate-800' : ''}>{k}</option>)}
               </select>
             </div>
             <div className={`flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Timer className="w-3 h-3 text-slate-500 flex-shrink-0" />
               <input 
                 type="number" step="0.1" placeholder="Dur"
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.durationProcessing || ""} 
                 onChange={(e) => onUpdate(index, 'durationProcessing', parseFloat(e.target.value), subIndex)}
               />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
             <div className={`flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Flag className="w-3 h-3 text-emerald-500 flex-shrink-0" />
               <select 
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.finalNodeState || ""} 
                 onChange={(e) => onUpdate(index, 'finalNodeState', e.target.value, subIndex)}
               >
                 <option value="">Final: None</option>
                 {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className={isDirectorMode ? 'bg-slate-800' : ''}>{k}</option>)}
               </select>
             </div>
             <div className={`flex items-center gap-1.5 rounded border px-2 py-1.5 overflow-hidden ${isDirectorMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               <Timer className="w-3 h-3 text-slate-500 flex-shrink-0" />
               <input 
                 type="number" step="0.1" placeholder="Dur"
                 className={`text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 ${isDirectorMode ? 'text-slate-300' : 'text-slate-700'}`} 
                 value={step.durationFinal || ""} 
                 onChange={(e) => onUpdate(index, 'durationFinal', parseFloat(e.target.value), subIndex)}
               />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
