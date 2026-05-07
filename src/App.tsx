import React, { useState, useEffect } from 'react';
import CanvasApp from './Canvas'; 

// REPLACE THE LINK BELOW WITH YOUR GOOGLE APPS SCRIPT URL
const API_URL = "https://script.google.com/macros/s/AKfycbz_uZbMfqVbFpBplYlWu-qDU8IZkJ0qBqmm1NfeNUpHrJsSxV0J-NuoBoTLHUyakDzT_w/exec";

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSheetData = async () => {
    try {
      const response = await fetch(API_URL);
      const jsonData = await response.json();
      setData(jsonData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, []);

  const fetchOptions = (bodyData: any) => ({
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(bodyData)
  });

  const insertItem = async (_: any, row: any) => {
    setLoading(true);
    await fetch(API_URL, fetchOptions({ action: 'INSERT', row }));
    fetchSheetData(); 
  };

  const updateItem = async (index: number, row: any) => {
    setLoading(true);
    await fetch(API_URL, fetchOptions({ action: 'UPDATE', rowIndex: index, row }));
    fetchSheetData();
  };

  const deleteItem = async (index: number) => {
    setLoading(true);
    await fetch(API_URL, fetchOptions({ action: 'DELETE', rowIndex: index }));
    fetchSheetData();
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