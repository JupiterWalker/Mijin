import React, { useMemo } from 'react';

export interface MinimapNode {
  id: string;
  x: number;
  y: number;
  color?: string;
}

export interface MinimapZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MinimapProps {
  nodes: MinimapNode[];
  zones: MinimapZone[];
  world: WorldBounds;
  viewport: ViewportBounds;
  isDirectorMode?: boolean;
}

const BASE_WIDTH = 200;
const BASE_HEIGHT = 140;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const Minimap: React.FC<MinimapProps> = ({ nodes, zones, world, viewport, isDirectorMode = false }) => {
  const { scale, offsetX, offsetY } = useMemo(() => {
    const padding = 120;
    const computedMinX = Math.min(world.minX, ...zones.map((z) => z.x), ...nodes.map((n) => n.x)) - padding;
    const computedMinY = Math.min(world.minY, ...zones.map((z) => z.y), ...nodes.map((n) => n.y)) - padding;
    const computedMaxX = Math.max(world.maxX, ...zones.map((z) => z.x + z.width), ...nodes.map((n) => n.x)) + padding;
    const computedMaxY = Math.max(world.maxY, ...zones.map((z) => z.y + z.height), ...nodes.map((n) => n.y)) + padding;

    const safeMinX = Number.isFinite(computedMinX) ? computedMinX : -100;
    const safeMinY = Number.isFinite(computedMinY) ? computedMinY : -100;
    const safeMaxX = Number.isFinite(computedMaxX) ? computedMaxX : 100;
    const safeMaxY = Number.isFinite(computedMaxY) ? computedMaxY : 100;

    const worldWidth = Math.max(safeMaxX - safeMinX, 1);
    const worldHeight = Math.max(safeMaxY - safeMinY, 1);

    const scaleX = BASE_WIDTH / worldWidth;
    const scaleY = BASE_HEIGHT / worldHeight;
    const uniformScale = Math.min(scaleX, scaleY);
    const offsetHorizontal = (BASE_WIDTH - worldWidth * uniformScale) / 2;
    const offsetVertical = (BASE_HEIGHT - worldHeight * uniformScale) / 2;

    return {
      scale: uniformScale,
      offsetX: offsetHorizontal - safeMinX * uniformScale,
      offsetY: offsetVertical - safeMinY * uniformScale,
    };
  }, [nodes, world.maxX, world.minX, world.maxY, world.minY, zones]);

  const toScreenX = (x: number) => x * scale + offsetX;
  const toScreenY = (y: number) => y * scale + offsetY;

  const viewportScreen = useMemo(() => {
    const width = viewport.width * scale;
    const height = viewport.height * scale;
    const x = toScreenX(viewport.x);
    const y = toScreenY(viewport.y);

    const clampX = clamp(x, 0, BASE_WIDTH - width);
    const clampY = clamp(y, 0, BASE_HEIGHT - height);

    return {
      x: clampX,
      y: clampY,
      width: Math.min(width, BASE_WIDTH),
      height: Math.min(height, BASE_HEIGHT),
    };
  }, [scale, viewport.height, viewport.width, viewport.x, viewport.y]);

  return (
    <div className="pointer-events-none select-none">
      <svg
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        className={`rounded-xl shadow-lg ring-1 ring-black/10 ${isDirectorMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur`}
      >
        <rect x={0} y={0} width={BASE_WIDTH} height={BASE_HEIGHT} fill="none" stroke={isDirectorMode ? '#1e293b' : '#cbd5f5'} strokeWidth={1} opacity={0.8} />

        {zones.map((zone) => {
          const x = toScreenX(zone.x);
          const y = toScreenY(zone.y);
          const width = Math.max(zone.width * scale, 2);
          const height = Math.max(zone.height * scale, 2);
          const stroke = zone.color || '#3b82f6';
          const fill = isDirectorMode ? 'rgba(96, 165, 250, 0.16)' : 'rgba(96, 165, 250, 0.12)';

          return <rect key={zone.id} x={x} y={y} width={width} height={height} rx={4} fill={fill} stroke={stroke} strokeWidth={1} />;
        })}

        {nodes.map((node) => {
          const x = toScreenX(node.x);
          const y = toScreenY(node.y);
          const fill = node.color || (isDirectorMode ? '#38bdf8' : '#6366f1');

          return <circle key={node.id} cx={x} cy={y} r={4} fill={fill} stroke={isDirectorMode ? '#0f172a' : '#eef2ff'} strokeWidth={1.5} opacity={0.9} />;
        })}

        <rect
          x={viewportScreen.x}
          y={viewportScreen.y}
          width={Math.max(viewportScreen.width, 10)}
          height={Math.max(viewportScreen.height, 10)}
          fill="none"
          stroke={isDirectorMode ? '#bae6fd' : '#312e81'}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </svg>
    </div>
  );
};

export default Minimap;
