import React, { useRef, useEffect, useState } from 'react';
import { Layers, Play, Pause, Info, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface PipelineVisualizer3DProps {
  trackedWallets?: number;
  openPositions?: number;
  totalSignals?: number;
  activeRuleVersion?: string;
  isDaemonRunning?: boolean;
}

interface Node3D {
  id: string;
  name: string;
  sub: string;
  x: number;
  y: number;
  z: number;
  status: 'ACTIVE' | 'IDLE' | 'LEARNING';
  metrics: string;
  description: string;
}

export const PipelineVisualizer3D: React.FC<PipelineVisualizer3DProps> = ({
  trackedWallets = 0,
  openPositions = 0,
  totalSignals = 0,
  activeRuleVersion = 'v1.0.0',
  isDaemonRunning = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotX, setRotX] = useState(0.25);
  const [rotY, setRotY] = useState(-0.35);

  const nodes: Node3D[] = [
    {
      id: 'ingest',
      name: '1. Ingestion Feed',
      sub: 'Polymarket CLOB & Gamma',
      x: -240,
      y: 0,
      z: 0,
      status: 'ACTIVE',
      metrics: '500 Wallets | Real-time',
      description: 'Stream orderbooks, trade fills, and market resolution events with zero data fabrication.',
    },
    {
      id: 'wallet',
      name: '2. Wallet Intelligence',
      sub: 'Quality & One-Hit Filter',
      x: -120,
      y: -30,
      z: 40,
      status: 'ACTIVE',
      metrics: `${trackedWallets} Tracked Wallets`,
      description: 'Calculates 30d ROI, consistency, copyability, and penalizes single lucky-trade whales.',
    },
    {
      id: 'signal',
      name: '3. Signal Scorer',
      sub: 'Multi-Factor Engine',
      x: 0,
      y: 20,
      z: -30,
      status: 'ACTIVE',
      metrics: `${totalSignals} Total Signals`,
      description: 'Evaluates spread, liquidity, latency drift, and thesis to yield paper_copy, watchlist, or skip.',
    },
    {
      id: 'paper',
      name: '4. Paper Simulator',
      sub: '$5 - $20 Bounded Sim',
      x: 120,
      y: -25,
      z: 50,
      status: 'ACTIVE',
      metrics: `${openPositions} Open Positions`,
      description: 'Executes strictly simulated orders without real keys. Updates mark-to-market hourly.',
    },
    {
      id: 'learning',
      name: '5. Rule Calibration',
      sub: 'Walk-Forward Engine',
      x: 240,
      y: 10,
      z: -20,
      status: 'LEARNING',
      metrics: `RuleSet: ${activeRuleVersion}`,
      description: 'Out-of-sample 70/30 walk-forward validation adapts paper rules autonomously with immutable audit.',
    },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    const particles: { progress: number; speed: number; segment: number; offset: number }[] = [];

    // Initialize 24 flowing data particles along the 4 segments
    for (let i = 0; i < 24; i++) {
      particles.push({
        progress: Math.random(),
        speed: 0.004 + Math.random() * 0.003,
        segment: Math.floor(Math.random() * (nodes.length - 1)),
        offset: (Math.random() - 0.5) * 8,
      });
    }

    const render = () => {
      if (!canvas) return;
      const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
      const height = (canvas.height = Math.min(320, Math.max(240, width * 0.35)));

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Project 3D coordinate to 2D screen coordinate
      const project = (x: number, y: number, z: number) => {
        // Rotate around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;

        // Rotate around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;

        // Perspective scale factor
        const fov = 480;
        const scale = fov / (fov + z2);
        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          scale,
          zDepth: z2,
        };
      };

      // Draw subtle ambient 3D grid plane
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
      ctx.lineWidth = 1;
      for (let gx = -280; gx <= 280; gx += 70) {
        const p1 = project(gx, 50, -100);
        const p2 = project(gx, 50, 100);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
      for (let gz = -100; gz <= 100; gz += 50) {
        const p1 = project(-280, 50, gz);
        const p2 = project(280, 50, gz);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      // Draw connecting energy tubes between pipeline nodes
      for (let i = 0; i < nodes.length - 1; i++) {
        const nA = nodes[i];
        const nB = nodes[i + 1];
        const pA = project(nA.x, nA.y, nA.z);
        const pB = project(nB.x, nB.y, nB.z);

        // Gradient line connecting nodes
        const grad = ctx.createLinearGradient(pA.px, pA.py, pB.px, pB.py);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        grad.addColorStop(0.5, 'rgba(96, 165, 250, 0.6)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.3)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.5, 2.5 * ((pA.scale + pB.scale) / 2));
        ctx.beginPath();
        ctx.moveTo(pA.px, pA.py);
        ctx.lineTo(pB.px, pB.py);
        ctx.stroke();
      }

      // Draw flowing data particles
      if (!isPaused) {
        particles.forEach((p) => {
          p.progress += p.speed;
          if (p.progress >= 1) {
            p.progress = 0;
            p.segment = (p.segment + 1) % (nodes.length - 1);
          }
          const nA = nodes[p.segment];
          const nB = nodes[p.segment + 1];

          const curX = nA.x + (nB.x - nA.x) * p.progress;
          const curY = nA.y + (nB.y - nA.y) * p.progress + p.offset;
          const curZ = nA.z + (nB.z - nA.z) * p.progress;

          const proj = project(curX, curY, curZ);

          ctx.fillStyle = '#60a5fa';
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, Math.max(1.5, 3 * proj.scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      // Project and sort nodes by depth for correct 3D rendering
      const projectedNodes = nodes.map((node) => ({
        ...node,
        proj: project(node.x, node.y, node.z),
      }));
      projectedNodes.sort((a, b) => b.proj.zDepth - a.proj.zDepth);

      // Render 3D Nodes
      projectedNodes.forEach((node) => {
        const { px, py, scale } = node.proj;
        const radius = Math.max(14, 22 * scale);
        const isHovered = hoveredNode?.id === node.id;

        // Outer glow
        const glowRad = radius * (isHovered ? 2.2 : 1.6);
        const glowGrad = ctx.createRadialGradient(px, py, radius * 0.4, px, py, glowRad);
        glowGrad.addColorStop(0, isHovered ? 'rgba(96, 165, 250, 0.5)' : 'rgba(59, 130, 246, 0.25)');
        glowGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(px, py, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // Node base circle
        ctx.fillStyle = isHovered ? '#1e3a8a' : '#090e1a';
        ctx.strokeStyle = isHovered ? '#60a5fa' : '#3b82f6';
        ctx.lineWidth = isHovered ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner glowing core
        ctx.fillStyle = isHovered ? '#93c5fd' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Node labels
        ctx.font = `600 ${Math.max(10, Math.floor(12 * scale))}px Outfit, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, px, py - radius - 8);

        ctx.font = `500 ${Math.max(8, Math.floor(10 * scale))}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(node.metrics, px, py + radius + 14);
      });

      time += 0.01;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [nodes, rotX, rotY, isPaused, hoveredNode]);

  // Pointer drag for smooth 3D rotation
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.buttons === 1) {
      setRotY((prev) => prev + e.movementX * 0.005);
      setRotX((prev) => Math.max(-0.5, Math.min(0.5, prev + e.movementY * 0.005)));
    }

    // Check hit test on nodes
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let found: Node3D | null = null;

    nodes.forEach((node) => {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = node.x * cosY - node.z * sinY;
      const z1 = node.z * cosY + node.x * sinY;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = node.y * cosX - z1 * sinX;
      const z2 = z1 * cosX + node.y * sinX;

      const scale = 480 / (480 + z2);
      const px = cx + x1 * scale;
      const py = cy + y2 * scale;
      const dist = Math.hypot(mx - px, my - py);

      if (dist < 28) {
        found = node;
      }
    });

    setHoveredNode(found);
  };

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Autonomous Paper-Trading Pipeline</span>
          <Badge variant="blue" className="ml-1 text-[10px]">
            3D VISUALIZER
          </Badge>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-blue-900/40 transition-colors text-xs flex items-center gap-1"
            title={isPaused ? 'Resume Animation' : 'Pause Animation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-blue-400" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline font-mono text-[11px]">{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>
        </div>
      }
      noPadding
      className="overflow-hidden relative"
    >
      {/* 3D Interactive Canvas */}
      <div className="relative w-full h-64 sm:h-72 bg-gradient-to-b from-[#050811] to-[#090e1a] cursor-grab active:cursor-grabbing select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredNode(null)}
          className="w-full h-full block"
        />

        {/* Drag Hint Pill */}
        <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-blue-500/10 pointer-events-none">
          Click & Drag to Tilt 3D Pipeline • Hover Node to Inspect
        </div>

        {/* Live Daemon Status Pill */}
        <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[10px] font-mono text-blue-200 bg-blue-950/80 px-2.5 py-1 rounded-full border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>DAEMON: {isDaemonRunning ? 'AUTONOMOUS ACTIVE' : 'STANDBY'}</span>
        </div>
      </div>

      {/* Node Detail Bar */}
      <div className="p-3 sm:p-4 border-t border-blue-500/15 bg-[#060a14] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {hoveredNode ? (
          <div className="space-y-0.5">
            <div className="font-semibold text-white flex items-center gap-2">
              <span className="text-blue-400 font-bold">{hoveredNode.name}</span>
              <span className="text-slate-400">— {hoveredNode.sub}</span>
            </div>
            <p className="text-slate-400 text-[11px]">{hoveredNode.description}</p>
          </div>
        ) : (
          <div className="text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Real-time multi-stage pipeline: Discovers wallets, scores signals, isolates uncopyable one-hit wonders, and auto-calibrates.
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-blue-300">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Paper Mode: $5.00 – $20.00 Max Sizing</span>
        </div>
      </div>
    </Card>
  );
};
