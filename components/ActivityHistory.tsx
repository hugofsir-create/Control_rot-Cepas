
import React from 'react';
import { ActivityLog } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  ArrowLeft, 
  History, 
  Clock, 
  Info, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Trash2
} from 'lucide-react';

interface ActivityHistoryProps {
  logs: ActivityLog[];
  onBack: () => void;
  onClearLogs: () => void;
}

export const ActivityHistory: React.FC<ActivityHistoryProps> = ({ logs, onBack, onClearLogs }) => {
  const getIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'WARNING': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'DANGER': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-4 flex items-center justify-between shadow-2xl sticky top-0 z-40">
        <div className="flex items-center gap-4 lg:gap-6">
          <Button variant="ghost" onClick={onBack} className="p-3 bg-zinc-950/50 rounded-full hover:bg-zinc-800 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl lg:text-2xl font-black italic tracking-tighter flex items-center gap-2 lg:gap-3">
              HISTORIAL <span className="text-amber-500">DE ACTIVIDAD</span>
            </h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Registro de operaciones del sistema</p>
          </div>
        </div>
        
        <Button variant="secondary" onClick={() => confirm('¿Borrar todo el historial?') && onClearLogs()} size="sm" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white">
          <Trash2 className="w-4 h-4 mr-2" /> Limpiar
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-zinc-800 font-black italic uppercase opacity-20 tracking-[0.5em]">
              <History className="w-20 h-20 mb-6" />
              Sin Actividad Reciente
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-start gap-4 hover:border-zinc-700 transition-all group"
              >
                <div className="mt-1 flex-shrink-0">
                  {getIcon(log.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-zinc-100 uppercase tracking-tight text-sm">{log.action}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {log.details && (
                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
