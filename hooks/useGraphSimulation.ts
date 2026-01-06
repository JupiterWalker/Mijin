import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  GraphData,
  GraphNode,
  GraphLink,
  ThemeConfig,
  SimulationAction,
  EventSequence,
  EnvironmentZone,
  EnvironmentLabel,
} from '../types';
import { updateStyles } from '../utils/graphStyling';
import { AnimationContext, runAnimationSequence, runSingleAnimationStep } from '../utils/graphAnimations';

interface Dimensions {
  width: number;
  height: number;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface UseGraphSimulationArgs {
  data: GraphData;
  theme: ThemeConfig;
  readonly: boolean;
  isLinkMode: boolean;
  isDirectorMode: boolean;
  directorPicking: 'source' | 'target' | null;
  linkingSourceId: string | null;
  setLinkingSourceId: (value: string | null) => void;
  mousePos: MousePosition | null;
  setMousePos: (pos: MousePosition | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedLinkId: string | null;
  setSelectedLinkId: (id: string | null) => void;
  selectedZoneId: string | null;
  setSelectedZoneId: (id: string | null) => void;
  selectedLabelId: string | null;
  setSelectedLabelId: (id: string | null) => void;
  isConfirmingDelete: boolean;
  setIsConfirmingDelete: (value: boolean) => void;
  setBgContextMenu: (value: { x: number; y: number; worldX: number; worldY: number } | null) => void;
  onDirectorPick?: (nodeId: string) => void;
  onNodeDragEnd?: (nodes: GraphNode[]) => void;
  onLinkAdd?: (sourceId: string, targetId: string) => void;
  onZoneUpdate?: (zone: EnvironmentZone) => void;
  onLabelUpdate?: (label: EnvironmentLabel) => void;
  zones: EnvironmentZone[];
  labels: EnvironmentLabel[];
}

export interface UseGraphSimulationResult {
  svgRef: React.RefObject<SVGSVGElement>;
  wrapperRef: React.RefObject<HTMLDivElement>;
  nodesRef: React.MutableRefObject<GraphNode[]>;
  linksRef: React.MutableRefObject<GraphLink[]>;
  nodeSelectionRef: React.MutableRefObject<d3.Selection<any, GraphNode, any, any> | null>;
  linkSelectionRef: React.MutableRefObject<d3.Selection<any, GraphLink, any, any> | null>;
  lastTransformRef: React.MutableRefObject<d3.ZoomTransform>;
  dimensions: Dimensions;
  runAnimation: (sequence: EventSequence, onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void) => void;
  runSingleStep: (step: SimulationAction) => void;
}

export function useGraphSimulation(args: UseGraphSimulationArgs): UseGraphSimulationResult {
  const {
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
  } = args;

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nodeSelectionRef = useRef<d3.Selection<any, GraphNode, any, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<any, GraphLink, any, any> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const lastTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  const refreshStyles = useCallback(() => {
    updateStyles({
      linkSelection: linkSelectionRef.current,
      nodeSelection: nodeSelectionRef.current,
      nodeContext: {
        linkingSourceId,
        selectedNodeId,
        theme,
        readonly,
        isConfirmingDelete,
        directorPicking,
        isDirectorMode,
      },
      linkContext: {
        selectedLinkId,
        theme,
        readonly,
        isDirectorMode,
      },
      readonly,
      selectedNodeId,
      isConfirmingDelete,
      isDirectorMode,
    });
  }, [linkingSourceId, selectedNodeId, theme, readonly, isConfirmingDelete, directorPicking, isDirectorMode, selectedLinkId]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      });
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);

