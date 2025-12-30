
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Toggle } from './Toggle';
import GraphCanvas, { GraphCanvasHandle } from './GraphCanvas';
import { GraphData, EventSequence, GraphNode, GraphLink, ThemeConfig, GraphProject } from '../types';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { 
  Settings, Play, AlertCircle, Code2, Activity, 
  RotateCcw, Palette, ArrowLeft, X, Save, ChevronDown, Pipette, 
  Plus, History, Link as LinkIcon
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
          {children}
          {error && (
            <div className="bg-red-50 text-red-600 text-[10px] p-2 rounded border border-red-200 flex items-start animate-in slide-in-from-top-1">
              <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Editor: React.FC<EditorProps> = ({ initialProject, onSave, onBack }) => {
  const [devMode, setDevMode] = useState(true);
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

  const btnPrimaryClass = "px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";
  const btnSecondaryClass = "px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
  }, [graphData, themeData, eventData, projectName]);

  // Utility to strip D3 internal properties
  const cleanNodeData = (node: any): GraphNode => {
    const { fx, fy, vx, vy, index, ...rest } = node;
    return {
      id: rest.id,
      label: rest.label,
      group: rest.group,
      x: Math.round(rest.x ?? 0),
      y: Math.round(rest.y ?? 0),
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
        const cleaned = {
          nodes: parsed.nodes.map(cleanNodeData),
          links: parsed.links.map(cleanLinkData)
        };
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
    const newData = { 
      nodes: nodes.map(cleanNodeData), 
      links: links.map(cleanLinkData) 
    };
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

  const handleNodeUpdateSingle = (updatedNode: GraphNode) => {
    const cleanUpdate = cleanNodeData(updatedNode);
    const newNodes = graphData.nodes.map(n => n.id === cleanUpdate.id ? cleanUpdate : n);
    const newData = { ...graphData, nodes: newNodes };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleNodeAdd = (x?: number, y?: number) => {
    const newId = (Math.max(0, ...graphData.nodes.map(n => parseInt(n.id) || 0)) + 1).toString();
    const newNode: GraphNode = {
      id: newId,
      label: `Node ${newId}`,
      group: 0,
      x: x ?? 400,
      y: y ?? 300,
      activeStates: [],
      meta_data: {}
    };
    const newData = {
      ...graphData,
      nodes: [...graphData.nodes, newNode].map(cleanNodeData)
    };
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

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
      <div className={`relative flex-1 h-full transition-all duration-300 ease-in-out ${devMode ? 'mr-[400px]' : 'mr-0'}`}>
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-2 pointer-events-auto flex items-center space-x-3 pr-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <div className="h-6 w-px bg-slate-300"></div>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-transparent font-bold text-slate-800 focus:outline-none focus:bg-slate-100 rounded px-2 py-1 text-sm w-48" placeholder="Project Name" />
            
            <button 
              onClick={() => handleNodeAdd()} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-200"
            >
              <Plus className="w-3.5 h-3.5" />
              添加节点
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            <Toggle 
              checked={isLinkMode} 
              onChange={setIsLinkMode} 
              label={isLinkMode ? "连线开启" : "连接模式"} 
            />

            <div className="h-6 w-px bg-slate-300"></div>

            <button onClick={handleManualSave} disabled={!isDirty || saveStatus === 'saving'} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${isDirty ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-default'}`}>
                <Save className="w-3.5 h-3.5" />
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            <Toggle checked={devMode} onChange={setDevMode} label="Dev Mode" />
          </div>
        </div>
        <GraphCanvas 
          key={canvasKey}
          ref={canvasRef} 
          data={graphData} 
          theme={themeData}
          isLinkMode={isLinkMode}
          onNodeDragEnd={(nodes) => handleUpdate(nodes, graphData.links)}
          onNodeDelete={handleNodeDelete}
          onNodeUpdate={handleNodeUpdateSingle}
          onNodeAdd={handleNodeAdd}
          onLinkAdd={handleLinkAdd}
          onSimulationEnd={handleUpdate}
        />
      </div>
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-slate-50 shadow-2xl transform transition-transform duration-300 ease-in-out z-20 flex flex-col border-l border-slate-200 ${devMode ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
          <div className="flex items-center space-x-2 text-slate-800"><Settings className="w-5 h-5 text-indigo-600" /><h2 className="font-bold text-lg tracking-tight">Developer Tools</h2></div>
          <button onClick={() => setDevMode(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50/50">
          <CollapsibleSection title="Graph Topology" icon={<Code2 className="w-4 h-4 text-sky-500" />} defaultOpen={true} actions={<><button onClick={handleResetData} className={btnSecondaryClass}><RotateCcw className="w-3 h-3 mr-1" /> Reset</button><button onClick={() => handleApply('graph', graphJson, setGraphData)} className={btnPrimaryClass}>Apply</button></>} error={errors.graph}>
            <JsonTreeEditor value={graphJson} onChange={setGraphJson} height="280px" />
          </CollapsibleSection>
          <CollapsibleSection title="Visual Theme" icon={<Palette className="w-4 h-4 text-pink-500" />} actions={<button onClick={() => handleApply('theme', themeJson, setThemeData)} className={btnPrimaryClass}>Apply Theme</button>} error={errors.theme}>
            <JsonTreeEditor value={themeJson} onChange={setThemeJson} height="280px" />
            <p className="text-[10px] text-slate-400 italic px-1 flex items-center gap-1"><Pipette className="w-3 h-3" /> Click color swatches in the gutter to edit.</p>
          </CollapsibleSection>
          <CollapsibleSection title="Animation Script" icon={<Activity className="w-4 h-4 text-emerald-500" />} actions={<button onClick={() => handleApply('event', eventJson, setEventData)} className={btnSecondaryClass}>Update</button>} error={errors.event}>
            <JsonTreeEditor value={eventJson} onChange={setEventJson} height="200px" />
            <button onClick={() => canvasRef.current?.runAnimation(eventData)} disabled={!!errors.event} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-xs flex justify-center items-center shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] mt-2 group"><Play className="w-3.5 h-3.5 mr-2 fill-current" />Run Simulation</button>
          </CollapsibleSection>
        </div>
        <div className="p-4 bg-white border-t border-slate-200">
           <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1 uppercase tracking-widest"><span>GraphFlow Engine v2.0</span><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live Sync</span></div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
