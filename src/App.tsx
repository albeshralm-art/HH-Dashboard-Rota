import { useState, useEffect } from 'react';
// @ts-expect-error Canvas is the existing JSX dashboard module.
import CanvasApp from './Canvas';
import { localPreviewData } from './localPreviewData';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1vEWmQdWpfssvw7mJMC_jsm_LXddRKLMfRxIO6Uvrxmg/export?format=csv&gid=448780296";
const WRITE_API_URL = "https://script.google.com/macros/s/AKfycbz_uZbMfqVbFpBplYlWu-qDU8IZkJ0qBqmm1NfeNUpHrJsSxV0J-NuoBoTLHUyakDzT_w/exec";

type SheetCell = string | number | boolean | null | undefined;
type SheetRow = SheetCell[];
type SheetItem = {
  index_: number;
  row: SheetRow;
};
type SheetMutation =
  | { action: 'INSERT'; row: SheetRow }
  | { action: 'UPDATE'; rowIndex: number; row: SheetRow }
  | { action: 'DELETE'; rowIndex: number };

const parseCsvRows = (csvText: string): SheetRow[] => {
  const rows: SheetRow[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field);
      if (row.some(cell => cell !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some(cell => cell !== '')) {
    rows.push(row);
  }

  return rows;
};

const csvToSheetItems = (csvText: string): SheetItem[] =>
  parseCsvRows(csvText).map((row, index) => ({
    index_: index + 1,
    row
  }));

export default function App() {
  const [data, setData] = useState<SheetItem[]>(localPreviewData);
  const [loading, setLoading] = useState(false);

  const fetchSheetData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Google Sheets sync failed with status ${response.status}`);
      }

      const sheetData = csvToSheetItems(await response.text());
      if (sheetData.length > 0) {
        setData(sheetData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setData(currentData => currentData.length > 0 ? currentData : localPreviewData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSheetData();
  }, []);

  const fetchOptions = (bodyData: SheetMutation): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(bodyData)
  });

  const insertItem = async (_unused: unknown, row: SheetRow) => {
    setLoading(true);
    await fetch(WRITE_API_URL, fetchOptions({ action: 'INSERT', row }));
    fetchSheetData(true); 
  };

  const updateItem = async (index: number, row: SheetRow) => {
    setLoading(true);
    await fetch(WRITE_API_URL, fetchOptions({ action: 'UPDATE', rowIndex: index, row }));
    fetchSheetData(true);
  };

  const deleteItem = async (index: number) => {
    setLoading(true);
    await fetch(WRITE_API_URL, fetchOptions({ action: 'DELETE', rowIndex: index }));
    fetchSheetData(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-slate-500 font-bold text-xl animate-pulse">
          Syncing with Google Sheets...
        </div>
      </div>
    );
  }

  return (
    <CanvasApp 
      data={data} 
      insertItem={insertItem} 
      updateItem={updateItem} 
      deleteItem={deleteItem} 
    />
  );
}
