
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { GraphData, GraphNode, GraphLink, EventSequence, ThemeConfig, SimulationAction, AtomicStep, ParallelStep } from '../types';

interface GraphCanvasProps {
  data: GraphData;
  theme: ThemeConfig;
  readonly?: boolean;
  onNodeDragEnd?: (nodes: GraphNode[]) => void;
  onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void;
}

export interface GraphCanvasHandle {
  runAnimation: (sequence: EventSequence) => void;
}

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({ data, theme, readonly = false, onNodeDragEnd, onSimulationEnd }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  
  // D3 Refs
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // State to track dimensions for consistent rendering
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    if (!wrapperRef.current || readonly) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        
        // Update SVG attributes immediately to keep coordinate system in sync
        if (svgRef.current) {
          d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);
        }

        // Update simulation center force if it exists
        if (simulationRef.current) {
          simulationRef.current.force("center", d3.forceCenter(width / 2, height / 2));
          simulationRef.current.alpha(0.01).restart(); // Gentle nudge to re-center
        }
      }
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [readonly]);

  const getNodeVisuals = (node: GraphNode) => {
    let visuals = {
      fill: "#fff", 
      stroke: "#fff",
      strokeWidth: 2,
      radius: readonly ? 12 : 20,
      badge: null as { text?: string, color?: string, textColor?: string } | null
    };

    const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b"];
    visuals.fill = groupColors[(node.group || 0) % groupColors.length];

    if (node.activeStates && theme.nodeStyles) {
      node.activeStates.forEach(stateName => {
        const styleDef = theme.nodeStyles[stateName];
        if (styleDef && styleDef.persistent) {
          const p = styleDef.persistent;
          if (p.fill) visuals.fill = p.fill;
          if (p.stroke) visuals.stroke = p.stroke;
          if (p.strokeWidth !== undefined) visuals.strokeWidth = p.strokeWidth;
          if (p.radius !== undefined) visuals.radius = p.radius;
          if (p.badge) visuals.badge = p.badge;
        }
      });
    }
    return visuals;
  };

  const getLinkVisuals = (link: GraphLink) => {
    let visuals = {
      mainColor: "#94a3b8",
      width: readonly ? 1.5 : 2,
      opacity: 0.6,
      outlineColor: "transparent",
      outlineWidth: 0
    };

    if (link.activeStates && theme.linkStyles) {
      link.activeStates.forEach(stateName => {
        const styleDef = theme.linkStyles[stateName];
        if (styleDef && styleDef.persistent) {
          const p = styleDef.persistent;
          if (p.mainColor) visuals.mainColor = p.mainColor;
          if (p.width !== undefined) visuals.width = p.width;
          if (p.opacity !== undefined) visuals.opacity = p.opacity;
          if (p.outlineColor) visuals.outlineColor = p.outlineColor;
          if (p.outlineWidth !== undefined) visuals.outlineWidth = p.outlineWidth;
        }
      });
    }
    return visuals;
  };

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
    
    minimapSvg.select(".minimap-viewport")
      .attr("x", mapX)
      .attr("y", mapY)
      .attr("width", viewW)
      .attr("height", viewH);
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
      svg.append("rect")
        .attr("class", "minimap-viewport")
        .attr("fill", "#ef4444")
        .attr("fill-opacity", 0.1)
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 20) 
        .attr("stroke-opacity", 0.5);
    }

    content.attr("transform", `translate(${worldW/2}, ${worldH/2})`);

    content.selectAll("line")
      .data(links)
      .join("line")
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 5);

    content.selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("cx", (d) => d.x!)
      .attr("cy", (d) => d.y!)
      .attr("r", 15)
      .attr("fill", (d) => {
        const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b"];
        return groupColors[(d.group || 0) % groupColors.length];
      });
  }

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;
    if (width === 0) return;

    setDimensions({ width, height });

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        d3.select(svgRef.current).select(".zoom-layer").attr("transform", event.transform);
        lastTransformRef.current = event.transform;
        if (!readonly) updateMinimap(event.transform, width, height);
      });
    
    zoomBehaviorRef.current = zoom;

    if (!readonly) {
        svg.call(zoom).on("dblclick.zoom", null);
        svg.call(zoom.transform, lastTransformRef.current);
    } else {
        svg.on(".zoom", null);
    }

    svg.selectAll("*").remove();
    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    if (!readonly) zoomLayer.attr("transform", lastTransformRef.current.toString());

    const oldNodesMap = new Map<string, GraphNode>(nodesRef.current.map(n => [n.id, n]));
    const nodes: GraphNode[] = data.nodes.map(n => {
      const old = oldNodesMap.get(n.id);
      return { 
        ...n,
        x: n.x ?? old?.x,
        y: n.y ?? old?.y,
        fx: n.fx ?? old?.fx ?? (n.x !== undefined ? n.x : null),
        fy: n.fy ?? old?.fy ?? (n.y !== undefined ? n.y : null),
        vx: old?.vx,
        vy: old?.vy,
        activeStates: n.activeStates || []
      };
    });

    const links: GraphLink[] = data.links.map(d => ({ 
      ...d,
      activeStates: d.activeStates || []
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(readonly ? 60 : 150))
      .force("charge", d3.forceManyBody().strength(readonly ? -300 : -400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(readonly ? 25 : 40));

    simulationRef.current = simulation;

    const linkGroup = zoomLayer.append("g")
      .attr("class", "links-layer")
      .selectAll("g")
      .data(links)
      .join("g")
      .attr("id", (d: any) => `link-group-${d.source.id}-${d.target.id}`);

    linkGroup.append("line").attr("class", "link-outline").attr("stroke-linecap", "round");
    linkGroup.append("line").attr("class", "link-core");

    const nodeGroup = zoomLayer.append("g")
      .attr("class", "nodes-layer")
      .selectAll("g")
      .data(nodes)
      .join("g");
      
    if (!readonly) {
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
      .attr("fill", "#475569")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .clone(true).lower()
      .attr("stroke", "white")
      .attr("stroke-width", readonly ? 1.5 : 3);

    const badgeGroup = nodeGroup.append("g")
      .attr("class", "node-badge")
      .attr("transform", readonly ? "translate(8, -8)" : "translate(14, -14)")
      .style("display", "none");

    badgeGroup.append("circle").attr("r", readonly ? 5 : 8).attr("stroke", "#fff").attr("stroke-width", 1.5);
    if (!readonly) badgeGroup.append("text").attr("text-anchor", "middle").attr("dy", 3).attr("font-size", "10px").attr("font-weight", "bold");

    if (!readonly) zoomLayer.append("g").attr("class", "anim-layer");

    const updateStyles = () => {
       linkGroup.each(function(d) {
         const visuals = getLinkVisuals(d);
         const g = d3.select(this);
         g.select(".link-outline").attr("stroke", visuals.outlineColor!).attr("stroke-width", visuals.outlineWidth!);
         g.select(".link-core").attr("stroke", visuals.mainColor!).attr("stroke-width", visuals.width!).attr("stroke-opacity", visuals.opacity!);
       });

       nodeGroup.each(function(d) {
         const visuals = getNodeVisuals(d);
         const g = d3.select(this);
         g.select(".node-circle").attr("r", visuals.radius!).attr("fill", visuals.fill!).attr("stroke", visuals.stroke!).attr("stroke-width", visuals.strokeWidth!);
         const badge = g.select(".node-badge");
         if (visuals.badge) {
            badge.style("display", "block");
            badge.select("circle").attr("fill", visuals.badge.color || "red");
            if(!readonly) badge.select("text").text(visuals.badge.text || "!").attr("fill", visuals.badge.textColor || "white");
         } else {
            badge.style("display", "none");
         }
       });
    };

    const ticked = () => {
      linkGroup.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      
      updateStyles();
      if (!readonly) {
        // Use dimensions from state to ensure minimap matches current visible area during transitions
        renderMinimapNodes(nodes, links, wrapperRef.current?.clientWidth || width, wrapperRef.current?.clientHeight || height);
        updateMinimap(lastTransformRef.current, wrapperRef.current?.clientWidth || width, wrapperRef.current?.clientHeight || height);
      }
    };

    simulation.on("tick", ticked);

    if (readonly) {
        simulation.tick(300);
        ticked();
        simulation.stop();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let hasNodes = false;
        nodes.forEach(n => {
            if (n.x !== undefined && n.y !== undefined) {
                hasNodes = true;
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y);
            }
        });
        if (hasNodes) {
          const padding = 40;
          const fitWidth = Math.max(maxX - minX, 100);
          const fitHeight = Math.max(maxY - minY, 100);
          const scale = Math.min((width - padding) / fitWidth, (height - padding) / fitHeight, 1.2);
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          zoomLayer.attr("transform", `translate(${width/2}, ${height/2}) scale(${scale}) translate(${-centerX}, ${-centerY})`);
        }
    }

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
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
      if (onNodeDragEnd) onNodeDragEnd(nodes);
    }

    return () => {
      simulation.stop();
    };
  }, [data, theme, readonly, onNodeDragEnd]); 

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
                  const visuals = getLinkVisuals(linkDatum);
                  linkGroupSelection.select(".link-outline").attr("stroke", visuals.outlineColor!).attr("stroke-width", visuals.outlineWidth!);
                  linkGroupSelection.select(".link-core").attr("stroke", visuals.mainColor!).attr("stroke-width", visuals.width!).attr("stroke-opacity", visuals.opacity!);
                }
             }
             if (atomicStep.targetNodeState) {
                const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
                if (nodeDatum) {
                   if (!nodeDatum.activeStates) nodeDatum.activeStates = [];
                   if (!nodeDatum.activeStates.includes(atomicStep.targetNodeState)) nodeDatum.activeStates.push(atomicStep.targetNodeState);
                   const visuals = getNodeVisuals(nodeDatum);
                   const g = d3.select(`#node-group-${targetNode.id}`);
                   g.select(".node-circle").attr("fill", visuals.fill!).attr("stroke", visuals.stroke!).attr("stroke-width", visuals.strokeWidth!);
                   const badge = g.select(".node-badge");
                   if (visuals.badge) { badge.style("display", "block").select("circle").attr("fill", visuals.badge.color || "red"); badge.select("text").text(visuals.badge.text || "!"); }
                }
             }
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

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-50 overflow-hidden">
      <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
      {!readonly && (
        <>
          <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border border-slate-200 text-xs text-slate-500 pointer-events-none">
            Powered by GraphFlow Engine
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
