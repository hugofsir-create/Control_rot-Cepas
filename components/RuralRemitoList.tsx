import React, { useState } from 'react';
import { RuralRemito, Pallet } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  FileCheck, 
  ArrowLeft, 
  Package, 
  Calendar, 
  Truck, 
  Edit, 
  Download, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Layers, 
  Search 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDateFull } from '../services/weekUtils.ts';

interface RuralRemitoListProps {
  remitos: RuralRemito[];
  pallets: Pallet[];
  onBack: () => void;
  onUpdateRemito: (updated: RuralRemito) => void;
  onDeleteRemito: (remitoId: string) => void;
  onSelectPallet?: (pallet: Pallet) => void;
}

export const RuralRemitoList: React.FC<RuralRemitoListProps> = ({
  remitos,
  pallets,
  onBack,
  onUpdateRemito,
  onDeleteRemito,
  onSelectPallet
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const startEdit = (e: React.MouseEvent, remito: RuralRemito) => {
    e.stopPropagation();
    setEditingId(remito.id);
    setEditingValue(remito.remitoNumber);
  };

  const handleSaveEdit = (remito: RuralRemito) => {
    if (editingValue.trim()) {
      onUpdateRemito({ ...remito, remitoNumber: editingValue.trim() });
    }
    setEditingId(null);
  };

  // Export single Remito group to Excel
  const exportSingleRemitoToExcel = (e: React.MouseEvent, remito: RuralRemito, remitoPallets: Pallet[]) => {
    e.stopPropagation();
    const rows: any[] = [];

    // Header info
    rows.push({ 'CAMPO': 'COMPROBANTE DE REMITO - BODEGA LA RURAL', 'VALOR': `REMITO #${remito.remitoNumber}` });
    rows.push({ 'CAMPO': 'Fecha de Emisión', 'VALOR': formatDateFull(new Date(remito.createdAt)) });
    rows.push({ 'CAMPO': 'Cantidad de Pallets', 'VALOR': remitoPallets.length });
    
    const totalUnits = remitoPallets.reduce((acc, p) => acc + p.items.reduce((sum, i) => sum + i.quantity, 0), 0);
    rows.push({ 'CAMPO': 'Total Unidades / Cajas', 'VALOR': totalUnits });
    
    if (remito.carrier) {
      rows.push({ 'CAMPO': 'Transportista / Conductor', 'VALOR': remito.carrier });
    }
    if (remito.note) {
      rows.push({ 'CAMPO': 'Observaciones / Notas', 'VALOR': remito.note });
    }
    rows.push({}); // empty spacer

    // Detailed lines header
    rows.push({
      'CAMPO': 'PALLET N°',
      'VALOR': 'SKU',
      'C': 'DESCRIPCIÓN',
      'D': 'CANTIDAD',
      'E': 'N° ENTREGA',
      'F': 'N° VIAJE',
      'G': 'NOTAS'
    });

    // Detail rows
    remitoPallets.forEach(p => {
      if (p.items.length === 0) {
        rows.push({
          'CAMPO': `Pallet #${p.number}`,
          'VALOR': '(VACÍO)',
          'C': 'Pallet sin items cargados',
          'D': 0,
          'E': '',
          'F': '',
          'G': p.reference || ''
        });
      } else {
        p.items.forEach(item => {
          rows.push({
            'CAMPO': `Pallet #${p.number}`,
            'VALOR': item.sku,
            'C': item.description,
            'D': item.quantity,
            'E': item.deliveryNumber || '',
            'F': item.tripNumber || '',
            'G': item.note || p.reference || ''
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 40 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Remito_${remito.remitoNumber}`);
    XLSX.writeFile(workbook, `Remito_${remito.remitoNumber}_Bodega_La_Rural.xlsx`);
  };

  // Export all remitos to Excel
  const exportAllRemitosToExcel = () => {
    if (remitos.length === 0) return;
    const rows: any[] = [];

    remitos.forEach(remito => {
      const remitoPallets = pallets.filter(p => remito.palletIds.includes(p.id));
      remitoPallets.forEach(pallet => {
        if (pallet.items.length === 0) {
          rows.push({
            'N° Remito': remito.remitoNumber,
            'Fecha Remito': formatDateFull(new Date(remito.createdAt)),
            'Transportista': remito.carrier || '-',
            'Pallet': `Pallet #${pallet.number}`,
            'SKU': '(VACÍO)',
            'Descripción': 'Pallet sin items',
            'Cantidad': 0,
            'N° Entrega': '',
            'N° Viaje': '',
            'Nota Remito': remito.note || ''
          });
        } else {
          pallet.items.forEach(item => {
            rows.push({
              'N° Remito': remito.remitoNumber,
              'Fecha Remito': formatDateFull(new Date(remito.createdAt)),
              'Transportista': remito.carrier || '-',
              'Pallet': `Pallet #${pallet.number}`,
              'SKU': item.sku,
              'Descripción': item.description,
              'Cantidad': item.quantity,
              'N° Entrega': item.deliveryNumber || '',
              'N° Viaje': item.tripNumber || '',
              'Nota Remito': remito.note || ''
            });
          });
        }
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 35 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial_Remitos');
    XLSX.writeFile(workbook, `Historial_Remitos_Bodega_La_Rural_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredRemitos = remitos.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchesRemito = r.remitoNumber.toLowerCase().includes(q);
    const matchesNote = r.note?.toLowerCase().includes(q);
    const matchesCarrier = r.carrier?.toLowerCase().includes(q);
    const remitoPallets = pallets.filter(p => r.palletIds.includes(p.id));
    const matchesPallet = remitoPallets.some(p => 
      p.number.toString().includes(q) ||
      p.items.some(i => i.sku.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    );
    return matchesRemito || matchesNote || matchesCarrier || matchesPallet;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} className="bg-zinc-900 border-zinc-800 text-zinc-300">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Bodega La Rural
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-zinc-700 uppercase tracking-widest">
                Bodega La Rural
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white italic tracking-tight flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-amber-500" /> GRUPOS DE REMITO
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Listado y detalle de pallets agrupados y despachados bajo remito oficial.
            </p>
          </div>
        </div>

        {remitos.length > 0 && (
          <Button 
            variant="outline" 
            onClick={exportAllRemitosToExcel} 
            className="border-zinc-800 text-zinc-200 hover:text-white bg-zinc-900"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-amber-500" /> Exportar Todos los Remitos
          </Button>
        )}
      </div>

      {/* Search and summary */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
        <div className="text-xs text-zinc-400 flex items-center gap-2">
          <span>Total de Remitos: <strong className="text-white font-mono">{remitos.length}</strong></span>
          <span>•</span>
          <span>
            Pallets Agrupados: <strong className="text-amber-400 font-mono">
              {remitos.reduce((sum, r) => sum + r.palletIds.length, 0)}
            </strong>
          </span>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por N° Remito, Pallet, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* List of Remitos */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRemitos.length > 0 ? (
          filteredRemitos.map(remito => {
            const remitoPallets = pallets.filter(p => remito.palletIds.includes(p.id));
            const totalUnits = remitoPallets.reduce((acc, p) => acc + p.items.reduce((s, i) => s + i.quantity, 0), 0);
            const isExpanded = !!expandedIds[remito.id];

            // Consolidated SKUs inside this remito
            const remitoSKUs = (() => {
              const map = new Map<string, { sku: string; description: string; qty: number }>();
              remitoPallets.forEach(p => {
                p.items.forEach(i => {
                  const existing = map.get(i.sku);
                  if (existing) {
                    existing.qty += i.quantity;
                  } else {
                    map.set(i.sku, { sku: i.sku, description: i.description, qty: i.quantity });
                  }
                });
              });
              return Array.from(map.values());
            })();

            return (
              <div 
                key={remito.id}
                className={`bg-zinc-900 rounded-2xl border transition-all duration-200 overflow-hidden shadow-md ${
                  isExpanded ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Header of Remito card (Clickable to expand/collapse) */}
                <div 
                  className="p-4 md:p-5 bg-zinc-950/60 hover:bg-zinc-950/90 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  onClick={() => toggleExpand(remito.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 text-amber-500 flex-shrink-0">
                      <FileCheck className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingId === remito.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input 
                              type="text" 
                              className="bg-zinc-900 border border-amber-500 rounded px-2.5 py-1 text-zinc-100 text-sm font-bold uppercase outline-none focus:ring-1 focus:ring-amber-500"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(remito)}
                              autoFocus
                            />
                            <button 
                              onClick={() => handleSaveEdit(remito)}
                              className="text-[10px] font-black uppercase text-amber-400 hover:text-amber-300 bg-zinc-800 px-2 py-1 rounded border border-zinc-700"
                            >
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <h3 className="font-black italic uppercase text-zinc-100 tracking-tight text-base">
                              Remito #{remito.remitoNumber}
                            </h3>
                            <button 
                              onClick={(e) => startEdit(e, remito)}
                              title="Editar número de remito"
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-amber-400 transition-colors opacity-70 group-hover:opacity-100"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          {remitoPallets.length} Pallets
                        </span>
                        <span className="bg-zinc-800 text-amber-400 border border-zinc-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          {totalUnits} Unidades
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          {formatDateFull(new Date(remito.createdAt))}
                        </span>
                        {remito.carrier && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-zinc-500" />
                            Transporte: <span className="text-zinc-300">{remito.carrier}</span>
                          </span>
                        )}
                        {remito.note && (
                          <span className="text-zinc-500 italic truncate max-w-xs">
                            "{remito.note}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={(e) => exportSingleRemitoToExcel(e, remito, remitoPallets)}
                      className="bg-zinc-900 border-zinc-800 hover:text-amber-400 text-xs py-1.5"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Descargar Excel
                    </Button>

                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar el registro de Remito #${remito.remitoNumber}? Los pallets volverán a estar activos sin remito.`)) {
                          onDeleteRemito(remito.id);
                        }
                      }}
                      className="bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-red-400 p-1.5"
                      title="Eliminar remito y liberar pallets"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="p-1 text-zinc-500">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Lists all pallets and items */}
                {isExpanded && (
                  <div className="p-5 border-t border-zinc-800/80 bg-zinc-950/40 space-y-5 animate-in fade-in duration-150">
                    {/* Consolidated SKU pills inside this remito */}
                    {remitoSKUs.length > 0 && (
                      <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
                        <div className="text-[10px] font-black uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-500" />
                          Resumen Consolidado del Remito #{remito.remitoNumber}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {remitoSKUs.map(skuItem => (
                            <div key={skuItem.sku} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <span className="font-mono font-bold text-amber-400 text-xs block truncate">
                                  {skuItem.sku}
                                </span>
                                <span className="text-[10px] text-zinc-400 block truncate">
                                  {skuItem.description}
                                </span>
                              </div>
                              <span className="font-mono font-black text-white text-xs flex-shrink-0 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                                {skuItem.qty} u
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pallets Detailed Table */}
                    <div>
                      <div className="text-[10px] font-black uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-zinc-400" />
                        Pallets Asignados ({remitoPallets.length})
                      </div>

                      <div className="space-y-3">
                        {remitoPallets.map(p => {
                          const palletUnits = p.items.reduce((s, i) => s + i.quantity, 0);
                          return (
                            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-3">
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-white text-sm">
                                    Pallet #{p.number}
                                  </span>
                                  {p.reference && (
                                    <span className="text-xs text-zinc-400 italic">
                                      "{p.reference}"
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-amber-400 font-bold">
                                    {palletUnits} unidades
                                  </span>
                                  {onSelectPallet && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => onSelectPallet(p)}
                                      className="text-[10px] py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                    >
                                      Ver Detalle
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {p.items.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-800/50">
                                        <th className="py-1 px-2">SKU</th>
                                        <th className="py-1 px-2">Descripción</th>
                                        <th className="py-1 px-2 text-center">N° Entrega</th>
                                        <th className="py-1 px-2 text-center">N° Viaje</th>
                                        <th className="py-1 px-2 text-right">Cantidad</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/30">
                                      {p.items.map(item => (
                                        <tr key={item.id} className="hover:bg-zinc-800/30">
                                          <td className="py-1.5 px-2 font-mono font-bold text-amber-400">{item.sku}</td>
                                          <td className="py-1.5 px-2 text-zinc-300">{item.description}</td>
                                          <td className="py-1.5 px-2 text-center font-mono text-zinc-400">{item.deliveryNumber || '-'}</td>
                                          <td className="py-1.5 px-2 text-center font-mono text-zinc-400">{item.tripNumber || '-'}</td>
                                          <td className="py-1.5 px-2 text-right font-mono font-bold text-white">{item.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500 italic p-2">
                                  Pallet sin items cargados.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 space-y-2">
            <FileCheck className="w-12 h-12 text-zinc-700 mx-auto" />
            <h4 className="text-zinc-300 font-bold uppercase tracking-wider text-sm">
              No hay remitos generados
            </h4>
            <p className="text-xs max-w-sm mx-auto">
              Selecciona pallets en la sección "Cargas / Pallets" de Bodega La Rural y haz clic en "Agrupar con N° de Remito" para crear un comprobante de remito.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
