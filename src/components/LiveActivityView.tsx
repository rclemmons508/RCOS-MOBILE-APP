import React, { useState } from 'react';
import { 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { ActionRecord, BusinessAccount } from '../types';
import { AI_EMPLOYEES } from '../data/employees';

interface LiveActivityViewProps {
  business: BusinessAccount;
  actions: ActionRecord[];
  onRefresh: () => void;
}

export const LiveActivityView: React.FC<LiveActivityViewProps> = ({
  business,
  actions,
  onRefresh
}) => {
  const [expandedActionIds, setExpandedActionIds] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedActionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Export full actions CSV
  const handleExportCsv = () => {
    window.open(`/api/business/${business.id}/export?format=csv`, '_blank');
  };

  // Printable single or all action report
  const handlePrintReport = (singleAction?: ActionRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsToPrint = singleAction ? [singleAction] : actions;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>RCOS Operational Report - ${business.name}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #1e293b; line-height: 1.5; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .header-meta { font-size: 12px; color: #64748b; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
            .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #e2e8f0; }
            .trace-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            .trace-table th, .trace-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            .trace-table th { background: #f8fafc; }
            pre { background: #f1f5f9; padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>RCOS Operational Work Record</h1>
          <div class="header-meta">
            Business: <strong>${business.name}</strong> | Industry: ${business.industry} | Generated: ${new Date().toLocaleString()}
          </div>
          ${itemsToPrint.map(a => `
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 14px;">${a.title}</h3>
                <span class="badge">${a.status.toUpperCase()}</span>
              </div>
              <p style="font-size: 12px; color: #475569; margin: 6px 0;">Summary: ${a.stepSummary}</p>
              <div style="font-size: 11px; color: #64748b;">
                Employee: ${a.employeeId} | Value: $${a.dollarAmount || 0} | Date: ${new Date(a.createdAt).toLocaleString()}
              </div>
              ${a.result?.text ? `
                <div style="margin-top: 8px;">
                  <strong>Result Artifact:</strong>
                  <pre>${a.result.text}</pre>
                </div>
              ` : ''}
              ${a.fullTrace && a.fullTrace.length > 0 ? `
                <div style="margin-top: 10px;">
                  <strong>Step-by-Step Trace:</strong>
                  <table class="trace-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Stage</th>
                        <th>Action</th>
                        <th>Checked</th>
                        <th>Rule Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${a.fullTrace.map(t => `
                        <tr>
                          <td>${t.stepNumber}</td>
                          <td>${t.stage}</td>
                          <td>${t.action}</td>
                          <td>${t.checked}</td>
                          <td>${t.ruleApplied}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Filter actions
  const filteredActions = actions.filter(action => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'working' && action.status !== 'running' && action.status !== 'queued') return false;
      if (filterStatus === 'needs_approval' && action.status !== 'awaiting_approval') return false;
      if (filterStatus === 'done' && action.status !== 'completed') return false;
      if (filterStatus === 'rejected' && action.status !== 'rejected' && action.status !== 'failed') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = action.title.toLowerCase().includes(q);
      const matchSummary = (action.stepSummary || action.description || '').toLowerCase().includes(q);
      const matchEmployee = action.employeeId.toLowerCase().includes(q);
      return matchTitle || matchSummary || matchEmployee;
    }
    return true;
  });

  const getStatusBadge = (status: ActionRecord['status']) => {
    switch (status) {
      case 'running':
      case 'queued':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Working
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Needs your approval
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-[#00ff66]" />
            Done
          </span>
        );
      case 'rejected':
      case 'failed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Needs attention
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2637] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Live Activity Feed</span>
            <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time feed of tasks, calculations, and operational work performed by your AI team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-[#141822] hover:bg-[#1e2536] text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-[#263044] transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#00ff66]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrintReport()}
            className="px-3 py-2 rounded-xl bg-[#141822] hover:bg-[#1e2536] text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-[#263044] transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1017] p-3 rounded-2xl border border-[#1d2434]">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity records..."
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'working', label: 'Working' },
            { id: 'needs_approval', label: 'Needs Approval' },
            { id: 'done', label: 'Done' },
            { id: 'rejected', label: 'Attention' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer shrink-0 ${
                filterStatus === tab.id
                  ? 'bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions List */}
      {filteredActions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0e1118] border border-[#1f2638] space-y-3">
          <Activity className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">No actions in queue</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'all' 
                ? 'No activity records match your current filter.' 
                : 'Your AI team is standing by. Use the Command Bar above to assign your first operational task.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActions.map((action) => {
            const employee = AI_EMPLOYEES.find(e => e.id === action.employeeId) || AI_EMPLOYEES[0];
            const isExpanded = !!expandedActionIds[action.id];

            return (
              <div
                key={action.id}
                className="p-4 md:p-5 rounded-2xl bg-[#0e1118] border border-[#21293a] hover:border-slate-700 transition space-y-3 shadow-lg"
              >
                {/* Primary Simple Line (Friendly by Default) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#141822] border border-[#263044] flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                      {employee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{action.title}</h4>
                      <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#00ff66]">{employee.name}</span>
                        <span>•</span>
                        <span>{action.stepSummary}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    {getStatusBadge(action.status)}
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Friendly Result Summary if available */}
                {action.result?.summary && (
                  <div className="p-3 rounded-xl bg-[#121622] border border-[#1c2333] text-xs text-slate-300 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-200">Outcome: </span>
                      {action.result.summary}
                    </div>
                    {action.dollarAmount && action.dollarAmount > 0 && (
                      <span className="font-mono text-xs font-bold text-[#00ff66] shrink-0">
                        ${action.dollarAmount}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Controls: "View full details" Toggle & Single Action Export */}
                <div className="flex items-center justify-between pt-1 border-t border-[#181f2e] text-xs">
                  <button
                    type="button"
                    onClick={() => toggleExpand(action.id)}
                    className="flex items-center gap-1 text-slate-400 hover:text-[#00ff66] transition cursor-pointer font-medium"
                  >
                    <span>{isExpanded ? 'Hide technical trace' : 'View full details & trace'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintReport(action)}
                    className="text-slate-500 hover:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Report</span>
                  </button>
                </div>

                {/* EXPANDED FULL TRACE (Only when requested by user) */}
                {isExpanded && (
                  <div className="pt-3 space-y-3 border-t border-[#1e2537] animate-in fade-in duration-200">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#00ff66]" />
                      <span>Complete Execution Trace (Auditable Log)</span>
                    </div>

                    {/* Step-by-step table */}
                    <div className="overflow-x-auto rounded-xl border border-[#21293a] bg-[#090b0e]">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-[#121622] text-slate-400 border-b border-[#21293a]">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Stage</th>
                            <th className="py-2 px-3">Action</th>
                            <th className="py-2 px-3">What was checked</th>
                            <th className="py-2 px-3">Rule Applied</th>
                            <th className="py-2 px-3">Data Used</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#181f2f]">
                          {action.fullTrace?.map((step, idx) => (
                            <tr key={idx} className="hover:bg-[#121622]/50">
                              <td className="py-2 px-3 font-mono text-[#00ff66]">{step.stepNumber}</td>
                              <td className="py-2 px-3 font-medium text-white">{step.stage}</td>
                              <td className="py-2 px-3">{step.action}</td>
                              <td className="py-2 px-3 text-slate-400">{step.checked}</td>
                              <td className="py-2 px-3 text-slate-400">{step.ruleApplied}</td>
                              <td className="py-2 px-3 font-mono text-slate-500 text-[10px]">{step.dataUsed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Full Raw Generated Result */}
                    {action.result?.text && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-400">Result Output:</div>
                        <pre className="p-3 rounded-xl bg-[#090b0e] border border-[#1b2233] text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {action.result.text}
                        </pre>
                      </div>
                    )}

                    {/* Decision info if owner reviewed */}
                    {action.approvalDecision && (
                      <div className="p-2.5 rounded-lg bg-[#141822] border border-[#21293a] text-[11px] text-slate-400 flex items-center justify-between">
                        <div>
                          Owner Decision: <strong className="text-white capitalize">{action.approvalDecision.decision}</strong>
                          {action.approvalDecision.reviewerNote && ` ("${action.approvalDecision.reviewerNote}")`}
                        </div>
                        <span className="font-mono text-slate-500">
                          {new Date(action.approvalDecision.decidedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
