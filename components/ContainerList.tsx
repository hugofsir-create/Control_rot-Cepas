
import React from 'react';
import { Container, Pallet } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  Truck, 
  ArrowLeft, 
  Package, 
  Calendar, 
  Info, 
  Trash2, 
  Edit, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ContainerListProps {
  containers: Container[];
  pallets: Pallet[];
  onBack: () => void;
  onDeleteContainer: (id: string) => void;
  onUpdateContainer: (container: Container) => void;
}

export const ContainerList: React.FC<ContainerListProps> = ({ 
  containers, 
  pallets, 
  onBack,
  onDeleteContainer,
  onUpdateContainer
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});

  const startEditing = (e: React.MouseEvent, container: Container) => {
    e.stopPropagation(); // Avoid expanding card when clicking edit
    setEditingId(container.id);
    setEditValue(container.dispatchId);
  };

  const handleSave = (container: Container) => {
    if (editValue.trim()) {
      onUpdateContainer({ ...container, dispatchId: editValue.trim() });
    }
    setEditingId(null);
  };

  const toggleExpand = (containerId: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [containerId]: !prev[containerId]
    }));
  };

  // Helper to export a single dispatch/container details to Excel
  const exportSingleDispatchToExcel = (e: React.MouseEvent, container: Container, containerPallets: Pallet[]) => {
    e.stopPropagation(); // Prevent toggling expansion
    const rows: any[] = [];
    
    // Header information
    rows.push({ 'CAMPO': 'REPORTE DE DESPACHO', 'VALOR_DETALLE': `DESPACHO CORRELATIVO #${container.dispatchId}` });
    rows.push({ 'CAMPO': 'Fecha de Despacho', 'VALOR_DETALLE': new Date(container.createdAt).toLocaleString() });
    rows.push({ 'CAMPO': 'Cantidad de Pallets', 'VALOR_DETALLE': container.palletIds.length });
    
    const totalUnits = containerPallets.reduce((acc, p) => acc + p.items.reduce((sum, i) => sum + i.quantity, 0), 0);
    rows.push({ 'CAMPO': 'Total Unidades Despachadas', 'VALOR_DETALLE': totalUnits });
    
    if (container.note) {
      rows.push({ 'CAMPO': 'Notas u Observación', 'VALOR_DETALLE': container.note });
    }
    rows.push({}); // empty spacer row
    
    // Detailed list header
    rows.push({
      'CAMPO': 'PALLET N°',
      'VALOR_DETALLE': 'SKU RECURSO',
      'C': 'DESCRIPCIÓN',
      'D': 'CANTIDAD (U)',
      'E': 'N° VIAJE',
      'F': 'N° ENTREGA'
    });
    
    // Data list
    containerPallets.forEach(pallet => {
      pallet.items.forEach(item => {
        rows.push({
          'CAMPO': `Pallet #${pallet.number}`,
          'VALOR_DETALLE': item.sku,
          'C': item.description || '',
          'D': item.quantity,
          'E': item.tripNumber || '',
          'F': item.deliveryNumber || ''
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Despacho_${container.dispatchId}`);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 18 }, // Pallet Label
      { wch: 18 }, // SKU
      { wch: 40 }, // Description
      { wch: 15 }, // Qty
      { wch: 15 }, // Trip
      { wch: 18 }  // Delivery
    ];

    XLSX.writeFile(workbook, `Reporte_Despacho_${container.dispatchId}.xlsx`);
  };

  // Helper to export all dispatches log to Excel
  const exportAllDispatchesToExcel = () => {
    if (containers.length === 0) return;
    
    const rows: any[] = [];
    
    containers.forEach(container => {
      const containerPallets = pallets.filter(p => container.palletIds.includes(p.id));
      containerPallets.forEach(pallet => {
        pallet.items.forEach(item => {
          rows.push({
            'ID Despacho': container.dispatchId,
            'Fecha Despacho': new Date(container.createdAt).toLocaleString(),
            'Pallet': `Pallet #${pallet.number}`,
            'SKU': item.sku,
            'Descripción': item.description || '',
            'Cantidad': item.quantity,
            'N° Viaje': item.tripNumber || '',
            'N° Entrega': item.deliveryNumber || '',
            'Nota Despacho': container.note || ''
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Global");

    worksheet["!cols"] = [
      { wch: 15 }, // ID Despacho
      { wch: 22 }, // Fecha
      { wch: 15 }, // Pallet
      { wch: 15 }, // SKU
      { wch: 35 }, // Description
      { wch: 12 }, // Qty
      { wch: 15 }, // Trip
      { wch: 20 }, // Delivery
      { wch: 25 }  // Notes
    ];

    XLSX.writeFile(workbook, `Historial_General_Despachos_LogiPro.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6" id="container-list-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        {/* Global actions */}
        {containers.length > 0 && (
          <Button 
            variant="outline" 
            className="border-zinc-800 text-zinc-300 hover:text-white bg-zinc-900/60" 
            onClick={exportAllDispatchesToExcel}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Exportar Despachos Totales
          </Button>
        )}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {containers.length > 0 ? (
          containers.map(container => {
            const containerPallets = pallets.filter(p => container.palletIds.includes(p.id));
            const totalUnits = containerPallets.reduce((acc, p) => acc + p.items.reduce((sum, i) => sum + i.quantity, 0), 0);
            const isExpanded = !!expandedIds[container.id];

            // Consolidate identical SKUs inside this dispatch
            const dispatchConsolidatedItems = (() => {
              const map = new Map<string, { sku: string; description: string; quantity: number }>();
              containerPallets.forEach(pallet => {
                pallet.items.forEach(item => {
                  const existing = map.get(item.sku);
                  if (existing) {
                    existing.quantity += item.quantity;
                  } else {
                    map.set(item.sku, {
                      sku: item.sku,
                      description: item.description,
                      quantity: item.quantity
                    });
                  }
                });
              });
              return Array.from(map.values());
            })();

            return (
              <div 
                key={container.id} 
                className={`bg-zinc-900 rounded-2xl border transition-all duration-200 overflow-hidden shadow-xl ${isExpanded ? 'border-amber-500/40 ring-1 ring-amber-500/10' : 'border-zinc-800'}`}
              >
                {/* Clickable Header card */}
                <div 
                  className="p-5 bg-zinc-950/50 hover:bg-zinc-950/90 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  onClick={() => toggleExpand(container.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-500 flex-shrink-0">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingId === container.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input 
                              type="text" 
                              className="bg-zinc-900 border border-amber-500/50 rounded px-2.5 py-1 text-zinc-100 text-sm font-bold uppercase outline-none focus:ring-1 focus:ring-amber-500"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave(container)}
                              autoFocus
                            />
                            <button 
                              onClick={() => handleSave(container)}
                              className="text-[10px] font-black uppercase text-amber-500 hover:text-amber-400 bg-zinc-850 px-2 py-1 rounded border border-zinc-750"
                            >
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <h3 className="font-black italic uppercase text-zinc-100 tracking-tight text-base">
                              Despacho #{container.dispatchId}
                            </h3>
                            <button 
                              onClick={(e) => startEditing(e, container)}
                              title="Editar identificador de despacho"
                              className="p-1 text-zinc-500 hover:text-amber-500 rounded hover:bg-zinc-850 transition-colors flex items-center justify-center"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-750 flex items-center gap-1">
                          <Bookmark className="w-2.5 h-2.5 text-amber-500" /> Nº {container.number}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] items-center uppercase font-bold text-zinc-500">
                          <Calendar className="w-3.5 h-3.5" /> {new Date(container.createdAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] items-center uppercase font-bold text-zinc-500">
                          <Package className="w-3.5 h-3.5" /> {container.palletIds.length} Pallets
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right alignment */}
                  <div className="flex items-center justify-between md:justify-end gap-4" onClick={e => e.stopPropagation()}>
                    <div className="text-left md:text-right pr-2">
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Total Unidades</p>
                      <p className="text-xl font-black italic text-amber-500 tabular-nums leading-none">{totalUnits} U</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Export Single dispatch */}
                      <button 
                        onClick={(e) => exportSingleDispatchToExcel(e, container, containerPallets)}
                        className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight shadow-md"
                        title="Exportar despacho específico a Excel"
                      >
                        <Download className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Excel</span>
                      </button>

                      <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => {
                          if(confirm('¿Eliminar registro de despacho? Esto no devolverá los pallets al inventario activo.')) {
                            onDeleteContainer(container.id);
                          }
                        }}
                        className="p-2.5 rounded-lg text-red-400 border border-red-500/20 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      {/* Expand / Collapse Indicator */}
                      <button 
                        onClick={() => toggleExpand(container.id)}
                        className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-750 hover:text-white hover:bg-zinc-755 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="p-6 bg-zinc-900 border-t border-zinc-850 flex flex-col gap-6 animate-fadeIn">
                    {/* Notes block */}
                    {container.note && (
                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-start gap-3">
                        <Info className="w-4 h-4 text-amber-500/80 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-zinc-400 italic">"{container.note}"</p>
                      </div>
                    )}

                    {/* LATEST MODULE: CONSOLIDATED BREAKDOWN OF SKUS INSIDE THIS DISPATCH */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Consolidado de Despacho
                      </h4>
                      {dispatchConsolidatedItems.length > 0 ? (
                        <div className="bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="px-4 py-3 font-bold text-zinc-400 uppercase tracking-widest w-1/3">SKU</th>
                                <th className="px-4 py-3 font-bold text-zinc-400 uppercase tracking-widest">Descripción del Recurso</th>
                                <th className="px-4 py-3 font-bold text-zinc-400 uppercase tracking-widest w-24 text-center">Unidades</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850/60">
                              {dispatchConsolidatedItems.map(item => (
                                <tr key={item.sku} className="hover:bg-zinc-900/30">
                                  <td className="px-4 py-2.5 font-mono font-bold text-amber-500">{item.sku}</td>
                                  <td className="px-4 py-2.5 text-zinc-300">{item.description}</td>
                                  <td className="px-4 py-2.5 text-center font-bold text-white font-mono bg-zinc-900/10">{item.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic px-4 py-2 bg-zinc-955 rounded-lg border border-zinc-850">Sin artículos registrados.</p>
                      )}
                    </div>

                    {/* PALLETS GRID WITH PRODUCT PREVIEWS */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-500" /> Desglose por Pallet ({containerPallets.length})
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {containerPallets.map(pallet => (
                          <div key={pallet.id} className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 flex flex-col gap-3">
                            {/* Pallet label header */}
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                              <div className="flex items-center gap-2.5">
                                <Package className="w-4 h-4 text-amber-500" />
                                <span className="text-xs font-black text-zinc-200">Pallet #{pallet.number}</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded text-amber-500 border border-zinc-800">
                                {pallet.items.reduce((a,b) => a+b.quantity, 0)} U
                              </span>
                            </div>

                            {/* Reference field, if any */}
                            {pallet.reference && (
                              <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium bg-zinc-900 px-2 py-1 rounded max-w-full truncate">
                                <span className="text-zinc-500 uppercase font-bold text-[9px] mr-1">R:</span> {pallet.reference}
                              </div>
                            )}

                            {/* Pallet items listing sub-table */}
                            <div className="flex-1 space-y-2 mt-1 max-h-48 overflow-y-auto">
                              {pallet.items.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-start text-[11px] hover:bg-zinc-900 p-1.5 rounded transition-all">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <span className="font-mono font-black text-amber-500 block leading-none">{item.sku}</span>
                                    <span className="text-zinc-400 text-[10px] block truncate mt-0.5">{item.description}</span>
                                  </div>
                                  <div className="text-right flex flex-col items-end">
                                    <span className="text-white font-mono font-bold">{item.quantity} U</span>
                                    {item.tripNumber && (
                                      <span className="text-[8px] text-zinc-500 leading-none mt-0.5 uppercase">V: {item.tripNumber}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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

