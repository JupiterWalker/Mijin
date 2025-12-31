
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Toggle } from './Toggle';
import GraphCanvas, { GraphCanvasHandle } from './GraphCanvas';
import { GraphData, EventSequence, GraphNode, GraphLink, ThemeConfig, GraphProject, SimulationAction, AtomicStep, ParallelStep, InitialNodeState } from '../types';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { 
  Settings, Play, AlertCircle, Code2, Activity, 
  RotateCcw, Palette, ArrowLeft, X, Save, ChevronDown, Pipette, 
  Plus, History, Link as LinkIcon, Clapperboard, Trash2, GripVertical, 
  FastForward, Layers, Box, Type, MousePointer2, Check
} from 'lucide-react';

interface EditorProps {
  initialProject: GraphProject;
  onSave: (project: GraphProject) => void;
  onBack: () => void;
}

const JsonTreeEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
  height?: string;
}> = ({ value, onChange, height = "250px" }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const linesInfo = useMemo(() => {
    const lines = value.split('\n');
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
    return lines.map((line, idx) => {
      const match = line.match(hexRegex);
      return {
        lineIndex: idx,
        color: match ? match[0] : null,
      };
    });
  }, [value]);

  const handleColorChange = (lineIdx: number, newColor: string) => {
    const lines = value.split('\n');
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
    lines[lineIdx] = lines[lineIdx].replace(hexRegex, newColor);
    onChange(lines.join('\n'));
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
    }
  };

  return (
    <div className="flex rounded-lg border border-slate-700 bg-[#282c34] overflow-hidden shadow-2xl relative">
      <div 
        ref={gutterRef}
        className="w-8 bg-[#1e2227] border-r border-slate-800 flex flex-col items-center no-scrollbar pointer-events-none"
        style={{ height }}
      >
        <div className="w-full flex flex-col" style={{ height: `${linesInfo.length * 20}px` }}>
          {linesInfo.map((info, idx) => (
            <div 
              key={idx} 
              className="h-[20px] w-full flex items-center justify-center pointer-events-auto"
            >
              {info.color && (
                <div className="relative w-4 h-4 rounded-sm overflow-hidden flex items-center justify-center group">
                  <input
                    type="color"
                    value={info.color.length === 4 ? `#${info.color[1]}${info.color[1]}${info.color[2]}${info.color[2]}${info.color[3]}${info.color[3]}` : info.color}
                    onChange={(e) => handleColorChange(idx, e.target.value)}
                    className="color-swatch-input absolute inset-0 w-8 h-8 -translate-x-2 -translate-y-2 cursor-pointer"
                  />
                  <div 
                    className="absolute inset-0 pointer-events-none rounded-sm border border-white/10"
                    style={{ backgroundColor: info.color }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0" onScroll={handleEditorScroll}>
        <CodeMirror
          value={value}
          height={height}
          theme={oneDark}
          extensions={[json()]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
          }}
          className="text-xs"
        />
      </div>
    </div>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  error?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, actions, error, defaultOpen = false, children }) => {
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

const Editor: React.FC<EditorProps> = ({ initialProject, onSave, onBack }) => {
  const [devMode, setDevMode] = useState(false);
  const [isDirectorMode, setIsDirectorMode] = useState(false);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [projectName, setProjectName] = useState(initialProject.name);
  const [mountGraphData] = useState<GraphData>(JSON.parse(JSON.stringify(initialProject.graphData)));
  const [graphData, setGraphData] = useState<GraphData>(initialProject.graphData);
  const [themeData, setThemeData] = useState<ThemeConfig>(initialProject.themeData);
  const [eventData, setEventData] = useState<EventSequence>(initialProject.eventData);
  const [graphJson, setGraphJson] = useState<string>(JSON.stringify(initialProject.graphData, null, 2));
  const [themeJson, setThemeJson] = useState<string>(JSON.stringify(initialProject.themeData, null, 2));
  const [eventJson, setEventJson] = useState<string>(JSON.stringify(initialProject.eventData, null, 2));
  const [errors, setErrors] = useState({ graph: '', theme: '', event: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const isFirstRender = useRef(true);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<GraphCanvasHandle>(null);

  // Director Specific State (Draft changes)
  const [draftEventData, setDraftEventData] = useState<EventSequence>(initialProject.eventData);
  const [directorPicking, setDirectorPicking] = useState<'source' | 'target' | null>(null);
  const [currentPickInfo, setCurrentPickInfo] = useState<{ source?: string, groupIndex?: number } | null>(null);

  const btnPrimaryClass = "px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";
  const btnSecondaryClass = "px-3 py-1 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed text-slate-700 border border-slate-200 text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
  }, [graphData, themeData, eventData, projectName]);

  // Sync draft whenever mode is turned on or official script changes
  useEffect(() => {
    if (isDirectorMode) {
      setDraftEventData(JSON.parse(JSON.stringify(eventData)));
    }
  }, [isDirectorMode, eventData]);

  // Real-time JSON validation
  useEffect(() => {
    const validate = (text: string, type: 'graph' | 'theme' | 'event') => {
      try {
        JSON.parse(text);
        setErrors(prev => ({ ...prev, [type]: '' }));
      } catch (e: any) {
        setErrors(prev => ({ ...prev, [type]: e.message }));
      }
    };
    validate(graphJson, 'graph');
    validate(themeJson, 'theme');
    validate(eventJson, 'event');
  }, [graphJson, themeJson, eventJson]);

  const cleanNodeData = (node: any): GraphNode => {
    const { fx, fy, vx, vy, index, ...rest } = node;
    return {
      id: rest.id,
      label: rest.label,
      group: rest.group,
      x: rest.x !== undefined ? Math.round(rest.x) : 0,
      y: rest.y !== undefined ? Math.round(rest.y) : 0,
      activeStates: rest.activeStates || [],
      meta_data: rest.meta_data || {}
    };
  };

  const cleanLinkData = (link: any): GraphLink => {
    return {
      source: (link.source as any).id || link.source,
      target: (link.target as any).id || link.target,
      activeStates: link.activeStates || []
    };
  };

  const handleManualSave = () => {
    setSaveStatus('saving');
    const updatedProject: GraphProject = { 
      ...initialProject, 
      name: projectName, 
      graphData: {
        nodes: graphData.nodes.map(cleanNodeData),
        links: graphData.links.map(cleanLinkData)
      }, 
      themeData, 
      eventData, 
      updatedAt: Date.now() 
    };
    onSave(updatedProject);
    setTimeout(() => { setSaveStatus('saved'); setIsDirty(false); }, 500);
    setTimeout(() => { setSaveStatus(prev => prev === 'saved' ? 'idle' : prev); }, 2500);
  };

  const handleApply = (type: 'graph' | 'theme' | 'event', jsonText: string, setter: Function) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (type === 'graph') {
        if (!parsed.nodes || !parsed.links) throw new Error("Missing nodes/links");
        const cleaned = { nodes: parsed.nodes.map(cleanNodeData), links: parsed.links.map(cleanLinkData) };
        setter(cleaned);
        setGraphJson(JSON.stringify(cleaned, null, 2));
      } else if (type === 'event') {
        if (!Array.isArray(parsed.steps)) throw new Error("Missing steps array");
        setter(parsed);
      } else {
        setter(parsed);
      }
      setErrors(prev => ({ ...prev, [type]: '' }));
    } catch (e: any) { setErrors(prev => ({ ...prev, [type]: e.message })); }
  };

  const handleResetData = () => {
    const resetNodes = mountGraphData.nodes.map(cleanNodeData);
    const resetLinks = mountGraphData.links.map(cleanLinkData);
    const resetData = { nodes: resetNodes, links: resetLinks };
    setGraphData(resetData);
    setGraphJson(JSON.stringify(resetData, null, 2));
    setCanvasKey(prev => prev + 1);
  };

  const handleUpdate = (nodes: GraphNode[], links: GraphLink[]) => {
    const newData = { nodes: nodes.map(cleanNodeData), links: links.map(cleanLinkData) };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleNodeDelete = (nodeId: string) => {
    const filteredNodes = graphData.nodes.filter(n => n.id !== nodeId);
    const filteredLinks = graphData.links.filter(l => {
      const sourceId = (l.source as any).id || l.source;
      const targetId = (l.target as any).id || l.target;
      return sourceId !== nodeId && targetId !== nodeId;
    });
    const newData = { nodes: filteredNodes.map(cleanNodeData), links: filteredLinks.map(cleanLinkData) };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleLinkDelete = (sourceId: string, targetId: string) => {
    const filteredLinks = graphData.links.filter(l => {
      const s = (l.source as any).id || l.source;
      const t = (l.target as any).id || l.target;
      return !((s === sourceId && t === targetId) || (s === targetId && t === sourceId));
    });
    const newData = { ...graphData, links: filteredLinks.map(cleanLinkData) };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleNodeUpdateSingle = (updatedNode: GraphNode) => {
    const cleanUpdate = cleanNodeData(updatedNode);
    const newNodes = graphData.nodes.map(n => n.id === cleanUpdate.id ? cleanUpdate : n);
    const newData = { ...graphData, nodes: newNodes };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleNodeAdd = (x?: number, y?: number) => {
    const newId = (Math.max(0, ...graphData.nodes.map(n => parseInt(n.id) || 0)) + 1).toString();
    const newNode: GraphNode = { id: newId, label: `Node ${newId}`, group: 0, x: x ?? 400, y: y ?? 300, activeStates: [], meta_data: {} };
    const newData = { ...graphData, nodes: [...graphData.nodes, newNode].map(cleanNodeData) };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleLinkAdd = (sourceId: string, targetId: string) => {
    const exists = graphData.links.some(l => {
      const s = (l.source as any).id || l.source;
      const t = (l.target as any).id || l.target;
      return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
    });
    if (!exists) {
      const newLinks = [...graphData.links, { source: sourceId, target: targetId, activeStates: [] }];
      const newData = { ...graphData, links: newLinks.map(cleanLinkData) };
      setGraphData(newData);
      setGraphJson(JSON.stringify(newData, null, 2));
    }
  };

  // --- Director Mode Handlers (Operating on Draft) ---

  const startAtomicPick = (groupIndex?: number) => {
    setDirectorPicking('source');
    setCurrentPickInfo({ groupIndex });
  };

  const handleDirectorNodePick = (nodeId: string) => {
    if (directorPicking === 'source') {
      setCurrentPickInfo(prev => ({ ...prev, source: nodeId }));
      setDirectorPicking('target');
    } else if (directorPicking === 'target') {
      const source = currentPickInfo?.source;
      if (source && source !== nodeId) {
        const newStep: AtomicStep = { from: source, to: nodeId, label: "New Flow Step" };
        const updatedDraft = { ...draftEventData };
        if (currentPickInfo.groupIndex !== undefined) {
          const group = updatedDraft.steps[currentPickInfo.groupIndex] as ParallelStep;
          group.steps.push(newStep);
        } else {
          updatedDraft.steps.push(newStep);
        }
        setDraftEventData(updatedDraft);
      }
      setDirectorPicking(null);
      setCurrentPickInfo(null);
    }
  };

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

  const commitDraftToScript = () => {
    setEventData(JSON.parse(JSON.stringify(draftEventData)));
    setEventJson(JSON.stringify(draftEventData, null, 2));
    // isDirty will be set by the useEffect
  };

  const StepCard = ({ step, index, subIndex }: { step: AtomicStep, index: number, subIndex?: number }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-200 transition-all group/card relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
            {subIndex !== undefined ? `${index + 1}.${subIndex + 1}` : index + 1}
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Atomic</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <button onClick={() => canvasRef.current?.runSingleStep(step)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Preview Step">
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
          <button onClick={() => deleteStep(index, subIndex)} className="p-1 text-red-400 hover:bg-red-50 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
          <label className="text-[9px] text-slate-400 block mb-0.5">FROM</label>
          <span className="text-[11px] font-bold text-slate-700">{graphData.nodes.find(n => n.id === step.from)?.label || step.from}</span>
        </div>
        <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
          <label className="text-[9px] text-slate-400 block mb-0.5">TO</label>
          <span className="text-[11px] font-bold text-slate-700">{graphData.nodes.find(n => n.id === step.to)?.label || step.to}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-50 rounded border border-slate-100 px-2 py-1">
          <Type className="w-3 h-3 text-slate-400" />
          <input 
            className="text-[11px] bg-transparent border-none focus:ring-0 flex-1 p-0" 
            value={step.label || ""} 
            placeholder="Step label..."
            onChange={(e) => updateStepProp(index, 'label', e.target.value, subIndex)}
          />
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex-1 flex items-center gap-1 bg-slate-50 rounded border border-slate-100 px-2 py-1 overflow-hidden">
             <LinkIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
             <select 
               className="text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none" 
               value={step.linkStyle || ""} 
               onChange={(e) => updateStepProp(index, 'linkStyle', e.target.value, subIndex)}
             >
               <option value="">Default Link</option>
               {Object.keys(themeData.linkStyles).map(k => <option key={k} value={k}>{k}</option>)}
             </select>
           </div>
           <div className="flex-1 flex items-center gap-1 bg-slate-50 rounded border border-slate-100 px-2 py-1 overflow-hidden">
             <Box className="w-3 h-3 text-slate-400 flex-shrink-0" />
             <select 
               className="text-[10px] bg-transparent border-none focus:ring-0 flex-1 p-0 appearance-none outline-none" 
               value={step.targetNodeState || ""} 
               onChange={(e) => updateStepProp(index, 'targetNodeState', e.target.value, subIndex)}
             >
               <option value="">No State Change</option>
               {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k}>{k}</option>)}
             </select>
           </div>
        </div>
      </div>
    </div>
  );

  const isDraftDifferent = JSON.stringify(draftEventData) !== JSON.stringify(eventData);

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
      <div className={`relative flex-1 h-full transition-all duration-500 ease-in-out ${devMode || isDirectorMode ? 'mr-[420px]' : 'mr-0'}`}>
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-2 pointer-events-auto flex items-center space-x-3 pr-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <div className="h-6 w-px bg-slate-300"></div>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-transparent font-bold text-slate-800 focus:outline-none focus:bg-slate-100 rounded px-2 py-1 text-sm w-40" placeholder="Project Name" />
            
            <button onClick={() => handleNodeAdd()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-200"><Plus className="w-3.5 h-3.5" /> 节点</button>

            <div className="h-6 w-px bg-slate-200"></div>
            <Toggle checked={isLinkMode} onChange={setIsLinkMode} label={isLinkMode ? "连线开启" : "连接模式"} />
            <div className="h-6 w-px bg-slate-200"></div>

            <button 
              onClick={() => { setIsDirectorMode(!isDirectorMode); if (!isDirectorMode) setDevMode(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${isDirectorMode ? 'bg-purple-600 text-white border-purple-700 shadow-md' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'}`}
            >
              <Clapperboard className={`w-3.5 h-3.5 ${isDirectorMode ? 'animate-pulse' : ''}`} />
              导演模式
            </button>

            <div className="h-6 w-px bg-slate-300"></div>

            <button onClick={handleManualSave} disabled={!isDirty || saveStatus === 'saving'} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${isDirty ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-default'}`}>
                <Save className="w-3.5 h-3.5" />
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            <Toggle checked={devMode} onChange={(val) => { setDevMode(val); if (val) setIsDirectorMode(false); }} label="Dev Mode" />
          </div>
        </div>
        <GraphCanvas 
          key={canvasKey}
          ref={canvasRef} 
          data={graphData} 
          theme={themeData}
          isLinkMode={isLinkMode}
          directorPicking={directorPicking}
          onDirectorPick={handleDirectorNodePick}
          onNodeDragEnd={(nodes) => handleUpdate(nodes, graphData.links)}
          onNodeDelete={handleNodeDelete}
          onLinkDelete={handleLinkDelete}
          onNodeUpdate={handleNodeUpdateSingle}
          onNodeAdd={handleNodeAdd}
          onLinkAdd={handleLinkAdd}
          onSimulationEnd={handleUpdate}
        />
      </div>

      {/* Side Panels */}
      <div className={`fixed top-0 right-0 h-full w-[420px] bg-slate-50 shadow-2xl transform transition-transform duration-500 ease-in-out z-20 flex flex-col border-l border-slate-200 ${devMode || isDirectorMode ? 'translate-x-0' : 'translate-x-full'}`}>
        {devMode && (
          <>
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
              <div className="flex items-center space-x-2 text-slate-800"><Settings className="w-5 h-5 text-indigo-600" /><h2 className="font-bold text-lg tracking-tight">Developer Tools</h2></div>
              <button onClick={() => setDevMode(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50/50">
              <CollapsibleSection title="Graph Topology" icon={<Code2 className="w-4 h-4 text-sky-500" />} defaultOpen={true} actions={<><button onClick={handleResetData} className={btnSecondaryClass}><RotateCcw className="w-3 h-3 mr-1" /> Reset</button><button onClick={() => handleApply('graph', graphJson, setGraphData)} disabled={!!errors.graph} className={btnPrimaryClass}>Apply</button></>} error={errors.graph}>
                <JsonTreeEditor value={graphJson} onChange={setGraphJson} height="280px" />
              </CollapsibleSection>
              <CollapsibleSection title="Visual Theme" icon={<Palette className="w-4 h-4 text-pink-500" />} actions={<button onClick={() => handleApply('theme', themeJson, setThemeData)} disabled={!!errors.theme} className={btnPrimaryClass}>Apply Theme</button>} error={errors.theme}>
                <JsonTreeEditor value={themeJson} onChange={setThemeJson} height="280px" />
                <p className="text-[10px] text-slate-400 italic px-1 flex items-center gap-1"><Pipette className="w-3 h-3" /> Click color swatches in the gutter to edit.</p>
              </CollapsibleSection>
              <CollapsibleSection 
                title="Animation Script" 
                icon={<Activity className="w-4 h-4 text-emerald-500" />} 
                actions={
                  <>
                    <button onClick={() => handleApply('event', eventJson, setEventData)} disabled={!!errors.event} className={btnSecondaryClass}>Update</button>
                    <button 
                      onClick={() => canvasRef.current?.runAnimation(eventData)} 
                      disabled={!!errors.event} 
                      className={btnPrimaryClass}
                    >
                      <Play className="w-3 h-3 mr-1 fill-current" /> Run
                    </button>
                  </>
                } 
                error={errors.event}
              >
                <JsonTreeEditor value={eventJson} onChange={setEventJson} height="200px" />
                <button onClick={() => canvasRef.current?.runAnimation(eventData)} disabled={!!errors.event} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs flex justify-center items-center shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] mt-2 group"><Play className="w-3.5 h-3.5 mr-2 fill-current" />Run Simulation</button>
              </CollapsibleSection>
            </div>
          </>
        )}

        {isDirectorMode && (
          <>
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
              <div className="flex items-center space-x-2 text-purple-600"><Clapperboard className="w-5 h-5" /><h2 className="font-bold text-lg tracking-tight">导演工作台</h2></div>
              <button onClick={() => setIsDirectorMode(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
              {/* Initial State Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3.5 h-3.5" /> 初始状态设置
                  </h3>
                  <button onClick={addInitNode} className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-md transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(draftEventData.initNodes || []).map((init, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-2 shadow-sm animate-in slide-in-from-right-2 duration-200">
                      <select 
                        className="text-[11px] font-bold bg-slate-50 border-slate-200 rounded px-1 py-1 focus:ring-0 outline-none flex-1"
                        value={init.id}
                        onChange={(e) => updateInitNode(idx, 'id', e.target.value)}
                      >
                        {graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                      </select>
                      <span className="text-[10px] text-slate-400">IS</span>
                      <select 
                        className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border-indigo-100 rounded px-1 py-1 focus:ring-0 outline-none flex-1"
                        value={init.nodeState}
                        onChange={(e) => updateInitNode(idx, 'nodeState', e.target.value)}
                      >
                        {Object.keys(themeData.nodeStyles).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button onClick={() => removeInitNode(idx)} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps Timeline Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> 剧本时间轴
                  </h3>
                </div>

                <div className="space-y-4">
                  {draftEventData.steps.map((step, idx) => (
                    <div key={idx} className="relative pl-6">
                      {/* Timeline Line */}
                      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-slate-200 -z-10"></div>
                      <div className="absolute left-0 top-4 w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {idx + 1}
                      </div>

                      {step.type === 'parallel' ? (
                        <div className="bg-slate-100/80 border-2 border-dashed border-slate-300 rounded-2xl p-3 space-y-3 relative group/parallel">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-widest flex items-center gap-1">
                                <FastForward className="w-3 h-3" /> Parallel Group
                              </span>
                              <input 
                                className="text-[11px] font-bold text-slate-600 bg-transparent border-none focus:ring-0 p-0" 
                                value={step.label || ""} 
                                placeholder="Group Label"
                                onChange={(e) => updateStepProp(idx, 'label', e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => startAtomicPick(idx)} className="p-1 text-indigo-600 hover:bg-white rounded transition-all" title="Add Step to Group">
                                <Plus className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteStep(idx)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {(step as ParallelStep).steps.map((subStep, subIdx) => (
                              <StepCard key={subIdx} step={subStep as AtomicStep} index={idx} subIndex={subIdx} />
                            ))}
                            {(step as ParallelStep).steps.length === 0 && (
                              <div className="text-[10px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl bg-white/50">
                                并行组内暂无动作，点击上方 + 添加
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <StepCard step={step as AtomicStep} index={idx} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    onClick={() => startAtomicPick()} 
                    className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 transition-all text-indigo-600 group"
                  >
                    <MousePointer2 className="w-5 h-5 mb-1.5 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">新增单步动作</span>
                  </button>
                  <button 
                    onClick={addParallelGroup} 
                    className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-400 transition-all text-purple-600 group"
                  >
                    <FastForward className="w-5 h-5 mb-1.5 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">新增并行容器</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => canvasRef.current?.runAnimation(draftEventData)} 
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-all active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  试运行
                </button>
                <button 
                  onClick={commitDraftToScript}
                  disabled={!isDraftDifferent}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-all shadow-lg active:scale-[0.98] ${isDraftDifferent ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                >
                  <Check className="w-4 h-4 mr-2" />
                  保存剧本
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1 uppercase tracking-widest">
                <span>Director Workbench v2.2</span>
                {isDraftDifferent ? (
                   <span className="text-amber-500 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 未保存的草稿</span>
                ) : (
                   <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> 已保存</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Editor;
