import React, { useState } from 'react';
import { Pallet, Material, PalletStatus, RuralRemito } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { RuralWeeklyReport } from './RuralWeeklyReport.tsx';
import { RuralRemitoList } from './RuralRemitoList.tsx';
import { MaterialMaster } from './MaterialMaster.tsx';
import { 
  Building2, 
  Plus, 
  Calendar, 
  FileCheck, 
  Package, 
  Layers, 
  Boxes, 
  Search, 
  CheckSquare, 
  Square, 
  Printer, 
  Download, 
  Lock, 
  Trash2, 
  Truck, 
  X, 
  Tag, 
  Info, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDateFull } from '../services/weekUtils.ts';

interface RuralWarehouseProps {
  pallets: Pallet[];
  materials: Material[];
  ruralMaterials: Material[];
  setRuralMaterials: React.Dispatch<React.SetStateAction<Material[]>> | ((updater: React.SetStateAction<Material[]>) => void | Promise<void>);
  remitos: RuralRemito[];
  onAddPallet: () => void;
  onSelectPallet: (pallet: Pallet) => void;
  onDeletePallet: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkClose: (ids: string[]) => void;
  onBulkPrint: (ids: string[]) => void;
  onGroupWithRemito: (palletIds: string[], remitoNumber: string, remitoDate: string, carrier?: string, note?: string) => void;
  onUpdateRemito: (remito: RuralRemito) => void;
  onDeleteRemito: (remitoId: string) => void;
}

