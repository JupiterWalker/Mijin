
export interface GraphNode {
  id: string;
  label: string;
  group?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
  // State properties: Array of style names applied to this node
  activeStates?: string[];
  // Flexible metadata for user-defined properties
  meta_data?: Record<string, any>;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value?: number;
  // State properties: Array of style names applied to this link
  activeStates?: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// --- Project Management ---

export interface GraphProject {
  id: string;
  name: string;
  updatedAt: number;
  isPinned: boolean;
  graphData: GraphData;
  themeData: ThemeConfig;
  eventData: EventSequence;
}

// --- Theme / Style Configuration ---

export interface NodeStyleVisuals {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  badge?: {
    text?: string;
    color?: string;
    textColor?: string;
  };
}

export interface LinkStyleVisuals {
  mainColor?: string;
  width?: number;
  opacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
}

export interface AnimationProps {
  // Packet animation on link
  packetColor?: string;
  packetRadius?: number;
  duration?: number; // Travel duration
  
  // Node impact animation
  scale?: number;
  durationIn?: number;
}

export interface StyleDefinition<PersistentType> {
  persistent?: PersistentType; // What sticks after the event
  animation?: AnimationProps;  // Transient effects
}

export interface ThemeConfig {
  nodeStyles: Record<string, StyleDefinition<NodeStyleVisuals>>;
  linkStyles: Record<string, StyleDefinition<LinkStyleVisuals>>;
}

// --- Event Sequence ---

export interface AtomicStep {
  type?: 'atomic'; // Default if undefined
  from: string;
  to: string;
  label?: string;
  
  // Reference a key in themeConfig.linkStyles
  linkStyle?: string; 
  
  // Reference a key in themeConfig.nodeStyles to apply to the target node
  targetNodeState?: string;
  
  // Optional override for timing if not defined in style
  duration?: number; 
  delay?: number;
}

export interface ParallelStep {
  type: 'parallel';
  steps: SimulationAction[];
  delay?: number;
  label?: string;
}

export type SimulationAction = AtomicStep | ParallelStep;

// Backward compatibility alias if needed, though we use SimulationAction now
export type EventStep = AtomicStep; 

export interface EventSequence {
  name: string;
  steps: SimulationAction[];
}
