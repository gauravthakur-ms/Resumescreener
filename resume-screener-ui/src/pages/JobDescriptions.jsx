import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar, Briefcase, Trash2, Pencil, Save, X, Type, List, BarChart3 } from 'lucide-react';
import { Card, Button, Badge, Modal, EmptyState, Skeleton } from '../components/UI';
import { getJDs, getJDById, uploadJD, uploadJDText, deleteJD, updateJD, updateJDText } from '../services/api';
import toast from 'react-hot-toast';

export default function JobDescriptions() {
  const navigate = useNavigate();
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'text'
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedJd, setSelectedJd] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editMode, setEditMode] = useState('form'); // 'form' | 'text'
  const [textContent, setTextContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [projectIdError, setProjectIdError] = useState('');

  const fetchJDs = async () => {
    try {
      const res = await getJDs();
      setJds(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load job descriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJDs(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJD(deleteTarget.id);
      toast.success('Job description deleted');
      setDeleteTarget(null);
      fetchJDs();
    } catch {
      toast.error('Failed to delete job description');
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = async (jd) => {
    setSelectedJd(jd);
    setEditing(false);
    setLoadingDetail(true);
    try {
      const res = await getJDById(jd.id);
      setSelectedJd(res.data);
    } catch {
      // Keep the summary data if full fetch fails
    } finally {
      setLoadingDetail(false);
    }
  };

  const startEditing = () => {
    setEditData({
      title: selectedJd.title || '',
      project_id: selectedJd.project_id || '',
      domain: selectedJd.domain || '',
      min_experience_years: selectedJd.min_experience_years || 0,
      skills: {
        primary: (selectedJd.skills?.primary || []).join(', '),
        secondary: (selectedJd.skills?.secondary || []).join(', '),
      },
      certifications_preferred: (selectedJd.certifications_preferred || []).join(', '),
      scoring_weights: { ...(selectedJd.scoring_weights || {}) },
      thresholds: { ...(selectedJd.thresholds || {}) },
    });
    // Prepare text content for text mode
    const jdText = selectedJd.raw_text || generateTextFromJd(selectedJd);
    setTextContent(jdText);
    setEditMode('text');
    setEditing(true);
  };

  const generateTextFromJd = (jd) => {
    const lines = [];
    lines.push(`Title: ${jd.title || 'Untitled'}`);
    lines.push(`Domain: ${jd.domain || 'General'}`);
    lines.push(`Minimum Experience: ${jd.min_experience_years || 0}+ years`);
    lines.push('');
    if (jd.skills?.primary?.length) {
      lines.push(`Primary Skills: ${jd.skills.primary.join(', ')}`);
    }
    if (jd.skills?.secondary?.length) {
      lines.push(`Secondary Skills: ${jd.skills.secondary.join(', ')}`);
    }
    if (jd.certifications_preferred?.length) {
      lines.push('');
      lines.push(`Certifications Preferred: ${jd.certifications_preferred.join(', ')}`);
    }
    return lines.join('\n');
  };

  const handleSaveText = async () => {
    if (!textContent.trim()) {
      toast.error('Text content cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await updateJDText(selectedJd.id, textContent);
      setSelectedJd(res.data);
      setEditing(false);
      toast.success('Job description updated (re-parsed from text)');
      fetchJDs();
    } catch {
      toast.error('Failed to update job description');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editData.project_id?.trim()) {
      toast.error('Project ID is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editData.title,
        project_id: editData.project_id.trim(),
        domain: editData.domain,
        min_experience_years: parseFloat(editData.min_experience_years) || 0,
        skills: {
          primary: editData.skills.primary.split(',').map(s => s.trim()).filter(Boolean),
          secondary: editData.skills.secondary.split(',').map(s => s.trim()).filter(Boolean),
        },
        certifications_preferred: editData.certifications_preferred.split(',').map(s => s.trim()).filter(Boolean),
        scoring_weights: editData.scoring_weights,
        thresholds: {
          selected: parseInt(editData.thresholds.selected) || 70,
          need_review: parseInt(editData.thresholds.need_review) || 50,
        },
      };
      const res = await updateJD(selectedJd.id, payload);
      setSelectedJd(res.data);
      setEditing(false);
      toast.success('Job description updated');
      fetchJDs();
    } catch {
      toast.error('Failed to update job description');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!projectId.trim()) {
      setProjectIdError('Project ID is required');
      return;
    }
    setUploading(true);
    try {
      if (uploadMode === 'file' && file) {
        const formData = new FormData();
        formData.append('jd_file', file);
        formData.append('project_id', projectId.trim());
        await uploadJD(formData);
      } else if (uploadMode === 'text' && text.trim()) {
        await uploadJDText(text, title, projectId.trim());
      } else {
        toast.error('Please provide a file or text');
        setUploading(false);
        return;
      }
      toast.success('Job description uploaded successfully!');
      setShowModal(false);
      setFile(null);
      setText('');
      setTitle('');
      setProjectId('');
      setProjectIdError('');
      fetchJDs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Job Descriptions</h1>
          <p className="text-muted mt-1">Manage your job requirements for resume screening</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Upload JD
        </Button>
      </div>

      {/* JD List */}
      {jds.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Job Descriptions"
          description="Upload your first job description to start screening resumes against it."
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} /> Upload JD
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jds.map((jd) => (
            <Card
              key={jd.id}
              className="cursor-pointer hover:border-coral/40 transition-colors !p-4 flex flex-col"
              onClick={() => openDetail(jd)}
            >
              {/* Card Content */}
              <div className="flex-1">
                {/* Line 1 — Icon + Job ID + Delete */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-coral/10 flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-coral" />
                  </div>
                  <span className="text-[13px] font-semibold font-mono text-coral flex-1 min-w-0 truncate">
                    {jd.project_id || '—'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="default">{jd.domain || 'General'}</Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(jd); }}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Line 2 — Job Role */}
                <h3 className="text-[15px] font-bold text-white truncate mb-1.5">
                  {jd.title}
                </h3>

                {/* Line 3 — Experience Required */}
                <p className="text-[13px] text-white truncate mb-1.5">
                  {jd.min_experience_years || 0}+ yrs exp
                </p>

                {/* Line 4 — Date Posted */}
                <div className="flex items-center gap-1 text-xs text-[#888] mb-2.5">
                  <Calendar size={12} />
                  {formatDate(jd.uploaded_at)}
                </div>

                {/* Line 5 — Skills Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {(jd.skills?.primary || []).slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 text-xs bg-coral/10 text-coral rounded-md"
                    >
                      {skill}
                    </span>
                  ))}
                  {(jd.skills?.primary?.length || 0) > 8 && (
                    <span className="relative group">
                      <span className="px-2 py-0.5 text-xs bg-dark-700 text-muted rounded-md cursor-default">
                        +{jd.skills.primary.length - 8}
                      </span>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-700 border border-coral/40 rounded-lg shadow-xl text-xs text-white whitespace-normal max-w-[220px] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                        {jd.skills.primary.slice(8).join(', ')}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Results Button — always anchored to bottom */}
              <div className="mt-3 pt-2.5 border-t border-dark-600 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/screened/${jd.id}/results`); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-coral border border-coral/30 hover:bg-coral/10 hover:border-coral/50 rounded-md transition-all duration-200"
                >
                  <BarChart3 size={13} /> View Results
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setProjectIdError(''); }} title="Upload Job Description">
        <div className="space-y-4">
          {/* Project ID — mandatory first field */}
          <div>
            <label className="text-xs text-muted block mb-1">
              Project ID <span className="text-coral">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter Project ID (e.g. PROJ-2024-001)"
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); if (e.target.value.trim()) setProjectIdError(''); }}
              onBlur={() => { if (!projectId.trim()) setProjectIdError('Project ID is required'); }}
              className={`w-full px-3.5 py-2.5 bg-[#1a1a1a] border rounded-lg text-[#f5f5f5] text-sm placeholder:text-muted focus:outline-none focus:border-coral focus:shadow-[0_0_0_2px_rgba(255,69,68,0.15)] ${
                projectIdError ? 'border-coral bg-[rgba(255,69,68,0.05)]' : 'border-[#333]'
              }`}
            />
            {projectIdError && (
              <p className="text-coral text-xs mt-1">⚠ {projectIdError}</p>
            )}
          </div>

          {/* Toggle */}
          <div className="flex bg-dark-700 rounded-lg p-1">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'file' ? 'bg-coral text-white' : 'text-muted'
              }`}
              onClick={() => setUploadMode('file')}
            >
              Upload File
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'text' ? 'bg-coral text-white' : 'text-muted'
              }`}
              onClick={() => setUploadMode('text')}
            >
              Paste Text
            </button>
          </div>

          {uploadMode === 'file' ? (
            <div className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center hover:border-coral/40 transition-colors">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="jd-file"
              />
              <label htmlFor="jd-file" className="cursor-pointer">
                <FileText size={32} className="mx-auto text-muted mb-2" />
                <p className="text-sm text-muted">
                  {file ? file.name : 'Click to select PDF or DOCX'}
                </p>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Job Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder:text-muted focus:outline-none focus:border-coral"
              />
              <textarea
                rows={8}
                placeholder="Paste job description text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder:text-muted focus:outline-none focus:border-coral resize-none"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowModal(false); setProjectIdError(''); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              disabled={uploading || !projectId.trim()}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* JD Detail Modal */}
      <Modal
        isOpen={!!selectedJd}
        onClose={() => { setSelectedJd(null); setEditing(false); }}
        title={editing ? 'Edit Job Description' : (selectedJd?.title || 'Job Description')}
        wide
      >
        {selectedJd && !editing && (
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {loadingDetail ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* Top Info Row */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted">Domain</p>
                    <p className="text-sm text-white font-medium">{selectedJd.domain || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Project ID</p>
                    <p className="text-sm font-mono text-coral">{selectedJd.project_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Min Experience</p>
                    <p className="text-sm text-white font-medium">{selectedJd.min_experience_years || 0}+ years</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Uploaded</p>
                    <p className="text-sm text-white font-medium">{formatDate(selectedJd.uploaded_at)}</p>
                  </div>
                </div>

                {/* Two-column skills layout */}
                <div className="grid grid-cols-2 gap-5">
                  {/* Left column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted mb-2">Primary Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedJd.skills?.primary || []).map((s) => (
                          <span key={s} className="px-2 py-1 text-xs bg-coral/10 text-coral rounded-md">{s}</span>
                        ))}
                        {(selectedJd.skills?.primary || []).length === 0 && <span className="text-xs text-muted">None specified</span>}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted mb-2">Certifications Preferred</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedJd.certifications_preferred || []).map((s) => (
                          <span key={s} className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 rounded-md">{s}</span>
                        ))}
                        {(selectedJd.certifications_preferred || []).length === 0 && <span className="text-xs text-muted">None specified</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted mb-2">Secondary Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedJd.skills?.secondary || []).map((s) => (
                          <span key={s} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded-md">{s}</span>
                        ))}
                        {(selectedJd.skills?.secondary || []).length === 0 && <span className="text-xs text-muted">None specified</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom row — Scoring & Thresholds side by side */}
                <div className="grid grid-cols-2 gap-5 pt-2 border-t border-dark-600">
                  <div>
                    <p className="text-xs text-muted mb-2">Scoring Weights</p>
                    <div className="space-y-1.5">
                      {Object.entries(selectedJd.scoring_weights || {}).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span className="text-muted capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="text-white font-medium">{(v * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-2">Thresholds</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-dark-700 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-green-400">{selectedJd.thresholds?.selected || 70}%</p>
                        <p className="text-xs text-muted">Selected</p>
                      </div>
                      <div className="bg-dark-700 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-yellow-400">{selectedJd.thresholds?.need_review || 50}%</p>
                        <p className="text-xs text-muted">Needs Review</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-3 border-t border-dark-600">
              <Button variant="secondary" className="flex-1" onClick={() => setSelectedJd(null)}>
                Close
              </Button>
              <Button className="flex-1" onClick={startEditing}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
          </div>
        )}

        {selectedJd && editing && editData && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Mode Toggle */}
            <div className="flex bg-dark-700 rounded-lg p-1">
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  editMode === 'text' ? 'bg-coral text-white' : 'text-muted hover:text-white'
                }`}
                onClick={() => setEditMode('text')}
              >
                <Type size={14} /> Text Mode
              </button>
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  editMode === 'form' ? 'bg-coral text-white' : 'text-muted hover:text-white'
                }`}
                onClick={() => setEditMode('form')}
              >
                <List size={14} /> Form Mode
              </button>
            </div>

            {editMode === 'form' ? (
              <>
            <div>
              <label className="text-xs text-muted block mb-1">Project ID <span className="text-coral">*</span></label>
              <input
                type="text"
                placeholder="Enter Project ID (e.g. PROJ-2024-001)"
                value={editData.project_id}
                onChange={(e) => setEditData({ ...editData, project_id: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-coral"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Title</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Domain</label>
                <input
                  type="text"
                  value={editData.domain}
                  onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Min Experience (years)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={editData.min_experience_years}
                onChange={(e) => setEditData({ ...editData, min_experience_years: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Primary Skills <span className="text-muted">(comma-separated)</span></label>
              <textarea
                rows={2}
                value={editData.skills.primary}
                onChange={(e) => setEditData({ ...editData, skills: { ...editData.skills, primary: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Secondary Skills <span className="text-muted">(comma-separated)</span></label>
              <textarea
                rows={2}
                value={editData.skills.secondary}
                onChange={(e) => setEditData({ ...editData, skills: { ...editData.skills, secondary: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Certifications Preferred <span className="text-muted">(comma-separated)</span></label>
              <input
                type="text"
                value={editData.certifications_preferred}
                onChange={(e) => setEditData({ ...editData, certifications_preferred: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-2">Scoring Weights</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(editData.scoring_weights).map(([k, v]) => (
                  <div key={k}>
                    <label className="text-xs text-muted capitalize block mb-1">{k.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={v}
                      onChange={(e) => setEditData({
                        ...editData,
                        scoring_weights: { ...editData.scoring_weights, [k]: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted block mb-2">Thresholds (%)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Selected</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editData.thresholds.selected}
                    onChange={(e) => setEditData({ ...editData, thresholds: { ...editData.thresholds, selected: e.target.value } })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Needs Review</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editData.thresholds.need_review}
                    onChange={(e) => setEditData({ ...editData, thresholds: { ...editData.thresholds, need_review: e.target.value } })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-coral"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-dark-600">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                <X size={14} /> Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !editData.project_id?.trim()}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted mb-2">
                    Edit the full job description text below. On save, it will be re-parsed by AI to extract structured fields.
                  </p>
                  <textarea
                    rows={18}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-coral resize-none leading-relaxed"
                    placeholder="Paste or type the full job description here..."
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-dark-600">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                    <X size={14} /> Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSaveText} disabled={saving || !textContent.trim()}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Job Description"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete <span className="text-white font-medium">"{deleteTarget?.title}"</span>? This action cannot be undone.
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
              onClick={handleDelete}
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
