import React, { useEffect, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import {
  GraphData,
  GraphNode,
  GraphLink,
  EventSequence,
  ThemeConfig,
  SimulationAction,
  EnvironmentZone,
  EnvironmentLabel,
} from '../types';
import { GraphControls } from './graph/GraphControls';
import { DirectorOverlay } from './graph/DirectorOverlay';
import { LinkControls } from './graph/LinkControls';
import { GraphContextMenu } from './graph/GraphContextMenu';
import { EnvironmentContextMenu } from './graph/EnvironmentContextMenu';
import { Plus, Square, Type } from 'lucide-react';
import { useGraphSimulation } from '../hooks/useGraphSimulation';

interface GraphCanvasProps {
  data: GraphData;
  theme: ThemeConfig;
  readonly?: boolean;
  isLinkMode?: boolean;
  isDirectorMode?: boolean;
  directorPicking?: 'source' | 'target' | null;
  onDirectorPick?: (nodeId: string) => void;
  onNodeDragEnd?: (nodes: GraphNode[]) => void;
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (node: GraphNode) => void;
  onNodeAdd?: (x: number, y: number) => void;
  onLinkAdd?: (sourceId: string, targetId: string) => void;
  onLinkDelete?: (sourceId: string, targetId: string) => void;
  onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void;
  onZoneAdd?: (zone: EnvironmentZone) => void;
  onZoneUpdate?: (zone: EnvironmentZone) => void;
  onZoneDelete?: (id: string) => void;
  onZoneOrder?: (id: string, direction: 'front' | 'back') => void;
  onLabelAdd?: (label: EnvironmentLabel) => void;
  onLabelUpdate?: (label: EnvironmentLabel) => void;
  onLabelDelete?: (id: string) => void;
}

export interface GraphCanvasHandle {
  runAnimation: (sequence: EventSequence) => void;
  runSingleStep: (step: SimulationAction) => void;
}

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({
  data,
  theme,
  readonly = false,
  isLinkMode = false,
  isDirectorMode = false,
  directorPicking = null,
  onDirectorPick,
  onNodeDragEnd,
  onNodeDelete,
  onNodeUpdate,
  onNodeAdd,
  onLinkAdd,
  onLinkDelete,
  onSimulationEnd,
  onZoneAdd,
  onZoneUpdate,
  onZoneDelete,
  onZoneOrder,
  onLabelAdd,
  onLabelUpdate,
  onLabelDelete,
}, ref) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [bgContextMenu, setBgContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);

  const zones = useMemo(() => data.environments?.zones || [], [data.environments]);
  const labels = useMemo(() => data.environments?.labels || [], [data.environments]);

  const {
    svgRef,
    wrapperRef,
    nodesRef,
    linksRef,
    lastTransformRef,
    runAnimation,
    runSingleStep,
  } = useGraphSimulation({
    data,
    theme,
    readonly,
    isLinkMode,
    isDirectorMode,
    directorPicking,
    linkingSourceId,
    setLinkingSourceId,
    mousePos,
    setMousePos,
    selectedNodeId,
    setSelectedNodeId,
    selectedLinkId,
    setSelectedLinkId,
    selectedZoneId,
    setSelectedZoneId,
    selectedLabelId,
    setSelectedLabelId,
    isConfirmingDelete,
    setIsConfirmingDelete,
    setBgContextMenu,
    onDirectorPick,
    onNodeDragEnd,
    onLinkAdd,
    onZoneUpdate,
    onLabelUpdate,
    zones,
    labels,
  });

  const selectedNode = useMemo(
    () => data.nodes.find((node) => node.id === selectedNodeId) || null,
    [data.nodes, selectedNodeId],
  );

  const selectedLink = useMemo(() => {
    if (!selectedLinkId) return null;
    const [sourceId, targetId] = selectedLinkId.split('-');
    return (
      linksRef.current.find((link) => {
        const s = (link.source as any).id || link.source;
        const t = (link.target as any).id || link.target;
        return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
      }) || null
    );
  }, [linksRef, selectedLinkId]);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || null,
    [zones, selectedZoneId],
  );

  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) || null,
    [labels, selectedLabelId],
  );

  useEffect(() => {
    if (directorPicking === null && !isLinkMode) {
      setLinkingSourceId(null);
      setMousePos(null);
    }
  }, [directorPicking, isLinkMode]);

  useEffect(() => {
    if (readonly) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      const isDelete = event.key === 'Delete' || event.key === 'Backspace';
      const isEnter = event.key === 'Enter';
      const isEsc = event.key === 'Escape';

      if (selectedNodeId) {
        if (isDelete) {
          event.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          event.preventDefault();
          onNodeDelete?.(selectedNodeId);
          setSelectedNodeId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          event.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedNodeId(null);
        }
      } else if (selectedLinkId) {
        if (isDelete) {
          event.preventDefault();
          const [s, t] = selectedLinkId.split('-');
          onLinkDelete?.(s, t);
          setSelectedLinkId(null);
        } else if (isEsc) {
          setSelectedLinkId(null);
        }
      } else if (selectedZoneId) {
        if (isDelete) {
          event.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          event.preventDefault();
          onZoneDelete?.(selectedZoneId);
          setSelectedZoneId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          event.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedZoneId(null);
        }
      } else if (selectedLabelId) {
        if (isDelete) {
          event.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          event.preventDefault();
          onLabelDelete?.(selectedLabelId);
          setSelectedLabelId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          event.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedLabelId(null);
        }
      } else if (isEsc) {
        setBgContextMenu(null);
        setSelectedZoneId(null);
        setSelectedLabelId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    selectedLinkId,
    selectedZoneId,
    selectedLabelId,
    isConfirmingDelete,
    onNodeDelete,
    onLinkDelete,
    onZoneDelete,
    onLabelDelete,
    readonly,
  ]);

  const getMenuPosition = () => {
    if (!selectedNodeId) return null;
    const simNode = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!simNode) return null;
    const transform = lastTransformRef.current;
    return {
      x: (simNode.x || 0) * transform.k + transform.x,
      y: (simNode.y || 0) * transform.k + transform.y,
    };
  };

  const getLinkMidPosition = () => {
    if (!selectedLink) return null;
    const sourceNode = selectedLink.source as GraphNode | undefined;
    const targetNode = selectedLink.target as GraphNode | undefined;
    if (!sourceNode || !targetNode || typeof sourceNode.x === 'undefined' || typeof targetNode.x === 'undefined') return null;
    const transform = lastTransformRef.current;
    const midX = ((sourceNode.x || 0) + (targetNode.x || 0)) / 2;
    const midY = ((sourceNode.y || 0) + (targetNode.y || 0)) / 2;
    return { x: midX * transform.k + transform.x, y: midY * transform.k + transform.y };
  };

  const getEnvMenuPosition = () => {
    if (!selectedZone && !selectedLabel) return null;
    const transform = lastTransformRef.current;
    if (selectedZone) {
      const worldX = selectedZone.x + selectedZone.width / 2;
      const worldY = selectedZone.y;
      return { x: worldX * transform.k + transform.x, y: worldY * transform.k + transform.y };
    }
    if (selectedLabel) {
      const worldX = selectedLabel.x;
      const worldY = selectedLabel.y - selectedLabel.fontSize;
      return { x: worldX * transform.k + transform.x, y: worldY * transform.k + transform.y };
    }
    return null;
  };

  useImperativeHandle(ref, () => ({
    runAnimation: (sequence: EventSequence) => {
      runAnimation(sequence, onSimulationEnd);
    },
    runSingleStep: (step: SimulationAction) => {
      runSingleStep(step);
    },
  }));

  const handleStartLinking = () => {
    if (selectedNodeId) setLinkingSourceId(selectedNodeId);
  };

  const handleAddFromBG = (type: 'node' | 'zone' | 'label') => {
    if (!bgContextMenu) return;
    const { worldX, worldY } = bgContextMenu;
    if (type === 'node') {
      onNodeAdd?.(worldX, worldY);
    } else if (type === 'zone') {
      onZoneAdd?.({
        id: crypto.randomUUID(),
        x: worldX,
        y: worldY,
        width: 200,
        height: 150,
        label: 'New Area',
        isLocked: false,
        attachedElementIds: { nodes: [], zones: [], labels: [] },
      });
    } else if (type === 'label') {
      onLabelAdd?.({
        id: crypto.randomUUID(),
        x: worldX,
        y: worldY,
        text: 'New Label',
        fontSize: 16,
      });
    }
    setBgContextMenu(null);
  };

  const menuPosition = getMenuPosition();
  const linkPosition = getLinkMidPosition();
  const envMenuPosition = getEnvMenuPosition();

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-full relative transition-colors duration-500 overflow-hidden ${isDirectorMode ? 'bg-slate-900' : 'bg-slate-50'}`}
    >
      <style>{`
        @keyframes deletePulse { 0% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; } 50% { filter: drop-shadow(0 0 10px #ef4444); stroke-width: 6; } 100% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; } }
        @keyframes selectionGlow { 0% { filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.6)); } 50% { filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.9)); } 100% { filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.6)); } }
        .confirming-delete-anim { animation: deletePulse 1s infinite ease-in-out; stroke: #ef4444 !important; }
        .selected-node-glow { animation: selectionGlow 2s infinite ease-in-out; stroke-opacity: 1; }
        .canvas-bg { fill: transparent; }
      `}</style>

      <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {bgContextMenu && (
        <div
          className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 min-w-[160px] animate-in zoom-in-95 duration-150"
          style={{ left: bgContextMenu.x, top: bgContextMenu.y }}
        >
          <button
            onClick={() => handleAddFromBG('node')}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Node
          </button>
          <button
            onClick={() => handleAddFromBG('zone')}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" /> Add Zone
          </button>
          <button
            onClick={() => handleAddFromBG('label')}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
          >
            <Type className="w-4 h-4" /> Add Label
          </button>
        </div>
      )}

      <DirectorOverlay
        directorPicking={directorPicking || null}
        isLinkMode={isLinkMode}
        linkingSourceId={linkingSourceId}
        onCancel={() => {
          setLinkingSourceId(null);
          setMousePos(null);
        }}
      />

      {selectedLink && !readonly && !isLinkMode && !directorPicking && !selectedNodeId && (
        <LinkControls
          link={selectedLink}
          position={linkPosition}
          isDirectorMode={isDirectorMode}
          onDelete={() => {
            const sourceId = (selectedLink.source as any).id || selectedLink.source;
            const targetId = (selectedLink.target as any).id || selectedLink.target;
            onLinkDelete?.(sourceId, targetId);
            setSelectedLinkId(null);
          }}
        />
      )}

      {selectedNode && !readonly && !isLinkMode && !linkingSourceId && !directorPicking && (
        <GraphContextMenu
          node={selectedNode}
          position={menuPosition}
          isDirectorMode={isDirectorMode}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
          onUpdate={onNodeUpdate}
          onDelete={(id) => {
            onNodeDelete?.(id);
            setSelectedNodeId(null);
          }}
          onStartLinking={handleStartLinking}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {(selectedZone || selectedLabel) && !readonly && !isLinkMode && !directorPicking && (
        <EnvironmentContextMenu
          data={(selectedZone || selectedLabel)!}
          type={selectedZone ? 'zone' : 'label'}
          position={envMenuPosition}
          onUpdate={selectedZone ? onZoneUpdate! : onLabelUpdate!}
          onDelete={selectedZone ? onZoneDelete! : onLabelDelete!}
          onClose={() => {
            setSelectedZoneId(null);
            setSelectedLabelId(null);
          }}
          onOrder={onZoneOrder}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
        />
      )}

      {!readonly && !directorPicking && <GraphControls isDirectorMode={isDirectorMode} />}
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
export default GraphCanvas;
