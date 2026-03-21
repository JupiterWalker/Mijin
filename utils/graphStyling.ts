import * as d3 from 'd3';
import { GraphNode, GraphLink, ThemeConfig } from '../types';

export interface NodeVisualContext {
  linkingSourceId: string | null;
  selectedNodeId: string | null;
  theme: ThemeConfig;
  readonly: boolean;
  isConfirmingDelete: boolean;
  directorPicking: 'source' | 'target' | null;
  isDirectorMode: boolean;
}

export interface LinkVisualContext {
  selectedLinkId: string | null;
  theme: ThemeConfig;
  readonly: boolean;
  isDirectorMode: boolean;
}

export interface NodeVisualResult {
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  badge: { text?: string; color?: string; textColor?: string } | null;
}

export interface LinkVisualResult {
  mainColor: string;
  width: number;
  opacity: number;
  outlineColor: string;
  outlineWidth: number;
}

export function getNodeVisuals(node: GraphNode, context: NodeVisualContext): NodeVisualResult {
  const {
    linkingSourceId,
    selectedNodeId,
    theme,
    readonly,
    isConfirmingDelete,
    directorPicking,
    isDirectorMode,
  } = context;

  const isLinkingSource = linkingSourceId === node.id;
  const isSelected = selectedNodeId === node.id;
  const isDirectorSource = directorPicking === 'target' && linkingSourceId === node.id;

  const result: NodeVisualResult = {
    fill: isDirectorMode ? '#1e293b' : '#fff',
    stroke: '#fff',
    strokeWidth: isSelected ? 4 : 2,
    radius: readonly ? 12 : 20,
    badge: null,
  };

  result.stroke = isSelected
    ? isConfirmingDelete
      ? '#ef4444'
      : '#6366f1'
    : isLinkingSource
      ? '#10b981'
      : isDirectorSource
        ? '#a855f7'
        : isDirectorMode
          ? '#475569'
          : '#fff';

  if (!isSelected && (isLinkingSource || isDirectorSource)) {
    result.strokeWidth = 4;
  }

  const groupColors = ['#1a1a1a', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
  result.fill = groupColors[(node.group || 0) % groupColors.length];

  if (node.apparence) {
    if (node.apparence.fill) result.fill = node.apparence.fill;
    if (node.apparence.stroke && !isSelected) result.stroke = node.apparence.stroke;
  }

  if (node.activeStates && theme.nodeStyles) {
    node.activeStates.forEach((stateName) => {
      const styleDef = theme.nodeStyles?.[stateName];
      if (!styleDef || !styleDef.persistent) return;
      const persistent = styleDef.persistent;
      if (persistent.fill) result.fill = persistent.fill;
      if (persistent.stroke && !isSelected) result.stroke = persistent.stroke;
      if (persistent.strokeWidth !== undefined && !isSelected) result.strokeWidth = persistent.strokeWidth;
      if (persistent.radius !== undefined) result.radius = persistent.radius;
      if (persistent.badge) result.badge = persistent.badge;
    });
  }

  return result;
}

export function getLinkVisuals(link: GraphLink, context: LinkVisualContext): LinkVisualResult {
  const { selectedLinkId, theme, readonly, isDirectorMode } = context;

  const sourceId = (link.source as any).id || link.source;
  const targetId = (link.target as any).id || link.target;
  const isSelected = selectedLinkId === `${sourceId}-${targetId}` || selectedLinkId === `${targetId}-${sourceId}`;

  const result: LinkVisualResult = {
    mainColor: isSelected ? (isDirectorMode ? '#a855f7' : '#6366f1') : isDirectorMode ? '#334155' : '#94a3b8',
    width: isSelected ? 4 : readonly ? 1.5 : 2,
    opacity: isSelected ? 1 : 0.6,
    outlineColor: isSelected
      ? isDirectorMode
        ? 'rgba(168, 85, 247, 0.2)'
        : 'rgba(99, 102, 241, 0.2)'
      : 'transparent',
    outlineWidth: isSelected ? 8 : 0,
  };

  if (link.activeStates && theme.linkStyles) {
    link.activeStates.forEach((stateName) => {
      const styleDef = theme.linkStyles?.[stateName];
      if (!styleDef || !styleDef.persistent) return;
      const persistent = styleDef.persistent;
      if (persistent.mainColor && !isSelected) result.mainColor = persistent.mainColor;
      if (persistent.width !== undefined && !isSelected) result.width = persistent.width;
      if (persistent.opacity !== undefined && !isSelected) result.opacity = persistent.opacity;
      if (persistent.outlineColor && !isSelected) result.outlineColor = persistent.outlineColor;
      if (persistent.outlineWidth !== undefined && !isSelected) result.outlineWidth = persistent.outlineWidth;
    });
  }

  return result;
}

interface UpdateStylesParams {
  linkSelection: d3.Selection<any, GraphLink, any, any> | null;
  nodeSelection: d3.Selection<any, GraphNode, any, any> | null;
  nodeContext: NodeVisualContext;
  linkContext: LinkVisualContext;
  readonly: boolean;
  selectedNodeId: string | null;
  isConfirmingDelete: boolean;
  isDirectorMode: boolean;
}

export function updateStyles(params: UpdateStylesParams): void {
  const {
    linkSelection,
    nodeSelection,
    nodeContext,
    linkContext,
    readonly,
    selectedNodeId,
    isConfirmingDelete,
    isDirectorMode,
  } = params;

  if (linkSelection) {
    linkSelection.each(function (d: GraphLink) {
      const visuals = getLinkVisuals(d, linkContext);
      const group = d3.select(this);
      group
        .select('.link-outline')
        .attr('stroke', visuals.outlineColor)
        .attr('stroke-width', visuals.outlineWidth);
      group
        .select('.link-core')
        .attr('stroke', visuals.mainColor)
        .attr('stroke-width', visuals.width)
        .attr('stroke-opacity', visuals.opacity);
    });
  }

  if (nodeSelection) {
    nodeSelection.each(function (d: GraphNode) {
      const visuals = getNodeVisuals(d, nodeContext);
      const isSelected = selectedNodeId === d.id;
      const group = d3.select(this);

      group
        .select('.node-circle')
        .attr('r', visuals.radius)
        .attr('fill', visuals.fill)
        .attr('stroke', visuals.stroke)
        .attr('stroke-width', visuals.strokeWidth)
        .classed('confirming-delete-anim', isSelected && isConfirmingDelete)
        .classed('selected-node-glow', isSelected && !isConfirmingDelete);

      group
        .select('.node-label-bg')
        .attr('stroke', nodeContext.isDirectorMode ? '#0f172a' : 'white');
      group
        .select('.node-label-fg')
        .attr('fill', nodeContext.isDirectorMode ? '#cbd5e1' : '#1e293b');

      const badge = group.select('.node-badge');
      if (visuals.badge) {
        badge.style('display', 'block');
        badge.select('circle').attr('fill', visuals.badge.color || 'red');
        if (!readonly) {
          badge
            .select('text')
            .text(visuals.badge.text || '!')
            .attr('fill', visuals.badge.textColor || 'white');
        }
      } else {
        badge.style('display', 'none');
      }
    });
  }
}
