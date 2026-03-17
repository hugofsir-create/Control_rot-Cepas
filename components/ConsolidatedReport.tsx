
import React, { useMemo } from 'react';
import { Pallet, Material } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { ArrowLeft, FileSpreadsheet, Package, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ConsolidatedReportProps {
  pallets: Pallet[];
  materials: Material[];
  onBack: () => void;
}

interface ConsolidatedItem {
  sku: string;
  description: string;
  totalQuantity: number;
  boxesPerPallet?: number;
}

export const ConsolidatedReport: React.FC<ConsolidatedReportProps> = ({ pallets, materials, onBack }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const consolidatedData = useMemo(() => {
    const map = new Map<string, ConsolidatedItem>();

    pallets.forEach(pallet => {
      pallet.items.forEach(item => {
        const existing = map.get(item.sku);
        if (existing) {
          existing.totalQuantity += item.quantity;
        } else {
          const materialInfo = materials.find(m => m.sku === item.sku);
          map.set(item.sku, {
            sku: item.sku,
            description: item.description,
            totalQuantity: item.quantity,
            boxesPerPallet: materialInfo?.boxesPerPallet
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [pallets, materials]);

  const filteredData = consolidatedData.filter(item => 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportToExcel = () => {
    const exportData = consolidatedData.map(item => ({
      'SKU': item.sku,
      'Descripción': item.description,
      'Cajas por Pallet': item.boxesPerPallet || '-',
      'Cantidad Total': item.totalQuantity,
      'Total Pallets': item.boxesPerPallet ? (item.totalQuantity / item.boxesPerPallet).toFixed(2) : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario Consolidado");
    
    // Auto-size columns
    worksheet["!cols"] = [ { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ];

    XLSX.writeFile(workbook, `Reporte_Inventario_Consolidado_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-6 gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" /> Inventario Consolidado
          </h2>
          <p className="text-zinc-400">Totales acumulados de todos los pallets registrados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleExportToExcel} disabled={consolidatedData.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar a Excel
          </Button>
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/50">
           <div className="text-zinc-400 text-sm">
               Total SKU Únicos: <span className="text-zinc-200 font-bold">{consolidatedData.length}</span>
           </div>
           <div className="relative w-full sm:w-80">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
             <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Buscar por SKU o descripción..." 
                className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-amber-500 placeholder-zinc-500 transition-all"
             />
           </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-1/4">SKU</th>
                <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800">Descripción</th>
                <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-24 text-center">Cjs/Plt</th>
                <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-32 text-center">Cant. Total</th>
                <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-32 text-center">Total PLT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-zinc-500 italic">
                    {consolidatedData.length === 0 ? "No hay datos para mostrar." : "No se encontraron coincidencias."}
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.sku} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-amber-500 font-bold">{item.sku}</td>
                    <td className="px-6 py-4 text-zinc-300">{item.description}</td>
                    <td className="px-6 py-4 text-center text-zinc-500 font-mono">{item.boxesPerPallet || '-'}</td>
                    <td className="px-6 py-4 text-center font-bold text-lg text-white">
                      {item.totalQuantity}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-amber-500/80 font-mono">
                      {item.boxesPerPallet ? (item.totalQuantity / item.boxesPerPallet).toFixed(2) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {consolidatedData.length > 0 && (
          <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-zinc-500 text-[10px] uppercase font-bold">LogiPro Inventory Report</span>
            <div className="flex gap-8">
              <span className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
                Suma Total de Unidades: <span className="text-white">{consolidatedData.reduce((acc, i) => acc + i.totalQuantity, 0)}</span>
              </span>
              <span className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
                Suma Total de Pallets: <span className="text-amber-500">{consolidatedData.reduce((acc, i) => acc + (i.boxesPerPallet ? i.totalQuantity / i.boxesPerPallet : 0), 0).toFixed(2)}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
