import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { GraphData, GraphNode, GraphLink, EventSequence, ThemeConfig } from '../types';

interface GraphCanvasProps {
  data: GraphData;
  theme: ThemeConfig;
  onNodeDragEnd?: (nodes: GraphNode[]) => void;
  onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void;
}

export interface GraphCanvasHandle {
  runAnimation: (sequence: EventSequence) => void;
}

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({ data, theme, onNodeDragEnd, onSimulationEnd }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // Helper: Compute merged visuals based on active states
  const getNodeVisuals = (node: GraphNode) => {
    let visuals = {
      fill: "#fff", // Base default
      stroke: "#fff",
      strokeWidth: 2,
      radius: 20,
      badge: null as { text?: string, color?: string, textColor?: string } | null
    };

    // Apply group color base
    const groupColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b"];
    visuals.fill = groupColors[(node.group || 0) % groupColors.length];

    // Stack states
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
      width: 2,
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

  // Initialize and update Graph
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Data Merging
    const oldNodesMap = new Map(nodesRef.current.map(n => [n.id, n] as [string, GraphNode]));

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

    // Handle Link Data (D3 replaces source/target string IDs with object references)
    // We need to be careful when mapping new data to preserve visited states if not supplied
    const links: GraphLink[] = data.links.map(d => ({ 
      ...d,
      activeStates: d.activeStates || []
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    simulationRef.current = simulation;

    // --- DRAWING ---

    const linkGroup = svg.append("g")
      .attr("class", "links-layer")
      .selectAll("g")
      .data(links)
      .join("g")
      .attr("id", (d: any) => `link-group-${d.source.id}-${d.target.id}`);

    // Link Outline
    linkGroup.append("line")
      .attr("class", "link-outline")
      .attr("stroke-linecap", "round");

    // Link Core
    linkGroup.append("line")
      .attr("class", "link-core");

    const nodeGroup = svg.append("g")
      .attr("class", "nodes-layer")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any)
      .attr("id", (d) => `node-group-${d.id}`);

    // Node Circle
    nodeGroup.append("circle")
      .attr("class", "node-circle")
      .attr("id", (d) => `node-${d.id}`);

    // Node Label
    nodeGroup.append("text")
      .text(d => d.label)
      .attr("x", 0)
      .attr("y", 32)
      .attr("text-anchor", "middle")
      .attr("fill", "#475569")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .clone(true).lower()
      .attr("stroke", "white")
      .attr("stroke-width", 3);

    // Badge Group
    const badgeGroup = nodeGroup.append("g")
      .attr("class", "node-badge")
      .attr("transform", "translate(14, -14)")
      .style("display", "none"); // Hidden by default

    badgeGroup.append("circle")
      .attr("r", 8)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
    
    badgeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 3)
      .attr("font-size", "10px")
      .attr("font-weight", "bold");

    // Function to apply styles (called on tick to keep things dynamic if needed, or just once)
    const updateStyles = () => {
       linkGroup.each(function(d) {
         const visuals = getLinkVisuals(d);
         const g = d3.select(this);
         g.select(".link-outline")
           .attr("stroke", visuals.outlineColor!)
           .attr("stroke-width", visuals.outlineWidth!);
         g.select(".link-core")
           .attr("stroke", visuals.mainColor!)
           .attr("stroke-width", visuals.width!)
           .attr("stroke-opacity", visuals.opacity!);
       });

       nodeGroup.each(function(d) {
         const visuals = getNodeVisuals(d);
         const g = d3.select(this);
         
         g.select(".node-circle")
          .attr("r", visuals.radius!)
          .attr("fill", visuals.fill!)
          .attr("stroke", visuals.stroke!)
          .attr("stroke-width", visuals.strokeWidth!);

         const badge = g.select(".node-badge");
         if (visuals.badge) {
            badge.style("display", "block");
            badge.select("circle").attr("fill", visuals.badge.color || "red");
            badge.select("text")
              .text(visuals.badge.text || "!")
              .attr("fill", visuals.badge.textColor || "white");
         } else {
            badge.style("display", "none");
         }
       });
    };

    simulation.on("tick", () => {
      linkGroup.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      
      // We can call this less frequently for performance, but for this scale, every tick is fine
      // ensuring position updates work. Style updates ideally only happen when data changes,
      // but D3 enter/update pattern handles that. Here we force attributes.
      updateStyles();
    });

    // --- DRAG LOGIC ---
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
  }, [data, theme, onNodeDragEnd]); // Re-run if data or theme changes

  // --- ANIMATION LOGIC ---
  useImperativeHandle(ref, () => ({
    runAnimation: (sequence: EventSequence) => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      let animLayer = svg.select<SVGGElement>(".anim-layer");
      if (animLayer.empty()) animLayer = svg.append("g").attr("class", "anim-layer").raise();
      else animLayer.raise();

      const tl = gsap.timeline({
        onComplete: () => {
          if (onSimulationEnd) {
             // Clean export
             const cleanNodes = nodesRef.current.map(n => ({
               ...n, vx: undefined, vy: undefined, index: undefined
             }));
             const cleanLinks = linksRef.current.map(l => ({
               ...l,
               source: (l.source as any).id || l.source,
               target: (l.target as any).id || l.target
             }));
             onSimulationEnd(cleanNodes, cleanLinks);
          }
        }
      });
      
      sequence.steps.forEach((step, index) => {
        const sourceNode = nodesRef.current.find(n => n.id === step.from);
        const targetNode = nodesRef.current.find(n => n.id === step.to);
        
        // Link Style Config
        const linkStyleDef = step.linkStyle ? theme.linkStyles[step.linkStyle] : null;
        const linkAnimConfig = linkStyleDef?.animation || {};
        
        // Node Style Config (Target)
        const nodeStyleDef = step.targetNodeState ? theme.nodeStyles[step.targetNodeState] : null;
        const nodeAnimConfig = nodeStyleDef?.animation || {};

        if (!sourceNode || !targetNode) return;

        // Find Link Group
        const linkGroupId = `#link-group-${step.from}-${step.to}`;
        const reverseGroupId = `#link-group-${step.to}-${step.from}`;
        let linkGroupSelection = svg.select(linkGroupId);
        if (linkGroupSelection.empty()) linkGroupSelection = svg.select(reverseGroupId);

        // 1. Packet
        const packetColor = linkAnimConfig.packetColor || "#ef4444";
        const packetRadius = linkAnimConfig.packetRadius || 6;
        const travelDuration = step.duration || linkAnimConfig.duration || 1;

        const packet = animLayer.append("circle")
          .attr("r", packetRadius)
          .attr("fill", packetColor)
          .attr("stroke", "#fff")
          .attr("stroke-width", 2)
          .attr("cx", sourceNode.x!)
          .attr("cy", sourceNode.y!)
          .attr("opacity", 0);

        // 2. Source Pulse (generic)
        tl.to(`#node-${sourceNode.id}`, {
          attr: { r: 24 },
          duration: 0.2,
          yoyo: true,
          repeat: 1
        }, `step-${index}`);

        // 3. Travel
        tl.to(packet.node(), { opacity: 1, duration: 0.1 }, `step-${index}`);
        tl.to(packet.node(), {
          attr: { cx: targetNode.x!, cy: targetNode.y! },
          duration: travelDuration,
          ease: "power1.inOut",
          onComplete: () => packet.remove()
        }, `step-${index}`);

        // 4. Impact & State Update
        tl.add(() => {
           // Apply Link State (Stacking)
           if (!linkGroupSelection.empty() && step.linkStyle) {
              const linkDatum = linkGroupSelection.datum() as GraphLink;
              if (linkDatum) {
                if (!linkDatum.activeStates) linkDatum.activeStates = [];
                // Add state if not present (or we could just push to allow duplicates logic)
                // Here we prevent exact duplicates for simplicity
                if (!linkDatum.activeStates.includes(step.linkStyle)) {
                   linkDatum.activeStates.push(step.linkStyle);
                }
              }
              // Force visual update immediately for immediate feedback
              const visuals = getLinkVisuals(linkDatum);
              linkGroupSelection.select(".link-outline")
                .attr("stroke", visuals.outlineColor!)
                .attr("stroke-width", visuals.outlineWidth!);
              linkGroupSelection.select(".link-core")
                .attr("stroke", visuals.mainColor!)
                .attr("stroke-width", visuals.width!)
                .attr("stroke-opacity", visuals.opacity!);
           }

           // Apply Node State (Stacking)
           if (step.targetNodeState) {
              const nodeDatum = d3.select(`#node-group-${targetNode.id}`).datum() as GraphNode;
              if (nodeDatum) {
                 if (!nodeDatum.activeStates) nodeDatum.activeStates = [];
                 if (!nodeDatum.activeStates.includes(step.targetNodeState)) {
                    nodeDatum.activeStates.push(step.targetNodeState);
                 }
                 
                 // Trigger immediate visual update for persistent styles (badge, border)
                 const visuals = getNodeVisuals(nodeDatum);
                 const g = d3.select(`#node-group-${targetNode.id}`);
                 g.select(".node-circle")
                  .attr("fill", visuals.fill!)
                  .attr("stroke", visuals.stroke!)
                  .attr("stroke-width", visuals.strokeWidth!);
                 
                 const badge = g.select(".node-badge");
                 if (visuals.badge) {
                    badge.style("display", "block")
                    badge.select("circle").attr("fill", visuals.badge.color || "red");
                    badge.select("text").text(visuals.badge.text || "!");
                 }
              }
           }
        }, `step-${index}+=${travelDuration}`);

        // 5. Node Animation (Transient)
        // If node animation is defined (scale, color flash), run it
        if (nodeAnimConfig.scale || nodeAnimConfig.durationIn) {
            const targetSelector = `#node-${targetNode.id}`;
            const animDuration = nodeAnimConfig.durationIn || 0.3;
            
            const animVars: any = {
                duration: animDuration,
                yoyo: true,
                repeat: 1,
                ease: "back.out(1.7)"
            };
            if (nodeAnimConfig.scale) animVars.attr = { r: 20 * nodeAnimConfig.scale };

            tl.to(targetSelector, animVars, `step-${index}+=${travelDuration}`);
        }

        if (step.delay) {
          tl.to({}, { duration: step.delay });
        }
      });
    }
  }));

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-50 overflow-hidden">
      <svg ref={svgRef} className="w-full h-full block" />
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border border-slate-200 text-xs text-slate-500 pointer-events-none">
        Powered by GraphFlow Engine
      </div>
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';

export default GraphCanvas;