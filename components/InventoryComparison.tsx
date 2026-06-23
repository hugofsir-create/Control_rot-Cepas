import React, { useState, useMemo, useRef } from 'react';
import { Pallet, Material } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Download,
  AlertCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface InventoryComparisonProps {
  pallets: Pallet[];
  materials: Material[];
  onBack: () => void;
  onAddLog?: (action: string, details?: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER') => void;
}

interface ConsolidatedItem {
  sku: string;
  description: string;
  totalQuantity: number;
}

interface ImportedItem {
  sku: string;
  quantity: number;
  description: string;
}

interface ComparisonResult {
  sku: string;
  description: string;
  systemQuantity: number;
  importedQuantity: number;
  difference: number;
  status: 'MATCH' | 'MISMATCH' | 'ONLY_IN_SYSTEM' | 'ONLY_IN_EXCEL';
}

export const InventoryComparison: React.FC<InventoryComparisonProps> = ({ 
  pallets, 
  materials, 
  onBack,
  onAddLog
}) => {
  const [importedData, setImportedData] = useState<ImportedItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCH' | 'MISMATCH' | 'ONLY_IN_SYSTEM' | 'ONLY_IN_EXCEL'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<{ sku: string; qty: string; desc: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Consolidate systems' internal active inventory
  const systemConsolidated = useMemo(() => {
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
            description: item.description || materialInfo?.description || 'Sin descripción',
            totalQuantity: item.quantity
          });
        }
      });
    });

    return map;
  }, [pallets, materials]);

  // Helper utility to detect appropriate columns inside the sheet autonomously
  const handleParseWorkbook = (workbook: XLSX.WorkBook, name: string) => {
    try {
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      if (jsonData.length === 0) {
        setErrorMessage('La hoja de cálculo está vacía o no tiene un formato legible.');
        return;
      }

      // Detect keys
      const sampleItem = jsonData[0];
      const keys = Object.keys(sampleItem);

      // Simple normalizer
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      const skuCandidates = ['sku', 'sku code', 'skucode', 'codigo', 'código', 'material', 'articulo', 'artículo', 'id'];
      const qtyCandidates = ['cantidad', 'cant', 'total', 'stock', 'quantity', 'qty', 'cajas', 'unidades'];
      const descCandidates = ['descripcion', 'descripción', 'description', 'nombre', 'name', 'detalle'];

      let skuKey = '';
      let qtyKey = '';
      let descKey = '';

      // 1. Detect SKU Column candidate
      for (const k of keys) {
        const normalized = norm(k);
        if (skuCandidates.includes(normalized) || skuCandidates.some(c => normalized.includes(c))) {
          skuKey = k;
          break;
        }
      }
      // Default to Column A (keys[0])
      if (!skuKey) skuKey = keys[0] || '';

      // 2. Detect Quantity Column candidate - Priority candidate, fallback is Column C (keys[2])
      for (const k of keys) {
        const normalized = norm(k);
        if (qtyCandidates.includes(normalized) || qtyCandidates.some(c => normalized.includes(c))) {
          qtyKey = k;
          break;
        }
      }
      // Crucial: Column C (keys[2]) holds quantities. If no candidate matched, or we have 3+ columns, default to keys[2] for Column C.
      if (!qtyKey) {
        qtyKey = keys[2] || keys[1] || '';
      }

      // 3. Detect Description Column candidate
      for (const k of keys) {
        const normalized = norm(k);
        if (descCandidates.includes(normalized) || descCandidates.some(c => normalized.includes(c))) {
          descKey = k;
          break;
        }
      }
      // Default description to keys[1] (Column B) as long as it's not the same key
      if (!descKey) {
        descKey = keys.find(k => k !== skuKey && k !== qtyKey) || keys[1] || '';
      }

      // Save the detected column mapping
      setDetectedColumns({
        sku: skuKey,
        qty: qtyKey,
        desc: descKey
      });

      // Build parsed array
      const parsedItems: ImportedItem[] = [];
      jsonData.forEach((row) => {
        let rawSku = row[skuKey];
        if (rawSku === undefined || rawSku === null) return;
        const sku = String(rawSku).trim().toUpperCase();
        if (!sku) return;

        let rawQty = row[qtyKey];
        let quantity = 0;
        if (typeof rawQty === 'number') {
          quantity = Math.round(rawQty);
        } else if (rawQty !== undefined && rawQty !== null) {
          // Remove currency formatting and spaces, parse decimal numbers robustly
          const cleaned = String(rawQty).replace(/[\s\$]/g, '').replace(/,/g, '.').trim();
          quantity = Math.round(parseFloat(cleaned)) || 0;
        }
        
        let desc = '';
        if (descKey && row[descKey]) {
          desc = String(row[descKey]).trim();
        } else {
          // Fallback, search material database matching SKU
          const matchingMat = materials.find(m => m.sku === sku);
          desc = matchingMat?.description || 'Importado de Excel';
        }

        // Aggregate if duplicate SKUs appear in Excel too
        const existing = parsedItems.find(item => item.sku === sku);
        if (existing) {
          existing.quantity += quantity;
        } else {
          parsedItems.push({ sku, quantity, description: desc });
        }
      });

      if (parsedItems.length === 0) {
        setErrorMessage('No se pudieron extraer filas con SKUs válidos.');
        return;
      }

      setImportedData(parsedItems);
      setFileName(name);
      setErrorMessage(null);
      if (onAddLog) {
        onAddLog(
          'Excel Comparativo Cargado', 
          `Archivo ${name} procesado con ${parsedItems.length} SKUs únicos para comparar (Cantidades leídas de columna: ${qtyKey})`, 
          'INFO'
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Error procesando archivo Excel: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        handleParseWorkbook(workbook, file.name);
      } catch (err: any) {
        setErrorMessage('Formato incompatible de archivo. Asegúrate de subir un archivo .xlsx, .xls o .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and Drop support
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
      ) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            handleParseWorkbook(workbook, file.name);
          } catch (err: any) {
            setErrorMessage('Error al leer el archivo arrastrado. Use un .xlsx o .csv tradicional.');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setErrorMessage('Tipo de archivo no admitido. Se requiere archivo de Excel (.xlsx, .xls, .csv).');
      }
    }
  };

  // 2. Perform comparison calculations between system inputs and excel inputs
  const comparisonList = useMemo<ComparisonResult[]>(() => {
    if (importedData.length === 0) return [];

    const results: ComparisonResult[] = [];
    const processedSkus = new Set<string>();

    // Check system items vs Excel
    systemConsolidated.forEach((systemItem, sku) => {
      processedSkus.add(sku);
      const excelItem = importedData.find(item => item.sku === sku);

      if (excelItem) {
        const diff = systemItem.totalQuantity - excelItem.quantity;
        results.push({
          sku,
          description: systemItem.description || excelItem.description || 'Sin descripción',
          systemQuantity: systemItem.totalQuantity,
          importedQuantity: excelItem.quantity,
          difference: diff,
          status: diff === 0 ? 'MATCH' : 'MISMATCH'
        });
      } else {
        results.push({
          sku,
          description: systemItem.description,
          systemQuantity: systemItem.totalQuantity,
          importedQuantity: 0,
          difference: systemItem.totalQuantity,
          status: 'ONLY_IN_SYSTEM'
        });
      }
    });

    // Check Excel items that were not processed (i.e. only in Excel)
    importedData.forEach((excelItem) => {
      if (!processedSkus.has(excelItem.sku)) {
        results.push({
          sku: excelItem.sku,
          description: excelItem.description,
          systemQuantity: 0,
          importedQuantity: excelItem.quantity,
          difference: -excelItem.quantity,
          status: 'ONLY_IN_EXCEL'
        });
      }
    });

    return results;
  }, [systemConsolidated, importedData]);

  // Filter comparison
  const filteredComparisonList = useMemo(() => {
    return comparisonList.filter(item => {
      // 1. Search term
      const matchesSearch = item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Status filter
      if (statusFilter === 'ALL') return true;
      return item.status === statusFilter;
    });
  }, [comparisonList, searchTerm, statusFilter]);

  // Statistics summaries
  const stats = useMemo(() => {
    let perfectCount = 0;
    let mismatchCount = 0;
    let systemOnlyCount = 0;
    let excelOnlyCount = 0;

    comparisonList.forEach(item => {
      if (item.status === 'MATCH') perfectCount++;
      else if (item.status === 'MISMATCH') mismatchCount++;
      else if (item.status === 'ONLY_IN_SYSTEM') systemOnlyCount++;
      else if (item.status === 'ONLY_IN_EXCEL') excelOnlyCount++;
    });

    return {
      total: comparisonList.length,
      perfectCount,
      mismatchCount,
      systemOnlyCount,
      excelOnlyCount,
    };
  }, [comparisonList]);

  // Export back exact compared list to Excel
  const handleExportComparison = () => {
    if (comparisonList.length === 0) return;

    const dataToExport = comparisonList.map(item => {
      let readableStatus = '';
      switch (item.status) {
        case 'MATCH': readableStatus = 'Coincide perfectamente'; break;
        case 'MISMATCH': readableStatus = 'Diferencia en cantidad'; break;
        case 'ONLY_IN_SYSTEM': readableStatus = 'Solo en Sistema (LogiPro)'; break;
        case 'ONLY_IN_EXCEL': readableStatus = 'Solo en Excel Importado'; break;
      }

      return {
        'SKU': item.sku,
        'Descripción': item.description,
        'Cantidad LogiPro (Sistema)': item.systemQuantity,
        'Cantidad Excel (Importada)': item.importedQuantity,
        'Diferencia (Sistema - Excel)': item.difference,
        'Estado de Comparación': readableStatus
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparativa_Inventario");

    // Color and width styles can be standard
    worksheet["!cols"] = [
      { wch: 15 }, // SKU
      { wch: 35 }, // Descripcion
      { wch: 25 }, // Cantidad Sistema
      { wch: 25 }, // Cantidad Excel
      { wch: 25 }, // Diferencia
      { wch: 30 }  // Estado
    ];

    XLSX.writeFile(workbook, `Comparativa_Inventario_LogiPro_${new Date().toISOString().split('T')[0]}.xlsx`);

    if (onAddLog) {
      onAddLog('Comparativa Exportada', 'Se exportó reporte de conciliación de inventario', 'SUCCESS');
    }
  };

  const resetComparison = () => {
    setImportedData([]);
    setFileName('');
    setErrorMessage(null);
    setDetectedColumns(null);
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  return (
    <div className="flex flex-col min-h-full max-w-6xl mx-auto p-6 gap-6" id="inventory-comparison-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-amber-500" /> Conciliación de Inventario
          </h2>
          <p className="text-zinc-400">Compara el inventario cargado en tus pallets versus un reporte de Excel externo.</p>
        </div>
        <div className="flex gap-2">
          {importedData.length > 0 && (
            <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:text-white" onClick={resetComparison}>
              <RefreshCw className="w-4 h-4 mr-2" /> Subir Otro Archivo
            </Button>
          )}
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </Button>
        </div>
      </div>

      {/* Main Area */}
      {importedData.length === 0 ? (
        /* Upload Area Dropzone */
        <div className="flex-1 flex flex-col justify-center items-center">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full max-w-2xl p-12 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center flex flex-col items-center bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-700 hover:border-amber-500/80 ${isDragActive ? 'border-amber-500 bg-zinc-900/90 scale-[1.01]' : ''}`}
            id="excel-dropzone"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            
            <div className="bg-zinc-850 p-5 rounded-2xl text-amber-500 mb-4 shadow-lg border border-zinc-800">
              <Upload className="w-10 h-10 animate-pulse" />
            </div>

            <h3 className="text-lg font-bold text-zinc-100 mb-1">Cargar reportes de inventario</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
              Arrastra tu archivo Excel aquí, o haz clic para buscarlo en tu dispositivo. Soporta formatos <strong className="text-amber-500">.xlsx, .xls y .csv</strong>.
            </p>

            <div className="bg-zinc-950 px-4 py-3 rounded-xl max-w-lg text-left text-xs border border-zinc-900 text-zinc-400 flex gap-2">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-zinc-300 block mb-1">¿Cómo estructurar mi Excel?</span>
                El sistema detecta automáticamente las columnas basándose en sus nombres. Asegúrate de incluir columnas como:
                <div className="flex flex-wrap gap-1 mt-1.5 font-mono">
                  <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-amber-500">SKU</span>
                  <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-amber-500">Cantidad</span>
                  <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Descripción (Opcional)</span>
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-4 bg-red-950/40 border border-red-900/50 rounded-xl max-w-xl text-center text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      ) : (
        /* Results Table View */
        <div className="flex flex-col gap-6 w-full">
          {/* File summary and fast info */}
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 text-emerald-500 rounded-lg border border-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-zinc-500 text-xs font-semibold block uppercase">Archivo Comparado</span>
                <span className="text-white font-mono font-bold">{fileName}</span>
              </div>
            </div>

            <Button variant="primary" className="bg-amber-600 hover:bg-amber-500" onClick={handleExportComparison}>
              <Download className="w-4 h-4 mr-2" /> Exportar Comparativa a Excel
            </Button>
          </div>

          {/* Column mappings display for feedback */}
          {detectedColumns && (
            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850 flex flex-wrap gap-x-6 gap-y-3 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Info className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-zinc-300">Asociación de Columnas:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">Columna SKU (A):</span>
                <span className="bg-zinc-850 border border-zinc-750 px-2.5 py-1 rounded text-amber-500 font-mono font-bold text-[11px]">
                  {detectedColumns.sku}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">Columna Descripción (B):</span>
                <span className="bg-zinc-850 border border-zinc-750 px-2.5 py-1 rounded text-zinc-300 font-mono text-[11px]">
                  {detectedColumns.desc}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500 font-semibold">Columna Cantidad (C):</span>
                <span className="bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded text-amber-400 font-mono font-black text-[11px]">
                  {detectedColumns.qty}
                </span>
              </div>
            </div>
          )}

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850">
              <span className="text-zinc-500 text-xs font-medium block uppercase mb-1">Total SKUs</span>
              <span className="text-2xl font-black text-white">{stats.total}</span>
            </div>
            
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850 border-l-4 border-l-emerald-500">
              <span className="text-emerald-500 text-xs font-semibold block uppercase mb-1 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Coinciden
              </span>
              <span className="text-2xl font-black text-white">{stats.perfectCount}</span>
            </div>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850 border-l-4 border-l-amber-500">
              <span className="text-amber-500 text-xs font-semibold block uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Diferencias
              </span>
              <span className="text-2xl font-black text-white">{stats.mismatchCount}</span>
            </div>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850 border-l-4 border-l-blue-500">
              <span className="text-blue-400 text-xs font-semibold block uppercase mb-1">
                Solo en LogiPro
              </span>
              <span className="text-2xl font-black text-white">{stats.systemOnlyCount}</span>
            </div>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-850 border-l-4 border-l-purple-500 col-span-2 md:col-span-1">
              <span className="text-purple-400 text-xs font-semibold block uppercase mb-1">
                Solo en Excel
              </span>
              <span className="text-2xl font-black text-white">{stats.excelOnlyCount}</span>
            </div>
          </div>

          {/* Filters shelf */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-850 p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900/50">
             {/* Search input */}
             <div className="relative w-full md:w-80">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
               <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Buscar por SKU o descripción..." 
                  className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-amber-500 placeholder-zinc-500 transition-all"
               />
             </div>

             {/* Filter chips */}
             <div className="flex flex-wrap gap-2 w-full md:w-auto overflow-x-auto justify-start md:justify-end">
               {[
                 { id: 'ALL', label: 'Todos' },
                 { id: 'MATCH', label: 'Coinciden perfect.' },
                 { id: 'MISMATCH', label: 'Con diferencia' },
                 { id: 'ONLY_IN_SYSTEM', label: 'Solo en LogiPro' },
                 { id: 'ONLY_IN_EXCEL', label: 'Solo en Excel' }
               ].map(btn => (
                 <button
                   key={btn.id}
                   onClick={() => setStatusFilter(btn.id as any)}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-tight transition-all ${statusFilter === btn.id ? 'bg-amber-600 text-white shadow-md' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'}`}
                 >
                   {btn.label}
                 </button>
               ))}
             </div>
          </div>

          {/* Data grid / table */}
          <div className="bg-zinc-900 rounded-xl shadow-xl border border-zinc-850 flex flex-col overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-1/4">SKU</th>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800">Descripción</th>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-32 text-center">Cant. LogiPro</th>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-32 text-center">Cant. Excel</th>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-28 text-center">Diferencia</th>
                    <th className="px-6 py-4 font-semibold text-zinc-400 border-b border-zinc-800 w-44 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredComparisonList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-zinc-500 italic">
                        {comparisonList.length === 0 ? "No hay datos para comparar." : "No se encontraron coincidencias para los criterios seleccionados."}
                      </td>
                    </tr>
                  ) : (
                    filteredComparisonList.map((item) => (
                      <tr key={item.sku} className="hover:bg-zinc-800/30 transition-colors">
                        {/* SKU */}
                        <td className="px-6 py-4 font-mono text-amber-500 font-bold">{item.sku}</td>
                        
                        {/* Description */}
                        <td className="px-6 py-4 text-zinc-300 max-w-xs truncate">{item.description}</td>
                        
                        {/* System Inventory */}
                        <td className="px-6 py-4 text-center font-bold text-white">
                          {item.systemQuantity}
                        </td>
                        
                        {/* Excel Inventory */}
                        <td className="px-6 py-4 text-center font-bold font-mono text-zinc-400">
                          {item.importedQuantity}
                        </td>
                        
                        {/* Difference amount */}
                        <td className={`px-6 py-4 text-center font-black font-mono ${item.difference === 0 ? 'text-zinc-500' : item.difference > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.difference > 0 ? `+${item.difference}` : item.difference}
                        </td>
                        
                        {/* Status tag */}
                        <td className="px-6 py-4 text-center">
                          {item.status === 'MATCH' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg uppercase">
                              <CheckCircle className="w-3 h-3" /> Coincide
                            </span>
                          )}
                          {item.status === 'MISMATCH' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-lg uppercase">
                              <AlertTriangle className="w-3 h-3" /> Desfase
                            </span>
                          )}
                          {item.status === 'ONLY_IN_SYSTEM' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-lg uppercase">
                              Solo Logipro
                            </span>
                          )}
                          {item.status === 'ONLY_IN_EXCEL' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold rounded-lg uppercase">
                              Solo Excel
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Total recap footer bar */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <span className="text-zinc-500 text-[10px] uppercase font-bold">LogiPro Inventory Reconciliation Report</span>
              
              <div className="flex flex-wrap gap-6 items-center justify-end text-xs font-bold uppercase tracking-tight text-zinc-400">
                <div>
                  Suma Diferencias Netas:{' '}
                  <span className={`font-black font-mono ml-1 text-sm ${comparisonList.reduce((acc, i) => acc + i.difference, 0) === 0 ? 'text-zinc-300' : 'text-amber-500'}`}>
                    {comparisonList.reduce((acc, i) => acc + i.difference, 0)}
                  </span>
                </div>
                <div>
                  Uds. Sistema:{' '}
                  <span className="text-white font-mono text-sm">
                    {comparisonList.reduce((acc, i) => acc + i.systemQuantity, 0)}
                  </span>
                </div>
                <div>
                  Uds. Excel:{' '}
                  <span className="text-zinc-300 font-mono text-sm">
                    {comparisonList.reduce((acc, i) => acc + i.importedQuantity, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
