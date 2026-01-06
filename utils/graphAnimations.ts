import * as d3 from 'd3';
import gsap from 'gsap';
import {
  GraphNode,
  GraphLink,
  ThemeConfig,
  EventSequence,
  SimulationAction,
  ParallelStep,
  AtomicStep,
} from '../types';

export interface AnimationContext {
  svgRef: React.RefObject<SVGSVGElement>;
  nodesRef: React.MutableRefObject<GraphNode[]>;
  linksRef: React.MutableRefObject<GraphLink[]>;
  theme: ThemeConfig;
  isDirectorMode: boolean;
  updateStyles: () => void;
  onSimulationEnd?: (nodes: GraphNode[], links: GraphLink[]) => void;
}

function applyNodeState(node: GraphNode | undefined, stateName: string | undefined): void {
  if (!node || !stateName) return;
  node.activeStates = node.activeStates || [];
  if (!node.activeStates.includes(stateName)) node.activeStates.push(stateName);
}

function ensureAnimLayer(context: AnimationContext): d3.Selection<SVGGElement, unknown, null, undefined> | null {
  const svg = d3.select(context.svgRef.current);
  if (svg.empty()) return null;
  let layer = svg.select<SVGGElement>('.zoom-layer .anim-layer');
  if (layer.empty()) {
    layer = svg.select('.zoom-layer').append('g').attr('class', 'anim-layer');
  }
  layer.raise();
  return layer;
}

function createPacket(animLayer: d3.Selection<any, unknown, null, undefined>, color: string, radius: number, source: GraphNode, isDirectorMode: boolean) {
  return animLayer
    .append('circle')
    .attr('r', radius)
    .attr('fill', color)
    .attr('stroke', isDirectorMode ? '#1e1b4b' : '#fff')
    .attr('stroke-width', 2)
    .attr('cx', source.x || 0)
    .attr('cy', source.y || 0)
    .attr('opacity', 0);
}

function buildAtomicTimeline(
  step: AtomicStep,
  animLayer: d3.Selection<any, unknown, null, undefined>,
  context: AnimationContext,
  masterTl: gsap.core.Timeline,
): gsap.core.Timeline {
  const { nodesRef, linksRef, theme, isDirectorMode, updateStyles } = context;
  const tl = gsap.timeline({ delay: step.delay || 0 });

  const sourceNode = nodesRef.current.find((n) => n.id === step.from);
  const targetNode = nodesRef.current.find((n) => n.id === step.to);
  if (!sourceNode || !targetNode) return tl;

  const linkStyleDef = step.linkStyle ? theme.linkStyles?.[step.linkStyle] : null;
  const linkAnimConfig = linkStyleDef?.animation || {};
  const nodeStyleDef = step.targetNodeState ? theme.nodeStyles?.[step.targetNodeState] : null;
  const nodeAnimConfig = nodeStyleDef?.animation || {};
  const packetColor = linkAnimConfig.packetColor || (isDirectorMode ? '#a855f7' : '#ef4444');
  const packetRadius = linkAnimConfig.packetRadius || 6;
  const travelDuration = step.duration || linkAnimConfig.duration || 1;

  const packet = createPacket(animLayer, packetColor, packetRadius, sourceNode, isDirectorMode);

  tl.to(`#node-${sourceNode.id}`, { attr: { r: 24 }, duration: 0.2, yoyo: true, repeat: 1 }, 0);
  tl.to(packet.node(), { opacity: 1, duration: 0.1 }, 0);
  tl.to(
    packet.node(),
    {
      attr: { cx: targetNode.x || 0, cy: targetNode.y || 0 },
      duration: travelDuration,
      ease: 'power1.inOut',
      onComplete: () => packet.remove(),
    },
    0,
  );

  tl.add(() => {
    if (step.linkStyle) {
      const svg = d3.select(context.svgRef.current);
      const forwardId = `#link-group-${step.from}-${step.to}`;
      const reverseId = `#link-group-${step.to}-${step.from}`;
      let linkGroup = svg.select(forwardId);
      if (linkGroup.empty()) linkGroup = svg.select(reverseId);
      if (!linkGroup.empty()) {
        const datum = linkGroup.datum() as GraphLink | undefined;
        if (datum) {
          datum.activeStates = datum.activeStates || [];
          if (!datum.activeStates.includes(step.linkStyle!)) datum.activeStates.push(step.linkStyle!);
        }
      }
    }

    if (step.targetNodeState) {
      const node = nodesRef.current.find((n) => n.id === step.to);
      applyNodeState(node, step.targetNodeState);
    }

    updateStyles();
  }, travelDuration);

  if (step.processingNodeState) {
    tl.add(() => {
      const target = nodesRef.current.find((n) => n.id === step.to);
      applyNodeState(target, step.processingNodeState);
      updateStyles();
    }, travelDuration + (step.durationProcessing || 0.4));
  }

  if (step.finalNodeState) {
    tl.add(() => {
      const target = nodesRef.current.find((n) => n.id === step.to);
      applyNodeState(target, step.finalNodeState);
      updateStyles();
    }, travelDuration + (step.durationProcessing || 0.4) + (step.durationFinal || 0.4));
  }

  if (nodeAnimConfig.scale || nodeAnimConfig.durationIn) {
    const selector = `#node-${targetNode.id}`;
    const animDuration = nodeAnimConfig.durationIn || 0.3;
    const animVars: gsap.TweenVars = {
      duration: animDuration,
      yoyo: true,
      repeat: 1,
      ease: 'back.out(1.7)',
    };
    if (nodeAnimConfig.scale) {
      animVars.attr = { r: 20 * nodeAnimConfig.scale };
    }
    tl.to(selector, animVars, travelDuration);
  }

  return tl;
}

