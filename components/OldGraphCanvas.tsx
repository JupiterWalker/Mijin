import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { GraphData, GraphNode, GraphLink, EventSequence, ThemeConfig, SimulationAction, AtomicStep, ParallelStep, EnvironmentZone, EnvironmentLabel } from '../types';
import { GraphControls } from './graph/GraphControls';
import { DirectorOverlay } from './graph/DirectorOverlay';
import { LinkControls } from './graph/LinkControls';
import { GraphContextMenu } from './graph/GraphContextMenu';
import { EnvironmentContextMenu } from './graph/EnvironmentContextMenu';
import { Plus, Square, Type, Lock, Unlock } from 'lucide-react';

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
  // New handlers for spatial organization
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
  onLabelDelete
}, ref) => {
  // --- Refs ---
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const nodeSelectionRef = useRef<d3.Selection<any, GraphNode, any, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<any, GraphLink, any, any> | null>(null);
  
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const lastTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // --- State ---
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  // Background Context Menu State
  const [bgContextMenu, setBgContextMenu] = useState<{x: number, y: number, worldX: number, worldY: number} | null>(null);

  // --- Derived State ---
  const selectedNode = useMemo(() => 
    data.nodes.find(n => n.id === selectedNodeId), 
    [selectedNodeId, data.nodes]
  );

  const selectedLink = useMemo(() => {
    if (!selectedLinkId) return null;
    const [sId, tId] = selectedLinkId.split('-');
    return linksRef.current.find(l => {
      const s = (l.source as any).id || l.source;
      const t = (l.target as any).id || l.target;
      return (s === sId && t === tId) || (s === tId && t === sId);
    });
  }, [selectedLinkId, data.links]);

  const selectedZone = useMemo(() => 
    data.environments?.zones.find(z => z.id === selectedZoneId),
    [selectedZoneId, data.environments]
  );

  const selectedLabel = useMemo(() => 
    data.environments?.labels.find(l => l.id === selectedLabelId),
    [selectedLabelId, data.environments]
  );

  const zones = useMemo(() => data.environments?.zones || [], [data.environments]);
  const labels = useMemo(() => data.environments?.labels || [], [data.environments]);

  // --- Helpers to calculate screen positions for overlays ---
  const getMenuPosition = () => { 
    if (!selectedNodeId || !svgRef.current) return null; 
    const simNode = nodesRef.current.find(n => n.id === selectedNodeId);
    if (!simNode) return null;
    const t = lastTransformRef.current; 
    const x = (simNode.x || 0) * t.k + t.x; 
    const y = (simNode.y || 0) * t.k + t.y; 
    return { x, y }; 
  };
  
  const getLinkMidPosition = () => { 
    if (!selectedLink || !svgRef.current) return null; 
    // Handle cases where source/target are just IDs strings or objects
    const s = selectedLink.source as unknown as GraphNode; 
    const t = selectedLink.target as unknown as GraphNode;
    
    // Safety check if simulation hasn't resolved references yet
    if (!s || !t || typeof s.x === 'undefined' || typeof t.x === 'undefined') return null;

    const midX = (s.x! + t.x!) / 2; 
    const midY = (s.y! + t.y!) / 2; 
    const trans = lastTransformRef.current; 
    return { x: midX * trans.k + trans.x, y: midY * trans.k + trans.y }; 
  };

  const getEnvMenuPosition = () => {
    if (!svgRef.current) return null;
    let worldX = 0, worldY = 0;
    
    if (selectedZone) {
      // Zone: Top Center (keep centering for zones as they don't resize on text change)
      worldX = selectedZone.x + selectedZone.width / 2; 
      worldY = selectedZone.y;
    } else if (selectedLabel) {
      // Label: Anchor to START (Top-Left) position to avoid jumping when resizing
      // Arrow will point here
      worldX = selectedLabel.x; 
      worldY = selectedLabel.y - selectedLabel.fontSize;
    } else {
      return null;
    }

    const t = lastTransformRef.current;
    return { 
      x: worldX * t.k + t.x, 
      y: worldY * t.k + t.y 
    };
  };

  // --- Reset selection when modes change ---
  useEffect(() => {
    if (directorPicking === null && !isLinkMode) {
      setLinkingSourceId(null);
      setMousePos(null);
    }
  }, [directorPicking, isLinkMode]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    if (readonly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';
      const isEnter = e.key === 'Enter';
      const isEsc = e.key === 'Escape';

      if (selectedNodeId) {
        if (isDelete) {
          e.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          e.preventDefault();
          onNodeDelete?.(selectedNodeId);
          setSelectedNodeId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          e.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedNodeId(null);
        }
      } else if (selectedLinkId) {
        if (isDelete) {
          e.preventDefault();
          const [s, t] = selectedLinkId.split('-');
          onLinkDelete?.(s, t);
          setSelectedLinkId(null);
        } else if (isEsc) {
          setSelectedLinkId(null);
        }
      } else if (selectedZoneId) {
        if (isDelete) {
          e.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          e.preventDefault();
          onZoneDelete?.(selectedZoneId);
          setSelectedZoneId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          e.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedZoneId(null);
        }
      } else if (selectedLabelId) {
        if (isDelete) {
          e.preventDefault();
          setIsConfirmingDelete(true);
        } else if (isEnter && isConfirmingDelete) {
          e.preventDefault();
          onLabelDelete?.(selectedLabelId);
          setSelectedLabelId(null);
          setIsConfirmingDelete(false);
        } else if (isEsc) {
          e.preventDefault();
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
  }, [selectedNodeId, selectedLinkId, selectedZoneId, selectedLabelId, isConfirmingDelete, onNodeDelete, onLinkDelete, onZoneDelete, onLabelDelete, readonly]);

  // --- Visual Styling Logic ---
  const getNodeVisuals = useCallback((node: GraphNode) => {
    const isLinkingSource = linkingSourceId === node.id;
    const isSelected = selectedNodeId === node.id;
    const isDirectorSource = directorPicking === 'target' && linkingSourceId === node.id;
    
    let visuals = {
      fill: isDirectorMode ? "#1e293b" : "#fff", 
      stroke: isSelected ? (isConfirmingDelete ? "#ef4444" : "#6366f1") : (isLinkingSource ? "#10b981" : (isDirectorSource ? "#a855f7" : (isDirectorMode ? "#475569" : "#fff"))),
      strokeWidth: isSelected ? 4 : (isLinkingSource || isDirectorSource ? 4 : 2),
      radius: readonly ? 12 : 20,
      badge: null as { text?: string, color?: string, textColor?: string } | null
    };
    
    const groupColors = ["#1a1a1a", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];
    visuals.fill = groupColors[(node.group || 0) % groupColors.length];
    
    if (node.apparence) {
      if (node.apparence.fill) visuals.fill = node.apparence.fill;
      if (node.apparence.stroke && !isSelected) visuals.stroke = node.apparence.stroke;
    }

    if (node.activeStates && theme.nodeStyles) {
      node.activeStates.forEach(stateName => {
        const styleDef = theme.nodeStyles[stateName];
        if (styleDef && styleDef.persistent) {
          const p = styleDef.persistent;
          if (p.fill) visuals.fill = p.fill;
          if (p.stroke && !isSelected) visuals.stroke = p.stroke;
          if (p.strokeWidth !== undefined && !isSelected) visuals.strokeWidth = p.strokeWidth;
          if (p.radius !== undefined) visuals.radius = p.radius;
          if (p.badge) visuals.badge = p.badge;
        }
      });
    }
    return visuals;
  }, [selectedNodeId, linkingSourceId, theme.nodeStyles, readonly, isConfirmingDelete, directorPicking, isDirectorMode]);

  const getLinkVisuals = useCallback((link: GraphLink) => {
    const sId = (link.source as any).id || link.source;
    const tId = (link.target as any).id || link.target;
    const isSelected = selectedLinkId === `${sId}-${tId}` || selectedLinkId === `${tId}-${sId}`;
    let visuals = {
      mainColor: isSelected ? (isDirectorMode ? "#a855f7" : "#6366f1") : (isDirectorMode ? "#334155" : "#94a3b8"),
      width: isSelected ? 4 : (readonly ? 1.5 : 2),
      opacity: isSelected ? 1 : 0.6,
      outlineColor: isSelected ? (isDirectorMode ? "rgba(168, 85, 247, 0.2)" : "rgba(99, 102, 241, 0.2)") : "transparent",
      outlineWidth: isSelected ? 8 : 0
    };
    if (link.activeStates && theme.linkStyles) {
      link.activeStates.forEach(stateName => {
        const styleDef = theme.linkStyles[stateName];
        if (styleDef && styleDef.persistent) {
          const p = styleDef.persistent;
          if (p.mainColor && !isSelected) visuals.mainColor = p.mainColor;
          if (p.width !== undefined && !isSelected) visuals.width = p.width;
          if (p.opacity !== undefined && !isSelected) visuals.opacity = p.opacity;
          if (p.outlineColor && !isSelected) visuals.outlineColor = p.outlineColor;
          if (p.outlineWidth !== undefined && !isSelected) visuals.outlineWidth = p.outlineWidth;
        }
      });
    }
    return visuals;
  }, [theme.linkStyles, readonly, selectedLinkId, isDirectorMode]);

  const updateStyles = useCallback(() => {
    if (linkSelectionRef.current) {
      linkSelectionRef.current.each(function(d) {
        const visuals = getLinkVisuals(d);
        const g = d3.select(this);
        g.select(".link-outline").attr("stroke", visuals.outlineColor!).attr("stroke-width", visuals.outlineWidth!);
        g.select(".link-core").attr("stroke", visuals.mainColor!).attr("stroke-width", visuals.width!).attr("stroke-opacity", visuals.opacity!);
      });
    }
    if (nodeSelectionRef.current) {
      nodeSelectionRef.current.each(function(d) {
        const visuals = getNodeVisuals(d);
        const isSelected = selectedNodeId === d.id;
        const g = d3.select(this);
        g.select(".node-circle")
          .attr("r", visuals.radius!)
          .attr("fill", visuals.fill!)
          .attr("stroke", visuals.stroke!)
          .attr("stroke-width", visuals.strokeWidth!)
          .classed("confirming-delete-anim", isSelected && isConfirmingDelete)
          .classed("selected-node-glow", isSelected && !isConfirmingDelete);
        
        g.select(".node-label-bg").attr("stroke", isDirectorMode ? "#0f172a" : "white");
        g.select(".node-label-fg").attr("fill", isDirectorMode ? "#cbd5e1" : "#1e293b");

        const badge = g.select(".node-badge");
        if (visuals.badge) {
          badge.style("display", "block");
          badge.select("circle").attr("fill", visuals.badge.color || "red");
          if (!readonly) badge.select("text").text(visuals.badge.text || "!").attr("fill", visuals.badge.textColor || "white");
        } else {
          badge.style("display", "none");
        }
      });
    }
  }, [getNodeVisuals, getLinkVisuals, readonly, selectedNodeId, isConfirmingDelete, isDirectorMode]);

  const createStepTimeline = useCallback((step: SimulationAction, animLayer: d3.Selection<any, any, any, any>, masterTl: gsap.core.Timeline) => {
    const tl = gsap.timeline({ delay: step.delay || 0 });
    const svg = d3.select(svgRef.current);

    if (step.type === 'parallel') {
      (step as ParallelStep).steps.forEach((subStep) => tl.add(createStepTimeline(subStep, animLayer, masterTl), 0));
    } else {
      const atomicStep = step as AtomicStep;
      const sourceNode = nodesRef.current.find(n => n.id === atomicStep.from);
      const targetNode = nodesRef.current.find(n => n.id === atomicStep.to);
      if (!sourceNode || !targetNode) return tl;

      const linkStyleDef = atomicStep.linkStyle ? theme.linkStyles?.[atomicStep.linkStyle] : null;
      const linkAnimConfig = linkStyleDef?.animation || {};
      const nodeStyleDef = atomicStep.targetNodeState ? theme.nodeStyles?.[atomicStep.targetNodeState] : null;
      const nodeAnimConfig = nodeStyleDef?.animation || {};
      const packetColor = linkAnimConfig.packetColor || (isDirectorMode ? "#a855f7" : "#ef4444");
      const packetRadius = linkAnimConfig.packetRadius || 6;
      const travelDuration = atomicStep.duration || linkAnimConfig.duration || 1;

      const packet = animLayer.append("circle")
        .attr("r", packetRadius)
        .attr("fill", packetColor)
        .attr("stroke", isDirectorMode ? "#1e1b4b" : "#fff")
        .attr("stroke-width", 2)
        .attr("cx", sourceNode.x || 0)
        .attr("cy", sourceNode.y || 0)
        .attr("opacity", 0);
      
      tl.to(`#node-${sourceNode.id}`, { attr: { r: 24 }, duration: 0.2, yoyo: true, repeat: 1 }, 0);
      tl.to(packet.node(), { opacity: 1, duration: 0.1 }, 0);
      tl.to(packet.node(), { attr: { cx: targetNode.x || 0, cy: targetNode.y || 0 }, duration: travelDuration, ease: "power1.inOut", onComplete: () => packet.remove() }, 0);

      tl.add(() => {
        if (atomicStep.linkStyle) {
          const directId = `#link-group-${atomicStep.from}-${atomicStep.to}`;
          const reverseId = `#link-group-${atomicStep.to}-${atomicStep.from}`;
          let linkGroupSelection = svg.select(directId);
          if (linkGroupSelection.empty()) linkGroupSelection = svg.select(reverseId);
          if (!linkGroupSelection.empty()) {
            const linkDatum = linkGroupSelection.datum() as GraphLink;
            if (linkDatum) {
              linkDatum.activeStates = linkDatum.activeStates || [];
              if (!linkDatum.activeStates.includes(atomicStep.linkStyle!)) linkDatum.activeStates.push(atomicStep.linkStyle!);
            }
          }
        }

        if (atomicStep.targetNodeState) {
          const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
          if (nodeDatum) {
            nodeDatum.activeStates = nodeDatum.activeStates || [];
            if (!nodeDatum.activeStates.includes(atomicStep.targetNodeState!)) nodeDatum.activeStates.push(atomicStep.targetNodeState!);
          }
        }
        updateStyles();
      }, travelDuration);

      if (atomicStep.processingNodeState) {
        tl.add(() => {
          const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
          if (nodeDatum) {
            nodeDatum.activeStates = nodeDatum.activeStates || [];
            nodeDatum.activeStates.push(atomicStep.processingNodeState!);
            updateStyles();
          }
        }, travelDuration + (atomicStep.durationProcessing || 0.4));
      }

      if (atomicStep.finalNodeState) {
        tl.add(() => {
          const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
          if (nodeDatum) {
            nodeDatum.activeStates = nodeDatum.activeStates || [];
            nodeDatum.activeStates.push(atomicStep.finalNodeState!);
            updateStyles();
          }
        }, travelDuration + (atomicStep.durationProcessing || 0.4) + (atomicStep.durationFinal || 0.4));
      }

      if (nodeAnimConfig.scale || nodeAnimConfig.durationIn) {
        const targetSelector = `#node-${targetNode.id}`;
        const animDuration = nodeAnimConfig.durationIn || 0.3;
        const animVars: any = { duration: animDuration, yoyo: true, repeat: 1, ease: "back.out(1.7)" };
        if (nodeAnimConfig.scale) animVars.attr = { r: 20 * nodeAnimConfig.scale };
        tl.to(targetSelector, animVars, travelDuration);
      }
    }
    return tl;
  }, [theme, updateStyles, isDirectorMode]);

  // --- D3 Simulation & Rendering ---
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Main D3 Render Effect ---
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    
    // Background click handler
    svg.selectAll(".canvas-bg")
      .data([1])
      .join("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "transparent")
      .attr("class", "canvas-bg")
      .on("click", (event) => {
        if (readonly) return;
        setBgContextMenu(null);
        if (event.target.classList.contains('canvas-bg')) {
          if (directorPicking) return;
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setSelectedZoneId(null);
          setSelectedLabelId(null);
          setLinkingSourceId(null);
          setMousePos(null);
          setIsConfirmingDelete(false);
        }
      })
      .on("contextmenu", (event) => {
        event.preventDefault();
        if (readonly || directorPicking || isLinkMode) return;
        const [mouseX, mouseY] = d3.pointer(event, wrapperRef.current);
        const transform = lastTransformRef.current;
        const [worldX, worldY] = transform.invert([mouseX, mouseY]);
        setBgContextMenu({ x: mouseX, y: mouseY, worldX, worldY });
      })
      .on("mousemove", (event) => {
        if (linkingSourceId || directorPicking === 'target') {
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          setMousePos({ x: mouseX, y: mouseY });
        }
      })
      .on("dblclick", (event) => {
         event.stopPropagation();
      });

    // Patterns
    const defs = svg.selectAll("defs").data([1]).join("defs");
    const patternSize = 40;
    const pattern = defs.selectAll("#grid-pattern").data([1]).join("pattern")
      .attr("id", "grid-pattern")
      .attr("width", patternSize)
      .attr("height", patternSize)
      .attr("patternUnits", "userSpaceOnUse");
    
    pattern.selectAll("path").data([1]).join("path")
      .attr("d", `M ${patternSize} 0 L 0 0 0 ${patternSize}`)
      .attr("fill", "none")
      .attr("stroke", isDirectorMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
      .attr("stroke-width", 1);

    svg.selectAll(".grid-rect").data([1]).join("rect")
      .attr("class", "grid-rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "url(#grid-pattern)")
      .style("pointer-events", "none");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => { 
        svg.select(".zoom-layer").attr("transform", event.transform); 
        lastTransformRef.current = event.transform; 
      });
    
    if (!readonly) {
       svg.call(zoom).on("dblclick.zoom", null);
    }

    const zoomLayer = svg.selectAll(".zoom-layer").data([1]).join("g").attr("class", "zoom-layer");
    if (!readonly) zoomLayer.attr("transform", lastTransformRef.current.toString());

    const zonesLayer = zoomLayer.selectAll(".zones-layer").data([1]).join("g").attr("class", "zones-layer");
    const linksLayer = zoomLayer.selectAll(".links-layer").data([1]).join("g").attr("class", "links-layer");
    const nodesLayer = zoomLayer.selectAll(".nodes-layer").data([1]).join("g").attr("class", "nodes-layer");
    const labelsLayer = zoomLayer.selectAll(".labels-layer").data([1]).join("g").attr("class", "labels-layer");
    const animLayer = zoomLayer.selectAll(".anim-layer").data([1]).join("g").attr("class", "anim-layer");

    // --- RECURSIVE DRAG UPDATE HELPER ---
    // This function recursively moves all attached elements when a zone is dragged.
    // It updates the visual DOM state immediately for smooth performance.
    const recursiveMove = (attachedIds: { nodes: string[], zones: string[], labels: string[] }, dx: number, dy: number, movedSet: Set<string>) => {
      // 1. Move Nodes
      attachedIds.nodes.forEach(id => {
        const node = nodesRef.current.find(n => n.id === id);
        if (node) {
          node.x = (node.x || 0) + dx;
          node.y = (node.y || 0) + dy;
          node.fx = node.x; node.fy = node.y; // Pin it so simulation doesn't fight back immediately
          // Visual Update
          nodesLayer.select(`#node-group-${id}`).attr("transform", `translate(${node.x},${node.y})`);
          // Update connected links visually
          linksLayer.selectAll(".link-group")
            .filter((d: any) => d.source.id === id || d.target.id === id)
            .selectAll("line")
            .attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
        }
      });

      // 2. Move Labels
      attachedIds.labels.forEach(id => {
         const labelData = labels.find(l => l.id === id);
         if (labelData) {
            labelData.x += dx; labelData.y += dy;
            // Visual update - finding the group by data binding might be slow, selector is better but we lack IDs on groups. 
            // We rely on D3 data binding update in next cycle, or manual selection if we added IDs.
            // Let's add IDs to label groups below to make this efficient.
            labelsLayer.selectAll(".label-group").filter((d: any) => d.id === id)
               .attr("transform", `translate(${labelData.x},${labelData.y})`);
         }
      });

      // 3. Move Sub-Zones (Recursive)
      attachedIds.zones.forEach(id => {
        if (movedSet.has(id)) return; // Prevent infinite loops or double moves
        movedSet.add(id);
        const zoneData = zones.find(z => z.id === id);
        if (zoneData) {
          zoneData.x += dx; zoneData.y += dy;
          zonesLayer.selectAll(".zone-group").filter((d: any) => d.id === id)
            .attr("transform", `translate(${zoneData.x},${zoneData.y})`);
          
          // Recurse
          if (zoneData.attachedElementIds) {
            recursiveMove(zoneData.attachedElementIds, dx, dy, movedSet);
          }
        }
      });
    };

    // --- Zones Rendering ---
    const zoneGroups = zonesLayer.selectAll("g.zone-group")
      .data(zones, (d: any) => d.id)
      .join("g")
      .attr("class", "zone-group")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .on("click", (event, d) => {
        if(readonly) return;
        event.stopPropagation();
        if (selectedZoneId !== d.id) {
           setSelectedZoneId(d.id);
           // Mutual exclusivity: Clear other selections
           setSelectedNodeId(null);
           setSelectedLinkId(null);
           setSelectedLabelId(null);
           setIsConfirmingDelete(false);
        }
      });

    zoneGroups.each(function(zoneData) {
      const g = d3.select(this);
      const isSelected = selectedZoneId === zoneData.id;

      // 1. Main Box
      g.selectAll("rect.zone-box")
        .data([zoneData])
        .join("rect")
        .attr("class", "zone-box")
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", 8)
        .attr("fill", d => {
          const baseColor = d.color || "rgba(59, 130, 246, 1)";
          const c = d3.color(baseColor);
          if (c) {
            c.opacity = 0.1;
            return c.toString();
          }
          return "rgba(59, 130, 246, 0.1)";
        })
        .attr("stroke", d => d.color || "#3b82f6")
        .attr("stroke-width", isSelected ? 3 : 2)
        .attr("stroke-dasharray", d => d.isLocked ? "none" : "5,5");

      // 2. Header Area
      g.selectAll("rect.zone-header")
        .data([zoneData])
        .join("rect")
        .attr("class", "zone-header")
        .attr("width", d => d.width)
        .attr("height", 30)
        .attr("fill", "transparent")
        .attr("cursor", "move");

      // 3. Title
      g.selectAll("text.zone-label")
        .data([zoneData])
        .join("text")
        .attr("class", "zone-label")
        .attr("x", 10)
        .attr("y", 20)
        .attr("font-size", "12px")
        .attr("font-weight", "700")
        .attr("fill", "#1e293b")
        .attr("pointer-events", "none") // Pass click through to header
        .text(d => d.label);

      // 4. Lock Toggle Icon
      const lockIconSize = 16;
      const lockX = zoneData.width - lockIconSize - 10;
      const lockY = 8;
      
      const lockBtn = g.selectAll("g.lock-btn")
        .data([zoneData])
        .join("g")
        .attr("class", "lock-btn")
        .attr("transform", `translate(${lockX}, ${lockY})`)
        .attr("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          onZoneUpdate?.({ ...d, isLocked: !d.isLocked });
        })
        .on("mousedown", (e) => e.stopPropagation());

      lockBtn.selectAll("rect.lock-hitbox").data([1]).join("rect").attr("class", "lock-hitbox").attr("width", lockIconSize).attr("height", lockIconSize).attr("fill", "transparent");

      const lockPathD = zoneData.isLocked 
        ? "M12.65 6H12V4a4 4 0 1 0-8 0v2h-.65a2 2 0 0 0-2 2v6.25a2 2 0 0 0 2 2h8.7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM6 4a2 2 0 1 1 4 0v2H6V4Zm4.65 12.25h-5.3a.75.75 0 0 1 0-1.5h5.3a.75.75 0 0 1 0 1.5Z"
        : "M12.65 6H12V4a4 4 0 1 0-8 0v2h-.65a2 2 0 0 0-2 2v6.25a2 2 0 0 0 2 2h8.7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM6 4a2 2 0 1 1 4 0v2H6V4Z";

      lockBtn.selectAll("path.lock-icon")
        .data([zoneData])
        .join("path")
        .attr("class", "lock-icon")
        .attr("d", lockPathD)
        .attr("fill", zoneData.isLocked ? "#ef4444" : "#64748b")
        .attr("transform", "scale(0.8)");

      // 5. Resize Handle
      const resizeData = zoneData.isLocked ? [] : [zoneData];
      const resizeHandle = g.selectAll("rect.resize-handle").data(resizeData).join("rect").attr("class", "resize-handle")
          .attr("x", d => d.width - 15).attr("y", d => d.height - 15).attr("width", 15).attr("height", 15)
          .attr("fill", "transparent").attr("cursor", "nwse-resize");
      
      resizeHandle.selectAll("title").data([1]).join("title").text("Resize Zone");

      g.selectAll("path.resize-indicator").data(resizeData).join("path").attr("class", "resize-indicator")
          .attr("d", d => `M${d.width - 4} ${d.height - 12} L${d.width - 12} ${d.height - 4} M${d.width - 4} ${d.height - 8} L${d.width - 8} ${d.height - 4}`)
          .attr("stroke", "#3b82f6").attr("stroke-width", 2).attr("stroke-linecap", "round").attr("pointer-events", "none");

      if (!readonly && !zoneData.isLocked) {
        resizeHandle.call(d3.drag<SVGRectElement, EnvironmentZone>()
          .on("start", (e) => { e.sourceEvent.stopPropagation(); if (selectedZoneId !== zoneData.id) setSelectedZoneId(zoneData.id); })
          .on("drag", function(e, d) {
            const newW = Math.max(100, d.width + e.dx);
            const newH = Math.max(50, d.height + e.dy);
            d.width = newW; d.height = newH;
            const parent = d3.select(this.parentNode as any);
            parent.select(".zone-box").attr("width", newW).attr("height", newH);
            parent.select(".zone-header").attr("width", newW);
            d3.select(this).attr("x", newW - 15).attr("y", newH - 15);
            parent.select(".resize-indicator").attr("d", `M${newW - 4} ${newH - 12} L${newW - 12} ${newH - 4} M${newW - 4} ${newH - 8} L${newW - 8} ${newH - 4}`);
            parent.select(".lock-btn").attr("transform", `translate(${newW - lockIconSize - 10}, ${lockY})`);
          })
          .on("end", (e, d) => { onZoneUpdate?.({ ...d }); }) as any
        );
      }
    });
    
    // Zone Group Drag Behavior with Recursive Sync
    if (!readonly) {
      zoneGroups
        .call(d3.drag<SVGGElement, EnvironmentZone>()
          .filter(function(event) {
            return event.target.classList.contains("zone-header") || event.target.classList.contains("zone-box");
          })
          .on("start", (e, d) => {
             e.sourceEvent.stopPropagation();
             if (selectedZoneId !== d.id) { 
               setSelectedZoneId(d.id); 
               // Mutual exclusivity
               setSelectedNodeId(null); 
               setSelectedLinkId(null); 
               setSelectedLabelId(null);
               setIsConfirmingDelete(false);
             }
          })
          .on("drag", function(e, d) {
             const dx = e.dx;
             const dy = e.dy;
             
             // Move Self
             d.x += dx; d.y += dy;
             d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
             
             // Recursive move attached elements if locked
             if (d.isLocked && d.attachedElementIds) {
               recursiveMove(d.attachedElementIds, dx, dy, new Set([d.id]));
             }
          })
          .on("end", (e, d) => { 
             // Bulk update on drag end
             onZoneUpdate?.({ ...d }); 
             // Trigger node updates (all nodes, as specific selection is hard without prop change)
             if (d.isLocked && d.attachedElementIds) {
                // If we moved attached nodes, we need to persist their state
                // GraphCanvas props only allow updating one zone or all nodes
                // onNodeDragEnd updates ALL nodesRef.current. 
                // Since we mutated nodesRef.current in recursiveMove, calling onNodeDragEnd works perfectly!
                if (d.attachedElementIds.nodes.length > 0) {
                  onNodeDragEnd?.(nodesRef.current);
                }
                
                // Labels & inner zones need individual updates as we don't have bulk update prop
                d.attachedElementIds.labels.forEach(lid => {
                   const l = labels.find(lb => lb.id === lid);
                   if (l) onLabelUpdate?.({...l});
                });
                d.attachedElementIds.zones.forEach(zid => {
                   const z = zones.find(zn => zn.id === zid);
                   if (z) onZoneUpdate?.({...z});
                });
             }
          }) as any
        );
    }

    // --- Labels Rendering ---
    const labelGroups = labelsLayer.selectAll("g.label-group")
      .data(labels, (d: any) => d.id)
      .join("g")
      .attr("class", "label-group")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .on("click", (event, d) => {
        if (readonly) return;
        event.stopPropagation();
        if (selectedLabelId !== d.id) {
          setSelectedLabelId(d.id);
          // Mutual exclusivity
          setSelectedNodeId(null);
          setSelectedZoneId(null);
          setSelectedLinkId(null);
          setIsConfirmingDelete(false);
        }
      });

    labelGroups.each(function(d) {
      const g = d3.select(this);
      const isSelected = selectedLabelId === d.id;

      // Selection box
      g.selectAll("rect.selection-box")
        .data(isSelected ? [1] : [])
        .join("rect")
        .attr("class", "selection-box")
        .attr("x", -5).attr("y", -d.fontSize).attr("width", (d.text.length * d.fontSize * 0.6) + 10).attr("height", d.fontSize + 10)
        .attr("fill", "transparent").attr("stroke", "#6366f1").attr("stroke-dasharray", "2,2");
      
      // Text
      g.selectAll("text.label-item")
        .data([d])
        .join("text")
        .attr("class", "label-item")
        .attr("font-size", `${d.fontSize}px`)
        .attr("fill", d => d.color || "#475569")
        .attr("font-weight", "600")
        .text(d => d.text)
        .style("user-select", "none");
    });

    if (!readonly) {
       labelGroups
         .call(d3.drag<SVGGElement, EnvironmentLabel>()
           .on("start", (e, d) => {
              e.sourceEvent.stopPropagation();
              if (selectedLabelId !== d.id) {
                 setSelectedLabelId(d.id);
                 // Mutual exclusivity
                 setSelectedNodeId(null);
                 setSelectedZoneId(null);
                 setSelectedLinkId(null);
                 setIsConfirmingDelete(false);
              }
           })
           .on("drag", function(e, d) {
              d.x += e.dx; d.y += e.dy;
              d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
           })
           .on("end", (e, d) => { onLabelUpdate?.({ ...d }); }) as any
         );
    }

    // --- Nodes & Links ---
    const oldNodesMap = new Map<string, GraphNode>(nodesRef.current.map(n => [n.id, n]));
    const nodes: GraphNode[] = data.nodes.map(n => {
      const old = oldNodesMap.get(n.id);
      return { ...n, x: old?.x ?? n.x, y: old?.y ?? n.y, fx: old?.fx ?? n.fx ?? null, fy: old?.fy ?? n.fy ?? null, vx: old?.vx, vy: old?.vy, activeStates: n.activeStates || [], meta_data: n.meta_data || {} };
    });
    const links: GraphLink[] = data.links.map(d => ({ ...d, activeStates: d.activeStates || [] }));
    nodesRef.current = nodes;
    linksRef.current = links;

    // Simulation
    const simulation = d3.forceSimulation(nodes).alpha(0) 
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(readonly ? 60 : 150))
      .force("charge", d3.forceManyBody().strength(readonly ? -300 : -400))
      .force("x", d3.forceX(width / 2).strength(0.01))
      .force("y", d3.forceY(height / 2).strength(0.01))
      .force("collide", d3.forceCollide().radius(readonly ? 30 : 45));
    simulationRef.current = simulation;

    // Ghost Line
    const ghostLine = zoomLayer.selectAll(".ghost-line").data([1]).join("line").attr("class", "ghost-line").attr("stroke", directorPicking ? "#a855f7" : "#10b981").attr("stroke-width", 3).attr("stroke-dasharray", "5,5").style("pointer-events", "none").style("opacity", 0);

    // Links
    const linkGroup = linksLayer.selectAll("g.link-group")
      .data(links, (d: any) => {
        const s = (d.source as any).id || d.source;
        const t = (d.target as any).id || d.target;
        return `${s}-${t}`;
      })
      .join("g")
      .attr("class", "link-group")
      .attr("id", (d: any) => {
         const s = (d.source as any).id || d.source;
         const t = (d.target as any).id || d.target;
         return `link-group-${s}-${t}`;
      })
      .style("cursor", readonly ? "default" : "pointer")
      .on("click", (event, d) => { 
        if (!readonly && !directorPicking) { 
          event.stopPropagation(); 
          const sId = (d.source as any).id || d.source; 
          const tId = (d.target as any).id || d.target; 
          setSelectedLinkId(`${sId}-${tId}`); 
          setSelectedNodeId(null); 
          setSelectedZoneId(null); 
          setSelectedLabelId(null); 
          setIsConfirmingDelete(false); 
        } 
      });

    // Fix: Bind data to line elements so "d" refers to the link in the tick function
    linkGroup.selectAll(".link-hitbox").data(d => [d]).join("line").attr("class", "link-hitbox").attr("stroke", "transparent").attr("stroke-width", 20);
    linkGroup.selectAll(".link-outline").data(d => [d]).join("line").attr("class", "link-outline").attr("stroke-linecap", "round");
    linkGroup.selectAll(".link-core").data(d => [d]).join("line").attr("class", "link-core");
    linkSelectionRef.current = linkGroup;

    // Nodes
    const nodeGroup = nodesLayer.selectAll("g.node-group")
      .data(nodes, (d: GraphNode) => d.id)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", readonly ? "default" : (isLinkMode || linkingSourceId || directorPicking ? "crosshair" : "pointer"))
      .on("click", (event, d) => { 
      if (readonly) return; 
      event.stopPropagation(); 
      if (directorPicking) {
        onDirectorPick?.(d.id);
        if (directorPicking === 'source') setLinkingSourceId(d.id);
        else setLinkingSourceId(null);
        return;
      }
      if (isLinkMode || linkingSourceId) { 
        if (!linkingSourceId) { setLinkingSourceId(d.id); } 
        else { if (linkingSourceId !== d.id) onLinkAdd?.(linkingSourceId, d.id); setLinkingSourceId(null); } 
      } else { 
        if (selectedNodeId !== d.id) { 
          setSelectedNodeId(d.id); 
          // Mutual exclusivity
          setSelectedLinkId(null); 
          setSelectedZoneId(null); 
          setSelectedLabelId(null); 
          setIsConfirmingDelete(false);
        } 
      } 
    });
    if (!readonly && !isLinkMode && !linkingSourceId && !directorPicking) nodeGroup.call(d3.drag<SVGGElement, GraphNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any);
    nodeGroup.attr("id", (d) => `node-group-${d.id}`);
    
    // FIX: Changed from data([1]) to data(d => [d]) to inherit the node data
    nodeGroup.selectAll(".node-circle").data(d => [d]).join("circle").attr("class", "node-circle").attr("id", (d: any) => `node-${d.id}`);
    
    // FIX: Changed from data([1]) to data(d => [d]) to inherit the node data
    const nodeLabels = nodeGroup.selectAll("text.node-text-label").data(d => [d]).join("text")
      .attr("class", "node-text-label")
      .attr("x", 0)
      .attr("y", readonly ? 22 : 32)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    nodeLabels.each(function(d) {
        const nodeD = d as unknown as GraphNode; 
        const txt = d3.select(this);
        txt.selectAll("tspan.node-label-bg").data([nodeD.label]).join("tspan").attr("class", "node-label-bg").attr("x", 0).attr("stroke-width", readonly ? 1.5 : 4).attr("stroke-opacity", 0.9).text(l => l);
        txt.selectAll("tspan.node-label-fg").data([nodeD.label]).join("tspan").attr("class", "node-label-fg").attr("x", 0).attr("stroke", "none").text(l => l);
    });

    const badgeGroup = nodeGroup.selectAll("g.node-badge").data([1]).join("g").attr("class", "node-badge").attr("transform", readonly ? "translate(8, -8)" : "translate(14, -14)").style("display", "none");
    badgeGroup.selectAll("circle").data([1]).join("circle").attr("r", readonly ? 5 : 8).attr("stroke", isDirectorMode ? "#0f172a" : "#fff").attr("stroke-width", 1.5);
    if (!readonly) badgeGroup.selectAll("text").data([1]).join("text").attr("text-anchor", "middle").attr("dy", 3).attr("font-size", "10px").attr("font-weight", "bold");
    nodeSelectionRef.current = nodeGroup;

    const ticked = () => {
      // Use optional chaining for safety during transitions
      linkGroup.selectAll("line")
        .attr("x1", (d: any) => d.source?.x || 0)
        .attr("y1", (d: any) => d.source?.y || 0)
        .attr("x2", (d: any) => d.target?.x || 0)
        .attr("y2", (d: any) => d.target?.y || 0);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x || 0},${d.y || 0})`);
      
      if ((linkingSourceId || directorPicking === 'target') && mousePos) {
        const sourceNode = nodes.find(n => n.id === linkingSourceId);
        if (sourceNode) {
          const trans = lastTransformRef.current;
          const [worldMouseX, worldMouseY] = trans.invert([mousePos.x, mousePos.y]);
          ghostLine.attr("x1", sourceNode.x!).attr("y1", sourceNode.y!).attr("x2", worldMouseX).attr("y2", worldMouseY).style("opacity", 1);
        }
      } else {
        ghostLine.style("opacity", 0);
      }
      updateStyles();
    };
    simulation.on("tick", ticked);

    if (readonly) {
      simulation.tick(200);
      ticked();
      simulation.stop();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          minX = Math.min(minX, n.x - 50); maxX = Math.max(maxX, n.x + 50);
          minY = Math.min(minY, n.y - 50); maxY = Math.max(maxY, n.y + 50);
        }
      });
      if (nodes.length > 0) {
        const fitWidth = Math.max(maxX - minX, 100); const fitHeight = Math.max(maxY - minY, 100);
        const scale = Math.min(width / fitWidth, height / fitHeight, 1.0);
        const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
        zoomLayer.attr("transform", `translate(${width/2}, ${height/2}) scale(${scale}) translate(${-centerX}, ${-centerY})`);
      }
    } else {
      // Force an initial tick to ensure static elements are positioned if alpha is 0
      ticked();
    }

    function dragstarted(event: any) { if (!event.active) simulation.alphaTarget(0.3).restart(); setSelectedNodeId(event.subject.id); setSelectedLinkId(null); setSelectedZoneId(null); setSelectedLabelId(null); nodesRef.current.forEach(n => { n.fx = n.x; n.fy = n.y; }); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
    function dragged(event: any) { event.subject.fx = event.x; event.subject.fy = event.y; }
    function dragended(event: any) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = event.x; event.subject.fy = event.y; if (onNodeDragEnd) onNodeDragEnd(nodesRef.current); }

    return () => { simulation.stop(); };
  }, [data, theme, readonly, isLinkMode, linkingSourceId, mousePos, onNodeDragEnd, onNodeAdd, updateStyles, onLinkAdd, dimensions.width, dimensions.height, directorPicking, onDirectorPick, isDirectorMode, zones, labels, onZoneUpdate, onLabelUpdate, selectedZoneId, selectedLabelId]); 

  // --- Imperative API ---
  useImperativeHandle(ref, () => ({
    runAnimation: (sequence: EventSequence) => {
      if (!svgRef.current || readonly) return;
      nodesRef.current.forEach(n => { n.activeStates = []; });
      linksRef.current.forEach(l => { l.activeStates = []; });
      if (sequence.initNodes) {
        sequence.initNodes.forEach(init => {
          const node = nodesRef.current.find(n => n.id === init.id);
          if (node) {
            node.activeStates = node.activeStates || [];
            if (!node.activeStates.includes(init.nodeState)) node.activeStates.push(init.nodeState);
          }
        });
      }
      updateStyles();
      const svg = d3.select(svgRef.current);
      let animLayer = svg.select<SVGGElement>(".zoom-layer .anim-layer");
      if (animLayer.empty()) animLayer = svg.select(".zoom-layer").append("g").attr("class", "anim-layer");
      animLayer.raise();
      const masterTl = gsap.timeline({
        onComplete: () => {
          if (onSimulationEnd) {
            const cleanNodes = nodesRef.current.map(n => ({ ...n, vx: undefined, vy: undefined, index: undefined }));
            const cleanLinks = linksRef.current.map(l => ({
              ...l,
              source: (l.source as any).id || l.source,
              target: (l.target as any).id || l.target
            }));
            onSimulationEnd(cleanNodes, cleanLinks);
          }
        }
      });
      sequence.steps.forEach(step => masterTl.add(createStepTimeline(step, animLayer, masterTl)));
    },
    runSingleStep: (step: SimulationAction) => {
      if (!svgRef.current || readonly) return;
      const svg = d3.select(svgRef.current);
      let animLayer = svg.select<SVGGElement>(".zoom-layer .anim-layer");
      if (animLayer.empty()) animLayer = svg.select(".zoom-layer").append("g").attr("class", "anim-layer");
      animLayer.raise();
      const tl = createStepTimeline(step, animLayer, gsap.timeline());
      tl.play();
    }
  }));

  const pos = getMenuPosition();
  const linkPos = getLinkMidPosition();
  const envMenuPos = getEnvMenuPosition();

  // --- Handlers ---
  const handleStartLinking = () => { if (selectedNodeId) setLinkingSourceId(selectedNodeId); };
  
  const handleAddFromBG = (type: 'node' | 'zone' | 'label') => {
    if (!bgContextMenu) return;
    const { worldX, worldY } = bgContextMenu;
    if (type === 'node') onNodeAdd?.(worldX, worldY);
    else if (type === 'zone') {
      onZoneAdd?.({
        id: crypto.randomUUID(),
        x: worldX,
        y: worldY,
        width: 200,
        height: 150,
        label: 'New Area',
        isLocked: false,
        attachedElementIds: { nodes: [], zones: [], labels: [] }
      });
    } else if (type === 'label') {
      onLabelAdd?.({
        id: crypto.randomUUID(),
        x: worldX,
        y: worldY,
        text: 'New Label',
        fontSize: 16
      });
    }
    setBgContextMenu(null);
  };

  return (
    <div ref={wrapperRef} className={`w-full h-full relative transition-colors duration-500 overflow-hidden ${isDirectorMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <style>{`
        @keyframes deletePulse { 0% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; } 50% { filter: drop-shadow(0 0 10px #ef4444); stroke-width: 6; } 100% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; } } 
        @keyframes selectionGlow { 0% { filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.6)); } 50% { filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.9)); } 100% { filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.6)); } }
        .confirming-delete-anim { animation: deletePulse 1s infinite ease-in-out; stroke: #ef4444 !important; }
        .selected-node-glow { animation: selectionGlow 2s infinite ease-in-out; stroke-opacity: 1; }
        .canvas-bg { fill: transparent; }
      `}</style>
      
      <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
      
      {/* Background Context Menu */}
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

      {/* Overlays */}
      <DirectorOverlay directorPicking={directorPicking || null} isLinkMode={isLinkMode} linkingSourceId={linkingSourceId} onCancel={() => { setLinkingSourceId(null); setMousePos(null); }} />
      
      {selectedLink && !readonly && !isLinkMode && !directorPicking && !selectedNodeId && (
        <LinkControls link={selectedLink} position={linkPos} isDirectorMode={isDirectorMode} onDelete={() => { const s = (selectedLink.source as any).id || selectedLink.source; const t = (selectedLink.target as any).id || selectedLink.target; onLinkDelete?.(s, t); setSelectedLinkId(null); }} />
      )}
      
      {selectedNode && !readonly && !isLinkMode && !linkingSourceId && !directorPicking && (
        <GraphContextMenu node={selectedNode} position={pos} isDirectorMode={isDirectorMode} isConfirmingDelete={isConfirmingDelete} setIsConfirmingDelete={setIsConfirmingDelete} onUpdate={onNodeUpdate} onDelete={(id) => { onNodeDelete?.(id); setSelectedNodeId(null); }} onStartLinking={handleStartLinking} onClose={() => setSelectedNodeId(null)} />
      )}
      
      {/* Environment Context Menu (Zones & Labels) */}
      {(selectedZone || selectedLabel) && !readonly && !isLinkMode && !directorPicking && (
        <EnvironmentContextMenu 
          data={(selectedZone || selectedLabel)!} 
          type={selectedZone ? 'zone' : 'label'}
          position={envMenuPos}
          onUpdate={selectedZone ? onZoneUpdate! : onLabelUpdate!}
          onDelete={selectedZone ? onZoneDelete! : onLabelDelete!}
          onClose={() => { setSelectedZoneId(null); setSelectedLabelId(null); }}
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