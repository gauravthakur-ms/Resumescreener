import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  Award,
  AlertTriangle,
  Filter,
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  Download,
} from 'lucide-react';
import { Card, Badge, Button, ScoreGauge, ProgressBar, Skeleton } from '../components/UI';
import SkillBadge from '../components/SkillBadge';
import { getCandidatesByJd, getJdExport } from '../services/api';
import toast from 'react-hot-toast';

export default function JDResults() {
  const { jdId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [jdTitle, setJdTitle] = useState('');
  const [certsPreferred, setCertsPreferred] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | Select | Review | Reject
  const [sortOrder, setSortOrder] = useState('desc'); // desc = High to Low, asc = Low to High
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await getCandidatesByJd(jdId);
        setResults(res.data?.candidates || []);
        setJdTitle(res.data?.jd_title || '');
        setCertsPreferred(res.data?.certifications_preferred || []);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [jdId]);

  // Map backend recommendations to display categories
  const getCategory = (rec) => {
    if (rec === 'Strong Hire' || rec === 'Hire') return 'Select';
    if (rec === 'Consider') return 'Review';
    return 'Reject';
  };

  const filtered = (() => {
    let list = filter === 'all'
      ? [...results]
      : results.filter((c) => getCategory(c.recommendation) === filter);

    // Date filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((c) => {
        const d = c.screened_at || c.processed_at || c._ts;
        if (!d) return true;
        const candidate_date = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
        return candidate_date >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((c) => {
        const d = c.screened_at || c.processed_at || c._ts;
        if (!d) return true;
        const candidate_date = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
        return candidate_date <= to;
      });
    }

    // Sort by match score
    list.sort((a, b) => {
      const scoreA = a.scoring?.match_score || 0;
      const scoreB = b.scoring?.match_score || 0;
      return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });

    return list;
  })();

  const getRecommendationVariant = (rec) => {
    const cat = getCategory(rec);
    const map = { Select: 'select', Review: 'review', Reject: 'reject' };
    return map[cat] || 'default';
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getJdExport(jdId, filtered);
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `jd_export_${jdId}.xlsx`;
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
      setExporting(false);
    }
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

  const selectCount = results.filter((c) => getCategory(c.recommendation) === 'Select').length;
  const reviewCount = results.filter((c) => getCategory(c.recommendation) === 'Review').length;
  const rejectCount = results.filter((c) => getCategory(c.recommendation) === 'Reject').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/screened')}
            className="flex items-center gap-1 text-muted hover:text-white text-sm mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Screened Resumes
          </button>
          <h1 className="text-3xl font-bold text-white">Screening Results</h1>
          {jdTitle && (
            <p className="text-muted mt-1 text-sm">
              Job Description: <span className="text-white font-medium">{jdTitle}</span>
            </p>
          )}
        </div>
        <Button onClick={handleExport} disabled={exporting || results.length === 0} variant="secondary">
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

      {/* Sort & Date Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Sort by Score */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-white/70" />
          <span className="text-xs text-white/80 font-medium">Score:</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-coral"
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-white/70" />
          <span className="text-xs text-white/80 font-medium">From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-coral"
          />
          <span className="text-xs text-white/80 font-medium">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-coral"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-2 py-1.5 text-xs bg-dark-700 text-muted hover:text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
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
                    {candidate.personal?.name || candidate.candidate_name || 'Unknown'}
                  </p>
                  <Badge variant={getRecommendationVariant(candidate.recommendation)}>
                    {candidate.recommendation}
                  </Badge>
                </div>
                <p className="text-xs text-muted truncate">
                  {candidate.personal?.email || candidate.candidate_email || ''} • {candidate.experience?.total_years || 0} yrs exp • {candidate.domain_classification || ''}
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
                {/* Recruiter Summary */}
                {candidate.recruiter_summary && (
                  <div className="px-3 py-2.5 rounded-lg bg-dark-700/40 border-l-2 border-warning/50">
                    <p className="text-[13px] text-white/80 leading-relaxed">
                      {candidate.recruiter_summary}
                    </p>
                  </div>
                )}
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
                      ['Primary Skills', candidate.scoring?.primary_score],
                      ['Secondary Skills', candidate.scoring?.secondary_score],
                      ['Experience', candidate.scoring?.experience_score],
                      ['Certifications', candidate.scoring?.certification_score],
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

                {/* Skills Match */}
                <div className="space-y-3">
                  <p className="text-xs text-muted font-medium">Skills Match</p>

                  {/* Primary Skills */}
                  {Object.keys(candidate.skills_matched?.primary || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">Primary Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(candidate.skills_matched.primary).map(
                          ([skill, matched]) => (
                            <SkillBadge
                              key={skill}
                              skill={skill}
                              matched={matched}
                              variant="primary"
                              timeline={candidate.skill_timeline}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Secondary Skills */}
                  {Object.keys(candidate.skills_matched?.secondary || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">Secondary Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(candidate.skills_matched.secondary).map(
                          ([skill, matched]) => (
                            <SkillBadge
                              key={skill}
                              skill={skill}
                              matched={matched}
                              variant="secondary"
                              timeline={candidate.skill_timeline}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {certsPreferred.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">Certifications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {certsPreferred.map((cert) => {
                          const matched = (candidate.certifications || []).some(
                            (c) => c.toLowerCase().includes(cert.toLowerCase()) || cert.toLowerCase().includes(c.toLowerCase())
                          );
                          return (
                            <span
                              key={cert}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium ${
                                matched
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : 'bg-purple-500/5 text-purple-400/50 border border-purple-500/10 line-through decoration-purple-400/40'
                              }`}
                            >
                              <span className={`text-[10px] ${matched ? 'text-green-400' : 'text-red-400/60'}`}>
                                {matched ? '✓' : '✕'}
                              </span>
                              {cert}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

                {/* Recruiter Summary removed - now shown in card header */}
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
