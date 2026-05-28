import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  Award,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Card, Badge, Button, ScoreGauge, ProgressBar, Skeleton } from '../components/UI';
import BatchIdDisplay from '../components/BatchIdDisplay';
import { getBatchResults, getBatchStatus, getBatchExport } from '../services/api';
import toast from 'react-hot-toast';

export default function BatchResults() {
  const { batchId } = useParams();
  const [results, setResults] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | Select | Review | Reject
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resultsRes, statusRes] = await Promise.all([
          getBatchResults(batchId),
          getBatchStatus(batchId),
        ]);
        setResults(resultsRes.data?.candidates || []);
        setBatchInfo(statusRes.data);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [batchId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getBatchExport(batchId);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `batch_${batchId.slice(0, 8)}_export.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const filtered = filter === 'all'
    ? results
    : results.filter((c) => c.recommendation === filter);

  const getRecommendationVariant = (rec) => {
    const map = { Select: 'select', Review: 'review', Reject: 'reject' };
    return map[rec] || 'default';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-xl" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const selectCount = results.filter((c) => c.recommendation === 'Select').length;
  const reviewCount = results.filter((c) => c.recommendation === 'Review').length;
  const rejectCount = results.filter((c) => c.recommendation === 'Reject').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Screening Results</h1>
          <div className="mt-2">
            <BatchIdDisplay batchId={batchId} />
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="secondary">
          <Download size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-white">{results.length}</p>
          <p className="text-xs text-muted">Total Candidates</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-green-400">{selectCount}</p>
          <p className="text-xs text-muted">Selected</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-yellow-400">{reviewCount}</p>
          <p className="text-xs text-muted">Review</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-red-400">{rejectCount}</p>
          <p className="text-xs text-muted">Rejected</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-muted" />
        {['all', 'Select', 'Review', 'Reject'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-coral text-white'
                : 'bg-dark-700 text-muted hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f} {f !== 'all' && `(${f === 'Select' ? selectCount : f === 'Review' ? reviewCount : rejectCount})`}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filtered.map((candidate, index) => (
          <Card key={candidate.id || index} className="p-0 overflow-hidden">
            {/* Row Header */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dark-700/50 transition-colors"
              onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
            >
              <div className="text-sm text-muted w-8 text-center font-mono">
                #{index + 1}
              </div>

              <ScoreGauge score={Math.round(candidate.scoring?.match_score || 0)} size={48} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">
                    {candidate.personal?.name || 'Unknown'}
                  </p>
                  <Badge variant={getRecommendationVariant(candidate.recommendation)}>
                    {candidate.recommendation}
                  </Badge>
                </div>
                <p className="text-xs text-muted truncate">
                  {candidate.personal?.email} • {candidate.experience?.total_years || 0} yrs exp • {candidate.domain_classification}
                </p>
              </div>

              <div className="text-right hidden md:block">
                <p className="text-lg font-bold text-white">
                  {Math.round(candidate.scoring?.match_score || 0)}%
                </p>
                <p className="text-xs text-muted">Match Score</p>
              </div>

              {expandedId === candidate.id ? (
                <ChevronUp size={18} className="text-muted" />
              ) : (
                <ChevronDown size={18} className="text-muted" />
              )}
            </div>

            {/* Expanded Detail */}
            {expandedId === candidate.id && (
              <div className="border-t border-dark-600 p-4 bg-dark-900/50 space-y-4">
                {/* Personal Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted" />
                    <div>
                      <p className="text-xs text-muted">Contact</p>
                      <p className="text-sm text-white">{candidate.personal?.email}</p>
                      <p className="text-xs text-muted">{candidate.personal?.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-muted" />
                    <div>
                      <p className="text-xs text-muted">Current Organization</p>
                      <p className="text-sm text-white">
                        {candidate.personal?.current_organization || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award size={14} className="text-muted" />
                    <div>
                      <p className="text-xs text-muted">Certifications</p>
                      <p className="text-sm text-white">
                        {candidate.certifications?.length || 0} found
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div>
                  <p className="text-xs text-muted mb-2 font-medium">Score Breakdown</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      ['Mandatory Skills', candidate.scoring?.mandatory_score],
                      ['Primary Skills', candidate.scoring?.primary_score],
                      ['Experience', candidate.scoring?.experience_score],
                      ['Certifications', candidate.scoring?.certification_score],
                      ['Secondary', candidate.scoring?.secondary_score],
                      ['Risk Penalty', candidate.scoring?.risk_penalty],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-dark-700 rounded-lg p-2.5">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{label}</span>
                          <span className="text-white">{Math.round(val || 0)}%</span>
                        </div>
                        <ProgressBar value={val || 0} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <p className="text-xs text-muted mb-2 font-medium">Skills Match</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(candidate.skills_matched?.mandatory || {}).map(
                      ([skill, matched]) => (
                        <span
                          key={skill}
                          className={`px-2 py-0.5 text-xs rounded-md ${
                            matched
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {skill} {matched ? '✓' : '✗'}
                        </span>
                      )
                    )}
                    {Object.entries(candidate.skills_matched?.primary || {}).map(
                      ([skill, matched]) => (
                        <span
                          key={skill}
                          className={`px-2 py-0.5 text-xs rounded-md ${
                            matched
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-orange-500/10 text-orange-400'
                          }`}
                        >
                          {skill} {matched ? '✓' : '✗'}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Risk Flags */}
                {candidate.risk_flags?.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-400 font-medium">Risk Flags</p>
                      <p className="text-xs text-muted">{candidate.risk_flags.join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Recruiter Summary */}
                {candidate.recruiter_summary && (
                  <div className="p-3 bg-dark-700 rounded-lg">
                    <p className="text-xs text-muted font-medium mb-1">Recruiter Summary</p>
                    <p className="text-sm text-white leading-relaxed">
                      {candidate.recruiter_summary}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">No candidates match the current filter.</p>
        </div>
      )}
    </div>
  );
}
