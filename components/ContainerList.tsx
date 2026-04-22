
import React from 'react';
import { Container, Pallet } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { Truck, ArrowLeft, Package, Calendar, Info, Trash2 } from 'lucide-react';

interface ContainerListProps {
  containers: Container[];
  pallets: Pallet[];
  onBack: () => void;
  onDeleteContainer: (id: string) => void;
}

export const ContainerList: React.FC<ContainerListProps> = ({ 
  containers, 
  pallets, 
  onBack,
  onDeleteContainer
}) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Truck className="w-6 h-6 text-amber-500" /> Depósito de Salidas
            </h2>
            <p className="text-zinc-400">Historial de despachos y contenedores enviados.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {containers.length > 0 ? (
          containers.map(container => {
            const containerPallets = pallets.filter(p => container.palletIds.includes(p.id));
            const totalUnits = containerPallets.reduce((acc, p) => acc + p.items.reduce((sum, i) => sum + i.quantity, 0), 0);

            return (
              <div key={container.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
                <div className="p-6 bg-zinc-950/50 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                      <Truck className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-black italic uppercase text-zinc-100 tracking-tight">
                        Despacho #{container.dispatchId}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500">
                          <Calendar className="w-3 h-3" /> {new Date(container.createdAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500">
                          <Package className="w-3 h-3" /> {container.palletIds.length} Pallets
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Total Unidades</p>
                      <p className="text-xl font-black italic text-amber-500 tabular-nums">{totalUnits}</p>
                    </div>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={() => {
                        if(confirm('¿Eliminar registro de despacho? Esto no devolverá los pallets al inventario activo.')) {
                          onDeleteContainer(container.id);
                        }
                      }}
                      className="ml-4"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  {container.note && (
                    <div className="mb-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-start gap-3">
                      <Info className="w-4 h-4 text-zinc-400 mt-0.5" />
                      <p className="text-sm text-zinc-400 italic">"{container.note}"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {containerPallets.map(pallet => (
                      <div key={pallet.id} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-zinc-500" />
                          <span className="text-xs font-bold text-zinc-300">Pallet #{pallet.number}</span>
                        </div>
                        <span className="text-[10px] font-black bg-zinc-900 px-2 py-1 rounded text-zinc-500 border border-zinc-700">
                          {pallet.items.reduce((a,b) => a+b.quantity, 0)} U
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-700 bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-800">
            <Truck className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold uppercase tracking-widest opacity-30">No hay despachos registrados</p>
            <p className="text-sm opacity-20">Los pallets enviados aparecerán aquí agrupados por viaje.</p>
          </div>
        )}
      </div>
    </div>
  );
};
