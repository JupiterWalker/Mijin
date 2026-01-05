import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { GraphData, GraphNode, GraphLink, EventSequence, ThemeConfig, SimulationAction, AtomicStep, ParallelStep } from '../types';
import { GraphControls } from './graph/GraphControls';
import { DirectorOverlay } from './graph/DirectorOverlay';
import { LinkControls } from './graph/LinkControls';
import { GraphContextMenu } from './graph/GraphContextMenu';

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
  onSimulationEnd 
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
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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
  }, [selectedLinkId, data.links, dimensions]); // Dimensions dep ensures updates on resize/redraw if needed

  // --- Helpers to calculate screen positions for overlays ---
  const getMenuPosition = () => { 
    if (!selectedNodeId || !svgRef.current) return null; 
    const simNode = nodesRef.current.find(n => n.id === selectedNodeId);
    if (!simNode) return null;
    const t = lastTransformRef.current; 
    const x = simNode.x! * t.k + t.x; 
    const y = simNode.y! * t.k + t.y; 
    return { x, y }; 
  };
  
  const getLinkMidPosition = () => { 
    if (!selectedLink || !svgRef.current) return null; 
    const s = selectedLink.source as GraphNode; 
    const t = selectedLink.target as GraphNode; 
    const midX = (s.x! + t.x!) / 2; 
    const midY = (s.y! + t.y!) / 2; 
    const trans = lastTransformRef.current; 
    return { x: midX * trans.k + trans.x, y: midY * trans.k + trans.y }; 
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
      if (selectedNodeId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          setIsConfirmingDelete(true);
        } else if (e.key === 'Enter' && isConfirmingDelete) {
          e.preventDefault();
          onNodeDelete?.(selectedNodeId);
          setSelectedNodeId(null);
          setIsConfirmingDelete(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsConfirmingDelete(false);
          setSelectedNodeId(null);
        }
      } else if (selectedLinkId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const [s, t] = selectedLinkId.split('-');
          onLinkDelete?.(s, t);
          setSelectedLinkId(null);
        } else if (e.key === 'Escape') {
          setSelectedLinkId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedLinkId, isConfirmingDelete, onNodeDelete, onLinkDelete, readonly]);

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

  // --- Animation Timeline Logic (kept inline as it depends on D3 refs heavily) ---
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

      const linkStyleDef = atomicStep.linkStyle ? theme.linkStyles[atomicStep.linkStyle] : null;
      const linkAnimConfig = linkStyleDef?.animation || {};
      const nodeStyleDef = atomicStep.targetNodeState ? theme.nodeStyles[atomicStep.targetNodeState] : null;
      const nodeAnimConfig = nodeStyleDef?.animation || {};
      const packetColor = linkAnimConfig.packetColor || (isDirectorMode ? "#a855f7" : "#ef4444");
      const packetRadius = linkAnimConfig.packetRadius || 6;
      const travelDuration = atomicStep.duration || linkAnimConfig.duration || 1;

      const packet = animLayer.append("circle")
        .attr("r", packetRadius)
        .attr("fill", packetColor)
        .attr("stroke", isDirectorMode ? "#1e1b4b" : "#fff")
        .attr("stroke-width", 2)
        .attr("cx", sourceNode.x!)
        .attr("cy", sourceNode.y!)
        .attr("opacity", 0);
      
      tl.to(`#node-${sourceNode.id}`, { attr: { r: 24 }, duration: 0.2, yoyo: true, repeat: 1 }, 0);
      tl.to(packet.node(), { opacity: 1, duration: 0.1 }, 0);
      tl.to(packet.node(), { attr: { cx: targetNode.x!, cy: targetNode.y! }, duration: travelDuration, ease: "power1.inOut", onComplete: () => packet.remove() }, 0);

      tl.add(() => {
         if (atomicStep.linkStyle) {
            const linkGroupId = `#link-group-${atomicStep.from}-${atomicStep.to}`;
            const reverseGroupId = `#link-group-${atomicStep.to}-${atomicStep.from}`;
            let linkGroupSelection = svg.select(linkGroupId);
            if (linkGroupSelection.empty()) linkGroupSelection = svg.select(reverseGroupId);
            if (!linkGroupSelection.empty()) {
              const linkDatum = linkGroupSelection.datum() as GraphLink;
              if (linkDatum) {
                if (!linkDatum.activeStates) linkDatum.activeStates = [];
                if (!linkDatum.activeStates.includes(atomicStep.linkStyle)) linkDatum.activeStates.push(atomicStep.linkStyle);
              }
            }
         }
         
         if (atomicStep.targetNodeState) {
            const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
            if (nodeDatum) {
               if (!nodeDatum.activeStates) nodeDatum.activeStates = [];
               if (!nodeDatum.activeStates.includes(atomicStep.targetNodeState)) nodeDatum.activeStates.push(atomicStep.targetNodeState);
            }
         }
         updateStyles();
      }, travelDuration);

      if (atomicStep.processingNodeState) {
        tl.add(() => {
          const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
          if (nodeDatum && atomicStep.processingNodeState) {
            if (!nodeDatum.activeStates) nodeDatum.activeStates = [];
            nodeDatum.activeStates.push(atomicStep.processingNodeState);
            updateStyles();
          }
        }, travelDuration + (atomicStep.durationProcessing || 0.4));
      }

      if (atomicStep.finalNodeState) {
        tl.add(() => {
          const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
          if (nodeDatum && atomicStep.finalNodeState) {
             if (!nodeDatum.activeStates) nodeDatum.activeStates = [];
             nodeDatum.activeStates.push(atomicStep.finalNodeState);
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

  // --- Main D3 Render Effect ---
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Background click handler
    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "transparent")
      .attr("class", "canvas-bg")
      .on("click", (event) => {
        if (readonly) return;
        if (event.target.classList.contains('canvas-bg')) {
          if (directorPicking) return;
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setLinkingSourceId(null);
          setMousePos(null);
          setIsConfirmingDelete(false);
        }
      })
      .on("mousemove", (event) => {
        if (linkingSourceId || directorPicking === 'target') {
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          setMousePos({ x: mouseX, y: mouseY });
        }
      })
      .on("dblclick", (event) => {
        if (!readonly && onNodeAdd && !isLinkMode && !directorPicking) {
          event.preventDefault();
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          const transform = lastTransformRef.current;
          const [worldX, worldY] = transform.invert([mouseX, mouseY]);
          onNodeAdd(worldX, worldY);
        }
      });

    // Grid Pattern
    const defs = svg.append("defs");
    const patternSize = 40;
    const pattern = defs.append("pattern")
      .attr("id", "grid-pattern")
      .attr("width", patternSize)
      .attr("height", patternSize)
      .attr("patternUnits", "userSpaceOnUse");
    
    pattern.append("path")
      .attr("d", `M ${patternSize} 0 L 0 0 0 ${patternSize}`)
      .attr("fill", "none")
      .attr("stroke", isDirectorMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
      .attr("stroke-width", 1);

    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "url(#grid-pattern)")
      .style("pointer-events", "none");

    // Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on("zoom", (event) => { 
      svg.select(".zoom-layer").attr("transform", event.transform); 
      lastTransformRef.current = event.transform; 
    });
    
    if (!readonly) svg.call(zoom).on("dblclick.zoom", null);

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    if (!readonly) zoomLayer.attr("transform", lastTransformRef.current.toString());

    // Prepare Data
    const oldNodesMap = new Map<string, GraphNode>(nodesRef.current.map(n => [n.id, n]));
    const nodes: GraphNode[] = data.nodes.map(n => {
      const old = oldNodesMap.get(n.id);
      return { 
        ...n, 
        x: old?.x ?? n.x, 
        y: old?.y ?? n.y, 
        fx: old?.fx ?? n.fx ?? null, 
        fy: old?.fy ?? n.fy ?? null, 
        vx: old?.vx, 
        vy: old?.vy, 
        activeStates: n.activeStates || [], 
        meta_data: n.meta_data || {} 
      };
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

    // Ghost Line (for linking)
    const ghostLine = zoomLayer.append("line").attr("class", "ghost-line").attr("stroke", directorPicking ? "#a855f7" : "#10b981").attr("stroke-width", 3).attr("stroke-dasharray", "5,5").style("pointer-events", "none").style("opacity", 0);

    // Links
    const linkGroup = zoomLayer.append("g").attr("class", "links-layer").selectAll("g").data(links).join("g").attr("id", (d: any) => `link-group-${d.source.id}-${d.target.id}`).style("cursor", readonly ? "default" : "pointer").on("click", (event, d) => { if (!readonly && !directorPicking) { event.stopPropagation(); const sId = (d.source as any).id || d.source; const tId = (d.target as any).id || d.target; setSelectedLinkId(`${sId}-${tId}`); setSelectedNodeId(null); setIsConfirmingDelete(false); } });
    linkGroup.append("line").attr("class", "link-hitbox").attr("stroke", "transparent").attr("stroke-width", 20);
    linkGroup.append("line").attr("class", "link-outline").attr("stroke-linecap", "round");
    linkGroup.append("line").attr("class", "link-core");
    linkSelectionRef.current = linkGroup;

    // Nodes
    const nodeGroup = zoomLayer.append("g").attr("class", "nodes-layer").selectAll("g").data(nodes).join("g").style("cursor", readonly ? "default" : (isLinkMode || linkingSourceId || directorPicking ? "crosshair" : "pointer")).on("click", (event, d) => { 
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
        if (selectedNodeId !== d.id) { setSelectedNodeId(d.id); setSelectedLinkId(null); } 
      } 
    });
    if (!readonly && !isLinkMode && !linkingSourceId && !directorPicking) nodeGroup.call(d3.drag<SVGGElement, GraphNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any);
    nodeGroup.attr("id", (d) => `node-group-${d.id}`);
    nodeGroup.append("circle").attr("class", "node-circle").attr("id", (d) => `node-${d.id}`);
    
    const labels = nodeGroup.append("text")
      .attr("x", 0)
      .attr("y", readonly ? 22 : 32)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    labels.append("tspan")
      .attr("class", "node-label-bg")
      .attr("x", 0) 
      .attr("stroke-width", readonly ? 1.5 : 4)
      .attr("stroke-opacity", 0.9)
      .text(d => d.label);

    labels.append("tspan")
      .attr("class", "node-label-fg")
      .attr("x", 0) 
      .attr("stroke", "none")
      .text(d => d.label);

    const badgeGroup = nodeGroup.append("g").attr("class", "node-badge").attr("transform", readonly ? "translate(8, -8)" : "translate(14, -14)").style("display", "none");
    badgeGroup.append("circle").attr("r", readonly ? 5 : 8).attr("stroke", isDirectorMode ? "#0f172a" : "#fff").attr("stroke-width", 1.5);
    if (!readonly) badgeGroup.append("text").attr("text-anchor", "middle").attr("dy", 3).attr("font-size", "10px").attr("font-weight", "bold");
    nodeSelectionRef.current = nodeGroup;

    if (!readonly) zoomLayer.append("g").attr("class", "anim-layer");

    const ticked = () => {
      linkGroup.selectAll("line").attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      
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
      // Auto-fit logic for readonly thumbnails
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          minX = Math.min(minX, n.x - 50);
          maxX = Math.max(maxX, n.x + 50);
          minY = Math.min(minY, n.y - 50);
          maxY = Math.max(maxY, n.y + 50);
        }
      });
      if (nodes.length > 0) {
        const fitWidth = Math.max(maxX - minX, 100);
        const fitHeight = Math.max(maxY - minY, 100);
        const scale = Math.min(width / fitWidth, height / fitHeight, 1.0);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        zoomLayer.attr("transform", `translate(${width/2}, ${height/2}) scale(${scale}) translate(${-centerX}, ${-centerY})`);
      }
    }

    function dragstarted(event: any) { if (!event.active) simulation.alphaTarget(0.3).restart(); setSelectedNodeId(event.subject.id); setSelectedLinkId(null); nodesRef.current.forEach(n => { n.fx = n.x; n.fy = n.y; }); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
    function dragged(event: any) { event.subject.fx = event.x; event.subject.fy = event.y; }
    function dragended(event: any) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = event.x; event.subject.fy = event.y; if (onNodeDragEnd) onNodeDragEnd(nodesRef.current); }

    return () => { simulation.stop(); };
  }, [data, theme, readonly, isLinkMode, linkingSourceId, mousePos, onNodeDragEnd, onNodeAdd, updateStyles, onLinkAdd, dimensions.width, dimensions.height, directorPicking, onDirectorPick, isDirectorMode]); 

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
            if (!node.activeStates) node.activeStates = [];
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
             const cleanLinks = linksRef.current.map(l => ({ ...l, source: (l.source as any).id || l.source, target: (l.target as any).id || l.target }));
             onSimulationEnd(cleanNodes, cleanLinks);
          }
        }
      });
      sequence.steps.forEach((step) => masterTl.add(createStepTimeline(step, animLayer, masterTl)));
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

  // --- Overlay Positions ---
  const pos = getMenuPosition();
  const linkPos = getLinkMidPosition();

  // --- Handlers for Child Components ---
  const handleStartLinking = () => { if (selectedNodeId) setLinkingSourceId(selectedNodeId); };
  const handleNodeUpdateWrapper = (node: GraphNode) => {
    if (onNodeUpdate) onNodeUpdate(node);
    // Update local d3 data references
    const idx = nodesRef.current.findIndex(n => n.id === node.id);
    if (idx !== -1) nodesRef.current[idx] = { ...nodesRef.current[idx], ...node };
    updateStyles();
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
      
      {/* Top Prompts */}
      <DirectorOverlay 
        directorPicking={directorPicking || null}
        isLinkMode={isLinkMode}
        linkingSourceId={linkingSourceId}
        onCancel={() => {
          setLinkingSourceId(null);
          setMousePos(null);
        }}
      />
      
      {/* Link Delete Button */}
      {selectedLink && !readonly && !isLinkMode && !directorPicking && !selectedNodeId && (
        <LinkControls 
          link={selectedLink}
          position={linkPos}
          isDirectorMode={isDirectorMode}
          onDelete={() => {
             const s = (selectedLink.source as any).id || selectedLink.source;
             const t = (selectedLink.target as any).id || selectedLink.target;
             onLinkDelete?.(s, t);
             setSelectedLinkId(null);
          }}
        />
      )}
      
      {/* Node Context Menu */}
      {selectedNode && !readonly && !isLinkMode && !linkingSourceId && !directorPicking && (
        <GraphContextMenu 
          node={selectedNode}
          position={pos}
          isDirectorMode={isDirectorMode}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
          onUpdate={handleNodeUpdateWrapper}
          onDelete={(id) => {
            onNodeDelete?.(id);
            setSelectedNodeId(null);
          }}
          onStartLinking={handleStartLinking}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* Bottom Help Panel */}
      {!readonly && !directorPicking && <GraphControls isDirectorMode={isDirectorMode} />}
      
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
export default GraphCanvas;
