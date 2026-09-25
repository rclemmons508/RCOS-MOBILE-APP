import React from 'react';
import { Agent } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Cpu } from 'lucide-react';

interface AgentWorkloadChartProps {
  agents: Agent[];
}

export const AgentWorkloadChart: React.FC<AgentWorkloadChartProps> = ({ agents }) => {
  const chartData = agents.map((agent) => ({
    name: agent.name.split(' ')[0],
    tasks: agent.tasksCompletedToday,
    accuracy: agent.accuracy,
    color: agent.color,
  }));

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-3.5 sm:p-4 space-y-3 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-lime-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
            Agent Workload Distribution
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">Tasks Completed Today</span>
      </div>

      <div className="h-32 w-full pt-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <XAxis
              dataKey="name"
              stroke="#52525b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#52525b"
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#09090b',
                borderColor: '#27272a',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#fff',
                fontFamily: 'sans-serif',
              }}
              formatter={(value: any) => [`${value} tasks completed`, 'Volume']}
            />
            <Bar dataKey="tasks" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-mono pt-2 border-t border-zinc-900">
        {agents.map((ag) => (
          <div key={ag.id} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate max-w-[120px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ag.color }} />
              <span className="truncate">{ag.name.split(' ')[0]}</span>
            </span>
            <span className="text-white font-bold">{ag.tasksCompletedToday}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
