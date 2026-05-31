import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileCheck, AlertCircle, X, CheckCircle, Clock, Copy, Loader } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Card, Button, Badge, Modal, ProgressBar } from '../components/UI';
import BatchIdDisplay from '../components/BatchIdDisplay';
import { getJDs, uploadResumes, getBatchStatus } from '../services/api';
import toast from 'react-hot-toast';

export default function ResumeUpload() {
  const navigate = useNavigate();
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  // Progress modal state
  const [showProgress, setShowProgress] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    getJDs()
      .then((res) => setJds(Array.isArray(res.data) ? res.data : []))
      .catch(() => toast.error('Failed to load job descriptions'));
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = (batchId, uploadResult) => {
    // Initialize progress with upload result
    setProgressData({
      batch_id: batchId,
      total: uploadResult.total_uploaded,
      queued: uploadResult.queued_for_processing,
      duplicates: uploadResult.duplicates_skipped || 0,
      processed: 0,
      failed: 0,
      pending: uploadResult.queued_for_processing,
      progress_pct: 0,
      status: 'queued',
    });
    setShowProgress(true);

    // If nothing queued (all duplicates), mark as done immediately
    if (uploadResult.queued_for_processing === 0) {
      setProgressData((prev) => ({ ...prev, status: 'completed', progress_pct: 100 }));
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await getBatchStatus(batchId);
        const d = res.data;
        setProgressData((prev) => ({
          ...prev,
          processed: d.processed,
          failed: d.failed,
          pending: d.pending,
          progress_pct: d.progress_pct,
          status: d.status,
        }));

        if (d.status === 'completed' || d.status === 'failed' || d.pending === 0) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // Silently retry on next interval
      }
    }, 2500);
  };

  const closeProgress = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setShowProgress(false);
    setProgressData(null);
  };

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    if (rejectedFiles.length > 0) {
      toast.error(`${rejectedFiles.length} file(s) rejected (must be PDF/DOCX, max 10MB)`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedJd) {
      toast.error('Please select a Job Description');
      return;
    }
    if (files.length === 0) {
      toast.error('Please add at least one resume');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const res = await uploadResumes(selectedJd, formData);
      setResult(res.data);
      setFiles([]);
      // Open progress modal and start polling
      startPolling(res.data.batch_id, res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Upload Resumes</h1>
        <p className="text-muted mt-1">Bulk upload resumes to screen against a job description</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* JD Selector */}
          <Card>
            <label className="text-sm font-medium text-white block mb-2">
              Select Job Description
            </label>
            <select
              value={selectedJd}
              onChange={(e) => setSelectedJd(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral appearance-none"
            >
              <option value="">Choose a JD...</option>
              {jds.map((jd) => (
                <option key={jd.id} value={jd.id}>
                  {jd.title} ({jd.domain})
                </option>
              ))}
            </select>
          </Card>

          {/* Dropzone */}
          <Card>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-coral bg-coral/5'
                  : 'border-dark-600 hover:border-coral/40'
              }`}
            >
              <input {...getInputProps()} />
              <Upload
                size={40}
                className={`mx-auto mb-3 ${isDragActive ? 'text-coral' : 'text-muted'}`}
              />
              <p className="text-white font-medium">
                {isDragActive ? 'Drop files here' : 'Drag & drop resumes here'}
              </p>
              <p className="text-muted text-sm mt-1">
                or click to browse • PDF, DOCX • Max 10MB each
              </p>
            </div>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">
                  Files ({files.length})
                </h3>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-muted hover:text-red-400"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 bg-dark-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck size={16} className="text-green-400" />
                      <span className="text-sm text-white truncate max-w-[300px]">
                        {f.name}
                      </span>
                      <span className="text-xs text-muted">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || !selectedJd}
            className="w-full justify-center py-3"
          >
            {uploading ? (
              'Uploading & Processing...'
            ) : (
              <>
                <Upload size={16} /> Upload {files.length} Resume{files.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          {result ? (
            <Card>
              <h3 className="text-base font-semibold text-white mb-4">
                Upload Complete
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-muted text-sm mb-2">Batch ID</p>
                  <BatchIdDisplay batchId={result.batch_id} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total Uploaded</span>
                  <span className="text-white">{result.total_uploaded}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Queued</span>
                  <Badge variant="processing">{result.queued_for_processing}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Duplicates Skipped</span>
                  <span className="text-yellow-400">{result.duplicates_skipped || 0}</span>
                </div>
                <hr className="border-dark-600" />
                <Button
                  className="w-full justify-center"
                  onClick={() => navigate(`/batches/${result.batch_id}/results`)}
                >
                  View Results →
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => navigate('/batches')}
                >
                  All Batches
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">
                Instructions
              </h3>
              <div className="space-y-3 text-sm text-muted">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
                  <p>Select a JD first resumes will be screened against its criteria</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
                  <p>Supported: PDF and DOCX only, max 10MB per file</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
                  <p>Duplicates are automatically detected and skipped</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
                  <p>Processing is async check batch status for progress</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Processing Progress Modal */}
      <Modal
        isOpen={showProgress}
        onClose={closeProgress}
        title="Resume Processing"
      >
        {progressData && (
          <div className="space-y-5">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-dark-700 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{progressData.total}</p>
                <p className="text-xs text-muted">Total Uploaded</p>
              </div>
              <div className="bg-dark-700 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{progressData.queued}</p>
                <p className="text-xs text-muted">Queued</p>
              </div>
              <div className="bg-dark-700 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">{progressData.duplicates}</p>
                <p className="text-xs text-muted">Duplicates Skipped</p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-medium">Processing Status</p>
                <Badge variant={progressData.status === 'completed' ? 'completed' : 'processing'}>
                  {progressData.status === 'completed' ? 'Completed' : progressData.status === 'failed' ? 'Failed' : 'Processing'}
                </Badge>
              </div>

              <ProgressBar value={progressData.progress_pct} />

              <div className="flex items-center justify-between text-sm">
                {progressData.status === 'completed' || progressData.pending === 0 ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={16} />
                    <span>All {progressData.queued} resume(s) processed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-coral">
                    <Loader size={16} className="animate-spin" />
                    <span>Processing {progressData.processed + 1}/{progressData.queued}</span>
                  </div>
                )}
                <span className="text-muted">{progressData.progress_pct}%</span>
              </div>

              {/* Processed / Failed breakdown */}
              {(progressData.processed > 0 || progressData.failed > 0) && (
                <div className="flex gap-4 text-xs">
                  <span className="text-green-400">{progressData.processed} processed</span>
                  {progressData.failed > 0 && (
                    <span className="text-red-400">{progressData.failed} failed</span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-dark-600">
              {progressData.status === 'completed' || progressData.pending === 0 ? (
                <>
                  <Button
                    variant="secondary"
                    className="flex-1 justify-center"
                    onClick={closeProgress}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 justify-center"
                    onClick={() => {
                      closeProgress();
                      navigate(`/batches/${progressData.batch_id}/results`);
                    }}
                  >
                    View Results →
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={closeProgress}
                >
                  Close (processing continues in background)
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