export const RuralWarehouse: React.FC<RuralWarehouseProps> = ({
  pallets,
  materials,
  ruralMaterials,
  setRuralMaterials,
  remitos,
  onAddPallet,
  onSelectPallet,
  onDeletePallet,
  onBulkDelete,
  onBulkClose,
  onBulkPrint,
  onGroupWithRemito,
  onUpdateRemito,
  onDeleteRemito
}) => {
  const [subView, setSubView] = useState<'PALLETS' | 'WEEKLY_REPORT' | 'REMITOS' | 'MATERIALS'>('PALLETS');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'REMITTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal for assigning Remito number to group of pallets
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState(false);
  const [remitoInputNumber, setRemitoInputNumber] = useState('');
  const [remitoInputDate, setRemitoInputDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remitoInputCarrier, setRemitoInputCarrier] = useState('');
  const [remitoInputNote, setRemitoInputNote] = useState('');

  // Suggest default remito number when opening modal
  const openRemitoModal = () => {
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const seq = remitos.length + 1;
    const suggested = `R-${todayStr}-${String(seq).padStart(3, '0')}`;
    setRemitoInputNumber(suggested);
    setRemitoInputDate(new Date().toISOString().split('T')[0]);
    setRemitoInputCarrier('');
    setRemitoInputNote(`Remito con ${selectedIds.length} pallets agrupados.`);
    setIsRemitoModalOpen(true);
  };

  const handleConfirmRemitoGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitoInputNumber.trim()) {
      alert('Por favor introduce un número de remito válido.');
      return;
    }
    if (selectedIds.length === 0) {
      alert('No hay pallets seleccionados para agrupar.');
      return;
    }

    onGroupWithRemito(
      selectedIds,
      remitoInputNumber.trim().toUpperCase(),
      remitoInputDate,
      remitoInputCarrier.trim(),
      remitoInputNote.trim()
    );

    setIsRemitoModalOpen(false);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredPallets: Pallet[]) => {
    if (selectedIds.length === filteredPallets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPallets.map(p => p.id));
    }
  };

  const handleBulkDeleteAction = () => {
    if (confirm(`¿Eliminar los ${selectedIds.length} pallets seleccionados de Bodega La Rural?`)) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleBulkCloseAction = () => {
    if (confirm(`¿Cerrar los ${selectedIds.length} pallets seleccionados?`)) {
      onBulkClose(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleExportExcel = () => {
    const palletsToExport = selectedIds.length > 0 
      ? pallets.filter(p => selectedIds.includes(p.id)) 
      : pallets;

    const data = palletsToExport.flatMap(p => 
      p.items.length > 0 
        ? p.items.map(item => ({
            'Almacén': 'Bodega La Rural',
            'Pallet #': `Pallet #${p.number}`,
            'Referencia': p.reference || '',
            'Estado': p.status,
            'N° Remito': p.remitoNumber || 'Sin Remito',
            'Fecha Remito': p.remitoDate ? formatDateFull(new Date(p.remitoDate)) : '-',
            'Fecha Creación': formatDateFull(new Date(p.createdAt)),
            'SKU': item.sku,
            'Descripción': item.description,
            'Cantidad': item.quantity,
            'N° Entrega': item.deliveryNumber || '',
            'N° Viaje': item.tripNumber || '',
            'Nota Item': item.note || ''
          }))
        : [{
            'Almacén': 'Bodega La Rural',
            'Pallet #': `Pallet #${p.number}`,
            'Referencia': p.reference || '',
            'Estado': p.status,
            'N° Remito': p.remitoNumber || 'Sin Remito',
            'Fecha Remito': p.remitoDate ? formatDateFull(new Date(p.remitoDate)) : '-',
            'Fecha Creación': formatDateFull(new Date(p.createdAt)),
            'SKU': '(VACÍO)',
            'Descripción': 'Pallet sin items',
            'Cantidad': 0,
            'N° Entrega': '',
            'N° Viaje': '',
            'Nota Item': ''
          }]
    );

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pallets_La_Rural');
    XLSX.writeFile(workbook, `Pallets_Bodega_La_Rural_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filter pallets
  const filteredPallets = pallets.filter(p => {
    if (statusFilter === 'OPEN' && p.status !== PalletStatus.OPEN) return false;
    if (statusFilter === 'CLOSED' && p.status !== PalletStatus.CLOSED) return false;
    if (statusFilter === 'REMITTED' && !p.remitoNumber && p.status !== PalletStatus.REMITTED) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = p.number.toString().includes(q);
      const matchRef = p.reference?.toLowerCase().includes(q);
      const matchRemito = p.remitoNumber?.toLowerCase().includes(q);
      const matchItems = p.items.some(i => 
        i.sku.toLowerCase().includes(q) || 
        i.description.toLowerCase().includes(q) ||
        i.deliveryNumber?.toLowerCase().includes(q) ||
        i.tripNumber?.toLowerCase().includes(q)
      );
      return matchNum || matchRef || matchRemito || matchItems;
    }

    return true;
  });

  const totalPalletUnits = pallets.reduce((acc, p) => acc + p.items.reduce((s, i) => s + i.quantity, 0), 0);
  const activeUnremittedPallets = pallets.filter(p => !p.remitoNumber);
  const remittedPallets = pallets.filter(p => !!p.remitoNumber);

  if (subView === 'MATERIALS') {
    return (
      <MaterialMaster
        materials={ruralMaterials}
        setMaterials={setRuralMaterials}
        onBack={() => setSubView('PALLETS')}
        title="Maestro La Rural"
        subtitle="Catálogo de SKUs y descripciones para Bodega La Rural"
        warehouseBadge="Bodega La Rural"
        availableCentralMaterials={materials}
      />
    );
  }

  if (subView === 'WEEKLY_REPORT') {
    return (
      <RuralWeeklyReport
        pallets={pallets}
        materials={ruralMaterials.length > 0 ? ruralMaterials : materials}
        remitos={remitos}
        onBack={() => setSubView('PALLETS')}
        onSelectPallet={onSelectPallet}
      />
    );
  }

  if (subView === 'REMITOS') {
    return (
      <RuralRemitoList
        remitos={remitos}
        pallets={pallets}
        onBack={() => setSubView('PALLETS')}
        onUpdateRemito={onUpdateRemito}
        onDeleteRemito={onDeleteRemito}
        onSelectPallet={onSelectPallet}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6 relative animate-in fade-in duration-200">
      {/* Top Banner & Warehouse Identifier - Clean integrated styling */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 text-black p-2.5 rounded-2xl shadow-md">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-zinc-700 uppercase tracking-widest">
                    Bodega La Rural
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ID: LR-W2
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
                  BODEGA <span className="text-amber-500">LA RURAL</span>
                </h1>
              </div>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">
              Almacén secundario con gestión de cargas, maestro de materiales propio, agrupación por remito e informe semanal de movimientos.
            </p>
          </div>

          {/* Quick Sub-navigation Buttons - Integrated warm palette */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => setSubView('MATERIALS')}
              className="bg-zinc-950 border-zinc-800 hover:border-amber-500/40 text-zinc-200 hover:text-white font-bold py-2.5 text-xs shadow-sm"
            >
              <ClipboardList className="w-4 h-4 mr-2 text-amber-500" />
              Maestro Materiales ({ruralMaterials.length})
            </Button>

            <Button
              variant="secondary"
              onClick={() => setSubView('WEEKLY_REPORT')}
              className="bg-zinc-950 border-zinc-800 hover:border-amber-500/40 text-zinc-200 hover:text-white font-bold py-2.5 text-xs shadow-sm"
            >
              <Calendar className="w-4 h-4 mr-2 text-amber-500" />
              Informe Semanal
            </Button>

            <Button
              variant="secondary"
              onClick={() => setSubView('REMITOS')}
              className="bg-zinc-950 border-zinc-800 hover:border-amber-500/40 text-zinc-200 hover:text-white font-bold py-2.5 text-xs shadow-sm"
            >
              <FileCheck className="w-4 h-4 mr-2 text-amber-500" />
              Grupos de Remito ({remitos.length})
            </Button>

            <Button
              variant="primary"
              onClick={onAddPallet}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 text-xs shadow-md border-amber-500"
            >
              <Plus className="w-4 h-4 mr-1 text-black" />
              Nuevo Pallet
            </Button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-800/80">
          <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Pallets</span>
            <span className="text-xl font-black text-white font-mono">{pallets.length}</span>
          </div>
          <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">En Stock (Sin Remito)</span>
            <span className="text-xl font-black text-zinc-200 font-mono">{activeUnremittedPallets.length}</span>
          </div>
          <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Remitidos</span>
            <span className="text-xl font-black text-zinc-200 font-mono">{remittedPallets.length}</span>
          </div>
          <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-amber-500 block">Total Unidades</span>
            <span className="text-xl font-black text-amber-500 font-mono">{totalPalletUnits}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Todos ({pallets.length})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              statusFilter === 'OPEN'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Abiertos ({pallets.filter(p => p.status === PalletStatus.OPEN).length})
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              statusFilter === 'CLOSED'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Cerrados ({pallets.filter(p => p.status === PalletStatus.CLOSED).length})
          </button>
          <button
            onClick={() => setStatusFilter('REMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
              statusFilter === 'REMITTED'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Con Remito ({remittedPallets.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar pallet, remito, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 pl-9 pr-3 py-2 rounded-xl text-xs outline-none focus:border-amber-500"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleSelectAll(filteredPallets)}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 whitespace-nowrap"
          >
            {selectedIds.length === filteredPallets.length && filteredPallets.length > 0 ? (
              <CheckSquare className="w-4 h-4 mr-1 text-amber-500" />
            ) : (
              <Square className="w-4 h-4 mr-1 text-zinc-500" />
            )}
            {selectedIds.length === filteredPallets.length && filteredPallets.length > 0 ? 'Deseleccionar' : 'Seleccionar Todos'}
          </Button>
        </div>
      </div>

      {/* Floating Action Bar when Pallets are Selected */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl p-4 flex items-center gap-4 md:gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 pr-4 border-r border-zinc-800">
            <div className="bg-amber-500 text-black font-black px-2 py-1 rounded text-xs">
              {selectedIds.length}
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-zinc-300 hidden sm:inline">
              Seleccionados
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-[60vw] md:max-w-none">
            <Button
              variant="primary"
              size="sm"
              onClick={openRemitoModal}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold whitespace-nowrap shadow-md border-amber-500"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              Agrupar con N° Remito
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onBulkPrint(selectedIds)}
              className="bg-zinc-950 border-zinc-800 hover:text-amber-400 whitespace-nowrap"
            >
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className="bg-zinc-950 border-zinc-800 hover:text-amber-400 whitespace-nowrap"
            >
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkCloseAction}
              className="bg-zinc-950 border-zinc-800 hover:text-amber-400 whitespace-nowrap"
            >
              <Lock className="w-4 h-4 mr-2" /> Cerrar
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkDeleteAction}
              className="bg-zinc-950 border-zinc-800 text-red-400 hover:bg-red-500/20 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </Button>
          </div>

          <button
            onClick={() => setSelectedIds([])}
            className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
            title="Cancelar selección"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Pallet Cards Grid */}
      {filteredPallets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPallets.map(pallet => {
            const isSelected = selectedIds.includes(pallet.id);
            const totalQty = pallet.items.reduce((sum, item) => sum + item.quantity, 0);
            const isClosed = pallet.status === PalletStatus.CLOSED;
            const isRemitted = !!pallet.remitoNumber || pallet.status === PalletStatus.REMITTED;

            return (
              <div
                key={pallet.id}
                onClick={() => onSelectPallet(pallet)}
                className={`group bg-zinc-900 rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer relative overflow-hidden shadow-md ${
                  isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-zinc-900'
                    : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => toggleSelect(pallet.id, e)}
                      className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white font-mono">
                          Pallet #{pallet.number}
                        </span>
                        {isClosed && (
                          <Lock className="w-3.5 h-3.5 text-zinc-500" title="Pallet Cerrado" />
                        )}
                      </div>
                      {pallet.reference ? (
                        <p className="text-xs text-zinc-400 font-medium truncate max-w-[180px]">
                          {pallet.reference}
                        </p>
                      ) : (
                        <p className="text-[10px] text-zinc-500 uppercase font-mono">
                          Bodega La Rural
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isRemitted ? (
                      <span className="bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Remitido
                      </span>
                    ) : isClosed ? (
                      <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Cerrado
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Abierto
                      </span>
                    )}
                  </div>
                </div>

                {/* Remito Tag if assigned */}
                {pallet.remitoNumber && (
                  <div className="mt-3 p-2 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-mono font-bold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      Remito <span className="text-amber-400 font-black">#{pallet.remitoNumber}</span>
                    </span>
                    {pallet.remitoDate && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatDateFull(new Date(pallet.remitoDate))}
                      </span>
                    )}
                  </div>
                )}

                {/* Items Preview */}
                <div className="my-4 space-y-1.5">
                  {pallet.items.length > 0 ? (
                    pallet.items.slice(0, 3).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-mono truncate max-w-[170px]">
                          {item.sku} - <span className="text-zinc-500 font-sans">{item.description}</span>
                        </span>
                        <span className="font-mono font-bold text-amber-400 flex-shrink-0">
                          {item.quantity} u
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-600 italic py-1">
                      Pallet sin items cargados.
                    </div>
                  )}

                  {pallet.items.length > 3 && (
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pt-1">
                      + {pallet.items.length - 3} items adicionales
                    </div>
                  )}
                </div>

                {/* Footer info & delete button */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-sm">
                      {totalQty} <span className="text-[10px] text-zinc-400 font-normal">unidades</span>
                    </span>
                    <span>•</span>
                    <span className="text-[11px] text-zinc-400">
                      {pallet.items.length} líneas
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar Pallet #${pallet.number}?`)) {
                          onDeletePallet(pallet.id);
                        }
                      }}
                      className="p-1 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                      title="Eliminar Pallet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-16 text-center space-y-4">
          <div className="bg-zinc-800 p-4 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center text-amber-500">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No hay pallets en Bodega La Rural</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Comienza creando un pallet para este almacén. Podrás cargar materiales, imprimir etiquetas, generar informes semanales y agrupar con número de remito.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={onAddPallet}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
          >
            <Plus className="w-4 h-4 mr-2 text-black" /> Crear Primer Pallet de La Rural
          </Button>
        </div>
      )}

      {/* Modal: Agrupar con N° de Remito */}
      {isRemitoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-800 text-amber-500 p-2 rounded-xl border border-zinc-700">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black italic uppercase text-white tracking-tight">
                    Agrupar Pallets con Remito
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Bodega La Rural • {selectedIds.length} pallets seleccionados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRemitoModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRemitoGroup} className="p-6 space-y-4">
              {/* Important rule note */}
              <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-start gap-3 text-zinc-300">
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-zinc-200">
                    Regla de Despacho Semanal
                  </p>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Al cargar el número de remito, los <strong>{selectedIds.length} pallets</strong> seleccionados formarán este grupo de despacho. 
                    <strong> No aparecerán en el informe de la próxima semana.</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                  Número de Remito <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: REM-00123 / R-98234"
                  value={remitoInputNumber}
                  onChange={(e) => setRemitoInputNumber(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono font-bold rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                  Fecha del Remito
                </label>
                <input
                  type="date"
                  value={remitoInputDate}
                  onChange={(e) => setRemitoInputDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                  Transportista / Conductor (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Logística Express / Juan Pérez"
                  value={remitoInputCarrier}
                  onChange={(e) => setRemitoInputCarrier(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales del remito..."
                  value={remitoInputNote}
                  onChange={(e) => setRemitoInputNote(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Selected Pallets List preview */}
              <div className="pt-2">
                <span className="text-[10px] font-black uppercase text-zinc-500 block mb-1.5">
                  Pallets incluidos en este remito:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-zinc-950 rounded-xl border border-zinc-800">
                  {pallets.filter(p => selectedIds.includes(p.id)).map(p => (
                    <span key={p.id} className="bg-zinc-800 text-zinc-200 text-[10px] font-mono font-bold px-2 py-1 rounded">
                      Pallet #{p.number} ({p.items.reduce((s, i) => s + i.quantity, 0)} u)
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsRemitoModalOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5"
                >
                  <FileCheck className="w-4 h-4 mr-2" /> Confirmar y Asignar Remito
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
