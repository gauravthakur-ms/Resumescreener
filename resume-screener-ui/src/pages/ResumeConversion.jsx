import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Download, Trash2, Eye, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadConversion, getConversions, getConversionStatus, downloadConversion, deleteConversion } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function ResumeConversion() {
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pollingIds, setPollingIds] = useState(new Set());
  const navigate = useNavigate();

  const fetchConversions = useCallback(async () => {
    try {
      const res = await getConversions();
      setConversions(res.data);
    } catch {
      toast.error('Failed to load conversions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  // Poll for in-progress conversions
  useEffect(() => {
    const inProgress = conversions.filter(c => c.status === 'queued' || c.status === 'processing');
    if (inProgress.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      for (const conv of inProgress) {
        try {
          const res = await getConversionStatus(conv.id);
          if (res.data.status !== conv.status) {
            updated = true;
            if (res.data.status === 'completed') {
              toast.success(`Conversion complete: ${conv.original_file_name}`);
            } else if (res.data.status === 'failed') {
              toast.error(`Conversion failed: ${conv.original_file_name}`);
            }
          }
        } catch {}
      }
      if (updated) fetchConversions();
    }, 3000);

    return () => clearInterval(interval);
  }, [conversions, fetchConversions]);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx')) {
      toast.error('Only PDF and DOCX files are supported');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadConversion(formData);
      toast.success('Resume uploaded! Conversion in progress...');
      fetchConversions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDownload = async (conv) => {
    try {
      const res = await downloadConversion(conv.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conv.original_file_name?.replace(/\.[^.]+$/, '')}_LTM_Format.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (conv) => {
    if (!confirm(`Delete conversion for "${conv.original_file_name}"?`)) return;
    try {
      await deleteConversion(conv.id);
      toast.success('Deleted');
      fetchConversions();
    } catch {
      toast.error('Delete failed');
    }
  };

  const statusBadge = (status) => {
    const styles = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      queued: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.queued}`}>
        {status === 'processing' && <Loader2 size={10} className="inline mr-1 animate-spin" />}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Resume Conversion</h1>
        <p className="text-muted text-sm mt-1">Convert any resume to LTM standardized format</p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
          ${dragActive ? 'border-coral bg-coral/5' : 'border-dark-600 hover:border-coral/50'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.docx';
          input.onchange = (e) => handleUpload(e.target.files);
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-coral animate-spin" />
            <p className="text-muted text-sm">Uploading and processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload size={40} className="text-muted" />
            <p className="text-white font-medium">Drop a resume here or click to upload</p>
            <p className="text-muted text-xs">Supports PDF, DOCX • Max 10MB</p>
          </div>
        )}
      </div>

      {/* Conversion History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Conversion History</h2>
          <button onClick={fetchConversions} className="text-muted hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="text-coral animate-spin" />
          </div>
        ) : conversions.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <FileText size={40} className="mx-auto mb-2 opacity-40" />
            <p>No conversions yet. Upload a resume to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversions.map((conv) => (
              <div
                key={conv.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between hover:border-dark-500 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={20} className="text-coral shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{conv.original_file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {statusBadge(conv.status)}
                      {conv.personal_name && conv.personal_name !== 'NDATA' && (
                        <span className="text-muted text-xs">{conv.personal_name}</span>
                      )}
                      <span className="text-muted/50 text-xs">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {conv.status === 'completed' && (
                    <>
                      <button
                        onClick={() => navigate(`/convert/${conv.id}`)}
                        className="p-2 rounded-lg text-muted hover:text-white hover:bg-dark-700 transition-colors"
                        title="Preview & Edit"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDownload(conv)}
                        className="p-2 rounded-lg text-muted hover:text-green-400 hover:bg-dark-700 transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(conv)}
                    className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-dark-700 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