function createStepTimeline(
  step: SimulationAction,
  animLayer: d3.Selection<any, unknown, null, undefined>,
  context: AnimationContext,
  masterTl: gsap.core.Timeline,
): gsap.core.Timeline {
  if (step.type === 'parallel') {
    const timeline = gsap.timeline({ delay: step.delay || 0 });
    (step as ParallelStep).steps.forEach((inner) => {
      timeline.add(createStepTimeline(inner, animLayer, context, masterTl), 0);
    });
    return timeline;
  }

  return buildAtomicTimeline(step as AtomicStep, animLayer, context, masterTl);
}

export function runAnimationSequence(sequence: EventSequence, context: AnimationContext): void {
  const animLayer = ensureAnimLayer(context);
  if (!animLayer) return;

  context.nodesRef.current.forEach((node) => {
    node.activeStates = [];
  });
  context.linksRef.current.forEach((link) => {
    link.activeStates = [];
  });

  if (sequence.initNodes) {
    sequence.initNodes.forEach((init) => {
      const node = context.nodesRef.current.find((n) => n.id === init.id);
      applyNodeState(node, init.nodeState);
    });
  }

  context.updateStyles();

  const masterTl = gsap.timeline({
    onComplete: () => {
      if (!context.onSimulationEnd) return;
      const cleanNodes = context.nodesRef.current.map((n) => ({ ...n, vx: undefined, vy: undefined, index: undefined }));
      const cleanLinks = context.linksRef.current.map((l) => ({
        ...l,
        source: (l.source as any).id || l.source,
        target: (l.target as any).id || l.target,
      }));
      context.onSimulationEnd(cleanNodes, cleanLinks);
    },
  });

  sequence.steps.forEach((step) => {
    masterTl.add(createStepTimeline(step, animLayer, context, masterTl));
  });
}

export function runSingleAnimationStep(step: SimulationAction, context: AnimationContext): void {
  const animLayer = ensureAnimLayer(context);
  if (!animLayer) return;
  const timeline = createStepTimeline(step, animLayer, context, gsap.timeline());
  timeline.play();
}
