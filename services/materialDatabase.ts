// Material Database Service for LogiPro Control
// Handles persistent database storage (Firestore & local cache) and robust Excel parsing for material masters.

import { 
  collection, 
  doc, 
  writeBatch, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { db } from './firebase.ts';
import { Material } from '../types.ts';
import * as XLSX from 'xlsx';

/**
 * Generates a safe, valid Firestore document ID from any SKU string.
 * Firestore document IDs cannot contain forward slashes '/' and must not be empty.
 */
export function sanitizeSkuToDocId(sku: string): string {
  const clean = sku.trim().toUpperCase();
  // Replace forward slashes and reserved characters with safe encoded tokens
  return clean
    .replace(/\//g, '__slash__')
    .replace(/\\/g, '__backslash__')
    .replace(/\./g, '__dot__')
    .replace(/#/g, '__hash__')
    .replace(/\?/g, '__question__')
    .replace(/\[/g, '__lbr__')
    .replace(/\]/g, '__rbr__');
}

/**
 * Reverts a sanitized document ID back to the original SKU format if needed.
 */
export function revertDocIdToSku(docId: string): string {
  return docId
    .replace(/__slash__/g, '/')
    .replace(/__backslash__/g, '\\')
    .replace(/__dot__/g, '.')
    .replace(/__hash__/g, '#')
    .replace(/__question__/g, '?')
    .replace(/__lbr__/g, '[')
    .replace(/__rbr__/g, ']');
}

/**
 * Cleans a material object ensuring no undefined values are sent to Firestore.
 */
export function sanitizeMaterialData(m: Material): { sku: string; description: string; boxesPerPallet?: number } {
  const clean: { sku: string; description: string; boxesPerPallet?: number } = {
    sku: String(m.sku || '').trim().toUpperCase(),
    description: String(m.description || '').trim().toUpperCase(),
  };

  if (m.boxesPerPallet !== undefined && m.boxesPerPallet !== null) {
    const num = Number(m.boxesPerPallet);
    if (!isNaN(num) && num > 0 && isFinite(num)) {
      clean.boxesPerPallet = Math.round(num);
    }
  }

  return clean;
}

/**
 * Persists an entire list of materials to the Firestore database and local storage.
 * Uses atomic batched writes (up to 400 documents per batch) to ensure all records
 * are saved reliably without crashing on individual errors.
 */
export async function saveMaterialsToDatabase(
  collectionName: 'materials' | 'ruralMaterials',
  materialsList: Material[],
  previousMaterials: Material[] = []
): Promise<{ success: boolean; savedCount: number; deletedCount: number; error?: string }> {
  try {
    // 1. Instant local persistence for zero data loss
    const localKey = collectionName === 'materials' 
      ? 'logipro_db_materials_central' 
      : 'logipro_db_materials_rural';
    try {
      localStorage.setItem(localKey, JSON.stringify(materialsList));
    } catch {
      // Ignore local storage quota limits if list is huge
    }

    // 2. Identify additions/updates and deletions
    const currentMap = new Map<string, Material>();
    materialsList.forEach(m => {
      const sku = m.sku.trim().toUpperCase();
      if (sku) currentMap.set(sku, m);
    });

    const previousMap = new Map<string, Material>();
    previousMaterials.forEach(m => {
      const sku = m.sku.trim().toUpperCase();
      if (sku) previousMap.set(sku, m);
    });

    // Detect items to save (new or modified)
    const itemsToSave: Material[] = [];
    currentMap.forEach((material, sku) => {
      const existing = previousMap.get(sku);
      if (!existing || existing.description !== material.description || existing.boxesPerPallet !== material.boxesPerPallet) {
        itemsToSave.push(material);
      }
    });

    // Detect items to delete
    const itemsToDelete: string[] = [];
    if (previousMaterials.length > 0 && materialsList.length < previousMaterials.length) {
      previousMap.forEach((_, sku) => {
        if (!currentMap.has(sku)) {
          itemsToDelete.push(sku);
        }
      });
    }

    // 3. Batch commit to Firestore in chunks of 400 (limit is 500)
    const BATCH_SIZE = 400;

    // Writes
    for (let i = 0; i < itemsToSave.length; i += BATCH_SIZE) {
      const chunk = itemsToSave.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(mat => {
        const safeId = sanitizeSkuToDocId(mat.sku);
        const docRef = doc(db, collectionName, safeId);
        const cleanData = sanitizeMaterialData(mat);
        batch.set(docRef, cleanData, { merge: true });
      });

      await batch.commit();
    }

    // Deletes
    for (let i = 0; i < itemsToDelete.length; i += BATCH_SIZE) {
      const chunk = itemsToDelete.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(sku => {
        const safeId = sanitizeSkuToDocId(sku);
        const docRef = doc(db, collectionName, safeId);
        batch.delete(docRef);
      });

      await batch.commit();
    }

    return {
      success: true,
      savedCount: itemsToSave.length,
      deletedCount: itemsToDelete.length
    };
  } catch (error: any) {
    console.error(`Error saving to database (${collectionName}):`, error);
    return {
      success: false,
      savedCount: 0,
      deletedCount: 0,
      error: error?.message || 'Error guardando en la base de datos'
    };
  }
}

/**
 * Loads materials from local storage database fallback if needed.
 */
export function getLocalDatabaseMaterials(collectionName: 'materials' | 'ruralMaterials'): Material[] {
  try {
    const localKey = collectionName === 'materials' 
      ? 'logipro_db_materials_central' 
      : 'logipro_db_materials_rural';
    const raw = localStorage.getItem(localKey);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Comprehensive parser for Excel spreadsheets adhering to the requested column rules:
 * - Columna A (index 0) = SKU
 * - Columna B (index 1) = DESCRIPCIÓN
 * - Columna O (index 14) = CAJAS POR PALLET
 * 
 * Also handles real-world variations:
 * - Title rows before actual headers
 * - Headers identified by name (SKU, DESCRIPCIÓN, CAJAS)
 * - Number formatting, units in box counts (e.g. "100 cjs", "50 u")
 */
export interface ExcelParseResult {
  materials: Material[];
  importedCount: number;
  totalRowsRead: number;
  headerRowIndex: number;
  detectedColumns: {
    skuCol: string;
    descCol: string;
    boxesCol: string;
  };
  warnings: string[];
}

export function parseMaterialsFromExcel(dataBuffer: ArrayBuffer): ExcelParseResult {
  const workbook = XLSX.read(dataBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to raw array of rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: '', 
    blankrows: false 
  }) as any[][];

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo Excel está completamente vacío.');
  }

  // Column index defaults according to requirements:
  // Col A = 0 (SKU)
  // Col B = 1 (DESCRIPCIÓN)
  // Col O = 14 (CAJAS POR PALLET)
  let skuIndex = 0;
  let descIndex = 1;
  let boxesIndex = 14;
  let headerRowIndex = -1;

  // Search the first 15 rows to find if there is an explicit header row
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    let foundSku = -1;
    let foundDesc = -1;
    let foundBoxes = -1;

    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim().toLowerCase();
      if (!cellVal) continue;

      // SKU / Código
      if (
        cellVal === 'sku' || 
        cellVal.includes('código') || 
        cellVal.includes('codigo') || 
        cellVal.includes('artículo') || 
        cellVal.includes('articulo') || 
        cellVal.includes('item') ||
        cellVal.includes('material')
      ) {
        if (foundSku === -1) foundSku = c;
      }

      // Descripción / Producto
      if (
        cellVal.includes('descrip') || 
        cellVal.includes('detalle') || 
        cellVal.includes('nombre') || 
        cellVal.includes('producto')
      ) {
        if (foundDesc === -1) foundDesc = c;
      }

      // Cajas por pallet
      if (
        cellVal.includes('caja') || 
        cellVal.includes('pallet') || 
        cellVal.includes('cjs') || 
        cellVal.includes('cant') ||
        cellVal.includes('bulto')
      ) {
        if (foundBoxes === -1) foundBoxes = c;
      }
    }

    // If both SKU and Description headers were found in this row, mark as header
    if (foundSku !== -1 && foundDesc !== -1) {
      headerRowIndex = i;
      skuIndex = foundSku;
      descIndex = foundDesc;
      if (foundBoxes !== -1) {
        boxesIndex = foundBoxes;
      }
      break;
    }
  }

  // If no explicit header row was identified by names, check row 0
  if (headerRowIndex === -1) {
    if (rawRows.length > 0) {
      const firstRow = rawRows[0];
      const colA = String(firstRow[0] || '').trim().toLowerCase();
      const colB = String(firstRow[1] || '').trim().toLowerCase();

      // If row 0 looks like header labels
      if (colA.includes('sku') || colA.includes('cod') || colB.includes('desc') || colB.includes('prod')) {
        headerRowIndex = 0;
      } else {
        // Starts directly at row 0 with data
        headerRowIndex = -1;
      }
    }
    // Maintain strict rule: Col A = 0, Col B = 1, Col O = 14
    skuIndex = 0;
    descIndex = 1;
    boxesIndex = 14;
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
  const materialsMap = new Map<string, Material>();
  const warnings: string[] = [];

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // 1. Read SKU from designated column
    const rawSku = row[skuIndex];
    if (rawSku === undefined || rawSku === null) continue;
    
    let sku = String(rawSku).trim().toUpperCase();
    if (!sku) continue;

    // Filter out potential repeated header rows
    if (sku === 'SKU' || sku === 'CODIGO' || sku === 'CÓDIGO' || sku === 'MATERIAL' || sku === 'ARTICULO') {
      continue;
    }

    // 2. Read Description from designated column
    const rawDesc = row[descIndex];
    let description = rawDesc !== undefined && rawDesc !== null ? String(rawDesc).trim().toUpperCase() : '';
    if (!description) {
      // If description in Col B is empty, skip invalid row
      continue;
    }
    if (description.includes('DESCRIPCION') || description.includes('DESCRIPCIÓN')) {
      continue;
    }

    // 3. Read Boxes per Pallet from designated column (Column O = 14, or fallback to Column C = 2 if file is narrow)
    let rawBoxes = row[boxesIndex];
    // Fallback: if Column O is blank or out of range, check column 2 (Col C) if row is compact
    if ((rawBoxes === undefined || rawBoxes === null || String(rawBoxes).trim() === '') && row.length <= 4 && row[2] !== undefined) {
      rawBoxes = row[2];
    }

    let boxesPerPallet: number | undefined = undefined;
    if (rawBoxes !== undefined && rawBoxes !== null && String(rawBoxes).trim() !== '') {
      // Extract numeric value even if formatted as "50 cjs" or "100.0" or "50,00"
      const strVal = String(rawBoxes).trim().replace(',', '.');
      const numMatch = strVal.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const parsed = Math.round(parseFloat(numMatch[1]));
        if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
          boxesPerPallet = parsed;
        }
      }
    }

    materialsMap.set(sku, {
      sku,
      description,
      boxesPerPallet
    });
  }

  const materials = Array.from(materialsMap.values()).sort((a, b) => a.sku.localeCompare(b.sku));

  const colLetter = (idx: number) => {
    let letter = '';
    let temp = idx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  return {
    materials,
    importedCount: materials.length,
    totalRowsRead: rawRows.length,
    headerRowIndex,
    detectedColumns: {
      skuCol: colLetter(skuIndex),
      descCol: colLetter(descIndex),
      boxesCol: colLetter(boxesIndex)
    },
    warnings
  };
}
