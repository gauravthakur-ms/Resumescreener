import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  Eye,
  BarChart3,
  Trash2,
  FileText,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
  ArrowDownToLine,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Card, Badge, Button, Modal, ProgressBar, Skeleton, EmptyState } from '../components/UI';
import { getJDs, getBatches, getCandidatesByJd, deleteCandidate, deleteBatch, getBatchStatus, getJdExport, downloadResume } from '../services/api';
import toast from 'react-hot-toast';

export default function ScreenedResumes() {
  const navigate = useNavigate();
  const [jdRows, setJdRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  // Modals
  const [statusModal, setStatusModal] = useState(null); // { jd, batches }
  const [profilesModal, setProfilesModal] = useState(null); // { jd, candidates, loading }
  const [deleteTarget, setDeleteTarget] = useState(null); // jd row to delete
  const [deleting, setDeleting] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState(null);
  const [exportingJdId, setExportingJdId] = useState(null);
  const [downloadingCandidateId, setDownloadingCandidateId] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [jdsRes, batchesRes] = await Promise.all([getJDs(), getBatches()]);
      const jds = jdsRes.data || [];
      const batches = Array.isArray(batchesRes.data) ? batchesRes.data : [];

      // Group batches by jd_id
      const batchMap = {};
      batches.forEach((b) => {
        if (!b.jd_id) return;
        if (!batchMap[b.jd_id]) batchMap[b.jd_id] = [];
        batchMap[b.jd_id].push(b);
      });

      // Build rows only for JDs that have batches
      const rows = jds
        .filter((jd) => batchMap[jd.id])
        .map((jd) => {
          const jdBatches = batchMap[jd.id] || [];
          const totalResumes = jdBatches.reduce((s, b) => s + (b.total || 0), 0);
          const processed = jdBatches.reduce((s, b) => s + (b.processed || 0), 0);
          const allCompleted = jdBatches.every((b) => b.status === 'completed');
          return {
            jd,
            batches: jdBatches,
            totalResumes,
            processed,
            batchCount: jdBatches.length,
            status: allCompleted ? 'completed' : 'processing',
          };
        })
        .sort((a, b) => b.totalResumes - a.totalResumes);

      setJdRows(rows);
    } catch {
      toast.error('Failed to load screened resumes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Status modal — aggregated across all batches for this JD
  const openStatus = async (row) => {
    setStatusModal({ jd: row.jd, loading: true, total: 0, processed: 0, duplicates: 0, failed: 0, status: row.status, progress_pct: 0 });
    try {
      const detailed = await Promise.all(
        row.batches.map((b) => getBatchStatus(b.batch_id || b.id).then((r) => r.data).catch(() => b))
      );
      const total = detailed.reduce((s, b) => s + (b.total || 0), 0);
      const processed = detailed.reduce((s, b) => s + (b.processed || 0), 0);
      const duplicates = detailed.reduce((s, b) => s + (b.duplicates || 0), 0);
      const failed = detailed.reduce((s, b) => s + (b.failed || 0), 0);
      const allCompleted = detailed.every((b) => b.status === 'completed');
      const progress_pct = total > 0 ? ((processed / total) * 100) : 0;
      setStatusModal({
        jd: row.jd,
        loading: false,
        total,
        processed,
        duplicates,
        failed,
        status: allCompleted ? 'completed' : 'processing',
        progress_pct,
      });
    } catch {
      setStatusModal((prev) => prev ? { ...prev, loading: false } : null);
    }
  };

  // Profiles modal
  const openProfiles = async (row) => {
    setSelectedCandidateIds(new Set());
    setProfilesModal({ jd: row.jd, candidates: [], loading: true });
    try {
      const res = await getCandidatesByJd(row.jd.id);
      setProfilesModal({ jd: row.jd, candidates: res.data?.candidates || [], loading: false });
    } catch {
      toast.error('Failed to load candidates');
      setProfilesModal(null);
    }
  };

  const closeProfiles = () => {
    setProfilesModal(null);
    setSelectedCandidateIds(new Set());
  };

  const toggleCandidateSelection = (id) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!profilesModal) return;
    const all = profilesModal.candidates.map((c) => c.id);
    if (selectedCandidateIds.size === all.length && all.length > 0) {
      setSelectedCandidateIds(new Set());
    } else {
      setSelectedCandidateIds(new Set(all));
    }
  };

  const handleBulkDownload = async () => {
    if (!profilesModal || selectedCandidateIds.size === 0) return;
    setBulkActionLoading(true);
    const targets = profilesModal.candidates.filter((c) => selectedCandidateIds.has(c.id));
    let successCount = 0;
    for (const c of targets) {
      try {
        const res = await downloadResume(c.id, profilesModal.jd.id);
        const filename = c.file_name || `resume_${c.id}.pdf`;
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        successCount++;
      } catch {
        // Continue with remaining
      }
    }
    setBulkActionLoading(false);
    if (successCount === targets.length) {
      toast.success(`Downloaded ${successCount} resume(s)`);
    } else {
      toast.error(`Downloaded ${successCount} of ${targets.length} resumes`);
    }
  };

  const handleBulkDelete = async () => {
    if (!profilesModal || selectedCandidateIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedCandidateIds);
    const results = await Promise.allSettled(
      ids.map((id) => deleteCandidate(id, profilesModal.jd.id))
    );
    const successIds = ids.filter((_, i) => results[i].status === 'fulfilled');
    setProfilesModal((prev) => prev ? {
      ...prev,
      candidates: prev.candidates.filter((c) => !successIds.includes(c.id)),
    } : null);
    setSelectedCandidateIds(new Set());
    setBulkDeleteConfirm(false);
    setBulkActionLoading(false);
    if (successIds.length === ids.length) {
      toast.success(`Deleted ${successIds.length} candidate(s)`);
    } else {
      toast.error(`Deleted ${successIds.length} of ${ids.length} candidates`);
    }
  };

  // Delete all batches for a JD
  const handleDeleteAll = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await Promise.all(
        deleteTarget.batches.map((b) => deleteBatch(b.batch_id || b.id))
      );
      toast.success(`Deleted ${deleteTarget.batches.length} batch(es)`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete batches');
    } finally {
      setDeleting(false);
    }
  };

  // Delete single candidate
  const handleDeleteCandidate = async (candidateId, jdId) => {
    setDeletingCandidate(candidateId);
    try {
      await deleteCandidate(candidateId, jdId);
      setProfilesModal((prev) => prev ? {
        ...prev,
        candidates: prev.candidates.filter((c) => c.id !== candidateId),
      } : null);
      toast.success('Candidate removed');
    } catch {
      toast.error('Failed to delete candidate');
    } finally {
      setDeletingCandidate(null);
    }
  };

  // Download resume for a candidate
  const handleDownloadResume = async (candidate, jdId) => {
    setDownloadingCandidateId(candidate.id);
    try {
      const res = await downloadResume(candidate.id, jdId);
      const filename = candidate.file_name || `resume_${candidate.id}.pdf`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download resume');
    } finally {
      setDownloadingCandidateId(null);
    }
  };

  const getStatusVariant = (status) => status === 'completed' ? 'completed' : 'processing';

  const getRecommendationVariant = (rec) => {
    if (!rec) return 'default';
    const r = rec.toLowerCase();
    if (r.includes('strong') || r === 'hire' || r === 'select' || r === 'selected') return 'select';
    if (r === 'consider' || r.includes('review')) return 'review';
    return 'reject';
  };

  // Navigate to JD-specific results page
  const goToResults = (row) => {
    navigate(`/screened/${row.jd.id}/results`);
  };

  // Export Excel for a JD
  const handleExportJd = async (row) => {
    setExportingJdId(row.jd.id);
    try {
      const candidatesRes = await getCandidatesByJd(row.jd.id);
      const candidates = candidatesRes.data?.candidates || [];
      if (!candidates.length) {
        toast.error('No candidates to export');
        return;
      }
      const res = await getJdExport(row.jd.id, candidates);
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `jd_export_${row.jd.title?.replace(/\s+/g, '_') || row.jd.id}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingJdId(null);
    }
  };

  const totalPages = Math.ceil(jdRows.length / PAGE_SIZE);
  const paginated = jdRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Screened Resumes</h1>
          <p className="text-muted mt-1">View screening results grouped by Job Description</p>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Screened Resumes</h1>
          <p className="text-muted mt-1">View screening results grouped by Job Description</p>
        </div>
        <Button onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {jdRows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No Screened Resumes"
          description="Upload resumes against a Job Description to see screening results here."
        />
      ) : (
        <>
          {/* Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-left">
                    <th className="pb-3 text-muted font-medium">Job Description</th>
                    <th className="pb-3 text-muted font-medium text-center">Resumes</th>
                    <th className="pb-3 text-muted font-medium text-center">Status</th>
                    <th className="pb-3 text-muted font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {paginated.map((row) => (
                    <tr key={row.jd.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-white">{row.jd.title || 'Untitled JD'}</div>
                        <div className="text-muted text-xs mt-0.5">
                          {row.batchCount} batch{row.batchCount > 1 ? 'es' : ''} · Uploaded {formatDate(row.batches[0]?.uploaded_at)}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-white font-semibold">{row.processed}</span>
                        <span className="text-muted">/{row.totalResumes}</span>
                      </td>
                      <td className="py-4 text-center">
                        <Badge variant={getStatusVariant(row.status)}>
                          {row.status === 'completed' ? 'Completed' : 'Processing'}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openStatus(row)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-muted hover:text-white rounded-md transition-colors"
                          >
                            <Eye size={12} /> Status
                          </button>
                          <button
                            onClick={() => goToResults(row)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-coral/10 hover:bg-coral/20 text-coral rounded-md transition-colors"
                          >
                            <BarChart3 size={12} /> Results
                          </button>
                          <button
                            onClick={() => openProfiles(row)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-muted hover:text-blue-400 rounded-md transition-colors"
                          >
                            <Users size={12} /> Profiles
                          </button>
                          <button
                            onClick={() => handleExportJd(row)}
                            disabled={exportingJdId === row.jd.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-muted hover:text-green-400 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Download size={12} /> {exportingJdId === row.jd.id ? 'Exporting...' : 'Export'}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="flex items-center justify-center w-7 h-7 bg-dark-700 hover:bg-red-500/10 text-muted hover:text-red-400 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-muted text-sm">{jdRows.length} JD(s) with screened resumes</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg hover:bg-dark-600 text-muted hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg hover:bg-dark-600 text-muted hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Status Modal */}
      <Modal isOpen={!!statusModal} onClose={() => setStatusModal(null)} title="Screening Status" wide>
        {statusModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-white font-medium text-lg">{statusModal.jd.title}</p>
              <Badge variant={getStatusVariant(statusModal.status)}>
                {statusModal.status === 'completed' ? 'COMPLETED' : 'PROCESSING'}
              </Badge>
            </div>
            {statusModal.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <>
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">Progress</span>
                    <span className="text-white font-medium">
                      {statusModal.progress_pct?.toFixed(0) || 0}%
                    </span>
                  </div>
                  <ProgressBar value={statusModal.progress_pct || 0} />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-white">{statusModal.total}</p>
                    <p className="text-xs text-muted mt-1">Total</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{statusModal.processed}</p>
                    <p className="text-xs text-muted mt-1">Processed</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{statusModal.failed}</p>
                    <p className="text-xs text-muted mt-1">Failed</p>
                  </div>
                  <div className="bg-dark-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{statusModal.duplicates}</p>
                    <p className="text-xs text-muted mt-1">Duplicates</p>
                  </div>
                </div>

                {/* View Results Button */}
                {statusModal.status === 'completed' && (
                  <div className="pt-2">
                    <Button onClick={() => { setStatusModal(null); navigate(`/screened/${statusModal.jd.id}/results`); }}>
                      View Results →
                    </Button>
                  </div>
                )}
                {statusModal.status === 'processing' && (
                  <p className="text-sm text-muted flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    Processing in progress...
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Profiles Modal */}
      <Modal isOpen={!!profilesModal} onClose={closeProfiles} title="Screened Profiles" wide>
        {profilesModal && (
          <div className="space-y-3">
            {/* Header */}
            <div className="sticky top-0 z-10 pb-3 border-b border-dark-600/60">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{profilesModal.jd.title}</h3>
                  <p className="text-muted text-xs mt-0.5">
                    {profilesModal.candidates.length} candidate{profilesModal.candidates.length !== 1 ? 's' : ''} screened
                  </p>
                </div>
                {profilesModal.candidates.length > 0 && !profilesModal.loading && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700/60 hover:bg-dark-600 text-muted hover:text-white text-xs font-medium transition-all border border-dark-600/80"
                  >
                    {selectedCandidateIds.size === profilesModal.candidates.length && profilesModal.candidates.length > 0 ? (
                      <CheckSquare size={13} className="text-coral" />
                    ) : (
                      <Square size={13} />
                    )}
                    Select All
                  </button>
                )}
              </div>

              {/* Bulk Action Bar — inline under header */}
              {selectedCandidateIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-dark-600/40">
                  <span className="text-muted text-xs">
                    <span className="text-white font-medium">{selectedCandidateIds.size}</span> selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkDownload}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-700 hover:bg-dark-600 text-muted hover:text-green-400 text-xs font-medium transition-all border border-dark-600/80 disabled:opacity-40"
                    >
                      <ArrowDownToLine size={12} /> Download
                    </button>
                    <button
                      onClick={() => setBulkDeleteConfirm(true)}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-700 hover:bg-dark-600 text-muted hover:text-red-400 text-xs font-medium transition-all border border-dark-600/80 disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    <button
                      onClick={() => setSelectedCandidateIds(new Set())}
                      disabled={bulkActionLoading}
                      className="px-2.5 py-1 rounded-md text-muted hover:text-white text-xs transition-all disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {profilesModal.loading ? (
              <div className="space-y-3 pt-1">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : profilesModal.candidates.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center">No candidates found.</p>
            ) : (
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                {profilesModal.candidates.map((c) => {
                  const isSelected = selectedCandidateIds.has(c.id);
                  const score = c.scoring?.match_score ?? 0;
                  const scoreColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
                  const barColor = score >= 70 ? 'bg-green-500/80' : score >= 50 ? 'bg-yellow-500/80' : 'bg-red-500/80';
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleCandidateSelection(c.id)}
                      className={`group flex items-center gap-3 rounded-lg px-3.5 py-3 cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-dark-700/90 border-dark-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
                          : 'bg-dark-800/40 border-transparent hover:bg-dark-700/60 hover:border-dark-600'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="shrink-0">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-coral" />
                        ) : (
                          <Square size={16} className="text-dark-500 group-hover:text-muted transition-colors" />
                        )}
                      </div>

                      {/* Candidate Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate leading-tight">
                          {(() => {
                            const n = c.personal?.name || c.candidate_name;
                            return n && n !== 'NDATA' ? n : 'Unknown Candidate';
                          })()}
                        </p>
                        <p className="text-muted/70 text-[11px] font-mono truncate mt-0.5">{c.file_name || '—'}</p>
                        {(() => {
                          const e = c.personal?.email || c.candidate_email;
                          return e && e !== 'NDATA' ? (
                            <p className="text-muted text-[11px] truncate">{e}</p>
                          ) : null;
                        })()}
                      </div>

                      {/* Score */}
                      <div className="hidden sm:flex flex-col items-end shrink-0 w-16">
                        <span className={`text-xs font-bold font-mono ${scoreColor}`}>{score}%</span>
                        <div className="w-full h-1 bg-dark-600 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all`}
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                      </div>

                      {/* Badge */}
                      <div className="shrink-0">
                        <Badge variant={getRecommendationVariant(c.recommendation)}>
                          {c.recommendation || '—'}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadResume(c, profilesModal.jd.id); }}
                          disabled={downloadingCandidateId === c.id}
                          className="p-1.5 rounded-md hover:bg-dark-600 text-muted hover:text-green-400 transition-colors disabled:opacity-30"
                          title="Download resume"
                        >
                          <ArrowDownToLine size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCandidate(c.id, profilesModal.jd.id); }}
                          disabled={deletingCandidate === c.id}
                          className="p-1.5 rounded-md hover:bg-dark-600 text-muted hover:text-red-400 transition-colors disabled:opacity-30"
                          title="Remove candidate"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Bulk Delete Confirmation */}
      <Modal isOpen={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} title="Delete Selected Profiles">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete <span className="text-white font-medium">{selectedCandidateIds.size} selected profile{selectedCandidateIds.size !== 1 ? 's' : ''}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setBulkDeleteConfirm(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 !bg-red-500/20 !text-red-400 hover:!bg-red-500/30"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Screening Data">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-muted text-sm">
              This will delete <span className="text-white font-medium">{deleteTarget.batches.length} batch(es)</span> and
              all associated data for <span className="text-white font-medium">{deleteTarget.jd.title}</span>.
            </p>
            <p className="text-red-400 text-xs">This action cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
