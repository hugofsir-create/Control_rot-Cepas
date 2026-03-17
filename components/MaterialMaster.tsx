import React, { useState, useRef } from 'react';
import { Material } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { Plus, Trash2, Search, Package, Upload, Download, ClipboardList } from 'lucide-react';
import { read, utils } from 'xlsx';

interface MaterialMasterProps {
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  onBack: () => void;
}

export const MaterialMaster: React.FC<MaterialMasterProps> = ({ materials, setMaterials, onBack }) => {
  const [newSku, setNewSku] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBoxes, setNewBoxes] = useState<string>('');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length === 0) {
        alert('El archivo está vacío.');
        return;
      }

      const newMaterials: Material[] = [];
      let importedCount = 0;
      let updatedCount = 0;

      // Intentar encontrar los índices de las columnas
      let skuIdx = 0;
      let descIdx = 1;
      let boxesIdx = -1;
      let startIndex = 0;

      // Buscar encabezados en las primeras 5 filas
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        const sIdx = row.findIndex(cell => String(cell || '').toLowerCase().includes('sku'));
        const dIdx = row.findIndex(cell => {
          const val = String(cell || '').toLowerCase();
          return val.includes('desc') || val.includes('prod') || val.includes('nombre') || val.includes('material');
        });
        const bIdx = row.findIndex(cell => {
          const val = String(cell || '').toLowerCase();
          return val.includes('caja') || val.includes('pallet') || val.includes('unid') || val.includes('cant');
        });

        if (sIdx !== -1 && dIdx !== -1) {
          skuIdx = sIdx;
          descIdx = dIdx;
          boxesIdx = bIdx;
          startIndex = i + 1;
          break;
        }
        
        // Si encontramos al menos uno, también lo tomamos como cabecera
        if (sIdx !== -1 || dIdx !== -1) {
            if (sIdx !== -1) skuIdx = sIdx;
            if (dIdx !== -1) descIdx = dIdx;
            if (bIdx !== -1) boxesIdx = bIdx;
            startIndex = i + 1;
            break;
        }
      }

      for (let i = startIndex; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row.length > Math.max(skuIdx, descIdx)) {
            const sku = String(row[skuIdx] || '').trim().toUpperCase();
            const description = String(row[descIdx] || '').trim().toUpperCase();
            const boxes = boxesIdx !== -1 ? parseInt(String(row[boxesIdx])) : undefined;

            if (sku && description) {
                newMaterials.push({ 
                  sku, 
                  description, 
                  boxesPerPallet: (boxes && !isNaN(boxes)) ? boxes : undefined 
                });
            }
        }
      }

      if (newMaterials.length === 0) {
          alert('No se encontraron SKUs válidos. Asegúrate de que el archivo tenga una columna "SKU" y otra "DESCRIPCION".');
          return;
      }

      setMaterials(prev => {
        const materialMap = new Map<string, Material>(prev.map(m => [m.sku, m]));
        newMaterials.forEach(m => {
            if (materialMap.has(m.sku)) updatedCount++;
            else importedCount++;
            materialMap.set(m.sku, m);
        });
        return Array.from(materialMap.values()).sort((a: Material, b: Material) => a.sku.localeCompare(b.sku));
      });

      alert(`Sincronización Exitosa:\n- ${importedCount} SKUs nuevos registrados.\n- ${updatedCount} descripciones actualizadas.`);

    } catch (error) {
      console.error('Import error:', error);
      alert('Error procesando el archivo Excel. Verifica el formato.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
      const csvContent = "data:text/csv;charset=utf-8,SKU,DESCRIPCION,CAJAS_POR_PALLET\nCOD-001,MATERIAL DE EJEMPLO A,50\nCOD-002,MATERIAL DE EJEMPLO B,100";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "plantilla_maestro_logipro.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const filteredMaterials = materials.filter(m => 
    m.sku.toLowerCase().includes(search.toLowerCase()) || 
    m.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-8 gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black italic uppercase text-white flex items-center gap-4 tracking-tighter">
            <ClipboardList className="w-10 h-10 text-amber-500" /> Maestro <span className="text-amber-500">Materiales</span>
          </h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Catálogo maestro de SKUs y descripciones</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
             <Button variant="ghost" onClick={handleDownloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-500">
                 <Download className="w-4 h-4 mr-2" /> Plantilla
             </Button>
             <Button variant="secondary" onClick={handleImportClick} className="rounded-xl border-zinc-800">
                 <Upload className="w-4 h-4 mr-2" /> Importar Excel
             </Button>
             <Button variant="secondary" onClick={onBack} className="rounded-xl bg-zinc-950 border-zinc-800">Volver</Button>
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
