import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Search, RefreshCw, CheckCircle, Eye, BarChart3, Copy, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Badge, Button, ProgressBar, Skeleton, Modal } from '../components/UI';
import BatchIdDisplay from '../components/BatchIdDisplay';
import { getBatchStatus, getBatches, getJDById, deleteBatch } from '../services/api';
import toast from 'react-hot-toast';

export default function Batches() {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Recent batches state
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const PAGE_SIZE = 10;

  const copyBatchId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchBatch = async (id) => {
    const searchId = id || batchId.trim();
    if (!searchId) {
      toast.error('Enter a batch ID');
      return;
    }
    setBatchId(searchId);
    setLoading(true);
    try {
      const res = await getBatchStatus(searchId);
      setBatch(res.data);
    } catch {
      toast.error('Batch not found');
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setBatchesLoading(true);
    setBatchesError(false);
    try {
      const res = await getBatches();
      let list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      setBatches(list);

      // Fetch JD titles in parallel for batches missing them
      const enriched = await Promise.all(
        list.map(async (batch) => {
          if (batch.jd_title) return batch;
          if (!batch.jd_id || batch.jd_id === 'unknown') return { ...batch, jd_title: 'N/A' };
          try {
            const jdRes = await getJDById(batch.jd_id);
            return { ...batch, jd_title: jdRes.data?.title || 'N/A' };
          } catch {
            return { ...batch, jd_title: 'N/A' };
          }
        })
      );
      setBatches(enriched);
    } catch {
      setBatchesError(true);
    } finally {
      setBatchesLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBatches(); }, []);

  const handleViewStatus = (id) => {
    setBatchId(id);
    fetchBatch(id);
    searchRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStatusVariant = (status) => {
    const map = { queued: 'queued', processing: 'processing', completed: 'completed', failed: 'failed' };
    return map[status] || 'default';
  };

  const handleDeleteBatch = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBatch(deleteTarget.id);
      toast.success('Batch deleted');
      setDeleteTarget(null);
      fetchBatches();
    } catch {
      toast.error('Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(batches.length / PAGE_SIZE);
  const paginatedBatches = batches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div ref={searchRef}>
        <h1 className="text-3xl font-bold text-white">Batch Monitor</h1>
        <p className="text-muted mt-1">Track the processing status of your resume batches</p>
      </div>

      {/* Search */}
      <Card>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter Batch ID..."
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchBatch()}
            className="flex-1 px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm font-mono placeholder:text-muted placeholder:font-sans focus:outline-none focus:border-coral"
          />
          <Button onClick={() => fetchBatch()} disabled={loading}>
            <Search size={16} /> {loading ? 'Loading...' : 'Check Status'}
          </Button>
        </div>
      </Card>

      {/* Batch Detail */}
      {batch && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Batch Status</h3>
              <div className="mt-2">
                <BatchIdDisplay batchId={batch.batch_id} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={getStatusVariant(batch.status)}>
                {batch.status?.toUpperCase()}
              </Badge>
              <button
                onClick={() => fetchBatch()}
                className="text-muted hover:text-coral transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">Progress</span>
              <span className="text-white font-medium">
                {batch.progress_pct?.toFixed(0) || 0}%
              </span>
            </div>
            <ProgressBar value={batch.progress_pct || 0} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{batch.total || 0}</p>
              <p className="text-xs text-muted mt-1">Total</p>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{batch.processed || 0}</p>
              <p className="text-xs text-muted mt-1">Processed</p>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{batch.failed || 0}</p>
              <p className="text-xs text-muted mt-1">Failed</p>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{batch.duplicates || 0}</p>
              <p className="text-xs text-muted mt-1">Duplicates</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            {batch.status === 'completed' && (
              <Button onClick={() => navigate(`/batches/${batch.batch_id}/results`)}>
                View Results →
              </Button>
            )}
            {batch.status === 'processing' && (
              <p className="text-sm text-muted flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                Processing in progress... refresh to check status
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Recent Batches List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Batches</h3>
          <button
            onClick={() => fetchBatches(true)}
            className={`flex items-center gap-1.5 text-sm text-muted hover:text-coral transition-colors ${refreshing ? 'pointer-events-none' : ''}`}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {batchesLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : batchesError ? (
          <div className="text-center py-8">
            <p className="text-muted text-sm">Could not load batch history. Click Refresh to try again.</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted text-sm">No batches submitted yet. Upload resumes to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="pb-3 text-muted font-medium">JD Title</th>
                  <th className="pb-3 text-muted font-medium">Resumes</th>
                  <th className="pb-3 text-muted font-medium">Uploaded At</th>
                  <th className="pb-3 text-muted font-medium">Progress</th>
                  <th className="pb-3 text-muted font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {paginatedBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-dark-700/50">
                    <td className="py-3 pr-3">
                      <span className="text-white block max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" title={b.jd_title || ''}>
                        {b.jd_title || '...'}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-white">{b.total ? b.total : '—'}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-muted whitespace-nowrap">{formatDate(b.uploaded_at)}</span>
                    </td>
                    <td className="py-3 pr-3 min-w-[140px]">
                      {b.status === 'completed' ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle size={14} /> Complete
                        </span>
                      ) : (
                        <div>
                          <div className="flex justify-between text-xs text-muted mb-1">
                            <span>{b.processed || 0} / {b.total || 0}</span>
                          </div>
                          <ProgressBar value={b.processed || 0} max={b.total || 1} />
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyBatchId(b.id)}
                          className="flex items-center justify-center w-7 h-7 bg-dark-700 hover:bg-dark-600 text-muted hover:text-white rounded-md transition-colors"
                          title="Copy Batch ID"
                        >
                          {copiedId === b.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => handleViewStatus(b.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-muted hover:text-white rounded-md transition-colors"
                          title="View Status"
                        >
                          <Eye size={12} /> Status
                        </button>
                        <button
                          onClick={() => navigate(`/batches/${b.id}/results`)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-coral/10 hover:bg-coral/20 text-coral rounded-md transition-colors"
                          title="View Results"
                        >
                          <BarChart3 size={12} /> Results
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="flex items-center justify-center w-7 h-7 bg-dark-700 hover:bg-red-500/10 text-muted hover:text-red-400 rounded-md transition-colors"
                          title="Delete Batch"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-dark-600 mt-4">
                <p className="text-xs text-muted">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, batches.length)} of {batches.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md text-muted hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-coral text-white'
                          : 'text-muted hover:text-white hover:bg-dark-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md text-muted hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Batch"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete this batch? This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 !bg-red-500/20 !text-red-400 hover:!bg-red-500/30"
              onClick={handleDeleteBatch}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
