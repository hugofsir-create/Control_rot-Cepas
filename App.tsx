
// LogiPro Control - Main Application Component
import React, { useState, useEffect, useRef } from 'react';
import { Material, Pallet, ViewState, PalletStatus, ActivityLog } from './types.ts';
import { MaterialMaster } from './components/MaterialMaster.tsx';
import { PalletList } from './components/PalletList.tsx';
import { PalletDetail } from './components/PalletDetail.tsx';
import { PrintLabel } from './components/PrintLabel.tsx';
import { ConsolidatedReport } from './components/ConsolidatedReport.tsx';
import { ActivityHistory } from './components/ActivityHistory.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { ContainerList } from './components/ContainerList.tsx';
// Added Button import to fix the "Cannot find name 'Button'" errors in the Settings modal
import { Button } from './components/ui/Button.tsx';
import { 
  Box, 
  Package as PalletIcon, 
  Database, 
  ClipboardList, 
  Download, 
  Upload, 
  Settings,
  X,
  ShieldCheck,
  History,
  Trash2,
  Truck
} from 'lucide-react';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [bulkPrintIds, setBulkPrintIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Persistence Keys
  const STORAGE_KEY_MATERIALS = 'materials_logipro_v6';
  const STORAGE_KEY_PALLETS = 'pallets_logipro_v6';
  const STORAGE_KEY_LOGS = 'logs_logipro_v6';
  const STORAGE_KEY_CONTAINERS = 'containers_logipro_v6';

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MATERIALS);
    return saved ? JSON.parse(saved) : [
        { sku: 'ELEC-100', description: 'MOTOR ELÉCTRICO TRIFÁSICO 10HP', boxesPerPallet: 24 },
        { sku: 'TUB-PVC-50', description: 'TUBO PVC PRESIÓN 50MM X 6M', boxesPerPallet: 100 },
    ];
  });

  const [pallets, setPallets] = useState<Pallet[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PALLETS);
    return saved ? JSON.parse(saved) : [];
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [containers, setContainers] = useState<any[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONTAINERS);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MATERIALS, JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PALLETS, JSON.stringify(pallets));
  }, [pallets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTAINERS, JSON.stringify(containers));
  }, [containers]);

  // --- Handlers ---

  const addLog = (action: string, details?: string, type: ActivityLog['type'] = 'INFO') => {
    const newLog: ActivityLog = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      action,
      details,
      type
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const handleCreatePallet = () => {
    const nextNumber = pallets.length > 0 
      ? Math.max(...pallets.map(p => p.number)) + 1 
      : 1;

    const newPallet: Pallet = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      number: nextNumber,
      items: [],
      status: PalletStatus.OPEN,
      createdAt: new Date().toISOString()
    };

    setPallets([newPallet, ...pallets]);
    setSelectedPalletId(newPallet.id);
    setView('PALLET_DETAIL');
    addLog('Pallet Creado', `Se inició el Pallet #${nextNumber}`, 'SUCCESS');
  };

  const handleBulkSend = (ids: string[]) => {
    const dispatchId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const nextContainerNum = containers.length > 0 ? Math.max(...containers.map(c => c.number)) + 1 : 1;

    const newContainer = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      number: nextContainerNum,
      dispatchId: dispatchId,
      createdAt: new Date().toISOString(),
      palletIds: ids,
      note: `Envío masivo de ${ids.length} pallets.`
    };

    setContainers([newContainer, ...containers]);
    setPallets(prev => prev.map(p => {
      if (ids.includes(p.id)) {
        return { ...p, status: PalletStatus.SENT, sentAt: new Date().toISOString(), containerId: newContainer.id };
      }
      return p;
    }));

    addLog('Despacho Generado', `Contenedor ${dispatchId} creado con ${ids.length} pallets`, 'SUCCESS');
    setView('CONTAINER_LIST');
  };

  const handleBackup = () => {
    const data = {
      materials,
      pallets,
      activityLogs,
      containers,
      exportedAt: new Date().toISOString(),
      version: '6.3'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LOGIPRO_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog('Backup Exportado', 'Se generó una copia de seguridad del sistema', 'INFO');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.materials && data.pallets) {
          if (confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')) {
            setMaterials(data.materials);
            setPallets(data.pallets);
            if (data.activityLogs) setActivityLogs(data.activityLogs);
            if (data.containers) setContainers(data.containers);
            alert('Datos restaurados con éxito.');
            setShowSettings(false);
            addLog('Sistema Restaurado', 'Se importó una copia de seguridad externa', 'WARNING');
          }
        } else {
          alert('El archivo no tiene un formato válido de LogiPro.');
        }
      } catch (err) {
        alert('Error al leer el archivo.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('¿ESTÁS SEGURO? Esta acción eliminará TODOS los datos del sistema (Materiales, Pallets e Historial) de forma permanente.')) {
      setMaterials([]);
      setPallets([]);
      setActivityLogs([]);
      setContainers([]);
      localStorage.clear();
      addLog('SISTEMA', 'Reinicio total de la base de datos', 'INFO');
      setShowSettings(false);
      window.location.reload();
    }
  };

  // --- Render ---

  const renderContent = () => {
    switch (view) {
      case 'MATERIALS':
        return <MaterialMaster materials={materials} setMaterials={(m) => { setMaterials(m); addLog('Maestro Actualizado', 'Se realizaron cambios en la base de materiales', 'INFO'); }} onBack={() => setView('DASHBOARD')} />;
      case 'PALLET_DETAIL':
        const currentPallet = pallets.find(p => p.id === selectedPalletId);
        if (!currentPallet) return <div className="p-20 text-center opacity-50 font-black uppercase italic tracking-widest">Pallet No Encontrado</div>;
        return (
          <PalletDetail 
            pallet={currentPallet} 
            materials={materials} 
            onUpdatePallet={(p) => {
              // Log specific actions in PalletDetail
              const oldPallet = pallets.find(old => old.id === p.id);
              if (oldPallet) {
                if (oldPallet.status !== p.status) {
                  addLog(`Pallet #${p.number} ${p.status}`, `Estado cambiado a ${p.status}`, p.status === PalletStatus.CLOSED ? 'SUCCESS' : 'WARNING');
                } else if (oldPallet.items.length < p.items.length) {
                  const newItem = p.items[0];
                  addLog('Material Cargado', `${newItem.quantity}x ${newItem.sku} añadidos al Pallet #${p.number}`, 'INFO');
                } else if (oldPallet.items.length > p.items.length) {
                  addLog('Material Eliminado', `Se retiró un item del Pallet #${p.number}`, 'DANGER');
                }
              }
              setPallets(prev => prev.map(old => old.id === p.id ? p : old));
            }} 
            onAddOverflow={(updatedCurrent, overflow) => {
              const count = overflow.length;
              
              setPallets(prev => {
                const currentMax = prev.length > 0 ? Math.max(...prev.map(p => p.number)) : 0;
                let nextNum = currentMax + 1;
                
                const newPallets: Pallet[] = overflow.map(items => ({
                  id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                  number: nextNum++,
                  items: items,
                  status: PalletStatus.OPEN,
                  createdAt: new Date().toISOString()
                }));

                const updated = prev.map(p => p.id === updatedCurrent.id ? updatedCurrent : p);
                
                // We'll add logs after state update to avoid side effects in reducer
                setTimeout(() => {
                  newPallets.forEach(np => {
                    addLog('Pallet Creado (Auto)', `Se inició el Pallet #${np.number} por exceso de capacidad`, 'SUCCESS');
                  });
                  alert(`DISTRIBUCIÓN AUTOMÁTICA:\nSe han generado ${count} pallets adicionales.\nTotal de pallets para esta carga: ${count + 1}.`);
                }, 100);

                return [...newPallets.slice().reverse(), ...updated];
              });
            }}
            onBack={() => setView('DASHBOARD')} 
            onPrint={(p) => { 
              setBulkPrintIds([p.id]); 
              setView('PRINT_PREVIEW'); 
              addLog('Etiqueta Impresa', `Se generó vista de impresión para Pallet #${p.number}`, 'INFO'); 
            }} 
          />
        );
      case 'PRINT_PREVIEW':
         const printPallets = pallets.filter(p => bulkPrintIds.includes(p.id));
         if (printPallets.length === 0) return null;
         return <PrintLabel pallets={printPallets} onBack={() => {
           if (bulkPrintIds.length === 1 && selectedPalletId === bulkPrintIds[0]) {
             setView('PALLET_DETAIL');
           } else {
             setView('DASHBOARD');
           }
         }} />;
      case 'CONSOLIDATED_REPORT':
        return <ConsolidatedReport pallets={pallets.filter(p => p.status !== PalletStatus.SENT)} materials={materials} onBack={() => setView('DASHBOARD')} />;
      case 'ACTIVITY_HISTORY':
        return <ActivityHistory logs={activityLogs} onBack={() => setView('DASHBOARD')} onClearLogs={() => setActivityLogs([])} />;
      case 'CONTAINER_LIST':
        return <ContainerList 
          containers={containers} 
          pallets={pallets} 
          onBack={() => setView('DASHBOARD')}
          onDeleteContainer={(id) => {
            setContainers(prev => prev.filter(c => c.id !== id));
            addLog('Despacho Eliminado', 'Se eliminó registro de despacho', 'DANGER');
          }}
          onUpdateContainer={(updatedContainer) => {
            setContainers(prev => prev.map(c => c.id === updatedContainer.id ? updatedContainer : c));
            addLog('Despacho Actualizado', `Se renombró el despacho a ${updatedContainer.dispatchId}`, 'INFO');
          }}
        />;
      case 'DASHBOARD':
      default:
        return <PalletList 
            pallets={pallets.filter(p => p.status !== PalletStatus.SENT)} 
            onAddPallet={handleCreatePallet} 
            onSelectPallet={(p) => { setSelectedPalletId(p.id); setView('PALLET_DETAIL'); }} 
            onDeletePallet={(id) => {
              if (confirm('¿Borrar pallet?')) {
                const p = pallets.find(pal => pal.id === id);
                setPallets(prev => prev.filter(pal => pal.id !== id));
                addLog('Pallet Eliminado', `Se eliminó el Pallet #${p?.number}`, 'DANGER');
              }
            }} 
            onBulkDelete={(ids) => {
              setPallets(prev => prev.filter(p => !ids.includes(p.id)));
              addLog('Eliminación Masiva', `Se eliminaron ${ids.length} pallets`, 'DANGER');
            }}
            onBulkClose={(ids) => {
              setPallets(prev => prev.map(p => {
                if (ids.includes(p.id) && p.status === PalletStatus.OPEN) {
                  return { ...p, status: PalletStatus.CLOSED, closedAt: new Date().toISOString() };
                }
                return p;
              }));
              addLog('Cierre Masivo', `Se cerraron ${ids.length} pallets`, 'SUCCESS');
            }}
            onBulkPrint={(ids) => {
              setBulkPrintIds(ids);
              setView('PRINT_PREVIEW');
              addLog('Impresión Masiva', `Se generó vista de impresión para ${ids.length} pallets`, 'INFO');
            }}
            onBulkSend={handleBulkSend}
            onOpenReport={() => setView('CONSOLIDATED_REPORT')} 
          />;
    }
  };

  if (view === 'PRINT_PREVIEW') return renderContent();

  return (
    <>
      {isLoading && <LoadingScreen />}
      <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Barra Lateral Optimizada para Tablets/Móviles */}
      <aside className="w-16 lg:w-72 bg-black border-r border-zinc-900 flex flex-col flex-shrink-0 z-30">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-zinc-900">
           <div className="bg-amber-500 p-2 rounded-xl">
              <PalletIcon className="w-6 h-6 text-black" />
           </div>
           <div className="ml-3 hidden lg:block">
              <h1 className="font-black text-xl italic tracking-tighter leading-none text-white">LOGI<span className="text-amber-500">PRO</span></h1>
           </div>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">
          {[
            { id: 'DASHBOARD', icon: Box, label: 'Cargas' },
            { id: 'CONTAINER_LIST', icon: Truck, label: 'Depósito / Salidas' },
            { id: 'MATERIALS', icon: Database, label: 'Maestro' },
            { id: 'CONSOLIDATED_REPORT', icon: ClipboardList, label: 'Inventario' },
            { id: 'ACTIVITY_HISTORY', icon: History, label: 'Historial' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all ${view === item.id || (view === 'PALLET_DETAIL' && item.id === 'DASHBOARD') ? 'bg-amber-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'}`}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="ml-3 font-bold uppercase tracking-tight text-xs hidden lg:block">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-2 lg:p-4 space-y-2 border-t border-zinc-900">
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-zinc-500 hover:bg-zinc-900 transition-all"
          >
            <Settings className="w-6 h-6 flex-shrink-0" />
            <span className="ml-3 font-bold uppercase tracking-tight text-xs hidden lg:block">Ajustes</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto bg-zinc-950">
           {renderContent()}
        </div>
      </main>

      {/* Modal de Ajustes y Copia de Seguridad */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <h3 className="font-black italic uppercase text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" /> Seguridad de Datos
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-2 font-bold uppercase tracking-widest">Información del Sistema</p>
                  <div className="grid grid-cols-2 gap-2 text-[8px] font-black uppercase tracking-tighter text-zinc-600">
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">Versión: <span className="text-amber-500">6.2.0</span></div>
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">Secure Context: <span className={window.isSecureContext ? 'text-emerald-500' : 'text-red-500'}>{window.isSecureContext ? 'SÍ' : 'NO'}</span></div>
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">UUID Native: <span className={typeof crypto.randomUUID === 'function' ? 'text-emerald-500' : 'text-red-500'}>{typeof crypto.randomUUID === 'function' ? 'SÍ' : 'NO'}</span></div>
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">Storage: <span className="text-amber-500">LOCAL</span></div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-4 font-bold uppercase tracking-widest">Instalación PWA</p>
                  <Button 
                    variant="secondary" 
                    onClick={() => window.open(window.location.href, '_blank')} 
                    className="w-full justify-start py-4 bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-black"
                  >
                    <ShieldCheck className="w-5 h-5 mr-3" /> Abrir para Instalar
                  </Button>
                  <p className="text-[9px] text-zinc-600 mt-2 font-medium uppercase tracking-tighter">
                    Si ya está instalada y no ves los cambios: Cierra la app, abre este enlace en el navegador y vuelve a instalar o refresca.
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-4 font-bold uppercase tracking-widest">Copia Local del Sistema</p>
                  <Button onClick={handleBackup} className="w-full justify-start py-4">
                    <Download className="w-5 h-5 mr-3" /> Exportar Base de Datos
                  </Button>
                </div>

                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-4 font-bold uppercase tracking-widest">Restaurar Información</p>
                  <input type="file" ref={fileInputRef} onChange={handleRestore} accept=".json" className="hidden" />
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full justify-start py-4">
                    <Upload className="w-5 h-5 mr-3" /> Importar Archivo .JSON
                  </Button>
                </div>

                <div className="p-4 bg-red-950/20 rounded-2xl border border-red-900/30">
                  <p className="text-xs text-red-500/70 mb-4 font-bold uppercase tracking-widest">Zona de Peligro</p>
                  <Button 
                    variant="secondary" 
                    onClick={handleResetData} 
                    className="w-full justify-start py-4 text-red-500 border-red-900/50 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-5 h-5 mr-3" /> Resetear Todo el Sistema
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-center text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                LogiPro utiliza almacenamiento local del navegador.<br/>Exporta tus datos periódicamente para no perderlos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default App;
