import React, { useState } from 'react';
import { Upload, FileText, Database } from 'lucide-react';

export function ArchiveView() {
  const [archivedData, setArchivedData] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setArchivedData(data);
      } catch (err) {
        console.error("Error parsing archive file:", err);
        alert("Invalid file format. Please upload a valid JSON backup file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-indigo-50 border border-indigo-150 p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
          <Database size={20} /> Data Archive Viewer
        </h2>
        <p className="text-sm text-indigo-800 mt-2">
          Upload your previous year's JSON backup file to view historical accounts, entries, and student records without mixing them with current data.
        </p>
      </div>

      {!archivedData ? (
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <Upload size={48} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-sm font-bold text-slate-900">Upload Backup File</h3>
          <p className="text-xs text-slate-500 mt-2">Select your JSON backup file</p>
          <input 
            type="file" 
            accept=".json" 
            onChange={handleFileUpload} 
            className="mt-4 block mx-auto text-xs" 
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <FileText size={16} /> Archive: {fileName}
            </h3>
            <button 
              onClick={() => setArchivedData(null)}
              className="text-xs text-rose-600 font-bold hover:underline"
            >
              Clear Archive
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 p-4 rounded-xl">
               <p className="text-[10px] uppercase font-bold text-slate-400">Total Entries</p>
               <p className="text-lg font-bold text-slate-900">{archivedData.entries?.length || 0}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl">
               <p className="text-[10px] uppercase font-bold text-slate-400">Total Students</p>
               <p className="text-lg font-bold text-slate-900">{archivedData.students?.length || 0}</p>
             </div>
          </div>
          <div className="mt-6 text-xs text-slate-500 italic">
            Note: This is a read-only viewer for historical data. To make changes, use the current active year interface.
          </div>
        </div>
      )}
    </div>
  );
}
