import React from 'react';
import { DepartmentTransfer } from '../../types';
import { RCOS_DEPARTMENTS } from '../../data/departments';
import { PhoneForwarded, X, User, PhoneCall, ShieldCheck } from 'lucide-react';

interface DepartmentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDepartment: (dept: DepartmentTransfer) => void;
  currentDepartment?: string;
}

export const DepartmentTransferModal: React.FC<DepartmentTransferModalProps> = ({
  isOpen,
  onClose,
  onSelectDepartment,
  currentDepartment
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/30">
              <PhoneForwarded className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transfer Caller</h3>
              <p className="text-[11px] text-zinc-400">Route active call to requested department</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
          {RCOS_DEPARTMENTS.map((dept) => {
            const isCurrent = currentDepartment === dept.name;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => {
                  onSelectDepartment(dept);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 group ${
                  isCurrent 
                    ? 'bg-lime-500/10 border-lime-500/50' 
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-lime-400 transition-colors">
                    {dept.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-800 text-lime-400 border border-zinc-700">
                    Ext {dept.extension}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <User className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Lead: <strong className="text-zinc-200">{dept.leadName}</strong></span>
                </div>
                <p className="text-[10.5px] text-zinc-500 leading-tight">
                  {dept.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="pt-1 text-[11px] text-zinc-500 flex items-center justify-between border-t border-zinc-900 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
            <span>VoIP PBX Direct Trunk</span>
          </span>
          <span>5 Available Depts</span>
        </div>
      </div>
    </div>
  );
};
