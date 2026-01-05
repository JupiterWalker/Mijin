import React from 'react';
import { Clapperboard, Settings2, X, Sparkles, Link as LinkIcon, Box, Activity, Flag, History, Plus, Layers, FastForward, Trash2, MousePointer2, Infinity as InfinityIcon, Play, Check } from 'lucide-react';
import { EventSequence, GraphData, ThemeConfig, ParallelStep, AtomicStep, InitialNodeState } from '../../types';
import { DirectorStepCard } from './DirectorStepCard';
import { GraphCanvasHandle } from '../GraphCanvas';

interface DirectorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  graphData: GraphData;
  themeData: ThemeConfig;
  draftEventData: EventSequence;
  setDraftEventData: (data: EventSequence) => void;
  directorPicking: 'source' | 'target' | null;
  isContinuousPick: boolean;
  onStartPick: (continuous?: boolean, groupIndex?: number) => void;
  isDirectorConfigOpen: boolean;
  setIsDirectorConfigOpen: (val: boolean) => void;
  directorDefaults: any;
  setDirectorDefaults: (val: any) => void;
  isDraftDifferent: boolean;
  onCommit: () => void;
  onRunFullAnimation: () => void;
  canvasRef: React.RefObject<GraphCanvasHandle>;
}

export const DirectorSidebar: React.FC<DirectorSidebarProps> = ({
  isOpen,
  onClose,
  graphData,
  themeData,
  draftEventData,
  setDraftEventData,
  directorPicking,
  isContinuousPick,
  onStartPick,
  isDirectorConfigOpen,
  setIsDirectorConfigOpen,
  directorDefaults,
  setDirectorDefaults,
  isDraftDifferent,
  onCommit,
  onRunFullAnimation,
  canvasRef
}) => {
  if (!isOpen) return null;

  // -- Helper functions (moved from Editor.tsx) --
  const addParallelGroup = () => {
    const newGroup: ParallelStep = { type: 'parallel', label: 'Concurrent Actions', steps: [] };
    const updatedDraft = { ...draftEventData, steps: [...draftEventData.steps, newGroup] };
    setDraftEventData(updatedDraft);
  };

  const deleteStep = (index: number, subIndex?: number) => {
    const updatedDraft = { ...draftEventData };
    if (subIndex !== undefined) {
      const group = updatedDraft.steps[index] as ParallelStep;
      group.steps.splice(subIndex, 1);
    } else {
      updatedDraft.steps.splice(index, 1);
    }
    setDraftEventData(updatedDraft);
  };

  const updateStepProp = (index: number, prop: string, value: any, subIndex?: number) => {
    const updatedDraft = { ...draftEventData };
    const step: any = subIndex !== undefined 
      ? (updatedDraft.steps[index] as ParallelStep).steps[subIndex]
      : updatedDraft.steps[index];
    step[prop] = value;
    setDraftEventData(updatedDraft);
  };

  const addInitNode = () => {
    const firstNode = graphData.nodes[0]?.id || "1";
    const newInit: InitialNodeState = { id: firstNode, nodeState: "loading" };
    const updated = { ...draftEventData, initNodes: [...(draftEventData.initNodes || []), newInit] };
    setDraftEventData(updated);
  };

  const removeInitNode = (idx: number) => {
    const updated = { ...draftEventData, initNodes: (draftEventData.initNodes || []).filter((_, i) => i !== idx) };
    setDraftEventData(updated);
  };

  const updateInitNode = (idx: number, prop: string, val: string) => {
    const updated = { ...draftEventData };
    if (updated.initNodes) {
      (updated.initNodes[idx] as any)[prop] = val;
    }
    setDraftEventData(updated);
  };

  return (
    <>
      <div className="p-5 border-b border-white/10 bg-slate-900/50 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center space-x-3 text-purple-400 relative">
          <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <Clapperboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-lg tracking-tight leading-tight uppercase">导演工作台</h2>
            <div className="text-[10px] font-bold text-slate-500 tracking-[0.2em]">DIRECTOR STUDIO v2.4</div>
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsDirectorConfigOpen(!isDirectorConfigOpen)}
              className={`p-1.5 rounded-lg transition-all ml-1 border ${isDirectorConfigOpen ? 'bg-purple-900/50 text-purple-300 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'text-slate-500 border-transparent hover:text-purple-400 hover:bg-white/5'}`}
              title="导演模式默认配置"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {isDirectorConfigOpen && (
              <div className="absolute top-full left-0 mt-3 w-64 bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 p-5 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-400" /> 默认动作配置</span>
                  <button onClick={() => setIsDirectorConfigOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <LinkIcon className="w-3 h-3" /> 默认连线样式
                    </label>
                    <select 
                      className="w-full text-[11px] bg-slate-800 border border-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-300"
                      value={directorDefaults.linkStyle}
                      onChange={(e) => setDirectorDefaults((prev: any) => ({ ...prev, linkStyle: e.target.value }))}
                    >
                      <option value="">(无/默认)</option>
                      {Object.keys(themeData.linkStyles).map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <Box className="w-3 h-3 text-indigo-400" /> 默认目标状态 (Impact)
                    </label>
                    <select 
                      className="w-full text-[11px] bg-slate-800 border border-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-300"
                      value={directorDefaults.targetState}
                      onChange={(e) => setDirectorDefaults((prev: any) => ({ ...prev, targetState: e.target.value }))}
                    >
                      <option value="">(无/不改变)</option>
                      {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <Activity className="w-3 h-3 text-amber-500" /> 默认处理状态 (Processing)
                    </label>
                    <select 
                      className="w-full text-[11px] bg-slate-800 border border-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-300"
                      value={directorDefaults.processingState}
                      onChange={(e) => setDirectorDefaults((prev: any) => ({ ...prev, processingState: e.target.value }))}
                    >
                      <option value="">(无/跳过)</option>
                      {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <Flag className="w-3 h-3 text-emerald-500" /> 默认结尾状态 (Final)
                    </label>
                    <select 
                      className="w-full text-[11px] bg-slate-800 border border-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-300"
                      value={directorDefaults.finalState}
                      onChange={(e) => setDirectorDefaults((prev: any) => ({ ...prev, finalState: e.target.value }))}
                    >
                      <option value="">(无/跳过)</option>
                      {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"><X className="w-5 h-5" /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-900/30">
        {/* Initial States */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> 初始状态设置
            </h3>
            <button onClick={addInitNode} className="p-1.5 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-all border border-transparent hover:border-indigo-500/30">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {(draftEventData.initNodes || []).map((init, idx) => (
              <div key={init.id + idx} className="bg-slate-800/40 border border-white/5 rounded-xl p-2.5 flex items-center gap-2 shadow-lg ring-1 ring-white/5 animate-in slide-in-from-right-2 duration-200">
                <select 
                  className="text-[11px] font-black bg-slate-900 border-white/10 rounded-lg px-2 py-1.5 focus:ring-0 outline-none flex-1 text-slate-200"
                  value={init.id}
                  onChange={(e) => updateInitNode(idx, 'id', e.target.value)}
                >
                  {graphData.nodes.map(n => <option key={n.id} value={n.id} className="bg-slate-900">{n.label}</option>)}
                </select>
                <span className="text-[10px] text-slate-600 font-black">IS</span>
                <select 
                  className="text-[11px] font-black bg-purple-900/30 text-purple-300 border-purple-500/20 rounded-lg px-2 py-1.5 focus:ring-0 outline-none flex-1"
                  value={init.nodeState}
                  onChange={(e) => updateInitNode(idx, 'nodeState', e.target.value)}
                >
                  {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                </select>
                <button onClick={() => removeInitNode(idx)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-5 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> 剧本时间轴
            </h3>
          </div>

          <div className="space-y-5">
            {draftEventData.steps.map((step, idx) => (
              <div key={idx} className="relative pl-7">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-800 to-slate-800/0 -z-10"></div>
                <div className={`absolute left-0 top-4 w-6 h-6 rounded-full bg-slate-900 border-2 flex items-center justify-center text-[10px] font-black shadow-lg ${step.type === 'parallel' ? 'border-purple-500/50 text-purple-400' : 'border-slate-700 text-slate-500'}`}>
                  {idx + 1}
                </div>

                {step.type === 'parallel' ? (
                  <div className="bg-purple-900/10 border-2 border-dashed border-purple-500/20 rounded-2xl p-4 space-y-4 relative group/parallel shadow-inner ring-1 ring-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-full border border-purple-500/30 uppercase tracking-[0.1em] flex items-center gap-1.5">
                          <FastForward className="w-3 h-3" /> 并行组
                        </span>
                        <input 
                          className="text-[11px] font-black text-slate-400 bg-transparent border-none focus:ring-0 p-0 placeholder-slate-600" 
                          value={step.label || ""} 
                          placeholder="Group Label"
                          onChange={(e) => updateStepProp(idx, 'label', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onStartPick(false, idx)} className="p-1.5 text-purple-400 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/5" title="Add Step to Group">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteStep(idx)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {(step as ParallelStep).steps.map((subStep, subIdx) => (
                        <DirectorStepCard 
                          key={subIdx} 
                          step={subStep as AtomicStep} 
                          index={idx} 
                          subIndex={subIdx}
                          isDirectorMode={true}
                          graphData={graphData}
                          themeData={themeData}
                          onRunStep={(s) => canvasRef.current?.runSingleStep(s)}
                          onDelete={deleteStep}
                          onUpdate={updateStepProp}
                        />
                      ))}
                      {(step as ParallelStep).steps.length === 0 && (
                        <div className="text-[10px] text-slate-600 font-bold text-center py-6 border border-dashed border-white/5 rounded-2xl bg-black/20 italic">
                          并行组内暂无动作，点击上方 + 添加
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <DirectorStepCard 
                    step={step as AtomicStep} 
                    index={idx}
                    isDirectorMode={true}
                    graphData={graphData}
                    themeData={themeData}
                    onRunStep={(s) => canvasRef.current?.runSingleStep(s)}
                    onDelete={deleteStep}
                    onUpdate={updateStepProp}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-6">
            <button 
              onClick={() => onStartPick(false)} 
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed transition-all group ${directorPicking === 'source' && !isContinuousPick ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 text-slate-500'}`}
            >
              <MousePointer2 className="w-6 h-6 mb-2 transition-transform group-hover:scale-110" />
              <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">新增<br/>单步动作</span>
            </button>

            <button 
              onClick={() => onStartPick(true)} 
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed transition-all group ${isContinuousPick ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 text-slate-500'}`}
            >
              <div className="relative mb-2">
                <MousePointer2 className="w-6 h-6 transition-transform group-hover:scale-110" />
                <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-slate-900">
                  <InfinityIcon className="w-2.5 h-2.5" />
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">连续<br/>新增单步</span>
            </button>

            <button 
              onClick={addParallelGroup} 
              className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-500 group"
            >
              <FastForward className="w-6 h-6 mb-2 transition-transform group-hover:scale-110" />
              <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">新增<br/>并行容器</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border-t border-white/10 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onRunFullAnimation} 
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 rounded-2xl font-black text-sm flex justify-center items-center transition-all active:scale-[0.97] border border-white/5 shadow-lg group"
          >
            <Play className="w-4 h-4 mr-2 fill-current group-hover:text-purple-400 transition-colors" />
            全剧试演
          </button>
          <button 
            onClick={onCommit}
            disabled={!isDraftDifferent}
            className={`flex-1 py-3.5 rounded-2xl font-black text-sm flex justify-center items-center transition-all shadow-xl active:scale-[0.97] border ${isDraftDifferent ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-purple-900/40' : 'bg-slate-800 text-slate-600 border-transparent cursor-not-allowed'}`}
          >
            <Check className="w-4 h-4 mr-2" />
            提交发布
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] font-black px-1 uppercase tracking-[0.15em]">
          <div className="flex items-center gap-2 text-slate-500">
             production READY
          </div>
          {isDraftDifferent ? (
             <span className="text-amber-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 草稿未同步</span>
          ) : (
             <span className="flex items-center gap-1.5 text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> 已锁定</span>
          )}
        </div>
      </div>
    </>
  );
};