    svg
      .selectAll('.canvas-bg')
      .data([1])
      .join('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'transparent')
      .attr('class', 'canvas-bg')
      .on('click', (event) => {
        if (readonly) return;
        setBgContextMenu(null);
        if ((event.target as Element).classList.contains('canvas-bg')) {
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
      .on('contextmenu', (event) => {
        event.preventDefault();
        if (readonly || directorPicking || isLinkMode) return;
        const [mouseX, mouseY] = d3.pointer(event, wrapperRef.current);
        const transform = lastTransformRef.current;
        const [worldX, worldY] = transform.invert([mouseX, mouseY]);
        setBgContextMenu({ x: mouseX, y: mouseY, worldX, worldY });
      })
      .on('mousemove', (event) => {
        if (linkingSourceId || directorPicking === 'target') {
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          setMousePos({ x: mouseX, y: mouseY });
        }
      })
      .on('dblclick', (event) => {
        event.stopPropagation();
      });

    const defs = svg.selectAll('defs').data([1]).join('defs');
    const patternSize = 40;
    const pattern = defs
      .selectAll('#grid-pattern')
      .data([1])
      .join('pattern')
      .attr('id', 'grid-pattern')
      .attr('width', patternSize)
      .attr('height', patternSize)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern
      .selectAll('path')
      .data([1])
      .join('path')
      .attr('d', `M ${patternSize} 0 L 0 0 0 ${patternSize}`)
      .attr('fill', 'none')
      .attr('stroke', isDirectorMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
      .attr('stroke-width', 1);

    svg
      .selectAll('.grid-rect')
      .data([1])
      .join('rect')
      .attr('class', 'grid-rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#grid-pattern)')
      .style('pointer-events', 'none');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        svg.select('.zoom-layer').attr('transform', event.transform.toString());
        lastTransformRef.current = event.transform;
      });

    if (!readonly) {
      svg.call(zoom).on('dblclick.zoom', null);
    }

    const zoomLayer = svg.selectAll('.zoom-layer').data([1]).join('g').attr('class', 'zoom-layer');
    if (!readonly) {
      zoomLayer.attr('transform', lastTransformRef.current.toString());
    }

    const zonesLayer = zoomLayer.selectAll('.zones-layer').data([1]).join('g').attr('class', 'zones-layer');
    const linksLayer = zoomLayer.selectAll('.links-layer').data([1]).join('g').attr('class', 'links-layer');
    const nodesLayer = zoomLayer.selectAll('.nodes-layer').data([1]).join('g').attr('class', 'nodes-layer');
    const labelsLayer = zoomLayer.selectAll('.labels-layer').data([1]).join('g').attr('class', 'labels-layer');
    const animLayer = zoomLayer.selectAll('.anim-layer').data([1]).join('g').attr('class', 'anim-layer');

    const recursiveMove = (
      attachedIds: { nodes: string[]; zones: string[]; labels: string[] },
      dx: number,
      dy: number,
      movedSet: Set<string>,
    ) => {
      attachedIds.nodes.forEach((id) => {
        const node = nodesRef.current.find((n) => n.id === id);
        if (!node) return;
        node.x = (node.x || 0) + dx;
        node.y = (node.y || 0) + dy;
        node.fx = node.x;
        node.fy = node.y;
        nodesLayer.select(`#node-group-${id}`).attr('transform', `translate(${node.x},${node.y})`);
        linksLayer
          .selectAll('.link-group')
          .filter((d: any) => d.source.id === id || d.target.id === id)
          .selectAll('line')
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
      });

      attachedIds.labels.forEach((id) => {
        const labelData = labels.find((l) => l.id === id);
        if (!labelData) return;
        labelData.x += dx;
        labelData.y += dy;
        labelsLayer
          .selectAll('.label-group')
          .filter((d: any) => d.id === id)
          .attr('transform', `translate(${labelData.x},${labelData.y})`);
      });

      attachedIds.zones.forEach((id) => {
        if (movedSet.has(id)) return;
        movedSet.add(id);
        const zoneData = zones.find((z) => z.id === id);
        if (!zoneData) return;
        zoneData.x += dx;
        zoneData.y += dy;
        zonesLayer
          .selectAll('.zone-group')
          .filter((d: any) => d.id === id)
          .attr('transform', `translate(${zoneData.x},${zoneData.y})`);
        if (zoneData.attachedElementIds) {
          recursiveMove(zoneData.attachedElementIds, dx, dy, movedSet);
        }
      });
    };

    const zoneGroups = zonesLayer
      .selectAll('g.zone-group')
      .data(zones, (d: any) => d.id)
      .join('g')
      .attr('class', 'zone-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .on('click', (event, d) => {
        if (readonly) return;
        event.stopPropagation();
        if (selectedZoneId !== d.id) {
          setSelectedZoneId(d.id);
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setSelectedLabelId(null);
          setIsConfirmingDelete(false);
        }
      });

    zoneGroups.each(function (zoneData) {
      const g = d3.select(this);
      const isSelected = selectedZoneId === zoneData.id;

      g
        .selectAll('rect.zone-box')
        .data([zoneData])
        .join('rect')
        .attr('class', 'zone-box')
        .attr('width', (d) => d.width)
        .attr('height', (d) => d.height)
        .attr('rx', 8)
        .attr('fill', (d) => {
          const baseColor = d.color || 'rgba(59, 130, 246, 1)';
          const c = d3.color(baseColor);
          if (!c) return 'rgba(59, 130, 246, 0.1)';
          c.opacity = 0.1;
          return c.toString();
        })
        .attr('stroke', (d) => d.color || '#3b82f6')
        .attr('stroke-width', isSelected ? 3 : 2)
        .attr('stroke-dasharray', (d) => (d.isLocked ? 'none' : '5,5'));

      g
        .selectAll('rect.zone-header')
        .data([zoneData])
        .join('rect')
        .attr('class', 'zone-header')
        .attr('width', (d) => d.width)
        .attr('height', 30)
        .attr('fill', 'transparent')
        .attr('cursor', 'move');

      g
        .selectAll('text.zone-label')
        .data([zoneData])
        .join('text')
        .attr('class', 'zone-label')
        .attr('x', 10)
        .attr('y', 20)
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('fill', '#1e293b')
        .attr('pointer-events', 'none')
        .text((d) => d.label);

      const lockIconSize = 16;
      const lockX = zoneData.width - lockIconSize - 10;
      const lockY = 8;

      const lockBtn = g
        .selectAll('g.lock-btn')
        .data([zoneData])
        .join('g')
        .attr('class', 'lock-btn')
        .attr('transform', `translate(${lockX}, ${lockY})`)
        .attr('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          onZoneUpdate?.({ ...d, isLocked: !d.isLocked });
        })
        .on('mousedown', (e) => e.stopPropagation());

      lockBtn
        .selectAll('rect.lock-hitbox')
        .data([1])
        .join('rect')
        .attr('class', 'lock-hitbox')
        .attr('width', lockIconSize)
        .attr('height', lockIconSize)
        .attr('fill', 'transparent');

      const lockedPath =
        'M12.65 6H12V4a4 4 0 1 0-8 0v2h-.65a2 2 0 0 0-2 2v6.25a2 2 0 0 0 2 2h8.7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM6 4a2 2 0 1 1 4 0v2H6V4Zm4.65 12.25h-5.3a.75.75 0 0 1 0-1.5h5.3a.75.75 0 0 1 0 1.5Z';
      const unlockedPath =
        'M12.65 6H12V4a4 4 0 1 0-8 0v2h-.65a2 2 0 0 0-2 2v6.25a2 2 0 0 0 2 2h8.7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM6 4a2 2 0 1 1 4 0v2H6z';

      lockBtn
        .selectAll('path.lock-icon')
        .data([zoneData])
        .join('path')
        .attr('class', 'lock-icon')
        .attr('d', zoneData.isLocked ? lockedPath : unlockedPath)
        .attr('fill', zoneData.isLocked ? '#ef4444' : '#64748b')
        .attr('transform', 'scale(0.8)');

      const resizeData = zoneData.isLocked ? [] : [zoneData];

      const resizeHandle = g
        .selectAll('rect.resize-handle')
        .data(resizeData)
        .join('rect')
        .attr('class', 'resize-handle')
        .attr('x', (d) => d.width - 15)
        .attr('y', (d) => d.height - 15)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', 'transparent')
        .attr('cursor', 'nwse-resize');

      resizeHandle.selectAll('title').data([1]).join('title').text('Resize Zone');

      g
        .selectAll('path.resize-indicator')
        .data(resizeData)
        .join('path')
        .attr('class', 'resize-indicator')
        .attr('d', (d) => `M${d.width - 4} ${d.height - 12} L${d.width - 12} ${d.height - 4} M${d.width - 4} ${d.height - 8} L${d.width - 8} ${d.height - 4}`)
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');

      if (!readonly && !zoneData.isLocked) {
        resizeHandle.call(
          d3
            .drag<SVGRectElement, EnvironmentZone>()
            .on('start', (event) => {
              event.sourceEvent.stopPropagation();
              if (selectedZoneId !== zoneData.id) setSelectedZoneId(zoneData.id);
            })
            .on('drag', function (event, d) {
              const newW = Math.max(100, d.width + event.dx);
              const newH = Math.max(50, d.height + event.dy);
              d.width = newW;
              d.height = newH;
              const parent = d3.select(this.parentNode as SVGGElement);
              parent.select('.zone-box').attr('width', newW).attr('height', newH);
              parent.select('.zone-header').attr('width', newW);
              d3.select(this).attr('x', newW - 15).attr('y', newH - 15);
              parent
                .select('.resize-indicator')
                .attr('d', `M${newW - 4} ${newH - 12} L${newW - 12} ${newH - 4} M${newW - 4} ${newH - 8} L${newW - 8} ${newH - 4}`);
              parent.select('.lock-btn').attr('transform', `translate(${newW - lockIconSize - 10}, ${lockY})`);
            })
            .on('end', (_, d) => {
              onZoneUpdate?.({ ...d });
            }) as any,
        );
      }
    });

    if (!readonly) {
      zoneGroups.call(
        d3
          .drag<SVGGElement, EnvironmentZone>()
          .filter((event) => {
            const target = event.target as Element;
            return target.classList.contains('zone-header') || target.classList.contains('zone-box');
          })
          .on('start', (event, d) => {
            event.sourceEvent.stopPropagation();
            if (selectedZoneId !== d.id) {
              setSelectedZoneId(d.id);
              setSelectedNodeId(null);
              setSelectedLinkId(null);
              setSelectedLabelId(null);
              setIsConfirmingDelete(false);
            }
          })
          .on('drag', function (event, d) {
            const dx = event.dx;
            const dy = event.dy;
            d.x += dx;
            d.y += dy;
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
            if (d.isLocked && d.attachedElementIds) {
              recursiveMove(d.attachedElementIds, dx, dy, new Set([d.id]));
            }
          })
          .on('end', (_, d) => {
            onZoneUpdate?.({ ...d });
            if (d.isLocked && d.attachedElementIds) {
              if (d.attachedElementIds.nodes.length > 0) {
                onNodeDragEnd?.(nodesRef.current);
              }
              d.attachedElementIds.labels.forEach((labelId) => {
                const labelData = labels.find((l) => l.id === labelId);
                if (labelData) onLabelUpdate?.({ ...labelData });
              });
              d.attachedElementIds.zones.forEach((zoneId) => {
                const zoneData = zones.find((z) => z.id === zoneId);
                if (zoneData) onZoneUpdate?.({ ...zoneData });
              });
            }
          }) as any,
      );
    }

    const labelGroups = labelsLayer
      .selectAll('g.label-group')
      .data(labels, (d: any) => d.id)
      .join('g')
      .attr('class', 'label-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .on('click', (event, d) => {
        if (readonly) return;
        event.stopPropagation();
        if (selectedLabelId !== d.id) {
          setSelectedLabelId(d.id);
          setSelectedNodeId(null);
          setSelectedZoneId(null);
          setSelectedLinkId(null);
          setIsConfirmingDelete(false);
        }
      });

