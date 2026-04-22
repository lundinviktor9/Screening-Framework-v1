import { useState, useRef } from 'react';
import { useDealStore } from '../../store/useDealStore';

export function DealUploadPanel() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDeal = useDealStore(s => s.addDeal);
  const fetchDeals = useDealStore(s => s.fetchDeals);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      for (const file of files) {
        setProgress(p => ({ ...p, [file.name]: 0 }));
      }

      const response = await fetch('http://localhost:8787/ingest', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      const deals = await response.json();

      // Add each deal to store
      deals.forEach((deal: any) => {
        if (deal.deal_id) {
          addDeal(deal);
        }
        setProgress(p => {
          const newP = { ...p };
          delete newP[deal.source_filename];
          return newP;
        });
      });

      // Refresh to sync
      await fetchDeals();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      setProgress({});
    }
  }

  function handleDragOver(e: React.DragEvent) {
    console.log('Drag over');
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    console.log('Drag leave');
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    console.log('Drop detected, files:', e.dataTransfer.files);
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const allFiles = Array.from(e.dataTransfer.files);
    console.log('All files:', allFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));
    const files = allFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    console.log('Filtered files:', files.length);
    if (files.length) {
      uploadFiles(files);
    } else {
      console.warn('No PDF files found after filtering');
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files));
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <input
        ref={fileInputRef}
        id="deal-pdf-upload"
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileSelect}
        className="sr-only"
      />
      <div className="flex gap-3 items-center flex-wrap">
        {/* Upload zone */}
        <label
          htmlFor="deal-pdf-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 min-w-64 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <p className="text-sm text-gray-700">
            {uploading ? 'Uploading...' : 'Drag PDFs here or click to select'}
          </p>
          {uploading && (
            <div className="mt-2 space-y-1">
              {Object.entries(progress).map(([name, pct]) => (
                <div key={name} className="text-xs text-gray-600">
                  <div className="flex justify-between mb-1">
                    <span>{name}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </label>

        {/* Process inbox button */}
        <button
          onClick={() => {
            fetch('http://localhost:8787/ingest-folder?folder_path=deals_inbox', {
              method: 'POST'
            })
              .then(r => r.json())
              .then(deals => {
                deals.forEach((d: any) => {
                  if (d.deal_id) addDeal(d);
                });
                fetchDeals();
              })
              .catch(err => alert('Batch ingest failed: ' + err.message));
          }}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm"
        >
          Process Inbox
        </button>
      </div>
    </div>
  );
}
