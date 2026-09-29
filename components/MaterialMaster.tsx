import React, { useState, useRef } from 'react';
import { Material } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { 
  Plus, 
  Trash2, 
  Search, 
  Upload, 
  Download, 
  ClipboardList, 
  FileSpreadsheet, 
  Database,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseMaterialsFromExcel } from '../services/materialDatabase.ts';

interface MaterialMasterProps {
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>> | ((updater: React.SetStateAction<Material[]>) => void | Promise<void>);
  onBack: () => void;
  title?: string;
  subtitle?: string;
  warehouseBadge?: string;
  availableCentralMaterials?: Material[];
}

export const MaterialMaster: React.FC<MaterialMasterProps> = ({ 
  materials, 
  setMaterials, 
  onBack,
  title = 'Maestro Materiales',
  subtitle = 'Catálogo maestro de SKUs y descripciones',
  warehouseBadge,
  availableCentralMaterials
}) => {
  const [newSku, setNewSku] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBoxes, setNewBoxes] = useState<string>('');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyFromCentral = () => {
    if (!availableCentralMaterials || availableCentralMaterials.length === 0) {
      alert('No hay materiales en el almacén central para copiar.');
      return;
    }
    if (confirm(`¿Copiar ${availableCentralMaterials.length} materiales del maestro central a esta base de datos?`)) {
      setMaterials(prev => {
        const map = new Map<string, Material>(prev.map(m => [m.sku, m]));
        availableCentralMaterials.forEach(m => {
          if (!map.has(m.sku)) {
            map.set(m.sku, m);
          }
        });
        return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
      });
      alert('Materiales copiados y guardados exitosamente en la base de datos.');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = newSku.toUpperCase().trim();
    const desc = newDesc.toUpperCase().trim();
    const boxes = parseInt(newBoxes);
    const boxesPerPallet = (!isNaN(boxes) && boxes > 0) ? boxes : undefined;
    
    if (!sku || !desc) return;

    if (materials.some(m => m.sku === sku)) {
      alert('Este SKU ya existe en la base de datos.');
      return;
    }

    setMaterials(prev => [{ sku, description: desc, boxesPerPallet }, ...prev]);
    setNewSku('');
    setNewDesc('');
    setNewBoxes('');
  };

  const handleDelete = (sku: string) => {
    if (confirm(`¿Eliminar SKU ${sku} de la base de datos?`)) {
      setMaterials(prev => prev.filter(m => m.sku !== sku));
    }
  };

  const handleClearAll = () => {
    if (materials.length === 0) return;
    if (confirm(`¿ATENCIÓN: Deseas VACIAR todos los ${materials.length} materiales registrados en esta base de datos?`)) {
      setMaterials([]);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const parseResult = parseMaterialsFromExcel(data);

      if (parseResult.materials.length === 0) {
        alert(
          'No se encontraron registros válidos en el archivo Excel.\n\n' +
          'Asegúrate de que contenga:\n' +
          '• Columna A: Código SKU\n' +
          '• Columna B: Descripción del Producto\n' +
          '• Columna O: Cajas por Pallet (Opcional)'
        );
        return;
      }

      let importedCount = 0;
      let updatedCount = 0;

      await setMaterials(prev => {
        const materialMap = new Map<string, Material>(prev.map(m => [m.sku, m]));
        parseResult.materials.forEach(m => {
          if (materialMap.has(m.sku)) {
            updatedCount++;
          } else {
            importedCount++;
          }
          materialMap.set(m.sku, m);
        });
        return Array.from(materialMap.values()).sort((a: Material, b: Material) => a.sku.localeCompare(b.sku));
      });

      alert(
        `Base de Datos de Materiales Sincronizada con Éxito:\n\n` +
        `• ${parseResult.materials.length} materiales procesados correctamente.\n` +
        `• Columna A [${parseResult.detectedColumns.skuCol}]: Código SKU\n` +
        `• Columna B [${parseResult.detectedColumns.descCol}]: Descripción Oficial\n` +
        `• Columna O [${parseResult.detectedColumns.boxesCol}]: Cajas por Pallet\n\n` +
        `Impacto en Base de Datos:\n` +
        `• ${importedCount} SKUs nuevos incorporados.\n` +
        `• ${updatedCount} registros actualizados.\n` +
        `• Todos los datos han sido almacenados de forma permanente.`
      );
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Error al procesar el archivo Excel: ${error?.message || 'Verifica el formato del archivo'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    // Generar plantilla oficial: Col A: SKU, Col B: DESCRIPCION, Col O (índice 14): CAJAS_POR_PALLET
    const headerRow: string[] = new Array(15).fill('');
    headerRow[0] = 'SKU';
    headerRow[1] = 'DESCRIPCION';
    headerRow[14] = 'CAJAS_POR_PALLET';

    const row1: any[] = new Array(15).fill('');
    row1[0] = 'MAT-001';
    row1[1] = 'TUBO PVC RIGIDO 110MM X 6M';
    row1[14] = 50;

    const row2: any[] = new Array(15).fill('');
    row2[0] = 'MAT-002';
    row2[1] = 'CABLE SUBTERRANEO 4X10MM CU';
    row2[14] = 100;

    const row3: any[] = new Array(15).fill('');
    row3[0] = 'MAT-003';
    row3[1] = 'CAJA ELECTRICA RECTANGULAR 10X5';
    row3[14] = 200;

    const wsData = [headerRow, row1, row2, row3];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const cols = new Array(15).fill({ wch: 12 });
    cols[0] = { wch: 18 };
    cols[1] = { wch: 45 };
    cols[14] = { wch: 22 };
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Materiales');
    XLSX.writeFile(wb, 'plantilla_maestro_materiales.xlsx');
  };

  const handleExportDatabaseExcel = () => {
    if (materials.length === 0) {
      alert('La base de datos de materiales está vacía.');
      return;
    }

    const headerRow: string[] = new Array(15).fill('');
    headerRow[0] = 'SKU';
    headerRow[1] = 'DESCRIPCION';
    headerRow[14] = 'CAJAS_POR_PALLET';

    const rows = materials.map(m => {
      const r: any[] = new Array(15).fill('');
      r[0] = m.sku;
      r[1] = m.description;
      r[14] = m.boxesPerPallet || '';
      return r;
    });

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
    const cols = new Array(15).fill({ wch: 12 });
    cols[0] = { wch: 18 };
    cols[1] = { wch: 45 };
    cols[14] = { wch: 22 };
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maestro_Materiales');
    XLSX.writeFile(wb, `Base_Datos_Materiales_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredMaterials = materials.filter(m => 
    m.sku.toLowerCase().includes(search.toLowerCase()) || 
    m.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-6 md:p-8 gap-6 md:gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          {warehouseBadge && (
            <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-zinc-700 uppercase tracking-widest mb-1.5 inline-block">
              {warehouseBadge}
            </span>
          )}
          <h2 className="text-3xl md:text-4xl font-black italic uppercase text-white flex items-center gap-4 tracking-tighter">
            <ClipboardList className="w-8 h-8 md:w-10 md:h-10 text-amber-500" /> {title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
              <Database className="w-3 h-3 text-amber-500" /> Base de Datos Activa ({materials.length} registros)
            </span>
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">{subtitle}</span>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
             {availableCentralMaterials && availableCentralMaterials.length > 0 && materials.length === 0 && (
               <Button variant="secondary" onClick={handleCopyFromCentral} className="rounded-xl border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs">
                 Copiar de Central ({availableCentralMaterials.length})
               </Button>
             )}
             <Button variant="ghost" onClick={handleDownloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500">
                 <Download className="w-4 h-4 mr-2" /> Plantilla Excel
             </Button>
             <Button variant="secondary" onClick={handleExportDatabaseExcel} className="rounded-xl border-zinc-800 text-xs">
                 <Download className="w-4 h-4 mr-2 text-amber-500" /> Exportar Base
             </Button>
             <Button variant="secondary" onClick={handleImportClick} className="rounded-xl border-zinc-800 text-xs">
                 <Upload className="w-4 h-4 mr-2 text-amber-500" /> Importar Excel
             </Button>
             {materials.length > 0 && (
               <Button variant="secondary" onClick={handleClearAll} className="rounded-xl border-zinc-800 text-zinc-400 hover:text-red-400 text-xs" title="Vaciar todos los registros del maestro">
                 <Trash2 className="w-4 h-4 mr-1.5" /> Vaciar
               </Button>
             )}
             <Button variant="secondary" onClick={onBack} className="rounded-xl bg-zinc-950 border-zinc-800 text-xs">Volver</Button>
        </div>
      </div>

      {/* Format Helper Note */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-500">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-zinc-200 flex items-center gap-2">
              Estructura de Columnas para Importación de Excel:
              <span className="text-[10px] text-amber-400 font-mono font-normal flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /> Guardado permanente en Base de Datos
              </span>
            </p>
            <p className="text-zinc-400 text-[11px] mt-0.5">
              <strong className="text-amber-400 font-mono">Columna A</strong> = Código SKU • <strong className="text-zinc-200 font-mono">Columna B</strong> = Descripción del Producto • <strong className="text-amber-400 font-mono">Columna O</strong> = Cajas por Pallet
            </p>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 shadow-2xl">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] italic mb-6">Registro Manual</h3>
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="block text-[10px] font-black text-zinc-600 mb-2 uppercase tracking-widest italic">Cód. SKU</label>
                <input 
                  type="text" 
                  value={newSku} 
                  onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                  className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 text-white font-mono rounded-xl focus:ring-2 focus:ring-amber-500 outline-none placeholder-zinc-800 transition-all uppercase"
                  placeholder="EJ. MAT-1020"
                />
            </div>
            <div className="flex-[2] w-full">
                <label className="block text-[10px] font-black text-zinc-600 mb-2 uppercase tracking-widest italic">Descripción del Producto</label>
                <input 
                  type="text" 
                  value={newDesc} 
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 text-white font-bold rounded-xl focus:ring-2 focus:ring-amber-500 outline-none placeholder-zinc-800 transition-all uppercase"
                  placeholder="EJ. CABLE SUBTERRANEO 4X10MM"
                />
            </div>
            <div className="w-full md:w-32">
                <label className="block text-[10px] font-black text-zinc-600 mb-2 uppercase tracking-widest italic">Cajas/Pallet</label>
                <input 
                  type="number" 
                  value={newBoxes} 
                  onChange={(e) => setNewBoxes(e.target.value)}
                  className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 text-white font-bold rounded-xl focus:ring-2 focus:ring-amber-500 outline-none placeholder-zinc-800 transition-all uppercase text-center"
                  placeholder="0"
                />
            </div>
            <Button type="submit" disabled={!newSku || !newDesc} className="h-14 rounded-xl px-10 italic">
                <Plus className="w-5 h-5 mr-2" /> Guardar
            </Button>
          </form>
      </div>

      <div className="flex-1 bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-6 bg-zinc-900/50">
           <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
               Registros Totales en Base de Datos: <span className="text-amber-500 text-sm italic">{materials.length}</span>
           </div>
           <div className="relative w-full sm:w-80">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
             <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="BUSCAR EN EL MAESTRO..." 
                className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 outline-none focus:ring-1 focus:ring-amber-500 placeholder-zinc-800 transition-all uppercase"
             />
           </div>
        </div>
        
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/80 backdrop-blur sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-1/4">SKU (Col A)</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Descripción Oficial (Col B)</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-24 text-center">Cajas (Col O)</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-12 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-8 text-center text-zinc-700 italic uppercase font-black tracking-[0.2em] text-xs">
                    Base de datos sin registros. Importa un archivo Excel o registra manualmente.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => (
                  <tr key={m.sku} className="hover:bg-zinc-800/30 group transition-all">
                    <td className="px-3 py-1 font-mono text-amber-500 font-black text-xs italic tracking-tighter leading-none">{m.sku}</td>
                    <td className="px-3 py-1 text-zinc-300 font-bold text-[8px] uppercase tracking-widest leading-tight truncate max-w-[180px]">{m.description}</td>
                    <td className="px-3 py-1 text-center font-mono text-zinc-400 font-black text-[10px] italic">{m.boxesPerPallet || '-'}</td>
                    <td className="px-3 py-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDelete(m.sku)}
                        className="text-zinc-600 hover:text-red-500 p-0.5 transition-colors"
                        title="Eliminar de la base de datos"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