    labelGroups.each(function (d) {
      const g = d3.select(this);
      const isSelected = selectedLabelId === d.id;

      g
        .selectAll('rect.selection-box')
        .data(isSelected ? [1] : [])
        .join('rect')
        .attr('class', 'selection-box')
        .attr('x', -5)
        .attr('y', -d.fontSize)
        .attr('width', d.text.length * d.fontSize * 0.6 + 10)
        .attr('height', d.fontSize + 10)
        .attr('fill', 'transparent')
        .attr('stroke', '#6366f1')
        .attr('stroke-dasharray', '2,2');

      g
        .selectAll('text.label-item')
        .data([d])
        .join('text')
        .attr('class', 'label-item')
        .attr('font-size', `${d.fontSize}px`)
        .attr('fill', d.color || '#475569')
        .attr('font-weight', '600')
        .text((label) => label.text)
        .style('user-select', 'none');
    });

    if (!readonly) {
      labelGroups.call(
        d3
          .drag<SVGGElement, EnvironmentLabel>()
          .on('start', (event, d) => {
            event.sourceEvent.stopPropagation();
            if (selectedLabelId !== d.id) {
              setSelectedLabelId(d.id);
              setSelectedNodeId(null);
              setSelectedZoneId(null);
              setSelectedLinkId(null);
              setIsConfirmingDelete(false);
            }
          })
          .on('drag', function (event, d) {
            d.x += event.dx;
            d.y += event.dy;
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
          })
          .on('end', (_, d) => {
            onLabelUpdate?.({ ...d });
          }) as any,
      );
    }

