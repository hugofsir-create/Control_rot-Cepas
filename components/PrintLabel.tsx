import React from 'react';
import { Pallet } from '../types.ts';
import { Button } from './ui/Button.tsx';
import { Printer, ArrowLeft, Box, Calendar, Package } from 'lucide-react';

interface PrintLabelProps {
  pallets: Pallet[];
  onBack: () => void;
}

export const PrintLabel: React.FC<PrintLabelProps> = ({ pallets, onBack }) => {

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Navbar para pantalla */}
      <div className="no-print bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center shadow-md flex-shrink-0 z-50">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
        <div className="text-zinc-400 text-sm hidden sm:block font-medium">
          Vista de Impresión - {pallets.length} Pallet(s) seleccionados
        </div>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" /> Imprimir Todo
        </Button>
      </div>

      {/* Área de Previsualización */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-900/50 flex flex-col items-center gap-8 print:bg-white print:p-0 print:overflow-visible print:block">
        
        {pallets.map((pallet, pIdx) => (
          <div key={pallet.id} className="print-sheet bg-white text-black w-[210mm] min-h-fit shadow-2xl print:shadow-none print:w-full print:m-0 flex flex-col box-border print:break-after-page">
            
            <div className="p-10 flex flex-col flex-1 print:p-5">
              
              {/* Encabezado Principal */}
              <div className="flex justify-between items-stretch border-[6px] border-black mb-6">
                  <div className="flex-1 p-6 border-r-[6px] border-black flex flex-col justify-center">
                      <h1 className="text-5xl font-black tracking-tighter uppercase mb-2 leading-none">ETIQUETA DE<br/>CONTENIDO</h1>
                      <div className="flex flex-col gap-1 text-sm font-bold text-slate-600">
                          <div className="flex items-center gap-2">
                               <Calendar className="w-5 h-5" /> 
                               FECHA: {new Date(pallet.createdAt).toLocaleDateString()}
                          </div>
                          {pallet.reference && (
                               <div className="flex items-center gap-2 text-black text-2xl uppercase mt-4 border-t-4 border-slate-100 pt-2 font-black">
                                  REF: {pallet.reference}
                               </div>
                          )}
                      </div>
                  </div>
                  <div className="w-56 bg-black text-white flex flex-col items-center justify-center p-4">
                      <span className="text-xs uppercase font-bold tracking-[0.2em] text-slate-400 mb-1">PALLET N°</span>
                      <span className="text-9xl font-black leading-none">{pallet.number}</span>
                  </div>
              </div>

              {/* Resumen IA */}
              {pallet.aiSummary && (
                  <div className="mb-8 p-6 bg-slate-100 border-l-[15px] border-black">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                      <Box className="w-4 h-4" /> Resumen de Carga Consolidada
                    </div>
                    <p className="text-2xl font-serif italic text-slate-900 leading-snug">
                      "{pallet.aiSummary}"
                    </p>
                  </div>
              )}

              {/* Tabla de Materiales */}
              <div className="flex-1">
                  <table className="w-full text-left border-collapse">
                      <thead className="print:table-header-group">
                          <tr className="bg-black text-white border-2 border-black">
                              <th className="py-3 px-4 font-black border-2 border-black w-24 text-center text-xl uppercase">Cant.</th>
                              <th className="py-3 px-4 font-black border-2 border-black text-xl uppercase">SKU / Descripción</th>
                              <th className="py-3 px-4 font-black border-2 border-black w-48 text-center text-xs uppercase">Datos Entrega</th>
                          </tr>
                      </thead>
                      <tbody className="border-x-2 border-b-2 border-black">
                          {pallet.items.map((item) => (
                              <tr key={item.id} className="border-b-2 border-black page-break-inside-avoid">
                                  <td className="py-4 px-4 border-r-2 border-black font-mono text-5xl font-black text-center align-middle">
                                      {item.quantity}
                                  </td>
                                  <td className="py-4 px-4 border-r-2 border-black align-middle">
                                      <div className="text-2xl font-black leading-none uppercase mb-1">{item.description}</div>
                                      <div className="text-lg font-mono font-bold text-slate-700">SKU: {item.sku}</div>
                                      {item.note && (
                                        <div className="text-xs italic text-slate-500 mt-2 bg-slate-50 p-1 border-l-2 border-slate-300">
                                          NOTA: {item.note}
                                        </div>
                                      )}
                                  </td>
                                  <td className="py-4 px-4 text-center align-middle font-mono text-sm font-black">
                                      <div className="flex flex-col gap-2">
                                        {item.deliveryNumber && <div className="border border-black p-1">E: {item.deliveryNumber}</div>}
                                        {item.tripNumber && <div className="border border-black p-1">V: {item.tripNumber}</div>}
                                        {!item.deliveryNumber && !item.tripNumber && <span className="text-slate-300">---</span>}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* Footer de Firmas */}
              <div className="mt-12 pt-10 border-t-[6px] border-black grid grid-cols-2 gap-16 print:mt-10">
                  <div className="border-[4px] border-black h-36 relative flex items-end justify-center pb-4">
                      <span className="absolute top-2 left-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Despachado por (Firma)</span>
                      <div className="w-[80%] border-b-2 border-dashed border-black"></div>
                  </div>
                  <div className="border-[4px] border-black h-36 relative flex items-end justify-center pb-4">
                       <span className="absolute top-2 left-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Recibido Almacén (Firma)</span>
                       <div className="w-[80%] border-b-2 border-dashed border-black"></div>
                  </div>
              </div>
              
              <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.8em] text-slate-400 print:pb-5">
                CÓDIGO DE CONTROL: {pallet.id.toUpperCase()}
              </div>
              
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
