import React, { useState, useMemo } from 'react';
import { Pallet, Material, PalletStatus, RuralRemito } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  FileSpreadsheet, 
  ArrowLeft, 
  Calendar, 
  Package, 
  Layers, 
  CheckCircle2, 
  Search, 
  Info,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  WeekPeriod, 
  generateAvailableWeeks, 
  getWeekPeriod, 
  formatDateFull 
} from '../services/weekUtils.ts';

interface RuralWeeklyReportProps {
  pallets: Pallet[];
  materials: Material[];
  remitos: RuralRemito[];
  onBack: () => void;
  onSelectPallet?: (pallet: Pallet) => void;
}

export const RuralWeeklyReport: React.FC<RuralWeeklyReportProps> = ({
  pallets,
  materials,
  remitos,
  onBack,
  onSelectPallet
}) => {
  // Collect all relevant dates for week generation
  const referenceDates = useMemo(() => {
    const dates: (string | Date)[] = [new Date()];
    pallets.forEach(p => {
      if (p.createdAt) dates.push(p.createdAt);
      if (p.remitoDate) dates.push(p.remitoDate);
    });
    remitos.forEach(r => {
      if (r.createdAt) dates.push(r.createdAt);
    });
    return dates;
  }, [pallets, remitos]);

  const availableWeeks = useMemo(() => generateAvailableWeeks(referenceDates), [referenceDates]);
  const currentWeekPeriod = useMemo(() => getWeekPeriod(new Date()), []);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(
    `${currentWeekPeriod.year}-W${currentWeekPeriod.weekNumber}`
  );
  const [filterMode, setFilterMode] = useState<'ALL' | 'IN_STOCK' | 'REMITTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedWeek = useMemo(() => {
    return availableWeeks.find(w => `${w.year}-W${w.weekNumber}` === selectedWeekKey) || availableWeeks[0] || currentWeekPeriod;
  }, [availableWeeks, selectedWeekKey, currentWeekPeriod]);

  // Navigate between weeks
  const currentWeekIndex = availableWeeks.findIndex(w => `${w.year}-W${w.weekNumber}` === selectedWeekKey);
  const handlePrevWeek = () => {
    if (currentWeekIndex < availableWeeks.length - 1) {
      const prev = availableWeeks[currentWeekIndex + 1];
      setSelectedWeekKey(`${prev.year}-W${prev.weekNumber}`);
    }
  };
  const handleNextWeek = () => {
    if (currentWeekIndex > 0) {
      const next = availableWeeks[currentWeekIndex - 1];
      setSelectedWeekKey(`${next.year}-W${next.weekNumber}`);
    }
  };

  /**
   * CRITICAL FILTER LOGIC:
   * "cuando pasa esto los pallets con numero de remito asignado no aparecen en el informe de la proxima semana"
   * 
   * 1. Pallet must have been created on or before the selected week's end date:
   *    pallet.createdAt <= selectedWeek.endDate
   * 
   * 2. Pallets with remito:
   *    - If remito was assigned in a PREVIOUS week (remitoDate < selectedWeek.startDate):
   *      --> MUST BE EXCLUDED! (It was remitted before, so in this week / next week it no longer appears).
   *    - If remito was assigned in the CURRENT selected week (remitoDate >= startDate && remitoDate <= endDate):
   *      --> Included as remitted in this week.
   *    - If remito was assigned in a FUTURE week (remitoDate > selectedWeek.endDate):
   *      --> In this week it was still active stock without remito yet.
   */
  const { weekPallets, excludedRemittedCount } = useMemo(() => {
    let excludedCount = 0;
    const filtered: { pallet: Pallet; isRemittedThisWeek: boolean }[] = [];

    const weekStartMs = selectedWeek.startDate.getTime();
    const weekEndMs = selectedWeek.endDate.getTime();

    pallets.forEach(pallet => {
      const createdMs = new Date(pallet.createdAt).getTime();
      // Pallet was not yet created in this period
      if (createdMs > weekEndMs) {
        return;
      }

      const hasRemito = !!pallet.remitoNumber;
      if (hasRemito) {
        const remitoDateMs = pallet.remitoDate 
          ? new Date(pallet.remitoDate).getTime() 
          : createdMs;

        // If remitted BEFORE this week -> EXCLUDED from this and next weeks
        if (remitoDateMs < weekStartMs) {
          excludedCount++;
          return;
        }

        // If remitted DURING this week
        if (remitoDateMs >= weekStartMs && remitoDateMs <= weekEndMs) {
          filtered.push({ pallet, isRemittedThisWeek: true });
          return;
        }

        // If remitted in a future week relative to the selected week
        if (remitoDateMs > weekEndMs) {
          filtered.push({ pallet, isRemittedThisWeek: false });
          return;
        }
      } else {
        // Pallet is in stock (no remito assigned)
        filtered.push({ pallet, isRemittedThisWeek: false });
      }
    });

    return { weekPallets: filtered, excludedRemittedCount: excludedCount };
  }, [pallets, selectedWeek]);

  // Apply visual filter mode (All, Only In Stock, Only Remitted This Week)
  const displayedPallets = useMemo(() => {
    let result = weekPallets;
    if (filterMode === 'IN_STOCK') {
      result = result.filter(item => !item.isRemittedThisWeek && !item.pallet.remitoNumber);
    } else if (filterMode === 'REMITTED') {
      result = result.filter(item => item.isRemittedThisWeek);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const p = item.pallet;
        const matchesNumber = p.number.toString().includes(q);
        const matchesRef = p.reference?.toLowerCase().includes(q);
        const matchesRemito = p.remitoNumber?.toLowerCase().includes(q);
        const matchesItems = p.items.some(i => 
          i.sku.toLowerCase().includes(q) || 
          i.description.toLowerCase().includes(q) ||
          i.deliveryNumber?.toLowerCase().includes(q) ||
          i.tripNumber?.toLowerCase().includes(q)
        );
        return matchesNumber || matchesRef || matchesRemito || matchesItems;
      });
    }

    return result;
  }, [weekPallets, filterMode, searchQuery]);

  // Aggregate totals
  const totalUnits = useMemo(() => {
    return displayedPallets.reduce((acc, { pallet }) => {
      return acc + pallet.items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  }, [displayedPallets]);

  const remittedThisWeekCount = useMemo(() => {
    return weekPallets.filter(item => item.isRemittedThisWeek).length;
  }, [weekPallets]);

  const inStockCount = useMemo(() => {
    return weekPallets.filter(item => !item.isRemittedThisWeek).length;
  }, [weekPallets]);

  // Consolidated SKU breakdown
  const consolidatedSKUs = useMemo(() => {
    const map = new Map<string, { sku: string; description: string; totalQty: number; boxesPerPallet?: number; palletNumbers: Set<number> }>();

    displayedPallets.forEach(({ pallet }) => {
      pallet.items.forEach(item => {
        const existing = map.get(item.sku);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.palletNumbers.add(pallet.number);
        } else {
          const mat = materials.find(m => m.sku === item.sku);
          map.set(item.sku, {
            sku: item.sku,
            description: item.description,
            totalQty: item.quantity,
            boxesPerPallet: mat?.boxesPerPallet,
            palletNumbers: new Set([pallet.number])
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [displayedPallets, materials]);

  // Export to Excel function
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Resumen y SKUs
    const summaryRows: any[] = [
      { 'CAMPO': 'INFORME SEMANAL DE INVENTARIO - BODEGA LA RURAL', 'VALOR': '' },
      { 'CAMPO': 'Período', 'VALOR': selectedWeek.label },
      { 'CAMPO': 'Rango de Fechas', 'VALOR': `${formatDateFull(selectedWeek.startDate)} al ${formatDateFull(selectedWeek.endDate)}` },
      { 'CAMPO': 'Fecha de Emisión', 'VALOR': new Date().toLocaleString() },
      { 'CAMPO': 'Total Pallets en Informe', 'VALOR': displayedPallets.length },
      { 'CAMPO': 'Pallets en Stock Activo', 'VALOR': inStockCount },
      { 'CAMPO': 'Pallets Remitidos Esta Semana', 'VALOR': remittedThisWeekCount },
      { 'CAMPO': 'Pallets Excluidos (Remitidos Semanas Anteriores)', 'VALOR': excludedRemittedCount },
      { 'CAMPO': 'Total Unidades / Cajas', 'VALOR': totalUnits },
      {},
      { 'CAMPO': 'CONSOLIDADO POR SKU', 'VALOR': '', 'C': '', 'D': '', 'E': '' },
      { 'CAMPO': 'SKU', 'VALOR': 'DESCRIPCIÓN', 'C': 'CAJAS X PALLET', 'D': 'CANTIDAD TOTAL', 'E': 'PALLETS EQ.' }
    ];

    consolidatedSKUs.forEach(item => {
      const eq = item.boxesPerPallet ? (item.totalQty / item.boxesPerPallet).toFixed(2) : '-';
      summaryRows.push({
        'CAMPO': item.sku,
        'VALOR': item.description,
        'C': item.boxesPerPallet || '-',
        'D': item.totalQty,
        'E': eq
      });
    });

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true });
    summarySheet['!cols'] = [{ wch: 22 }, { wch: 38 }, { wch: 18 }, { wch: 16 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen_Semanal');

    // Sheet 2: Detalle de Pallets y Líneas
    const detailRows: any[] = [];
    displayedPallets.forEach(({ pallet, isRemittedThisWeek }) => {
      if (pallet.items.length === 0) {
        detailRows.push({
          'Pallet #': `Pallet #${pallet.number}`,
          'Estado': pallet.status,
          'Condición Semanal': isRemittedThisWeek ? 'Remitido Esta Semana' : 'En Existencia',
          'N° Remito': pallet.remitoNumber || 'Sin Remito',
          'Fecha Remito': pallet.remitoDate ? formatDateFull(new Date(pallet.remitoDate)) : '-',
          'Fecha Creación': formatDateFull(new Date(pallet.createdAt)),
          'SKU': '(VACÍO)',
          'Descripción': 'Pallet sin items cargados',
          'Cantidad': 0,
          'N° Entrega': '',
          'N° Viaje': '',
          'Nota': pallet.reference || ''
        });
      } else {
        pallet.items.forEach(item => {
          detailRows.push({
            'Pallet #': `Pallet #${pallet.number}`,
            'Estado': pallet.status,
            'Condición Semanal': isRemittedThisWeek ? 'Remitido Esta Semana' : 'En Existencia',
            'N° Remito': pallet.remitoNumber || 'Sin Remito',
            'Fecha Remito': pallet.remitoDate ? formatDateFull(new Date(pallet.remitoDate)) : '-',
            'Fecha Creación': formatDateFull(new Date(pallet.createdAt)),
            'SKU': item.sku,
            'Descripción': item.description,
            'Cantidad': item.quantity,
            'N° Entrega': item.deliveryNumber || '',
            'N° Viaje': item.tripNumber || '',
            'Nota': item.note || pallet.reference || ''
          });
        });
      }
    });

    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle_Pallets');

    const fileName = `Informe_Semanal_La_Rural_Semana_${selectedWeek.weekNumber}_${selectedWeek.year}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header and navigation */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
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
                <Calendar className="w-6 h-6 text-amber-500" /> INFORME SEMANAL DE INVENTARIO
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Control periódico de pallets, consolidado de SKUs y trazabilidad de remitos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="primary" 
            onClick={handleExportExcel} 
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold border-amber-500"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-black" /> Exportar Informe a Excel
          </Button>
        </div>
      </div>

      {/* Week Selector Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            disabled={currentWeekIndex >= availableWeeks.length - 1}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Seleccionar Período Semanal
            </label>
            <select
              value={selectedWeekKey}
              onChange={(e) => setSelectedWeekKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            >
              {availableWeeks.map(w => {
                const key = `${w.year}-W${w.weekNumber}`;
                return (
                  <option key={key} value={key}>
                    {w.label} {w.isCurrent ? '• (Semana Actual)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={handleNextWeek}
            disabled={currentWeekIndex <= 0}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 transition-colors"
            title="Semana siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Selected week details & quick switch to current week */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Rango de Fechas</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {formatDateFull(selectedWeek.startDate)} al {formatDateFull(selectedWeek.endDate)}
            </span>
          </div>

          {!selectedWeek.isCurrent && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedWeekKey(`${currentWeekPeriod.year}-W${currentWeekPeriod.weekNumber}`)}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Ir a Semana Actual
            </Button>
          )}
        </div>
      </div>

      {/* Explanatory Rule Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-start gap-3 text-zinc-300">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-zinc-200">
            Regla de Negocio: Exclusión Automática de Pallets con Remito
          </p>
          <p className="text-zinc-400 leading-relaxed">
            Al agrupar pallets y asignarles un <strong>número de remito</strong>, quedan registrados como despachados en esa semana. 
            Automáticamente, <strong>no aparecen en el informe de la próxima semana ni de las semanas posteriores</strong>.
            {excludedRemittedCount > 0 && (
              <span className="ml-1 font-bold text-amber-400">
                ({excludedRemittedCount} pallet(s) de remitos anteriores excluidos de este informe).
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Pallets en Período</span>
            <Package className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white font-mono">
            {displayedPallets.length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {inStockCount} en stock activo • {remittedThisWeekCount} remitidos
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Unidades</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
            {totalUnits}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            Cajas/piezas totales contabilizadas
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">SKUs Únicos</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white font-mono">
            {consolidatedSKUs.length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            Variedades de material registradas
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Remitidos Esta Semana</span>
            <Truck className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white font-mono">
            {remittedThisWeekCount}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            No figurarán en la semana siguiente
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              filterMode === 'ALL' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Todos ({weekPallets.length})
          </button>
          <button
            onClick={() => setFilterMode('IN_STOCK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              filterMode === 'IN_STOCK' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Solo En Stock ({inStockCount})
          </button>
          <button
            onClick={() => setFilterMode('REMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              filterMode === 'REMITTED' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Remitidos Esta Semana ({remittedThisWeekCount})
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por SKU, Pallet, Remito..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table 1: Consolidated SKU Breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm md:text-base uppercase tracking-tight text-white">
              Consolidado de Materiales (SKU) en la Semana
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-400">
            {consolidatedSKUs.length} SKUs Registrados
          </span>
        </div>

        {consolidatedSKUs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-950/30">
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5">Descripción del Material</th>
                  <th className="p-3.5 text-center">Cajas x Pallet</th>
                  <th className="p-3.5 text-center">Pallets en que figura</th>
                  <th className="p-3.5 text-right">Cantidad Total</th>
                  <th className="p-3.5 text-right">Pallets Equivalentes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {consolidatedSKUs.map(item => {
                  const palletsEq = item.boxesPerPallet ? (item.totalQty / item.boxesPerPallet).toFixed(2) : '-';
                  return (
                    <tr key={item.sku} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-amber-400">{item.sku}</td>
                      <td className="p-3.5 text-zinc-200 font-medium">{item.description}</td>
                      <td className="p-3.5 text-center font-mono text-zinc-400">
                        {item.boxesPerPallet || '-'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="bg-zinc-800 text-zinc-300 font-bold px-2 py-0.5 rounded text-[11px]">
                          {item.palletNumbers.size} pallet(s)
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-amber-400 text-sm">
                        {item.totalQty}
                      </td>
                      <td className="p-3.5 text-right font-mono text-zinc-300">
                        {palletsEq}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-zinc-500 text-xs">
            No se encontraron SKUs registrados para el período seleccionado.
          </div>
        )}
      </div>

      {/* Table 2: Detailed Pallets List in this period */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm md:text-base uppercase tracking-tight text-white">
              Detalle Individual de Pallets ({displayedPallets.length})
            </h3>
          </div>
        </div>

        {displayedPallets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-950/30">
                  <th className="p-3.5">Pallet #</th>
                  <th className="p-3.5">Condición Semanal</th>
                  <th className="p-3.5">N° Remito Asignado</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Líneas / Items</th>
                  <th className="p-3.5 text-right">Total Unidades</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {displayedPallets.map(({ pallet, isRemittedThisWeek }) => {
                  const palletQty = pallet.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <tr key={pallet.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        <span className="font-mono text-zinc-100">Pallet #{pallet.number}</span>
                        {pallet.reference && (
                          <div className="text-[10px] text-zinc-500 font-normal truncate max-w-[150px]">
                            {pallet.reference}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isRemittedThisWeek ? (
                          <span className="inline-flex items-center gap-1 bg-zinc-800 text-amber-400 font-bold px-2 py-0.5 rounded-full text-[10px] border border-zinc-700">
                            <Truck className="w-3 h-3" /> Remitido Esta Semana
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 font-bold px-2 py-0.5 rounded-full text-[10px] border border-zinc-700">
                            <CheckCircle2 className="w-3 h-3" /> En Existencia
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">
                        {pallet.remitoNumber ? (
                          <span className="bg-zinc-800 text-amber-300 font-black px-2 py-1 rounded text-xs border border-zinc-700">
                            Remito #{pallet.remitoNumber}
                          </span>
                        ) : (
                          <span className="text-zinc-600 italic">Sin Remito (Activo)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-zinc-400 font-mono text-[11px]">
                        {formatDateFull(new Date(pallet.createdAt))}
                      </td>
                      <td className="p-3.5 text-zinc-300 font-medium">
                        {pallet.items.length} líneas
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-amber-400">
                        {palletQty} u
                      </td>
                      <td className="p-3.5 text-right">
                        {onSelectPallet && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => onSelectPallet(pallet)}
                            className="text-[10px] py-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                          >
                            Ver Pallet
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-zinc-500 text-xs">
            No hay pallets registrados en este período semanal con el filtro seleccionado.
          </div>
        )}
      </div>
    </div>
  );
};
