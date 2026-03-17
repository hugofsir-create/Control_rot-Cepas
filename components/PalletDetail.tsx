
import React, { useState, useMemo, useEffect } from 'react';
import { Pallet, Material, PalletItem, PalletStatus } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { generatePalletSummary } from '../services/geminiService.ts';
import { 
  ArrowLeft, Plus, Trash2, Lock, Printer, Bot, Unlock, 
  X, Search, PackageSearch, Loader2, ClipboardCheck
} from 'lucide-react';

interface PalletDetailProps {
  pallet: Pallet;
  materials: Material[];
  onUpdatePallet: (updatedPallet: Pallet) => void;
  onAddOverflow?: (currentPallet: Pallet, overflowPalletsItems: PalletItem[][]) => void;
  onBack: () => void;
  onPrint: (pallet: Pallet) => void;
}

export const PalletDetail: React.FC<PalletDetailProps> = ({ 
  pallet, 
  materials, 
  onUpdatePallet, 
  onAddOverflow,
  onBack,
  onPrint 
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [tripNumber, setTripNumber] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const isClosed = pallet.status === PalletStatus.CLOSED;

  const filteredMaterials = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];
    return materials.filter(m => 
      m.sku.toLowerCase().includes(query) || 
      m.description.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [materials, searchQuery]);

  // Auto-select if exact SKU is typed
  useEffect(() => {
    const query = searchQuery.toUpperCase().trim();
    if (query && !selectedMaterial) {
      const match = materials.find(m => m.sku === query);
      if (match) {
        setSelectedMaterial(match);
        setSearchQuery('');
      }
    }
  }, [searchQuery, materials, selectedMaterial]);

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    let material = selectedMaterial;
    if (!material && searchQuery.trim()) {
      const match = materials.find(m => m.sku === searchQuery.toUpperCase().trim());
      if (match) material = match;
    }

    if (isClosed || !material || quantity <= 0) return;

    // Robust limit calculation
    const boxesPerPallet = material.boxesPerPallet ? Number(material.boxesPerPallet) : Infinity;
    const limit = (isNaN(boxesPerPallet) || boxesPerPallet <= 0) ? Infinity : boxesPerPallet;
    
    const currentTotal = pallet.items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const spaceLeft = limit === Infinity ? Infinity : Math.max(0, limit - currentTotal);

    console.log(`[LogiPro Debug] SKU: ${material.sku}, Limit: ${limit}, Current: ${currentTotal}, SpaceLeft: ${spaceLeft}, Adding: ${quantity}`);

    if (quantity <= spaceLeft || limit === Infinity) {
      const newItem: PalletItem = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        sku: material.sku,
        description: material.description,
        quantity: quantity,
        deliveryNumber: deliveryNumber.toUpperCase(),
        tripNumber: tripNumber.toUpperCase(),
        note: note.toUpperCase()
      };
      onUpdatePallet({ ...pallet, items: [newItem, ...pallet.items] });
    } else {
      let remaining = quantity;
      const updatedItems = [...pallet.items];
      
      if (spaceLeft > 0 && spaceLeft !== Infinity) {
        updatedItems.unshift({
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          sku: material.sku,
          description: material.description,
          quantity: spaceLeft,
          deliveryNumber: deliveryNumber.toUpperCase(),
          tripNumber: tripNumber.toUpperCase(),
          note: note.toUpperCase()
        });
        remaining -= spaceLeft;
      }
      
      const overflow: PalletItem[][] = [];
      while (remaining > 0) {
        const take = Math.min(remaining, limit);
        overflow.push([{
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          sku: material.sku,
          description: material.description,
          quantity: take,
          deliveryNumber: deliveryNumber.toUpperCase(),
          tripNumber: tripNumber.toUpperCase(),
          note: note.toUpperCase()
        }]);
        remaining -= take;
      }
      
      console.log(`[LogiPro Debug] Splitting into ${overflow.length} additional pallets.`);
      
      if (onAddOverflow) {
        onAddOverflow({ ...pallet, items: updatedItems }, overflow);
      } else {
        onUpdatePallet({ ...pallet, items: updatedItems });
      }
    }

    setSelectedMaterial(null);
    setSearchQuery('');
    setQuantity(1);
    setDeliveryNumber('');
    setTripNumber('');
    setNote('');
  };

  const handleToggleStatus = async () => {
    if (pallet.status === PalletStatus.OPEN) {
      if (pallet.items.length === 0) {
        alert("El pallet no tiene materiales cargados.");
        return;
      }
      
      setIsGeneratingAI(true);
      try {
        const summary = await generatePalletSummary(pallet.items);
        onUpdatePallet({
          ...pallet,
          status: PalletStatus.CLOSED,
          closedAt: new Date().toISOString(),
          aiSummary: summary
        });
      } catch (err) {
        onUpdatePallet({
          ...pallet,
          status: PalletStatus.CLOSED,
          closedAt: new Date().toISOString()
        });
      } finally {
        setIsGeneratingAI(false);
      }
    } else {
      if (confirm("¿Reabrir pallet para edición?")) {
        onUpdatePallet({ ...pallet, status: PalletStatus.OPEN });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-4 flex items-center justify-between shadow-2xl sticky top-0 z-40">
        <div className="flex items-center gap-4 lg:gap-6">
          <Button variant="ghost" onClick={onBack} className="p-3 bg-zinc-950/50 rounded-full hover:bg-zinc-800 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl lg:text-2xl font-black italic tracking-tighter flex items-center gap-2 lg:gap-3">
              PALLET <span className="text-amber-500">#{pallet.number}</span>
              <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded border font-black ${isClosed ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {pallet.status}
              </span>
            </h1>
            <input 
              type="text"
              placeholder="REFERENCIA DE CARGA..."
              value={pallet.reference || ''}
              readOnly={isClosed}
              onChange={(e) => onUpdatePallet({...pallet, reference: e.target.value.toUpperCase()})}
              className="bg-transparent text-[10px] font-black text-zinc-500 uppercase tracking-widest focus:text-zinc-300 outline-none w-full"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onPrint(pallet)} size="sm" className="hidden lg:flex">
             <Printer className="w-4 h-4 mr-2" /> Etiquetas
          </Button>
          <Button variant={isClosed ? 'secondary' : 'danger'} onClick={handleToggleStatus} disabled={isGeneratingAI} size="sm">
            {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span className="hidden lg:inline ml-2">{isClosed ? 'Reabrir' : 'Cerrar'}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-4 lg:p-8 gap-6 lg:gap-8 overflow-hidden">
        {/* Selector de Materiales */}
        {!isClosed && (
          <div className="w-full lg:w-[450px] flex-shrink-0">
            <div className="bg-zinc-900 p-6 lg:p-8 rounded-[2rem] border border-zinc-800 shadow-2xl flex flex-col gap-6">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" /> Selección de Material
              </h3>
              
              <div className="relative">
                {!selectedMaterial ? (
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-amber-500 transition-colors" />
                    <input 
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="SKU O DESCRIPCIÓN..."
                      className="w-full pl-12 pr-4 py-4 bg-zinc-950 border border-zinc-800 text-white rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-black tracking-tighter placeholder:text-zinc-800 uppercase"
                    />
                    {filteredMaterials.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden ring-1 ring-white/5">
                        {filteredMaterials.map(m => (
                          <button 
                            key={m.sku} 
                            onClick={() => { setSelectedMaterial(m); setSearchQuery(''); }}
                            className="w-full p-4 text-left hover:bg-amber-500/10 border-b border-zinc-800 last:border-0 group flex flex-col"
                          >
                            <span className="font-mono text-amber-500 text-sm font-black italic tracking-tighter group-hover:scale-105 origin-left transition-transform">{m.sku}</span>
                            <span className="text-zinc-500 text-[10px] font-bold uppercase truncate">{m.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-zinc-950 border-2 border-amber-500/40 rounded-2xl flex justify-between items-center animate-in fade-in zoom-in duration-200">
                    <div className="overflow-hidden">
                      <div className="font-mono text-amber-500 font-black text-lg italic leading-none truncate tracking-tighter">{selectedMaterial.sku}</div>
                      <div className="text-zinc-400 text-[10px] font-bold uppercase mt-1 truncate">{selectedMaterial.description}</div>
                      {selectedMaterial.boxesPerPallet && (
                        <div className="text-amber-500/60 text-[9px] font-black uppercase mt-1">Capacidad: {selectedMaterial.boxesPerPallet} cajas/pallet</div>
                      )}
                    </div>
                    <button onClick={() => setSelectedMaterial(null)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-600 ml-2"><X className="w-5 h-5"/></button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Unidades</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="number" 
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    className="w-full p-3 bg-zinc-950 border border-zinc-800 text-2xl font-black text-amber-500 text-center rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none tabular-nums tracking-tighter"
                  />
                  {selectedMaterial?.boxesPerPallet && quantity > 0 && (
                    <div className="px-4 py-2 bg-amber-500/5 rounded-xl border border-amber-500/10 animate-in fade-in slide-in-from-top-1">
                      <p className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest text-center">
                        Distribución estimada: {Math.ceil(quantity / selectedMaterial.boxesPerPallet)} Pallet(s)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Viaje (Opcional)</label>
                  <input 
                    type="text"
                    value={tripNumber}
                    onChange={(e) => setTripNumber(e.target.value)}
                    placeholder="VIAJE..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 rounded-xl focus:ring-1 focus:ring-amber-500 outline-none uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Entrega (Opcional)</label>
                  <input 
                    type="text"
                    value={deliveryNumber}
                    onChange={(e) => setDeliveryNumber(e.target.value)}
                    placeholder="ENTREGA..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 rounded-xl focus:ring-1 focus:ring-amber-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Nota (Opcional)</label>
                <input 
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="OBSERVACIONES..."
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 rounded-xl focus:ring-1 focus:ring-amber-500 outline-none uppercase"
                />
              </div>

              <Button 
                onClick={() => handleAddItem()} 
                disabled={!selectedMaterial || quantity < 1} 
                className="w-full py-4 text-xl italic font-black rounded-2xl"
              >
                <Plus className="w-6 h-6 mr-3" /> Cargar Material
              </Button>
            </div>
          </div>
        )}

        {/* Listado de Carga */}
        <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] flex flex-col overflow-hidden shadow-inner backdrop-blur-sm">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/60">
             <h3 className="text-sm font-black text-zinc-300 uppercase italic tracking-widest flex items-center gap-3">
                <PackageSearch className="w-5 h-5 text-zinc-600" /> Manifiesto de Carga
             </h3>
             <span className="text-[10px] text-zinc-600 font-black uppercase tracking-tighter bg-zinc-950 px-3 py-1 rounded-full">{pallet.items.length} POSICIONES</span>
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
             <table className="w-full text-left">
                <thead className="bg-zinc-950/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="p-3 text-[10px] font-black text-zinc-600 uppercase text-center w-24">CANT.</th>
                    <th className="p-3 text-[10px] font-black text-zinc-600 uppercase">DESCRIPCIÓN / SKU</th>
                    {!isClosed && <th className="p-3 text-[10px] font-black text-zinc-600 uppercase text-right w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {pallet.items.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-all group animate-in slide-in-from-left-2 duration-200">
                      <td className="p-2 text-center text-3xl font-black italic text-amber-500 tracking-tighter tabular-nums">{item.quantity}</td>
                      <td className="p-2">
                        <div className="font-mono text-zinc-100 font-black text-base italic leading-none mb-0.5 uppercase tracking-tighter truncate max-w-[150px] lg:max-w-xs">{item.description}</div>
                        <div className="text-[8px] text-zinc-600 font-black uppercase tracking-widest flex flex-wrap items-center gap-x-2 gap-y-0.5">
                           <div className="flex items-center gap-1"><span className="text-zinc-500">SKU:</span> {item.sku}</div>
                           {item.tripNumber && <div className="flex items-center gap-1"><span className="text-zinc-500">VIAJE:</span> {item.tripNumber}</div>}
                           {item.deliveryNumber && <div className="flex items-center gap-1"><span className="text-zinc-500">ENTREGA:</span> {item.deliveryNumber}</div>}
                           {item.note && <div className="flex items-center gap-1 text-amber-500/70"><span className="text-zinc-500">NOTA:</span> {item.note}</div>}
                           {materials.find(m => m.sku === item.sku)?.boxesPerPallet && (
                             <div className="flex items-center gap-1 text-amber-500/50">
                               <span className="text-zinc-500">PALLET:</span> 
                               {(item.quantity / (materials.find(m => m.sku === item.sku)?.boxesPerPallet || 1)).toFixed(2)} PLT
                             </div>
                           )}
                        </div>
                      </td>
                      {!isClosed && (
                        <td className="p-2 text-right">
                          <button 
                            onClick={() => { if(confirm('¿Eliminar material?')) onUpdatePallet({ ...pallet, items: pallet.items.filter(i => i.id !== item.id) }); }}
                            className="p-1.5 text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {pallet.items.length === 0 && (
                    <tr><td colSpan={3} className="p-32 text-center text-zinc-800 font-black italic uppercase opacity-20 tracking-[0.5em]">Pallet Vacío</td></tr>
                  )}
                </tbody>
             </table>
          </div>

          {pallet.aiSummary && (
            <div className="p-6 lg:p-8 bg-zinc-950/80 border-t border-zinc-800 flex gap-4 lg:gap-6 items-start">
               <Bot className="w-8 h-8 text-amber-500 mt-1 flex-shrink-0" />
               <div className="min-w-0">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block italic">IA LOGIPRO SUMMARY</span>
                  <p className="text-sm text-zinc-300 italic font-bold leading-relaxed break-words">"{pallet.aiSummary}"</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
