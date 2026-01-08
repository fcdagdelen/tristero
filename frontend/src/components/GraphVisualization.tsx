import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from '../types';
import type { TraversalState } from '../hooks/useGraph';

interface Props {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
  width?: number;
  height?: number;
  traversalState?: TraversalState;
}

export function GraphVisualization({
  data,
  onNodeClick,
  width = 600,
  height = 400,
  traversalState
}: Props) {
  const fgRef = useRef<any>();
  const [animationTick, setAnimationTick] = useState(0);
  const hasInitializedRef = useRef(false);

  // Animation ticker for pulsing effects on active node
  useEffect(() => {
    if (!traversalState?.isActive && !traversalState?.glowIntensities?.size) return;

    const interval = setInterval(() => {
      setAnimationTick((t) => t + 1);
    }, 50); // 20fps for smooth pulsing

    return () => clearInterval(interval);
  }, [traversalState?.isActive, traversalState?.glowIntensities?.size]);

  // Zoom to fit only once when graph first loads
  useEffect(() => {
    if (data.nodes.length > 0 && fgRef.current && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Wait for physics to settle a bit
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 1500);
    }
  }, [data.nodes.length]);

  const handleNodeClick = useCallback((node: any) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
    // Center view on clicked node with smooth zoom
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
    }
  }, [onNodeClick]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = Math.max(10 / globalScale, 3);
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;

    // Get glow intensity from traversal state
    const glowIntensity = traversalState?.glowIntensities?.get(node.id) || 0;
    const isActive = traversalState?.activeNodeId === node.id;
    const isVisited = traversalState?.visitedNodes?.has(node.id) || false;

    const nodeSize = node.val * (glowIntensity > 0 ? 1 + glowIntensity * 0.5 : 1);

    // Pulsing effect for active node
    const pulseIntensity = isActive
      ? Math.sin(animationTick * 0.15) * 0.3 + 0.7
      : 1;

    // Draw outer glow (largest, softest)
    if (glowIntensity > 0.1) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 14 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = `rgba(59, 130, 246, ${glowIntensity * 0.15 * pulseIntensity})`;
      ctx.fill();
    }

    // Draw middle glow
    if (glowIntensity > 0.05) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 8 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = `rgba(59, 130, 246, ${glowIntensity * 0.3 * pulseIntensity})`;
      ctx.fill();
    }

    // Draw inner glow (smallest, brightest)
    if (glowIntensity > 0) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 4 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = `rgba(59, 130, 246, ${glowIntensity * 0.5 * pulseIntensity})`;
      ctx.fill();
    }

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);

    // Color based on state
    if (isActive) {
      ctx.fillStyle = '#3B82F6'; // Bright blue for active
    } else if (glowIntensity > 0.3) {
      // Blend between original color and blue based on glow
      ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + glowIntensity * 0.5})`;
    } else if (isVisited) {
      ctx.fillStyle = node.color; // Keep original but we'll add border
    } else {
      ctx.fillStyle = node.color;
    }
    ctx.fill();

    // Draw border
    if (isActive) {
      ctx.strokeStyle = '#93C5FD'; // Light blue border for active
      ctx.lineWidth = 3 / globalScale;
    } else if (glowIntensity > 0) {
      ctx.strokeStyle = `rgba(147, 197, 253, ${glowIntensity})`;
      ctx.lineWidth = 2 / globalScale;
    } else if (isVisited) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 1.5 / globalScale;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1 / globalScale;
    }
    ctx.stroke();

    // Draw label (always show for glowing nodes, otherwise only when zoomed)
    if (globalScale > 0.5 || glowIntensity > 0.3 || isActive) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw text shadow for better readability
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      const labelY = node.y + nodeSize + fontSize + 2;
      const displayLabel = label.slice(0, 25) + (label.length > 25 ? '...' : '');
      ctx.fillText(displayLabel, node.x + 1, labelY + 1);

      // Draw text
      if (isActive || glowIntensity > 0.5) {
        ctx.fillStyle = '#93C5FD'; // Light blue for active/glowing
      } else if (isVisited) {
        ctx.fillStyle = '#60A5FA'; // Softer blue for visited
      } else {
        ctx.fillStyle = '#E2E8F0';
      }
      ctx.fillText(displayLabel, node.x, labelY);
    }
  }, [traversalState, animationTick]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;

    if (typeof start !== 'object' || typeof end !== 'object') return;

    // Check if this edge is being animated or was visited
    const edgeId = link.id;
    const drawProgress = traversalState?.edgeProgress?.get(edgeId) ?? 1.0;
    const isVisited = traversalState?.visitedEdges?.has(edgeId) || false;
    const isAnimating = drawProgress < 1.0;

    // Check if both endpoints are glowing
    const sourceGlow = traversalState?.glowIntensities?.get(start.id) || 0;
    const targetGlow = traversalState?.glowIntensities?.get(end.id) || 0;
    const connectionGlow = Math.min(sourceGlow, targetGlow);

    // Calculate positions
    const startX = start.x;
    const startY = start.y;
    const endX = end.x;
    const endY = end.y;

    // For animating edges, calculate partial endpoint
    const currentEndX = startX + (endX - startX) * drawProgress;
    const currentEndY = startY + (endY - startY) * drawProgress;

    // Base width from edge weight
    const baseWidth = Math.max(link.weight * 2, 0.5) / globalScale;

    // Draw glow for edges connecting glowing nodes
    if (connectionGlow > 0.1 && !isAnimating) {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = `rgba(59, 130, 246, ${connectionGlow * 0.3})`;
      ctx.lineWidth = baseWidth * 4;
      ctx.stroke();
    }

    // Draw the edge itself
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentEndX, currentEndY);

    if (isAnimating) {
      // Bright blue for animating edges
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.lineWidth = baseWidth * 3;
    } else if (isVisited || connectionGlow > 0.1) {
      // Highlighted for visited edges
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 + connectionGlow * 0.4})`;
      ctx.lineWidth = baseWidth * 2;
    } else {
      // Normal dim edge
      const alpha = Math.min(link.weight * 0.6, 0.5);
      ctx.strokeStyle = `rgba(100, 116, 139, ${alpha})`;
      ctx.lineWidth = baseWidth;
    }
    ctx.stroke();

    // Draw glowing tip for animating edges
    if (isAnimating) {
      // Outer glow
      ctx.beginPath();
      ctx.arc(currentEndX, currentEndY, 6 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fill();

      // Inner bright dot
      ctx.beginPath();
      ctx.arc(currentEndX, currentEndY, 3 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'rgba(147, 197, 253, 1.0)';
      ctx.fill();
    }

    // Draw particles along visited edges
    if (isVisited && connectionGlow > 0.2) {
      const particleCount = Math.ceil(connectionGlow * 2);
      for (let i = 0; i < particleCount; i++) {
        const offset = (animationTick * 0.02 + i / particleCount) % 1;
        const px = startX + (endX - startX) * offset;
        const py = startY + (endY - startY) * offset;

        ctx.beginPath();
        ctx.arc(px, py, 2 / globalScale, 0, 2 * Math.PI, false);
        ctx.fillStyle = `rgba(147, 197, 253, ${connectionGlow * 0.6})`;
        ctx.fill();
      }
    }
  }, [traversalState, animationTick]);

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <p className="text-xl mb-2">No nodes yet</p>
          <p className="text-sm text-slate-600">Add a note or import from Obsidian to get started</p>
        </div>
      </div>
    );
  }

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="#0f172a"
      nodeCanvasObject={nodeCanvasObject}
      linkCanvasObject={linkCanvasObject}
      onNodeClick={handleNodeClick}
      nodeRelSize={1}
      // Reduced particles to avoid conflict with our custom animations
      linkDirectionalParticles={0}
      // Physics settings for stability
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
      d3AlphaMin={0.001}
      cooldownTime={3000}
      warmupTicks={100}
      enableZoomInteraction={true}
      enablePanInteraction={true}
      minZoom={0.2}
      maxZoom={8}
    />
  );
}
