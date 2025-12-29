
import React, { useState, useEffect } from 'react';
import { GraphData, ThemeConfig, EventSequence, GraphProject } from './types';
import Editor from './components/Editor';
import { Dashboard } from './components/Dashboard';

// --- DEFAULTS ---
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
      persistent: { stroke: "#f59e0b", strokeWidth: 4, badge: { text: "!", color: "#f59e0b", textColor: "#fff" } },
      animation: { scale: 1.5, durationIn: 0.3 }
    },
    "error": {
      persistent: { stroke: "#ef4444", strokeWidth: 4, badge: { text: "X", color: "#ef4444", textColor: "#fff" } },
      animation: { scale: 1.3, durationIn: 0.2 }
    },
    "success": {
      persistent: { stroke: "#10b981", strokeWidth: 3, badge: { text: "✓", color: "#10b981", textColor: "#fff" } },
      animation: { scale: 1.2 }
    }
  },
  linkStyles: {
    "http_request": {
      persistent: { outlineColor: "#6366f1", outlineWidth: 3, mainColor: "#333" },
      animation: { packetColor: "#6366f1", packetRadius: 6, duration: 0.8 }
    },
    "db_query": {
      persistent: { outlineColor: "#ec4899", outlineWidth: 3 },
      animation: { packetColor: "#ec4899", packetRadius: 4, duration: 0.5 }
    },
    "slow_network": {
      persistent: { mainColor: "#94a3b8", opacity: 0.3, outlineColor: "transparent" },
      animation: { packetColor: "#94a3b8", packetRadius: 3, duration: 2.5 }
    }
  }
};

const INITIAL_EVENTS: EventSequence = {
  name: "Default Flow",
  steps: [
    { "from": "1", "to": "2", "label": "Request", "linkStyle": "http_request" },
    { "from": "2", "to": "3", "label": "Auth", "linkStyle": "http_request" },
    { "from": "3", "to": "2", "label": "Auth OK", "targetNodeState": "success" }
  ]
};

const App: React.FC = () => {
  // --- STATE ---
  const [projects, setProjects] = useState<GraphProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    const saved = localStorage.getItem('graphflow_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(parsed);
      } catch (e) {
        console.error("Failed to load projects", e);
        // If parse fails, treat as empty/init
        initDemo();
      }
    } else {
      initDemo();
    }
    setIsLoaded(true);
  }, []);

  const initDemo = () => {
    const demoProject: GraphProject = {
      id: 'demo-1',
      name: 'Demo Architecture',
      updatedAt: Date.now(),
      isPinned: true,
      graphData: INITIAL_GRAPH,
      themeData: INITIAL_THEME,
      eventData: INITIAL_EVENTS
    };
    setProjects([demoProject]);
  };

  useEffect(() => {
    // Only save after initial load to prevent overwriting with empty array before load
    if (isLoaded) {
      localStorage.setItem('graphflow_projects', JSON.stringify(projects));
    }
  }, [projects, isLoaded]);

  // --- ACTIONS ---

  const handleCreateProject = () => {
    const newProject: GraphProject = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: `Untitled Graph ${projects.length + 1}`,
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
    // Note: Confirmation is handled in the UI component (Dashboard ProjectCard)
    // to avoid browser blocking issues with window.confirm
    console.log("App: handleDeleteProject triggered for ID:", id);
    if (e) e.preventDefault();
    
    setProjects(prev => {
      const newProjects = prev.filter(p => p.id !== id);
      console.log(`App: Removing project. Old count: ${prev.length}, New count: ${newProjects.length}`);
      return newProjects;
    });
    
    if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    // e.stopPropagation() is handled in Dashboard component
    e.preventDefault();
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleSaveProject = (updatedProject: GraphProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  // --- RENDER ---

  if (!isLoaded) return null; // Or a loading spinner

  if (activeProjectId && activeProject) {
    return (
      <Editor 
        key={activeProject.id} // Re-mount if ID changes
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
