import { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, Briefcase } from 'lucide-react';
import { Card, Button, Badge, Modal, EmptyState, Skeleton } from '../components/UI';
import { getJDs, uploadJD, uploadJDText } from '../services/api';
import toast from 'react-hot-toast';

export default function JobDescriptions() {
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'text'
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedJd, setSelectedJd] = useState(null);

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

  const handleUpload = async () => {
    setUploading(true);
    try {
      if (uploadMode === 'file' && file) {
        const formData = new FormData();
        formData.append('jd_file', file);
        await uploadJD(formData);
      } else if (uploadMode === 'text' && text.trim()) {
        await uploadJDText(text, title);
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
      fetchJDs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
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
              className="cursor-pointer hover:border-coral/40 transition-colors"
              onClick={() => setSelectedJd(jd)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center">
                  <Briefcase size={18} className="text-coral" />
                </div>
                <Badge variant="default">{jd.domain || 'General'}</Badge>
              </div>
              <h3 className="text-base font-semibold text-white mb-2 line-clamp-2">
                {jd.title}
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(jd.uploaded_at).toLocaleDateString()}
                </span>
                <span>{jd.min_experience_years || 0}+ yrs exp</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(jd.skills?.mandatory || []).slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 text-xs bg-coral/10 text-coral rounded-md"
                  >
                    {skill}
                  </span>
                ))}
                {(jd.skills?.mandatory?.length || 0) > 4 && (
                  <span className="px-2 py-0.5 text-xs bg-dark-700 text-muted rounded-md">
                    +{jd.skills.mandatory.length - 4}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload Job Description">
        <div className="space-y-4">
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
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* JD Detail Modal */}
      <Modal
        isOpen={!!selectedJd}
        onClose={() => setSelectedJd(null)}
        title={selectedJd?.title || 'Job Description'}
      >
        {selectedJd && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted">Domain</p>
                <p className="text-sm text-white">{selectedJd.domain || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Min Experience</p>
                <p className="text-sm text-white">{selectedJd.min_experience_years || 0} years</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Mandatory Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedJd.skills?.mandatory || []).map((s) => (
                  <span key={s} className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Primary Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedJd.skills?.primary || []).map((s) => (
                  <span key={s} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Secondary / Good to Have</p>
              <div className="flex flex-wrap gap-1.5">
                {[...(selectedJd.skills?.secondary || []), ...(selectedJd.skills?.good_to_have || [])].map((s) => (
                  <span key={s} className="px-2 py-1 text-xs bg-dark-700 text-muted rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Scoring Weights</p>
              <div className="space-y-1.5">
                {Object.entries(selectedJd.scoring_weights || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-muted capitalize">{k.replace('_', ' ')}</span>
                    <span className="text-white">{(v * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