    const oldNodesMap = new Map<string, GraphNode>(nodesRef.current.map((n) => [n.id, n]));

    const nodes: GraphNode[] = data.nodes.map((node) => {
      const old = oldNodesMap.get(node.id);
      return {
        ...node,
        x: old?.x ?? node.x,
        y: old?.y ?? node.y,
        fx: old?.fx ?? node.fx ?? null,
        fy: old?.fy ?? node.fy ?? null,
        vx: old?.vx,
        vy: old?.vy,
        activeStates: node.activeStates || [],
        meta_data: node.meta_data || {},
      };
    });

    const links: GraphLink[] = data.links.map((link) => ({ ...link, activeStates: link.activeStates || [] }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const simulation = d3
      .forceSimulation(nodes)
      .alpha(0)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(readonly ? 60 : 150))
      .force('charge', d3.forceManyBody().strength(readonly ? -300 : -400))
      .force('x', d3.forceX(width / 2).strength(0.01))
      .force('y', d3.forceY(height / 2).strength(0.01))
      .force('collide', d3.forceCollide().radius(readonly ? 30 : 45));

    simulationRef.current = simulation;

    const ghostLine = zoomLayer
      .selectAll('.ghost-line')
      .data([1])
      .join('line')
      .attr('class', 'ghost-line')
      .attr('stroke', directorPicking ? '#a855f7' : '#10b981')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    const linkGroup = linksLayer
      .selectAll('g.link-group')
      .data(links, (d: any) => {
        const s = (d.source as any).id || d.source;
        const t = (d.target as any).id || d.target;
        return `${s}-${t}`;
      })
      .join('g')
      .attr('class', 'link-group')
      .attr('id', (d: any) => {
        const s = (d.source as any).id || d.source;
        const t = (d.target as any).id || d.target;
        return `link-group-${s}-${t}`;
      })
      .style('cursor', readonly ? 'default' : 'pointer')
      .on('click', (event, d) => {
        if (readonly || directorPicking) return;
        event.stopPropagation();
        const sId = (d.source as any).id || d.source;
        const tId = (d.target as any).id || d.target;
        setSelectedLinkId(`${sId}-${tId}`);
        setSelectedNodeId(null);
        setSelectedZoneId(null);
        setSelectedLabelId(null);
        setIsConfirmingDelete(false);
      });

    linkGroup.selectAll('.link-hitbox').data((d) => [d]).join('line').attr('class', 'link-hitbox').attr('stroke', 'transparent').attr('stroke-width', 20);
    linkGroup.selectAll('.link-outline').data((d) => [d]).join('line').attr('class', 'link-outline').attr('stroke-linecap', 'round');
    linkGroup.selectAll('.link-core').data((d) => [d]).join('line').attr('class', 'link-core');
    linkSelectionRef.current = linkGroup;

    const nodeGroup = nodesLayer
      .selectAll('g.node-group')
      .data(nodes, (d: GraphNode) => d.id)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', readonly ? 'default' : isLinkMode || linkingSourceId || directorPicking ? 'crosshair' : 'pointer')
      .on('click', (event, d) => {
        if (readonly) return;
        event.stopPropagation();
        if (directorPicking) {
          onDirectorPick?.(d.id);
          if (directorPicking === 'source') setLinkingSourceId(d.id);
          else setLinkingSourceId(null);
          return;
        }
        if (isLinkMode || linkingSourceId) {
          if (!linkingSourceId) {
            setLinkingSourceId(d.id);
          } else {
            if (linkingSourceId !== d.id) {
              onLinkAdd?.(linkingSourceId, d.id);
            }
            setLinkingSourceId(null);
          }
        } else {
          if (selectedNodeId !== d.id) {
            setSelectedNodeId(d.id);
            setSelectedLinkId(null);
            setSelectedZoneId(null);
            setSelectedLabelId(null);
            setIsConfirmingDelete(false);
          }
        }
      });

    if (!readonly && !isLinkMode && !linkingSourceId && !directorPicking) {
      nodeGroup.call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            setSelectedNodeId(event.subject.id);
            setSelectedLinkId(null);
            setSelectedZoneId(null);
            setSelectedLabelId(null);
            nodesRef.current.forEach((n) => {
              n.fx = n.x;
              n.fy = n.y;
            });
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on('drag', (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on('end', (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = event.x;
            event.subject.fy = event.y;
            onNodeDragEnd?.(nodesRef.current);
          }) as any,
      );
    }

    nodeGroup.attr('id', (d) => `node-group-${d.id}`);
    nodeGroup.selectAll('.node-circle').data((d) => [d]).join('circle').attr('class', 'node-circle').attr('id', (d: any) => `node-${d.id}`);

    const nodeLabels = nodeGroup
      .selectAll('text.node-text-label')
      .data((d) => [d])
      .join('text')
      .attr('class', 'node-text-label')
      .attr('x', 0)
      .attr('y', readonly ? 22 : 32)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none');

    nodeLabels.each(function (d) {
      const txt = d3.select(this);
      txt
        .selectAll('tspan.node-label-bg')
        .data([d.label])
        .join('tspan')
        .attr('class', 'node-label-bg')
        .attr('x', 0)
        .attr('stroke-width', readonly ? 1.5 : 4)
        .attr('stroke-opacity', 0.9)
        .text((l) => l);
      txt
        .selectAll('tspan.node-label-fg')
        .data([d.label])
        .join('tspan')
        .attr('class', 'node-label-fg')
        .attr('x', 0)
        .attr('stroke', 'none')
        .text((l) => l);
    });

    const badgeGroup = nodeGroup
      .selectAll('g.node-badge')
      .data([1])
      .join('g')
      .attr('class', 'node-badge')
      .attr('transform', readonly ? 'translate(8, -8)' : 'translate(14, -14)')
      .style('display', 'none');

    badgeGroup.selectAll('circle').data([1]).join('circle').attr('r', readonly ? 5 : 8).attr('stroke', isDirectorMode ? '#0f172a' : '#fff').attr('stroke-width', 1.5);

    if (!readonly) {
      badgeGroup.selectAll('text').data([1]).join('text').attr('text-anchor', 'middle').attr('dy', 3).attr('font-size', '10px').attr('font-weight', 'bold');
    }

    nodeSelectionRef.current = nodeGroup;

    const ticked = () => {
      linkGroup
        .selectAll('line')
        .attr('x1', (d: any) => d.source?.x || 0)
        .attr('y1', (d: any) => d.source?.y || 0)
        .attr('x2', (d: any) => d.target?.x || 0)
        .attr('y2', (d: any) => d.target?.y || 0);

      nodeGroup.attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);

      if ((linkingSourceId || directorPicking === 'target') && mousePos) {
        const sourceNode = nodes.find((n) => n.id === linkingSourceId);
        if (sourceNode) {
          const transform = lastTransformRef.current;
          const [worldMouseX, worldMouseY] = transform.invert([mousePos.x, mousePos.y]);
          ghostLine
            .attr('x1', sourceNode.x || 0)
            .attr('y1', sourceNode.y || 0)
            .attr('x2', worldMouseX)
            .attr('y2', worldMouseY)
            .style('opacity', 1);
        }
      } else {
        ghostLine.style('opacity', 0);
      }

      refreshStyles();
    };

    simulation.on('tick', ticked);

    if (readonly) {
      simulation.tick(200);
      ticked();
      simulation.stop();
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;
        minX = Math.min(minX, node.x - 50);
        maxX = Math.max(maxX, node.x + 50);
        minY = Math.min(minY, node.y - 50);
        maxY = Math.max(maxY, node.y + 50);
      });
      if (nodes.length > 0) {
        const fitWidth = Math.max(maxX - minX, 100);
        const fitHeight = Math.max(maxY - minY, 100);
        const scale = Math.min(width / fitWidth, height / fitHeight, 1.0);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        zoomLayer.attr('transform', `translate(${width / 2}, ${height / 2}) scale(${scale}) translate(${-centerX}, ${-centerY})`);
      }
    } else {
      ticked();
    }

    return () => {
      simulation.stop();
    };
  }, [
    data,
    dimensions,
    directorPicking,
    isLinkMode,
    isDirectorMode,
    labels,
    linkingSourceId,
    mousePos,
    onDirectorPick,
    onLabelUpdate,
    onLinkAdd,
    onNodeDragEnd,
    onZoneUpdate,
    readonly,
    selectedLabelId,
    selectedLinkId,
    selectedNodeId,
    selectedZoneId,
    setBgContextMenu,
    setIsConfirmingDelete,
    setLinkingSourceId,
    setMousePos,
    setSelectedLabelId,
    setSelectedLinkId,
    setSelectedNodeId,
    setSelectedZoneId,
    theme,
    zones,
    refreshStyles,
  ]);

  const runAnimation = useCallback(
    (sequence: EventSequence, onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void) => {
      if (readonly) return;
      const context: AnimationContext = {
        svgRef,
        nodesRef,
        linksRef,
        theme,
        isDirectorMode,
        updateStyles: refreshStyles,
        onSimulationEnd,
      };
      runAnimationSequence(sequence, context);
    },
    [isDirectorMode, refreshStyles, readonly, theme],
  );

  const runSingleStep = useCallback(
    (step: SimulationAction) => {
      if (readonly) return;
      const context: AnimationContext = {
        svgRef,
        nodesRef,
        linksRef,
        theme,
        isDirectorMode,
        updateStyles: refreshStyles,
      };
      runSingleAnimationStep(step, context);
    },
    [isDirectorMode, refreshStyles, readonly, theme],
  );

  return useMemo(
    () => ({
      svgRef,
      wrapperRef,
      nodesRef,
      linksRef,
      nodeSelectionRef,
      linkSelectionRef,
      lastTransformRef,
      dimensions,
      runAnimation,
      runSingleStep,
    }),
    [dimensions, runAnimation, runSingleStep],
  );
}
