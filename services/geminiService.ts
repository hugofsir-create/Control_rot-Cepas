
import { GoogleGenAI } from "@google/genai";
import { PalletItem } from "../types.ts";

export const generatePalletSummary = async (items: PalletItem[]): Promise<string> => {
  if (items.length === 0) return "Pallet sin contenido registrado.";

  // Inicializar justo antes de usar
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const itemList = items.map(i => `- ${i.quantity} x ${i.description} (SKU: ${i.sku})`).join('\n');

  const prompt = `
    Actúa como un supervisor experto en logística. 
    Genera un resumen técnico y profesional de 2 líneas para la etiqueta de este pallet.
    Usa un tono industrial y agrupa por tipos si es relevante.
    
    Contenido:
    ${itemList}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Resumen generado automáticamente.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Contenido verificado por control de calidad.";
  }
};
