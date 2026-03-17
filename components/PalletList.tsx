
import React, { useState } from 'react';
import { Pallet, PalletStatus } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  Plus, Box, PackageOpen, Edit, Trash2, FileBarChart, 
  CheckSquare, Square, X, Lock, Trash, Printer
} from 'lucide-react';

interface PalletListProps {
  pallets: Pallet[];
  onAddPallet: () => void;
  onSelectPallet: (pallet: Pallet) => void;
  onDeletePallet: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkClose: (ids: string[]) => void;
  onBulkPrint: (ids: string[]) => void;
  onOpenReport: () => void;
}

export const PalletList: React.FC<PalletListProps> = ({ 
  pallets, 
  onAddPallet, 
  onSelectPallet, 
  onDeletePallet,
  onBulkDelete,
  onBulkClose,
  onBulkPrint,
  onOpenReport
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pallets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pallets.map(p => p.id));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`¿Eliminar ${selectedIds.length} pallets seleccionados?`)) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleBulkClose = () => {
    if (confirm(`¿Cerrar ${selectedIds.length} pallets seleccionados?`)) {
      onBulkClose(selectedIds);
      setSelectedIds([]);
    }
  };

  const totalUnits = pallets.reduce((acc, pallet) => {
    return acc + pallet.items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-amber-500/30 shadow-2xl rounded-2xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 pr-6 border-r border-zinc-800">
            <div className="bg-amber-500 text-black font-black px-2 py-1 rounded text-xs">
              {selectedIds.length}
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Seleccionados</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onBulkPrint(selectedIds)} className="bg-zinc-950 border-zinc-800 hover:text-amber-500">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
            <Button variant="secondary" size="sm" onClick={handleBulkClose} className="bg-zinc-950 border-zinc-800 hover:text-emerald-500">
              <Lock className="w-4 h-4 mr-2" /> Cerrar
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              <Trash className="w-4 h-4 mr-2" /> Eliminar
            </Button>
            <button 
              onClick={() => setSelectedIds([])}
              className="ml-2 p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-zinc-100">Control de Pallets</h2>
           <p className="text-zinc-400">Gestión de carga y etiquetado de pallets.</p>
        </div>
        <div className="flex gap-4 flex-wrap">
           <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded shadow-sm border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              <span className="text-sm font-medium text-zinc-300">Total Unid: {totalUnits}</span>
           </div>
           
           <Button variant="secondary" onClick={onOpenReport}>
             <FileBarChart className="w-4 h-4 mr-2" /> Resumen Inventario
           </Button>
           
           <Button onClick={onAddPallet}>
             <Plus className="w-4 h-4 mr-2" /> Nuevo Pallet
           </Button>
        </div>
      </div>

      {pallets.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <button 
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {selectedIds.length === pallets.length ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4" />}
            {selectedIds.length === pallets.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pallets.map((pallet) => {
          const isSelected = selectedIds.includes(pallet.id);
          return (
            <div 
              key={pallet.id} 
              className={`
                relative group bg-zinc-900 rounded-lg shadow-lg border transition-all hover:shadow-xl hover:bg-zinc-800 cursor-pointer hover:-translate-y-1 flex flex-col
                ${isSelected ? 'ring-2 ring-amber-500 border-amber-500/50' : ''}
                ${pallet.status === PalletStatus.CLOSED 
                  ? 'border-l-4 border-l-red-500 border-y-zinc-800 border-r-zinc-800' 
                  : 'border-l-4 border-l-emerald-500 border-y-zinc-800 border-r-zinc-800'}
              `}
              onClick={() => onSelectPallet(pallet)}
            >
              {/* Checkbox Overlay */}
              <button 
                onClick={(e) => toggleSelect(pallet.id, e)}
                className={`absolute top-4 right-4 z-10 p-1 rounded transition-all ${isSelected ? 'text-amber-500' : 'text-zinc-700 group-hover:text-zinc-500'}`}
              >
                {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
              </button>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                     <Box className={`w-5 h-5 ${pallet.status === PalletStatus.CLOSED ? 'text-red-500' : 'text-emerald-500'}`} />
                     <h3 className="font-bold text-lg text-zinc-100">Pallet #{pallet.number}</h3>
                  </div>
                  <div className="mr-8"> {/* Space for checkbox */}
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${pallet.status === PalletStatus.CLOSED ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {pallet.status}
                    </span>
                  </div>
                </div>
                
                {pallet.reference && (
                  <div className="mb-3 px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-xs font-semibold text-zinc-300 truncate">
                    Ref: {pallet.reference}
                  </div>
                )}
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-zinc-400">
                    <span className="font-medium text-zinc-200">{pallet.items.length}</span> items
                  </p>
                  <p className="text-sm text-zinc-400">
                    Total unid: <span className="font-medium text-zinc-200">{pallet.items.reduce((a,b) => a+b.quantity, 0)}</span>
                  </p>
                  {pallet.aiSummary && (
                    <p className="text-xs text-zinc-500 italic line-clamp-2 mt-2 border-t pt-2 border-zinc-800">
                      "{pallet.aiSummary}"
                    </p>
                  )}
                </div>

                <div className="text-xs text-zinc-500 pt-3 border-t border-zinc-800 flex justify-between items-center mt-auto">
                  <span>{new Date(pallet.createdAt).toLocaleDateString()}</span>
                  
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onSelectPallet(pallet); }}
                        className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-amber-500 transition-colors flex items-center gap-1"
                        title="Editar Pallet"
                     >
                        <Edit className="w-3 h-3" /> <span className="hidden sm:inline">Editar</span>
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onDeletePallet(pallet.id); }}
                        className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                        title="Eliminar Pallet"
                     >
                        <Trash2 className="w-3 h-3" /> <span className="hidden sm:inline">Eliminar</span>
                     </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {pallets.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-lg">
            <PackageOpen className="w-16 h-16 mb-4 text-zinc-700" />
            <p className="text-lg font-medium">No hay pallets creados.</p>
            <p className="text-sm">Crea uno nuevo para comenzar a cargar inventario.</p>
          </div>
        )}
      </div>
    </div>
  );
};
