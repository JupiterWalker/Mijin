
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { Pencil, Trash2, Check, X, Palette, Trash, Plus, Link as LinkIcon, Link2Off, ChevronDown, ChevronUp, Database, CornerDownLeft } from 'lucide-react';
import { GraphData, GraphNode, GraphLink, EventSequence, ThemeConfig, SimulationAction, AtomicStep, ParallelStep } from '../types';

interface GraphCanvasProps {
  data: GraphData;
  theme: ThemeConfig;
  readonly?: boolean;
  isLinkMode?: boolean;
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
}

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({ 
  data, 
  theme, 
  readonly = false, 
  isLinkMode = false,
  onNodeDragEnd, 
  onNodeDelete,
  onNodeUpdate,
  onNodeAdd,
  onLinkAdd,
  onLinkDelete,
  onSimulationEnd 
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  
  const nodeSelectionRef = useRef<d3.Selection<any, GraphNode, any, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<any, GraphLink, any, any> | null>(null);
  
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // UI State
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null); // Format: "sourceId-targetId"
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editingLabel, setEditingLabel] = useState("");
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [newMetaKey, setNewMetaKey] = useState("");
  const [newMetaValue, setNewMetaValue] = useState("");

  const selectedNode = useMemo(() => 
    nodesRef.current.find(n => n.id === selectedNodeId), 
    [selectedNodeId, data.nodes, dimensions]
  );

  const selectedLink = useMemo(() => {
    if (!selectedLinkId) return null;
    const [sId, tId] = selectedLinkId.split('-');
    return linksRef.current.find(l => {
      const s = (l.source as any).id || l.source;
      const t = (l.target as any).id || l.target;
      return (s === sId && t === tId) || (s === tId && t === sId);
    });
  }, [selectedLinkId, data.links, dimensions]);

  // Keyboard Interaction Logic
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

  const getNodeVisuals = useCallback((node: GraphNode) => {
    const isLinkingSource = linkingSourceId === node.id;
    const isSelected = selectedNodeId === node.id;
    
    let visuals = {
      fill: "#fff", 
      stroke: isSelected ? (isConfirmingDelete ? "#ef4444" : "#6366f1") : (isLinkingSource ? "#10b981" : "#fff"),
      strokeWidth: isSelected ? 4 : (isLinkingSource ? 4 : 2),
      radius: readonly ? 12 : 20,
      badge: null as { text?: string, color?: string, textColor?: string } | null
    };

    const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
    visuals.fill = groupColors[(node.group || 0) % groupColors.length];

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
  }, [selectedNodeId, linkingSourceId, theme.nodeStyles, readonly, isConfirmingDelete]);

  const getLinkVisuals = useCallback((link: GraphLink) => {
    const sId = (link.source as any).id || link.source;
    const tId = (link.target as any).id || link.target;
    const isSelected = selectedLinkId === `${sId}-${tId}` || selectedLinkId === `${tId}-${sId}`;
    
    let visuals = {
      mainColor: isSelected ? "#6366f1" : "#94a3b8",
      width: isSelected ? 4 : (readonly ? 1.5 : 2),
      opacity: isSelected ? 1 : 0.6,
      outlineColor: isSelected ? "rgba(99, 102, 241, 0.2)" : "transparent",
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
  }, [theme.linkStyles, readonly, selectedLinkId]);

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
          .classed("confirming-delete-anim", isSelected && isConfirmingDelete);

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
  }, [getNodeVisuals, getLinkVisuals, readonly, selectedNodeId, isConfirmingDelete]);

  useEffect(() => {
    if (!wrapperRef.current || readonly) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions(prev => ({ ...prev, width, height }));
        if (svgRef.current) {
          d3.select(svgRef.current).attr("width", width).attr("height", height).attr("viewBox", [0, 0, width, height]);
        }
        if (simulationRef.current) {
          simulationRef.current.force("x", d3.forceX(width / 2).strength(0.01));
          simulationRef.current.force("y", d3.forceY(height / 2).strength(0.01));
          // Remove automatic restart on resize to keep nodes still
          // simulationRef.current.alpha(0.01).restart();
        }
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [readonly]);

  const updateMinimap = (transform: d3.ZoomTransform, width: number, height: number) => {
    if (!minimapRef.current || width === 0) return;
    const worldScale = 4;
    const worldW = width * worldScale;
    const worldH = height * worldScale;
    const minimapSvg = d3.select(minimapRef.current);
    const viewX = (-transform.x / transform.k) + (width / 2);
    const viewY = (-transform.y / transform.k) + (height / 2);
    const viewW = width / transform.k;
    const viewH = height / transform.k;
    const mapX = (viewX - width/2) + (worldW/2);
    const mapY = (viewY - height/2) + (worldH/2);
    minimapSvg.select(".minimap-viewport").attr("x", mapX).attr("y", mapY).attr("width", viewW).attr("height", viewH);
  };

  const renderMinimapNodes = (nodes: GraphNode[], links: GraphLink[], width: number, height: number) => {
    if (!minimapRef.current || width === 0) return;
    const worldScale = 4;
    const worldW = width * worldScale;
    const worldH = height * worldScale;
    const svg = d3.select(minimapRef.current);
    svg.attr("viewBox", [0, 0, worldW, worldH]);
    let content = svg.select<SVGGElement>(".minimap-content");
    if (content.empty()) {
      svg.append("rect").attr("class", "minimap-bg").attr("width", worldW).attr("height", worldH).attr("fill", "transparent");
      content = svg.append("g").attr("class", "minimap-content");
      svg.append("rect").attr("class", "minimap-viewport").attr("fill", "#ef4444").attr("fill-opacity", 0.1).attr("stroke", "#ef4444").attr("stroke-width", 20).attr("stroke-opacity", 0.5);
    }
    content.attr("transform", `translate(${worldW/2}, ${worldH/2})`);
    content.selectAll("line").data(links).join("line").attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y).attr("stroke", "#94a3b8").attr("stroke-width", 5);
    content.selectAll("circle").data(nodes).join("circle").attr("cx", (d) => d.x!).attr("cy", (d) => d.y!).attr("r", 15).attr("fill", (d) => {
      const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
      return groupColors[(d.group || 0) % groupColors.length];
    });
  }

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;
    if (width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Define Glow filter for confirming delete
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "confirm-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "blur").attr("operator", "over");

    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "transparent")
      .attr("class", "canvas-bg")
      .on("mousemove", (event) => {
        if (linkingSourceId) {
          const [mx, my] = d3.pointer(event, svgRef.current);
          const t = lastTransformRef.current;
          const [wx, wy] = t.invert([mx, my]);
          setMousePos({x: wx, y: wy});
        }
      })
      .on("click", () => {
        if (!readonly) {
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setLinkingSourceId(null);
          setMousePos(null);
          setIsConfirmingDelete(false);
          setIsMetaExpanded(false);
        }
      })
      .on("dblclick", (event) => {
        if (!readonly && onNodeAdd && !isLinkMode) {
          event.preventDefault();
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          const transform = lastTransformRef.current;
          const [worldX, worldY] = transform.invert([mouseX, mouseY]);
          onNodeAdd(worldX, worldY);
        }
      });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        svg.select(".zoom-layer").attr("transform", event.transform);
        lastTransformRef.current = event.transform;
        if (!readonly) {
           updateMinimap(event.transform, width, height);
           setDimensions(d => ({...d})); 
        }
      });
    
    zoomBehaviorRef.current = zoom;

    if (!readonly) {
        svg.call(zoom).on("dblclick.zoom", null);
    }

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    if (!readonly) zoomLayer.attr("transform", lastTransformRef.current.toString());

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

    const links: GraphLink[] = data.links.map(d => ({ 
      ...d,
      activeStates: d.activeStates || []
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    // Remove initial alpha to prevent automatic shaking on load
    const simulation = d3.forceSimulation(nodes)
      .alpha(0) 
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(readonly ? 60 : 150))
      .force("charge", d3.forceManyBody().strength(readonly ? -300 : -400))
      .force("x", d3.forceX(width / 2).strength(readonly ? 0.05 : 0.01))
      .force("y", d3.forceY(height / 2).strength(readonly ? 0.05 : 0.01))
      .force("collide", d3.forceCollide().radius(readonly ? 30 : 45));

    simulationRef.current = simulation;

    const linkGroup = zoomLayer.append("g")
      .attr("class", "links-layer")
      .selectAll("g")
      .data(links)
      .join("g")
      .attr("id", (d: any) => `link-group-${d.source.id}-${d.target.id}`)
      .style("cursor", readonly ? "default" : "pointer")
      .on("click", (event, d) => {
        if (!readonly) {
          event.stopPropagation();
          const sId = (d.source as any).id || d.source;
          const tId = (d.target as any).id || d.target;
          setSelectedLinkId(`${sId}-${tId}`);
          setSelectedNodeId(null);
          setIsConfirmingDelete(false);
        }
      });

    linkGroup.append("line").attr("class", "link-hitbox").attr("stroke", "transparent").attr("stroke-width", 20);
    linkGroup.append("line").attr("class", "link-outline").attr("stroke-linecap", "round");
    linkGroup.append("line").attr("class", "link-core");
    linkSelectionRef.current = linkGroup;

    const ghostLink = zoomLayer.append("line")
      .attr("class", "ghost-link")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .style("display", "none");

    const nodeGroup = zoomLayer.append("g")
      .attr("class", "nodes-layer")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", readonly ? "default" : (isLinkMode || linkingSourceId ? "crosshair" : "pointer"))
      .on("click", (event, d) => {
        if (readonly) return;
        event.stopPropagation();
        
        if (isLinkMode || linkingSourceId) {
          if (!linkingSourceId) {
            setLinkingSourceId(d.id);
            const [mx, my] = d3.pointer(event, svgRef.current);
            const t = lastTransformRef.current;
            const [wx, wy] = t.invert([mx, my]);
            setMousePos({x: wx, y: wy});
          } else {
            if (linkingSourceId !== d.id) {
              onLinkAdd?.(linkingSourceId, d.id);
            }
            setLinkingSourceId(null);
            setMousePos(null);
          }
        } else {
          if (selectedNodeId !== d.id) {
            setSelectedNodeId(d.id);
            setSelectedLinkId(null);
            setEditingLabel(d.label);
          }
        }
      });
      
    if (!readonly && !isLinkMode && !linkingSourceId) {
      nodeGroup.call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);
    }
      
    nodeGroup.attr("id", (d) => `node-group-${d.id}`);
    nodeGroup.append("circle").attr("class", "node-circle").attr("id", (d) => `node-${d.id}`);

    nodeGroup.append("text")
      .text(d => d.label)
      .attr("x", 0)
      .attr("y", readonly ? 22 : 32)
      .attr("text-anchor", "middle")
      .attr("fill", "#1e293b")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .clone(true).lower()
      .attr("stroke", "white")
      .attr("stroke-width", readonly ? 1.5 : 4)
      .attr("stroke-opacity", 0.9);

    const badgeGroup = nodeGroup.append("g")
      .attr("class", "node-badge")
      .attr("transform", readonly ? "translate(8, -8)" : "translate(14, -14)")
      .style("display", "none");

    badgeGroup.append("circle").attr("r", readonly ? 5 : 8).attr("stroke", "#fff").attr("stroke-width", 1.5);
    if (!readonly) badgeGroup.append("text").attr("text-anchor", "middle").attr("dy", 3).attr("font-size", "10px").attr("font-weight", "bold");
    
    nodeSelectionRef.current = nodeGroup;

    if (!readonly) zoomLayer.append("g").attr("class", "anim-layer");

    const ticked = () => {
      linkGroup.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      
      if (linkingSourceId && mousePos) {
        const sourceNode = nodes.find(n => n.id === linkingSourceId);
        if (sourceNode) {
          ghostLink
            .style("display", "block")
            .attr("x1", sourceNode.x!)
            .attr("y1", sourceNode.y!)
            .attr("x2", mousePos.x)
            .attr("y2", mousePos.y);
        }
      } else {
        ghostLink.style("display", "none");
      }

      updateStyles();
      if (!readonly) {
        renderMinimapNodes(nodes, links, wrapperRef.current?.clientWidth || width, wrapperRef.current?.clientHeight || height);
        updateMinimap(lastTransformRef.current, wrapperRef.current?.clientWidth || width, wrapperRef.current?.clientHeight || height);
        setDimensions(d => ({ ...d }));
      }
    };

    simulation.on("tick", ticked);

    // Manually trigger ticked once to position nodes without the "shake"
    ticked();

    if (readonly) {
        simulation.tick(300);
        ticked();
        simulation.stop();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            if (n.x !== undefined && n.y !== undefined) {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y);
            }
        });
        const padding = 40;
        const fitWidth = Math.max(maxX - minX, 100);
        const fitHeight = Math.max(maxY - minY, 100);
        const scale = Math.min((width - padding) / fitWidth, (height - padding) / fitHeight, 1.2);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        zoomLayer.attr("transform", `translate(${width/2}, ${height/2}) scale(${scale}) translate(${-centerX}, ${-centerY})`);
    }

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      
      setSelectedNodeId(event.subject.id);
      setSelectedLinkId(null);
      setEditingLabel(event.subject.label);
      setLinkingSourceId(null); 
      
      nodesRef.current.forEach(n => { n.fx = n.x; n.fy = n.y; });
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = event.x;
      event.subject.fy = event.y;
      if (onNodeDragEnd) onNodeDragEnd(nodesRef.current);
    }

    return () => {
      simulation.stop();
    };
  }, [data, theme, readonly, isLinkMode, linkingSourceId, mousePos, onNodeDragEnd, onNodeAdd, updateStyles, onLinkAdd]); 

  useImperativeHandle(ref, () => ({
    runAnimation: (sequence: EventSequence) => {
      if (!svgRef.current || readonly) return;
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
      
      const createStepTimeline = (step: SimulationAction): gsap.core.Timeline => {
        const tl = gsap.timeline({ delay: step.delay || 0 });
        if (step.type === 'parallel') {
          (step as ParallelStep).steps.forEach((subStep) => tl.add(createStepTimeline(subStep), 0));
        } else {
          const atomicStep = step as AtomicStep;
          const sourceNode = nodesRef.current.find(n => n.id === atomicStep.from);
          const targetNode = nodesRef.current.find(n => n.id === atomicStep.to);
          if (!sourceNode || !targetNode) return tl;

          const linkStyleDef = atomicStep.linkStyle ? theme.linkStyles[atomicStep.linkStyle] : null;
          const linkAnimConfig = linkStyleDef?.animation || {};
          const nodeStyleDef = atomicStep.targetNodeState ? theme.nodeStyles[atomicStep.targetNodeState] : null;
          const nodeAnimConfig = nodeStyleDef?.animation || {};
          const packetColor = linkAnimConfig.packetColor || "#ef4444";
          const packetRadius = linkAnimConfig.packetRadius || 6;
          const travelDuration = atomicStep.duration || linkAnimConfig.duration || 1;

          const packet = animLayer.append("circle").attr("r", packetRadius).attr("fill", packetColor).attr("stroke", "#fff").attr("stroke-width", 2).attr("cx", sourceNode.x!).attr("cy", sourceNode.y!).attr("opacity", 0);
          
          tl.to(`#node-${sourceNode.id}`, { attr: { r: 24 }, duration: 0.2, yoyo: true, repeat: 1 }, 0);
          tl.to(packet.node(), { opacity: 1, duration: 0.1 }, 0);
          
          tl.to(packet.node(), { 
            attr: { cx: targetNode.x!, cy: targetNode.y! }, 
            duration: travelDuration, 
            ease: "power1.inOut", 
            onComplete: () => packet.remove() 
          }, 0);

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

          if (nodeAnimConfig.scale || nodeAnimConfig.durationIn) {
              const targetSelector = `#node-${targetNode.id}`;
              const animDuration = nodeAnimConfig.durationIn || 0.3;
              const animVars: any = { duration: animDuration, yoyo: true, repeat: 1, ease: "back.out(1.7)" };
              if (nodeAnimConfig.scale) animVars.attr = { r: 20 * nodeAnimConfig.scale };
              tl.to(targetSelector, animVars, travelDuration);
          }
        }
        return tl;
      };

      sequence.steps.forEach((step) => masterTl.add(createStepTimeline(step)));
    }
  }));

  const handleAddMeta = () => {
    if (!newMetaKey || !selectedNode) return;
    const currentMeta = selectedNode.meta_data || {};
    const updatedNode = {
      ...selectedNode,
      meta_data: {
        ...currentMeta,
        [newMetaKey]: newMetaValue
      }
    };
    const index = nodesRef.current.findIndex(n => n.id === selectedNode.id);
    if (index !== -1) nodesRef.current[index] = updatedNode;

    onNodeUpdate?.(updatedNode);
    setNewMetaKey("");
    setNewMetaValue("");
  };

  const handleRemoveMeta = (key: string) => {
    if (!selectedNode) return;
    const currentMeta = { ...selectedNode.meta_data };
    delete currentMeta[key];
    const updatedNode = {
      ...selectedNode,
      meta_data: currentMeta
    };
    const index = nodesRef.current.findIndex(n => n.id === selectedNode.id);
    if (index !== -1) nodesRef.current[index] = updatedNode;
    
    onNodeUpdate?.(updatedNode);
  };

  const getMenuPosition = () => {
    if (!selectedNode || !svgRef.current) return null;
    const t = lastTransformRef.current;
    const x = selectedNode.x! * t.k + t.x;
    const y = selectedNode.y! * t.k + t.y;
    return { x, y };
  };

  const getLinkMidPosition = () => {
    if (!selectedLink || !svgRef.current) return null;
    const s = selectedLink.source as GraphNode;
    const t = selectedLink.target as GraphNode;
    const midX = (s.x! + t.x!) / 2;
    const midY = (s.y! + t.y!) / 2;
    const trans = lastTransformRef.current;
    return {
      x: midX * trans.k + trans.x,
      y: midY * trans.k + trans.y
    };
  };

  const pos = getMenuPosition();
  const linkPos = getLinkMidPosition();
  const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

  const handleStartLinking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedNode) {
      setLinkingSourceId(selectedNode.id);
    }
  };

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-50 overflow-hidden">
      <style>{`
        @keyframes deletePulse {
          0% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; }
          50% { filter: drop-shadow(0 0 10px #ef4444); stroke-width: 6; }
          100% { filter: drop-shadow(0 0 2px #ef4444); stroke-width: 4; }
        }
        .confirming-delete-anim {
          animation: deletePulse 1s infinite ease-in-out;
          stroke: #ef4444 !important;
        }
      `}</style>
      <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
      
      {(isLinkMode || linkingSourceId) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce z-50 flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          {linkingSourceId ? "点击目标节点以连接" : "选择源节点开始连线"}
          <button 
            onClick={() => {setLinkingSourceId(null); setMousePos(null);}} 
            className="ml-2 hover:bg-white/20 rounded-full p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Link Deletion Button */}
      {selectedLink && !readonly && !isLinkMode && linkPos && !selectedNode && (
        <div 
          className="absolute z-50 pointer-events-auto flex items-center justify-center animate-in zoom-in-95 fade-in duration-200"
          style={{ 
            left: linkPos.x, 
            top: linkPos.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              const s = (selectedLink.source as any).id || selectedLink.source;
              const t = (selectedLink.target as any).id || selectedLink.target;
              onLinkDelete?.(s, t);
              setSelectedLinkId(null);
            }}
            className="bg-white p-2.5 rounded-full shadow-xl border border-slate-200 text-red-500 hover:bg-red-50 hover:scale-110 active:scale-95 transition-all group"
            title="删除连接 (Del)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Floating Node Editor */}
      {selectedNode && !readonly && !isLinkMode && !linkingSourceId && pos && (
        <div 
          className="absolute z-50 pointer-events-none flex flex-col items-center"
          style={{ 
            left: pos.x, 
            top: pos.y - 35,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className={`bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border rounded-2xl p-1 pointer-events-auto flex flex-col items-stretch animate-in zoom-in-95 fade-in duration-200 w-auto min-w-[280px] transition-colors ${isConfirmingDelete ? 'border-red-400 bg-red-50/95' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1 p-0.5">
              <input 
                autoFocus
                className={`px-3 py-1.5 text-sm font-semibold text-slate-800 bg-transparent border-none focus:ring-0 w-24 outline-none ${isConfirmingDelete ? 'opacity-50' : ''}`}
                value={editingLabel}
                disabled={isConfirmingDelete}
                onChange={(e) => {
                  setEditingLabel(e.target.value);
                  if (onNodeUpdate) onNodeUpdate({ ...selectedNode, label: e.target.value });
                }}
                onKeyDown={(e) => { if(e.key === 'Enter') setSelectedNodeId(null); }}
                onMouseDown={(e) => e.stopPropagation()} 
              />
              
              <div className="w-px h-6 bg-slate-200 mx-1" />
              
              <div className={`flex gap-1 px-1 ${isConfirmingDelete ? 'opacity-30 pointer-events-none' : ''}`}>
                {groupColors.map((color, idx) => (
                  <button
                    key={idx}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onNodeUpdate?.({ ...selectedNode, group: idx })}
                    className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${selectedNode.group === idx ? 'ring-2 ring-slate-400 ring-offset-1 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <div className="flex gap-1 items-center">
                {!isConfirmingDelete ? (
                  <>
                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={handleStartLinking}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
                      title="创建连接 (L)"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>

                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMetaExpanded(!isMetaExpanded);
                      }}
                      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                        isMetaExpanded ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title="编辑元数据"
                    >
                      <Database className="w-4 h-4" />
                    </button>

                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsConfirmingDelete(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                      title="删除 (Del)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200">
                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeDelete?.(selectedNode.id);
                        setSelectedNodeId(null);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      确认删除
                      <CornerDownLeft className="w-3 h-3 opacity-70" />
                    </button>
                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-all"
                      title="取消 (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isMetaExpanded && !isConfirmingDelete && (
              <div className="border-t border-slate-100 p-3 space-y-2 animate-in slide-in-from-bottom-2 duration-200 max-h-48 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Meta Data (meta_data)</span>
                </div>
                
                <div className="space-y-1.5">
                  {Object.entries(selectedNode.meta_data || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-md border border-slate-100 group">
                      <span className="text-[11px] font-mono font-bold text-slate-500 w-16 truncate" title={k}>{k}:</span>
                      <span className="text-[11px] text-slate-700 flex-1 truncate">{String(v)}</span>
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => handleRemoveMeta(k)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex flex-col gap-1.5">
                  <div className="flex gap-1">
                    <input 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex-1 outline-none focus:ring-1 focus:ring-indigo-500" 
                      placeholder="key"
                      value={newMetaKey}
                      onChange={(e) => setNewMetaKey(e.target.value)}
                    />
                    <input 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex-1 outline-none focus:ring-1 focus:ring-indigo-500" 
                      placeholder="value"
                      value={newMetaValue}
                      onChange={(e) => setNewMetaValue(e.target.value)}
                    />
                    <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={handleAddMeta}
                      className="bg-indigo-600 text-white rounded p-1 hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={`w-3 h-3 border-r border-b rotate-45 -mt-1.5 shadow-[2px_2px_5px_rgba(0,0,0,0.02)] transition-colors ${isConfirmingDelete ? 'bg-red-50 border-red-400' : 'bg-white border-slate-200'}`} />
        </div>
      )}

      {!readonly && (
        <>
          <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border border-slate-200 text-[10px] text-slate-400 pointer-events-none flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5"><kbd className="bg-slate-100 px-1 rounded border border-slate-300">Del</kbd> 删除节点/连线</div>
            <div className="flex items-center gap-1.5"><kbd className="bg-slate-100 px-1 rounded border border-slate-300">Enter</kbd> 确认操作</div>
            <div className="flex items-center gap-1.5"><kbd className="bg-slate-100 px-1 rounded border border-slate-300">Esc</kbd> 取消选择</div>
          </div>
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-lg overflow-hidden pointer-events-none">
            <svg ref={minimapRef} className="w-full h-full block bg-slate-50/50" preserveAspectRatio="xMidYMid meet" />
          </div>
        </>
      )}
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';

export default GraphCanvas;
