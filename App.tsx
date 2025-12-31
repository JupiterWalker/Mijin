
import React, { useState, useEffect } from 'react';
import { GraphData, ThemeConfig, EventSequence, GraphProject } from './types';
import Editor from './components/Editor';
import { Dashboard } from './components/Dashboard';

// --- DEFAULTS ---
const INITIAL_GRAPH: GraphData = {
  nodes: [
    { id: "1", label: "Client App", group: 0, x: 100, y: 250 },
    { id: "2", label: "API Gateway", group: 1, x: 350, y: 250 },
    { id: "3", label: "Auth Service", group: 4, x: 550, y: 150 },
    { id: "4", label: "Main Database", group: 5, x: 550, y: 350 },
  ],
  links: [
    { source: "1", target: "2" },
    { source: "2", target: "3" },
    { source: "2", target: "4" },
  ]
};

const INITIAL_THEME: ThemeConfig = {
  nodeStyles: {
    "loading": {
      persistent: { stroke: "#6366f1", strokeWidth: 4, badge: { text: "...", color: "#6366f1", textColor: "#fff" } },
      animation: { scale: 1.1, durationIn: 0.5 }
    },
    "processing": {
      persistent: { stroke: "#8b5cf6", strokeWidth: 5, fill: "#f5f3ff" },
      animation: { scale: 1.2, durationIn: 0.4 }
    },
    "success": {
      persistent: { stroke: "#10b981", strokeWidth: 4, badge: { text: "✓", color: "#10b981", textColor: "#fff" } },
      animation: { scale: 1.2, durationIn: 0.3 }
    },
    "error": {
      persistent: { stroke: "#ef4444", strokeWidth: 4, badge: { text: "X", color: "#ef4444", textColor: "#fff" } },
      animation: { scale: 1.3, durationIn: 0.2 }
    }
  },
  linkStyles: {
    "http": {
      persistent: { outlineColor: "#6366f1", outlineWidth: 2, mainColor: "#475569" },
      animation: { packetColor: "#6366f1", packetRadius: 6, duration: 1.2 }
    },
    "secure": {
      persistent: { outlineColor: "#8b5cf6", outlineWidth: 3, mainColor: "#1e293b" },
      animation: { packetColor: "#8b5cf6", packetRadius: 7, duration: 0.8 }
    },
    "internal": {
      persistent: { outlineColor: "#94a3b8", outlineWidth: 1, mainColor: "#cbd5e1", opacity: 0.5 },
      animation: { packetColor: "#10b981", packetRadius: 4, duration: 0.6 }
    }
  }
};

const INITIAL_EVENTS: EventSequence = {
  name: "Secure API Retrieval Flow",
  // Initial state of the graph nodes: defines what the world looks like BEFORE the simulation starts
  initNodes: [
    { id: "1", nodeState: "loading" },
    { id: "3", nodeState: "processing" }
  ],
  steps: [
    { 
      from: "1", 
      to: "2", 
      label: "User Login Request", 
      linkStyle: "http" 
    },
    { 
      from: "2", 
      to: "3", 
      label: "Verify Token", 
      linkStyle: "secure" 
    },
    { 
      from: "3", 
      to: "2", 
      label: "Token Validated", 
      targetNodeState: "success",
      duration: 0.5
    },
    {
      type: "parallel",
      label: "Fetch & Log",
      steps: [
        { from: "2", to: "4", label: "Query DB", linkStyle: "internal" },
        { from: "2", to: "1", label: "Ack Receipt", linkStyle: "http" }
      ]
    },
    { 
      from: "4", 
      to: "2", 
      label: "Data Payload", 
      targetNodeState: "success" 
    },
    { 
      from: "2", 
      to: "1", 
      label: "Final Response", 
      linkStyle: "http", 
      targetNodeState: "success" 
    }
  ]
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<GraphProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('graphflow_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        initDemo();
      }
    } else {
      initDemo();
    }
    setIsLoaded(true);
  }, []);

  const initDemo = () => {
    const demoProject: GraphProject = {
      id: 'demo-architecture',
      name: 'Microservices Flow',
      updatedAt: Date.now(),
      isPinned: true,
      graphData: INITIAL_GRAPH,
      themeData: INITIAL_THEME,
      eventData: INITIAL_EVENTS
    };
    setProjects([demoProject]);
  };

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('graphflow_projects', JSON.stringify(projects));
    }
  }, [projects, isLoaded]);

  const handleCreateProject = () => {
    const newProject: GraphProject = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: `New Project ${projects.length + 1}`,
      updatedAt: Date.now(),
      isPinned: false,
      graphData: INITIAL_GRAPH,
      themeData: INITIAL_THEME,
      eventData: INITIAL_EVENTS
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleSaveProject = (updatedProject: GraphProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  if (!isLoaded) return null;

  if (activeProjectId && activeProject) {
    return (
      <Editor 
        key={activeProject.id}
        initialProject={activeProject}
        onSave={handleSaveProject}
        onBack={() => setActiveProjectId(null)}
      />
    );
  }

  return (
    <Dashboard 
      projects={projects}
      onCreateProject={handleCreateProject}
      onOpenProject={setActiveProjectId}
      onDeleteProject={handleDeleteProject}
      onTogglePin={handleTogglePin}
    />
  );
};

export default App;
