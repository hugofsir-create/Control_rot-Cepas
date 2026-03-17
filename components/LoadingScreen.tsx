
import React, { useState, useEffect } from 'react';
import { Box } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3000; // 3 seconds
    const interval = 30; // Update every 30ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs flex flex-col items-center animate-in fade-in zoom-in duration-500">
        {/* Logo / Icon */}
        <div className="bg-amber-500 p-4 rounded-2xl shadow-2xl shadow-amber-500/20 mb-8 animate-bounce">
          <Box className="w-12 h-12 text-black" />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-black italic tracking-tighter text-white mb-2 uppercase">
          LogiPro <span className="text-amber-500">Control</span>
        </h1>
        
        <div className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] mb-12">
          Calico S.A.
        </div>

        {/* Progress Container */}
        <div className="w-full space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
              Iniciando Sistema...
            </span>
            <span className="text-sm font-black text-amber-500 italic tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          
          {/* Progress Bar Track */}
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            {/* Progress Bar Fill */}
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest leading-relaxed">
            Gestión de Almacenes & Control de Pallets<br/>
            Versión 6.0.2 • 2026
          </p>
        </div>
      </div>
    </div>
  );
};
