import React, { useState, useRef, useEffect } from 'react';
import { Toggle } from './components/Toggle';
import GraphCanvas, { GraphCanvasHandle } from './components/GraphCanvas';
import { GraphData, EventSequence, GraphNode, GraphLink, ThemeConfig } from './types';
import { Settings, Play, CheckCircle2, AlertCircle, Code2, Activity, RotateCcw, Palette } from 'lucide-react';

// Default Data
const INITIAL_GRAPH: GraphData = {
  nodes: [
    { id: "1", label: "Client", group: 0 },
    { id: "2", label: "Gateway", group: 1 },
    { id: "3", label: "Auth", group: 1 },
    { id: "4", label: "DB", group: 2 },
  ],
  links: [
    { source: "1", target: "2" },
    { source: "2", target: "3" },
    { source: "2", target: "4" },
  ]
};

const INITIAL_THEME: ThemeConfig = {
  nodeStyles: {
    "warning": {
      persistent: {
        stroke: "#f59e0b",
        strokeWidth: 4,
        badge: { text: "!", color: "#f59e0b", textColor: "#fff" }
      },
      animation: { scale: 1.5, durationIn: 0.3 }
    },
    "error": {
      persistent: {
        stroke: "#ef4444",
        strokeWidth: 4,
        badge: { text: "X", color: "#ef4444", textColor: "#fff" }
      },
      animation: { scale: 1.3, durationIn: 0.2 }
    },
    "success": {
      persistent: {
        stroke: "#10b981",
        strokeWidth: 3,
        badge: { text: "✓", color: "#10b981", textColor: "#fff" }
      },
      animation: { scale: 1.2 }
    }
  },
  linkStyles: {
    "http_request": {
      persistent: {
        outlineColor: "#6366f1",
        outlineWidth: 3,
        mainColor: "#333"
      },
      animation: {
        packetColor: "#6366f1",
        packetRadius: 6,
        duration: 0.8
      }
    },
    "db_query": {
      persistent: {
        outlineColor: "#ec4899",
        outlineWidth: 3
      },
      animation: {
        packetColor: "#ec4899",
        packetRadius: 4,
        duration: 0.5
      }
    },
    "slow_network": {
      persistent: {
         mainColor: "#94a3b8",
         opacity: 0.3,
         outlineColor: "transparent"
      },
      animation: {
        packetColor: "#94a3b8",
        packetRadius: 3,
        duration: 2.5
      }
    }
  }
};

const INITIAL_EVENTS: EventSequence = {
  name: "Auth Flow Simulation",
  steps: [
    { from: "1", to: "2", linkStyle: "http_request", label: "Login" },
    { from: "2", to: "3", linkStyle: "http_request", label: "Verify", targetNodeState: "success" },
    { from: "2", to: "4", linkStyle: "db_query", label: "Fetch Profile" },
    { from: "4", to: "2", linkStyle: "slow_network", label: "Timeout", targetNodeState: "warning" }
  ]
};

const App: React.FC = () => {
  const [devMode, setDevMode] = useState(true);
  
  // Data States
  const [graphData, setGraphData] = useState<GraphData>(INITIAL_GRAPH);
  const [themeData, setThemeData] = useState<ThemeConfig>(INITIAL_THEME);
  const [eventData, setEventData] = useState<EventSequence>(INITIAL_EVENTS);

  // Input States
  const [graphJson, setGraphJson] = useState<string>(JSON.stringify(INITIAL_GRAPH, null, 2));
  const [themeJson, setThemeJson] = useState<string>(JSON.stringify(INITIAL_THEME, null, 2));
  const [eventJson, setEventJson] = useState<string>(JSON.stringify(INITIAL_EVENTS, null, 2));

  // Errors
  const [errors, setErrors] = useState({ graph: '', theme: '', event: '' });

  const canvasRef = useRef<GraphCanvasHandle>(null);

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
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden">
      
      {/* Canvas */}
      <div className={`relative flex-1 h-full transition-all duration-300 ease-in-out ${devMode ? 'mr-96' : 'mr-0'}`}>
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-3 pointer-events-auto flex items-center space-x-4">
            <h1 className="text-lg font-bold text-slate-800 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-indigo-600" />
              GraphFlow
            </h1>
            <div className="h-6 w-px bg-slate-300"></div>
            <Toggle checked={devMode} onChange={setDevMode} label="Developer Mode" />
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

// Styles
const styleEl = document.createElement('style');
styleEl.textContent = `
  .editor-textarea {
    width: 100%;
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0.75rem;
    background-color: #f8fafc;
    border-radius: 0.5rem;
    border: 1px solid #cbd5e1;
    outline: none;
    resize: vertical;
  }
  .editor-textarea:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px #6366f1;
  }
  .btn-primary {
    font-size: 0.75rem;
    background-color: #1e293b;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
  }
  .btn-primary:hover { background-color: #334155; }
  
  .btn-secondary {
    font-size: 0.75rem;
    background-color: white;
    border: 1px solid #cbd5e1;
    color: #334155;
    padding: 0.25rem 0.75rem;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
  }
  .btn-secondary:hover { background-color: #f1f5f9; }
`;
document.head.appendChild(styleEl);

export default App;