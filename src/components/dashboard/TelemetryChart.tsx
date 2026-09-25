import React from 'react';
import { TelemetryPoint } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Radio } from 'lucide-react';

interface TelemetryChartProps {
  telemetrySeries: TelemetryPoint[];
  currentLatency: number;
  currentCpu: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  telemetrySeries,
  currentLatency,
  currentCpu,
}) => {
  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-3.5 sm:p-4 space-y-3 shadow-xl relative overflow-hidden">
      {/* Background Neon Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-lime-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
            Real-Time System Telemetry
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-lime-400 bg-lime-500/10 border border-lime-500/20 px-2 py-0.5 rounded-full">
          <Radio className="w-3 h-3 animate-pulse text-lime-400" />
          <span>LIVE 3S TICK</span>
        </div>
      </div>

      {/* Current Stat Indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/80 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">System Latency</div>
            <div className="text-base font-extrabold text-lime-400 font-mono mt-0.5">{currentLatency} ms</div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-400 border border-lime-500/30 font-semibold font-mono">
            Ultra-Fast
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/80 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">CPU Core Load</div>
            <div className="text-base font-extrabold text-white font-mono mt-0.5">{currentCpu}%</div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold font-mono">
            Optimal
          </span>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-32 sm:h-36 w-full pt-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={telemetrySeries} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="latencyGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#84CC16" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#84CC16" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="cpuGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#52525b"
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#52525b"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#09090b',
                borderColor: '#27272a',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#fff',
                fontFamily: 'monospace',
              }}
              formatter={(value: any, name: any) => [
                `${value} ${name === 'latency' ? 'ms' : '%'}`,
                name === 'latency' ? 'Latency' : 'CPU Usage',
              ]}
            />
            <Area
              type="monotone"
              dataKey="latency"
              stroke="#84CC16"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#latencyGlow)"
            />
            <Area
              type="monotone"
              dataKey="cpu"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#cpuGlow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-900">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-lime-400" /> Latency (ms)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> CPU (%)
          </span>
        </div>
        <span>RCOS Telemetry Engine</span>
      </div>
    </div>
  );
};
