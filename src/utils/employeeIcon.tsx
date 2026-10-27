import React from 'react';
import {
  ShieldAlert, Cpu, Kanban, CircleDollarSign, Users, CalendarClock,
  TrendingUp, HeartHandshake, Wrench, Megaphone, FileText, BarChart3,
  Phone, Mail, FileCheck, Share2, Sparkles, Bot
} from 'lucide-react';
import { AI_EMPLOYEES } from '../data/employees';

/**
 * Real icon components for employee avatarIcon names. GeminiChatView used
 * to render the raw icon NAME as text ("ShieldAlert", "Phone", ...) in the
 * avatar bubble — this maps the name to the actual icon instead.
 */
export function getEmployeeIcon(iconName: string, className = 'w-4 h-4'): React.ReactElement {
  switch (iconName) {
    case 'ShieldAlert': return <ShieldAlert className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'Kanban': return <Kanban className={className} />;
    case 'CircleDollarSign': return <CircleDollarSign className={className} />;
    case 'Users': return <Users className={className} />;
    case 'CalendarClock': return <CalendarClock className={className} />;
    case 'TrendingUp': return <TrendingUp className={className} />;
    case 'HeartHandshake': return <HeartHandshake className={className} />;
    case 'Wrench': return <Wrench className={className} />;
    case 'Megaphone': return <Megaphone className={className} />;
    case 'FileText': return <FileText className={className} />;
    case 'BarChart3': return <BarChart3 className={className} />;
    case 'Phone': return <Phone className={className} />;
    case 'Mail': return <Mail className={className} />;
    case 'FileCheck': return <FileCheck className={className} />;
    case 'Share2': return <Share2 className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    default: return <Bot className={className} />;
  }
}

/**
 * Distinct avatar colors per agent, so agents are tellable apart at a
 * glance instead of every avatar sharing the same lime styling. Derived
 * from the agent's position in AI_EMPLOYEES, so every agent — including
 * ones added later — gets a color deterministically.
 */
const AGENT_PALETTE: Array<{ avatar: string; label: string }> = [
  { avatar: 'bg-lime-500/15 text-lime-400 border-lime-500/30', label: 'text-lime-400' },
  { avatar: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'text-blue-400' },
  { avatar: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'text-amber-400' },
  { avatar: 'bg-pink-500/15 text-pink-400 border-pink-500/30', label: 'text-pink-400' },
  { avatar: 'bg-purple-500/15 text-purple-400 border-purple-500/30', label: 'text-purple-400' },
  { avatar: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'text-orange-400' },
  { avatar: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', label: 'text-cyan-400' },
  { avatar: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'text-emerald-400' },
];

export function agentColorSet(employeeId: string): { avatar: string; label: string } {
  const idx = AI_EMPLOYEES.findIndex((e) => e.id === employeeId);
  return AGENT_PALETTE[(idx < 0 ? 0 : idx) % AGENT_PALETTE.length];
}
