
import React, { useState, useRef, useEffect } from 'react';
import GraphCanvas, { GraphCanvasHandle } from './GraphCanvas';
import { GraphData, EventSequence, GraphNode, GraphLink, ThemeConfig, GraphProject, AtomicStep, ParallelStep, EnvironmentZone, EnvironmentLabel } from '../types';
import { EditorToolbar } from './editor/EditorToolbar';
import { DevToolsSidebar } from './editor/DevToolsSidebar';
import { DirectorSidebar } from './editor/DirectorSidebar';

interface EditorProps {
  initialProject: GraphProject;
  onSave: (project: GraphProject) => void;
  onBack: () => void;
}

const Editor: React.FC<EditorProps> = ({ initialProject, onSave, onBack }) => {
  // --- UI State ---
  const [devMode, setDevMode] = useState(false);
  const [isDirectorMode, setIsDirectorMode] = useState(false);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  // --- Data State ---
  const [projectName, setProjectName] = useState(initialProject.name);
  const [mountGraphData] = useState<GraphData>(JSON.parse(JSON.stringify(initialProject.graphData)));
  const [graphData, setGraphData] = useState<GraphData>(initialProject.graphData);
  const [themeData, setThemeData] = useState<ThemeConfig>(initialProject.themeData);
  const [eventData, setEventData] = useState<EventSequence>(initialProject.eventData);

  // --- JSON Editors State ---
  const [graphJson, setGraphJson] = useState<string>(JSON.stringify(initialProject.graphData, null, 2));
  const [themeJson, setThemeJson] = useState<string>(JSON.stringify(initialProject.themeData, null, 2));
  const [eventJson, setEventJson] = useState<string>(JSON.stringify(initialProject.eventData, null, 2));
  const [errors, setErrors] = useState({ graph: '', theme: '', event: '' });

  // --- Director Mode State ---
  const [draftEventData, setDraftEventData] = useState<EventSequence>(initialProject.eventData);
  const [directorPicking, setDirectorPicking] = useState<'source' | 'target' | null>(null);
  const [isContinuousPick, setIsContinuousPick] = useState(false);
  const [currentPickInfo, setCurrentPickInfo] = useState<{ source?: string, groupIndex?: number } | null>(null);
  const [isDirectorConfigOpen, setIsDirectorConfigOpen] = useState(false);
  const [preDirectorGraphData, setPreDirectorGraphData] = useState<GraphData | null>(null);
  const [directorDefaults, setDirectorDefaults] = useState({ 
    linkStyle: "", 
    targetState: "", 
    processingState: "", 
    finalState: "",
    durationProcessing: 0.4,
    durationFinal: 0.4
  });

  const canvasRef = useRef<GraphCanvasHandle>(null);
  const isFirstRender = useRef(true);

  // --- Effects ---
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
  }, [graphData, themeData, eventData, projectName]);

  useEffect(() => {
    if (isDirectorMode) {
      setDraftEventData(JSON.parse(JSON.stringify(eventData)));
      if (!preDirectorGraphData) {
        setPreDirectorGraphData(JSON.parse(JSON.stringify(graphData)));
      }
    } else {
      if (preDirectorGraphData) {
        const restoredData = JSON.parse(JSON.stringify(preDirectorGraphData));
        setGraphData(restoredData);
        setGraphJson(JSON.stringify(restoredData, null, 2));
        setPreDirectorGraphData(null);
        setCanvasKey(prev => prev + 1);
        setDirectorPicking(null);
        setIsContinuousPick(false);
        setIsDirectorConfigOpen(false);
      }
    }
  }, [isDirectorMode, eventData]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDirectorPicking(null);
        setIsContinuousPick(false);
        setCurrentPickInfo(null);
        setIsDirectorConfigOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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

  // --- Helpers ---
  const cleanNodeData = (node: any): GraphNode => {
    const { fx, fy, vx, vy, index, ...rest } = node;
    return {
      id: rest.id,
      label: rest.label,
      group: rest.group,
      x: rest.x !== undefined ? Math.round(rest.x) : 0,
      y: rest.y !== undefined ? Math.round(rest.y) : 0,
      apparence: rest.apparence,
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

  // --- Handlers: Data & Save ---
  const handleManualSave = () => {
    setSaveStatus('saving');
    const updatedProject: GraphProject = { 
      ...initialProject, 
      name: projectName, 
      graphData: {
        ...graphData,
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
          links: parsed.links.map(cleanLinkData),
          environments: parsed.environments 
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

  // --- Handlers: Graph Manipulation ---
  const handleResetData = () => {
    const resetNodes = mountGraphData.nodes.map(cleanNodeData);
    const resetLinks = mountGraphData.links.map(cleanLinkData);
    const resetData = { nodes: resetNodes, links: resetLinks, environments: mountGraphData.environments };
    setGraphData(resetData);
    setGraphJson(JSON.stringify(resetData, null, 2));
    setCanvasKey(prev => prev + 1);
  };

  const handleUpdate = (nodes: GraphNode[], links: GraphLink[]) => {
    const newData = { ...graphData, nodes: nodes.map(cleanNodeData), links: links.map(cleanLinkData) };
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
    const newData = { ...graphData, nodes: filteredNodes.map(cleanNodeData), links: filteredLinks.map(cleanLinkData) };
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

  // Environment Handlers
  const handleZoneAdd = (zone: EnvironmentZone) => {
    const currentZones = graphData.environments?.zones || [];
    const newData = { 
      ...graphData, 
      environments: { 
        ...graphData.environments, 
        zones: [...currentZones, zone],
        labels: graphData.environments?.labels || []
      } 
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleZoneUpdate = (updatedZone: EnvironmentZone) => {
    const currentZones = graphData.environments?.zones || [];
    const currentNodes = graphData.nodes || [];
    const currentLabels = graphData.environments?.labels || [];

    // Capture Logic: If becoming locked, scan for elements inside
    if (updatedZone.isLocked) {
      const bounds = {
        left: updatedZone.x,
        right: updatedZone.x + updatedZone.width,
        top: updatedZone.y,
        bottom: updatedZone.y + updatedZone.height
      };

      // 1. Find all contained IDs (Greedy first pass)
      const containedNodeIds = currentNodes
        .filter(n => 
          (n.x !== undefined && n.y !== undefined) &&
          n.x >= bounds.left && n.x <= bounds.right && 
          n.y >= bounds.top && n.y <= bounds.bottom
        )
        .map(n => n.id);

      const containedLabelIds = currentLabels
        .filter(l => 
          l.x >= bounds.left && l.x <= bounds.right && 
          l.y >= bounds.top && l.y <= bounds.bottom
        )
        .map(l => l.id);

      const containedZoneIds = currentZones
        .filter(z => 
          z.id !== updatedZone.id && // Not self
          z.x >= bounds.left && (z.x + z.width) <= bounds.right &&
          z.y >= bounds.top && (z.y + z.height) <= bounds.bottom
        )
        .map(z => z.id);

      // 2. Hierarchy Check: Don't steal items that are already owned by a child zone
      const idsClaimedByChildren = new Set<string>();
      containedZoneIds.forEach(childZoneId => {
        const childZone = currentZones.find(z => z.id === childZoneId);
        if (childZone && childZone.attachedElementIds) {
          childZone.attachedElementIds.nodes.forEach(id => idsClaimedByChildren.add(id));
          childZone.attachedElementIds.labels.forEach(id => idsClaimedByChildren.add(id));
          childZone.attachedElementIds.zones.forEach(id => idsClaimedByChildren.add(id));
        }
      });

      const finalNodes = containedNodeIds.filter(id => !idsClaimedByChildren.has(id));
      const finalLabels = containedLabelIds.filter(id => !idsClaimedByChildren.has(id));
      const finalZones = containedZoneIds.filter(id => !idsClaimedByChildren.has(id));

      const newZonesState = currentZones.map(z => {
        if (z.id === updatedZone.id) {
          return {
            ...updatedZone,
            attachedElementIds: {
              nodes: finalNodes,
              zones: finalZones,
              labels: finalLabels
            }
          };
        }
        if (z.attachedElementIds) {
          return {
            ...z,
            attachedElementIds: {
              nodes: z.attachedElementIds.nodes.filter(id => !finalNodes.includes(id)),
              zones: z.attachedElementIds.zones.filter(id => !finalZones.includes(id)),
              labels: z.attachedElementIds.labels.filter(id => !finalLabels.includes(id))
            }
          };
        }
        return z;
      });

      const newData = { 
        ...graphData, 
        environments: { 
          ...graphData.environments, 
          zones: newZonesState,
          labels: currentLabels
        } 
      };
      setGraphData(newData);
      setGraphJson(JSON.stringify(newData, null, 2));

    } else {
      const newZones = currentZones.map(z => z.id === updatedZone.id ? { 
        ...updatedZone, 
        attachedElementIds: { nodes: [], zones: [], labels: [] } // Clear on unlock
      } : z);
      
      const newData = { 
        ...graphData, 
        environments: { 
          ...graphData.environments, 
          zones: newZones,
          labels: currentLabels
        } 
      };
      setGraphData(newData);
      setGraphJson(JSON.stringify(newData, null, 2));
    }
  };

  const handleZoneDelete = (id: string) => {
    const currentZones = graphData.environments?.zones || [];
    const newZones = currentZones.filter(z => z.id !== id);
    const newData = {
      ...graphData,
      environments: {
        ...graphData.environments,
        zones: newZones,
        labels: graphData.environments?.labels || []
      }
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleZoneOrder = (id: string, direction: 'front' | 'back') => {
    const currentZones = graphData.environments?.zones || [];
    const index = currentZones.findIndex(z => z.id === id);
    if (index === -1) return;

    const newZones = [...currentZones];
    const [movedZone] = newZones.splice(index, 1);

    if (direction === 'front') {
      newZones.push(movedZone);
    } else {
      newZones.unshift(movedZone);
    }

    const newData = {
      ...graphData,
      environments: {
        ...graphData.environments,
        zones: newZones,
        labels: graphData.environments?.labels || []
      }
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleLabelAdd = (label: EnvironmentLabel) => {
    const currentLabels = graphData.environments?.labels || [];
    const newData = { 
      ...graphData, 
      environments: { 
        ...graphData.environments, 
        labels: [...currentLabels, label],
        zones: graphData.environments?.zones || []
      } 
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleLabelUpdate = (updatedLabel: EnvironmentLabel) => {
    const currentLabels = graphData.environments?.labels || [];
    const newLabels = currentLabels.map(l => l.id === updatedLabel.id ? updatedLabel : l);
    const newData = { 
      ...graphData, 
      environments: { 
        ...graphData.environments, 
        labels: newLabels,
        zones: graphData.environments?.zones || []
      } 
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  const handleLabelDelete = (id: string) => {
    const currentLabels = graphData.environments?.labels || [];
    const newLabels = currentLabels.filter(l => l.id !== id);
    const newData = {
      ...graphData,
      environments: {
        ...graphData.environments,
        labels: newLabels,
        zones: graphData.environments?.zones || []
      }
    };
    setGraphData(newData);
    setGraphJson(JSON.stringify(newData, null, 2));
  };

  // --- Handlers: Director Mode ---
  const startAtomicPick = (continuous: boolean = false, groupIndex?: number) => {
    setDirectorPicking('source');
    setIsContinuousPick(continuous);
    setCurrentPickInfo({ groupIndex });
  };

  const handleDirectorNodePick = (nodeId: string) => {
    if (directorPicking === 'source') {
      setCurrentPickInfo(prev => ({ ...prev, source: nodeId }));
      setDirectorPicking('target');
    } else if (directorPicking === 'target') {
      const source = currentPickInfo?.source;
      if (source && source !== nodeId) {
        const newStep: AtomicStep = { 
          from: source, 
          to: nodeId, 
          label: "New Flow Step",
          linkStyle: directorDefaults.linkStyle || undefined,
          targetNodeState: directorDefaults.targetState || undefined,
          processingNodeState: directorDefaults.processingState || undefined,
          finalNodeState: directorDefaults.finalState || undefined,
          durationProcessing: directorDefaults.durationProcessing || undefined,
          durationFinal: directorDefaults.durationFinal || undefined
        };
        const updatedDraft = { ...draftEventData };
        if (currentPickInfo?.groupIndex !== undefined) {
          const group = updatedDraft.steps[currentPickInfo.groupIndex] as ParallelStep;
          group.steps.push(newStep);
        } else {
          updatedDraft.steps.push(newStep);
        }
        setDraftEventData(updatedDraft);
        
        setTimeout(() => {
          canvasRef.current?.runSingleStep(newStep);
        }, 50);

        if (isContinuousPick) {
          setDirectorPicking('source');
          setCurrentPickInfo(prev => ({ ...prev, source: undefined }));
        } else {
          setDirectorPicking(null);
          setCurrentPickInfo(null);
        }
      } else if (source === nodeId) {
        setDirectorPicking('source');
        setCurrentPickInfo(prev => ({ ...prev, source: undefined }));
      }
    }
  };

  const commitDraftToScript = () => {
    setEventData(JSON.parse(JSON.stringify(draftEventData)));
    setEventJson(JSON.stringify(draftEventData, null, 2));
  };

  const isDraftDifferent = JSON.stringify(draftEventData) !== JSON.stringify(eventData);

  return (
    <div className={`flex h-screen w-full overflow-hidden relative transition-colors duration-700 ${isDirectorMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-900'}`}>
      
      {/* Main Content Area */}
      <div className={`relative flex-1 h-full transition-all duration-500 ease-in-out ${devMode || isDirectorMode ? 'mr-[420px]' : 'mr-0'}`}>
        
        <EditorToolbar 
          projectName={projectName}
          setProjectName={setProjectName}
          onBack={onBack}
          onAddNode={() => handleNodeAdd()}
          isLinkMode={isLinkMode}
          setIsLinkMode={setIsLinkMode}
          isDirectorMode={isDirectorMode}
          onToggleDirectorMode={() => { setIsDirectorMode(!isDirectorMode); if (!isDirectorMode) setDevMode(false); }}
          devMode={devMode}
          setDevMode={(val) => { setDevMode(val); if (val) setIsDirectorMode(false); }}
          onSave={handleManualSave}
          saveStatus={saveStatus}
          isDirty={isDirty}
        />

        <GraphCanvas 
          key={canvasKey}
          ref={canvasRef} 
          data={graphData} 
          theme={themeData}
          isLinkMode={isLinkMode}
          isDirectorMode={isDirectorMode}
          directorPicking={directorPicking}
          onDirectorPick={handleDirectorNodePick}
          onNodeDragEnd={(nodes) => handleUpdate(nodes, graphData.links)}
          onNodeDelete={handleNodeDelete}
          onNodeUpdate={handleNodeUpdateSingle}
          onNodeAdd={handleNodeAdd}
          onLinkAdd={handleLinkAdd}
          onLinkDelete={handleLinkDelete}
          onSimulationEnd={handleUpdate}
          onZoneAdd={handleZoneAdd}
          onZoneUpdate={handleZoneUpdate}
          onZoneDelete={handleZoneDelete}
          onZoneOrder={handleZoneOrder}
          onLabelAdd={handleLabelAdd}
          onLabelUpdate={handleLabelUpdate}
          onLabelDelete={handleLabelDelete}
        />
      </div>

      {/* Sidebars */}
      <div className={`fixed top-0 right-0 h-full w-[420px] shadow-2xl transform transition-all duration-500 ease-in-out z-20 flex flex-col border-l border-slate-200 ${devMode || isDirectorMode ? 'translate-x-0' : 'translate-x-full'} ${isDirectorMode ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
        
        <DevToolsSidebar 
          isOpen={devMode}
          onClose={() => setDevMode(false)}
          graphJson={graphJson} setGraphJson={setGraphJson}
          themeJson={themeJson} setThemeJson={setThemeJson}
          eventJson={eventJson} setEventJson={setEventJson}
          errors={errors}
          onApplyGraph={() => handleApply('graph', graphJson, setGraphData)}
          onResetGraph={handleResetData}
          onApplyTheme={() => handleApply('theme', themeJson, setThemeData)}
          onApplyEvent={() => handleApply('event', eventJson, setEventData)}
          onRunAnimation={() => canvasRef.current?.runAnimation(eventData)}
        />

        <DirectorSidebar 
          isOpen={isDirectorMode}
          onClose={() => setIsDirectorMode(false)}
          graphData={graphData}
          themeData={themeData}
          draftEventData={draftEventData}
          setDraftEventData={setDraftEventData}
          directorPicking={directorPicking}
          isContinuousPick={isContinuousPick}
          onStartPick={startAtomicPick}
          isDirectorConfigOpen={isDirectorConfigOpen}
          setIsDirectorConfigOpen={setIsDirectorConfigOpen}
          directorDefaults={directorDefaults}
          setDirectorDefaults={setDirectorDefaults}
          isDraftDifferent={isDraftDifferent}
          onCommit={commitDraftToScript}
          onRunFullAnimation={() => canvasRef.current?.runAnimation(draftEventData)}
          canvasRef={canvasRef}
        />

      </div>
    </div>
  );
};

export default Editor;
