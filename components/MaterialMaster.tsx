import React, { useState, useRef } from 'react';
import { Material } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { Plus, Trash2, Search, Upload, Download, ClipboardList, FileSpreadsheet, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

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
    if (confirm(`¿Copiar ${availableCentralMaterials.length} materiales del maestro central a este almacén?`)) {
      setMaterials(prev => {
        const map = new Map<string, Material>(prev.map(m => [m.sku, m]));
        availableCentralMaterials.forEach(m => {
          if (!map.has(m.sku)) {
            map.set(m.sku, m);
          }
        });
        return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
      });
      alert('Materiales copiados exitosamente.');
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
      alert('Este SKU ya existe en el maestro.');
      return;
    }

    setMaterials(prev => [{ sku, description: desc, boxesPerPallet }, ...prev]);
    setNewSku('');
    setNewDesc('');
    setNewBoxes('');
  };

  const handleDelete = (sku: string) => {
    if (confirm(`¿Eliminar SKU ${sku} del maestro?`)) {
      setMaterials(prev => prev.filter(m => m.sku !== sku));
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
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length === 0) {
        alert('El archivo está vacío.');
        return;
      }

      // REGLA ESTRICTA:
      // Columna A (índice 0) = SKU
      // Columna B (índice 1) = DESCRIPCIÓN
      // Columna O (índice 14) = CAJAS_POR_PALLET

      let startIndex = 0;

      // Detectar si la primera fila corresponde a encabezados
      if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
        const colAHeader = String(jsonData[0][0] || '').trim().toLowerCase();
        const colBHeader = String(jsonData[0][1] || '').trim().toLowerCase();
        const colOHeader = String(jsonData[0][14] || '').trim().toLowerCase();

        const isColAHeader = colAHeader.includes('sku') || 
                             colAHeader.includes('cod') || 
                             colAHeader.includes('cód') || 
                             colAHeader.includes('art') || 
                             colAHeader.includes('item') ||
                             colAHeader.includes('material');

        const isColBHeader = colBHeader.includes('desc') || 
                             colBHeader.includes('prod') || 
                             colBHeader.includes('nom') || 
                             colBHeader.includes('detal');

        const isColOHeader = colOHeader.includes('caja') ||
                             colOHeader.includes('pallet') ||
                             colOHeader.includes('unid') ||
                             colOHeader.includes('cant');

        if (isColAHeader || isColBHeader || isColOHeader) {
          startIndex = 1;
        }
      }

      const newMaterials: Material[] = [];
      let importedCount = 0;
      let updatedCount = 0;

      for (let i = startIndex; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;

        // Columna A (índice 0) = SKU
        const rawSku = row[0];
        // Columna B (índice 1) = DESCRIPCION
        const rawDesc = row[1];
        // Columna O (índice 14) = Cajas por pallet
        // Soporte primario para Columna O (índice 14), con fallback a Columna C (índice 2) si es un archivo de 3 columnas
        let rawBoxes = row[14];
        if ((rawBoxes === undefined || rawBoxes === null || String(rawBoxes).trim() === '') && row.length <= 4 && row[2] !== undefined) {
          rawBoxes = row[2];
        }

        if (rawSku === undefined || rawSku === null) continue;

        const sku = String(rawSku).trim().toUpperCase();
        if (!sku) continue;
        if (sku === 'SKU' || sku === 'CODIGO' || sku === 'CÓDIGO' || sku === 'MATERIAL') continue;

        // Columna B = Descripción
        const description = rawDesc !== undefined && rawDesc !== null
          ? String(rawDesc).trim().toUpperCase()
          : '';

        if (!description) continue;
        if (description === 'DESCRIPCION' || description === 'DESCRIPCIÓN' || description === 'DETALLE') continue;

        let boxesPerPallet: number | undefined = undefined;
        if (rawBoxes !== undefined && rawBoxes !== null) {
          const cleaned = String(rawBoxes).trim().replace(',', '.');
          const parsed = Math.round(Number(cleaned));
          if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
            boxesPerPallet = parsed;
          }
        }

        newMaterials.push({ 
          sku, 
          description, 
          boxesPerPallet 
        });
      }

      if (newMaterials.length === 0) {
        alert('No se encontraron registros válidos.\n\nFormato requerido:\n- Columna A: Código SKU\n- Columna B: Descripción del Producto\n- Columna O: Cajas por Pallet');
        return;
      }

      setMaterials(prev => {
        const materialMap = new Map<string, Material>(prev.map(m => [m.sku, m]));
        newMaterials.forEach(m => {
          if (materialMap.has(m.sku)) {
            updatedCount++;
          } else {
            importedCount++;
          }
          materialMap.set(m.sku, m);
        });
        return Array.from(materialMap.values()).sort((a: Material, b: Material) => a.sku.localeCompare(b.sku));
      });

      alert(`Sincronización Exitosa:\n- Columna A -> SKU\n- Columna B -> Descripción\n- Columna O -> Cajas por Pallet\n\nResultados:\n- ${importedCount} SKUs nuevos registrados.\n- ${updatedCount} descripciones actualizadas.`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error procesando el archivo Excel. Verifica el formato del archivo.');
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
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{subtitle}</p>
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
             <Button variant="secondary" onClick={handleImportClick} className="rounded-xl border-zinc-800">
                 <Upload className="w-4 h-4 mr-2" /> Importar Excel
             </Button>
             <Button variant="secondary" onClick={onBack} className="rounded-xl bg-zinc-950 border-zinc-800">Volver</Button>
        </div>
      </div>

      {/* Format Helper Note */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-500">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-zinc-200">
              Estructura de Columnas para Importación de Excel:
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
               Registros Totales: <span className="text-amber-500 text-sm italic">{materials.length}</span>
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
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-1/4">SKU</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Descripción Oficial</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-20 text-center">Cjs/Plt</th>
                <th className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest w-12 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-8 text-center text-zinc-800 italic uppercase font-black opacity-10 tracking-[0.4em]">
                    No hay resultados
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => (
                  <tr key={m.sku} className="hover:bg-zinc-800/30 group transition-all">
                    <td className="px-3 py-1 font-mono text-amber-500 font-black text-xs italic tracking-tighter leading-none">{m.sku}</td>
                    <td className="px-3 py-1 text-zinc-300 font-bold text-[8px] uppercase tracking-widest leading-tight truncate max-w-[180px]">{m.description}</td>
                    <td className="px-3 py-1 text-center font-mono text-zinc-500 font-black text-[10px] italic">{m.boxesPerPallet || '-'}</td>
                    <td className="px-3 py-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDelete(m.sku)}
                        className="text-zinc-600 hover:text-red-500 p-0.5 transition-colors"
                        title="Eliminar"
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
