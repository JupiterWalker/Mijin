
import React, { useState, useRef, useEffect } from 'react';
import { Toggle } from './Toggle';
import GraphCanvas, { GraphCanvasHandle } from './GraphCanvas';
import { GraphData, EventSequence, GraphNode, GraphLink, ThemeConfig, GraphProject } from '../types';
import { Settings, Play, CheckCircle2, AlertCircle, Code2, Activity, RotateCcw, Palette, ArrowLeft, Save } from 'lucide-react';

interface EditorProps {
  initialProject: GraphProject;
  onSave: (project: GraphProject) => void;
  onBack: () => void;
}

const Editor: React.FC<EditorProps> = ({ initialProject, onSave, onBack }) => {
  const [devMode, setDevMode] = useState(true);
  const [projectName, setProjectName] = useState(initialProject.name);
  
  // Data States
  const [graphData, setGraphData] = useState<GraphData>(initialProject.graphData);
  const [themeData, setThemeData] = useState<ThemeConfig>(initialProject.themeData);
  const [eventData, setEventData] = useState<EventSequence>(initialProject.eventData);

  // Input States
  const [graphJson, setGraphJson] = useState<string>(JSON.stringify(initialProject.graphData, null, 2));
  const [themeJson, setThemeJson] = useState<string>(JSON.stringify(initialProject.themeData, null, 2));
  const [eventJson, setEventJson] = useState<string>(JSON.stringify(initialProject.eventData, null, 2));

  // Errors
  const [errors, setErrors] = useState({ graph: '', theme: '', event: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const canvasRef = useRef<GraphCanvasHandle>(null);

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
        handleGlobalSave();
    }, 2000); // Debounce save
    return () => clearTimeout(timer);
  }, [graphData, themeData, eventData, projectName]);

  const handleGlobalSave = () => {
    setSaveStatus('saving');
    const updatedProject: GraphProject = {
        ...initialProject,
        name: projectName,
        graphData,
        themeData,
        eventData,
        updatedAt: Date.now()
    };
    onSave(updatedProject);
    setTimeout(() => setSaveStatus('saved'), 500);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  // Generic JSON Handler
  const handleApply = (
    type: 'graph' | 'theme' | 'event', 
    json: string, 
    setter: Function
  ) => {
    try {
      const parsed = JSON.parse(json);
      // Basic validation
      if (type === 'graph' && (!parsed.nodes || !parsed.links)) throw new Error("Missing nodes/links");
      if (type === 'event' && !Array.isArray(parsed.steps)) throw new Error("Missing steps array");
      
      setter(parsed);
      setErrors(prev => ({ ...prev, [type]: '' }));
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [type]: e.message }));
    }
  };

  const triggerAnimation = () => {
    if (canvasRef.current && !errors.event) {
      canvasRef.current.runAnimation(eventData);
    }
  };

  const handleResetData = () => {
    const resetNodes = graphData.nodes.map(({activeStates, ...rest}) => ({...rest, activeStates: []}));
    const resetLinks = graphData.links.map(({activeStates, ...rest}) => ({...rest, activeStates: []}));
    
    const resetData = { nodes: resetNodes, links: resetLinks };
    setGraphData(resetData);
    setGraphJson(JSON.stringify(resetData, null, 2));
  };

  const handleUpdate = (nodes: GraphNode[], links: GraphLink[]) => {
    const cleanNodes = nodes.map(n => ({
      id: n.id,
      label: n.label,
      group: n.group,
      x: Math.round(n.x ?? 0),
      y: Math.round(n.y ?? 0),
      activeStates: n.activeStates
    }));

    const cleanLinks = links.map(l => ({
      source: (l.source as any).id || l.source,
      target: (l.target as any).id || l.target,
      activeStates: l.activeStates
    }));

    const newData = { nodes: cleanNodes, links: cleanLinks };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
      
      {/* Canvas */}
      <div className={`relative flex-1 h-full transition-all duration-300 ease-in-out ${devMode ? 'mr-96' : 'mr-0'}`}>
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-2 pointer-events-auto flex items-center space-x-3 pr-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            <div className="flex flex-col">
                 <input 
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none focus:bg-slate-100 rounded px-1 -ml-1 text-sm w-48"
                 />
                 <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Auto-save on'}
                 </span>
            </div>
            
            <div className="h-6 w-px bg-slate-300"></div>
            <Toggle checked={devMode} onChange={setDevMode} label="Dev Mode" />
          </div>
        </div>

        <GraphCanvas 
          ref={canvasRef} 
          data={graphData} 
          theme={themeData}
          onNodeDragEnd={(nodes) => handleUpdate(nodes, graphData.links)}
          onSimulationEnd={handleUpdate}
        />
      </div>

      {/* Dev Tools Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-20 flex flex-col border-l border-slate-200 ${
          devMode ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-slate-700">
            <Settings className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Configuration</h2>
          </div>
          <button onClick={() => setDevMode(false)} className="text-slate-400 hover:text-slate-600">
             &#x2715;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          
          {/* 1. Graph Structure */}
          <Section 
            title="Graph Structure" 
            icon={<Code2 className="w-4 h-4" />}
            actions={
              <>
                <button onClick={handleResetData} className="btn-secondary" title="Reset States">
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </button>
                <button onClick={() => handleApply('graph', graphJson, setGraphData)} className="btn-primary">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Apply
                </button>
              </>
            }
            error={errors.graph}
          >
            <textarea
              value={graphJson}
              onChange={(e) => setGraphJson(e.target.value)}
              className="editor-textarea h-40"
              spellCheck={false}
            />
          </Section>

          <div className="h-px bg-slate-100 w-full" />

          {/* 2. Theme Config */}
          <Section 
            title="Theme Config" 
            icon={<Palette className="w-4 h-4" />}
            actions={
              <button onClick={() => handleApply('theme', themeJson, setThemeData)} className="btn-secondary">
                Apply Theme
              </button>
            }
            error={errors.theme}
          >
            <textarea
              value={themeJson}
              onChange={(e) => setThemeJson(e.target.value)}
              className="editor-textarea h-40"
              spellCheck={false}
            />
            <p className="text-xs text-slate-400 mt-1">Define styles for nodes and links here.</p>
          </Section>

          <div className="h-px bg-slate-100 w-full" />

          {/* 3. Event Simulation */}
          <Section 
            title="Event Simulation" 
            icon={<Activity className="w-4 h-4" />}
            actions={
              <button onClick={() => handleApply('event', eventJson, setEventData)} className="btn-secondary">
                Save Script
              </button>
            }
            error={errors.event}
          >
            <textarea
              value={eventJson}
              onChange={(e) => setEventJson(e.target.value)}
              className="editor-textarea h-32"
              spellCheck={false}
            />
            <button 
              onClick={triggerAnimation}
              disabled={!!errors.event}
              className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium text-sm flex justify-center items-center shadow-sm"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Run Simulation
            </button>
          </Section>

        </div>
      </div>
    </div>
  );
};

// Sub-component for Sidebar Sections
const Section: React.FC<any> = ({ title, icon, actions, error, children }) => (
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-medium text-slate-700 flex items-center space-x-1.5">
        {icon} <span>{title}</span>
      </label>
      <div className="flex space-x-2">{actions}</div>
    </div>
    <div className="relative">
      {children}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-red-50 text-red-600 text-xs p-2 rounded border border-red-200 flex items-start">
          <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  </div>
);

export default Editor;
