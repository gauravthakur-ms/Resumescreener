import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Layers, TrendingUp, Plus, ArrowRight, Users } from 'lucide-react';
import { StatCard, Card, Badge, Skeleton } from '../components/UI';
import { getJDs, healthCheck, getBatches } from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jds: 0, healthy: false, resumesScreened: 0 });
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [jdRes, healthRes, batchRes] = await Promise.all([
          getJDs().catch(() => ({ data: [] })),
          healthCheck().catch(() => ({ data: { status: 'unhealthy' } })),
          getBatches().catch(() => ({ data: [] })),
        ]);
        const jdList = Array.isArray(jdRes.data) ? jdRes.data : [];
        const batches = Array.isArray(batchRes.data) ? batchRes.data : [];
        const totalScreened = batches.reduce((sum, b) => sum + (b.processed || 0), 0);
        setJds(jdList);
        setStats({
          jds: jdList.length,
          healthy: healthRes.data?.status === 'healthy',
          resumesScreened: totalScreened,
        });
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-muted mt-1">Welcome to LTM Resume Screener</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Job Descriptions" value={stats.jds} accent />
        <StatCard icon={Layers} label="System Status" value={stats.healthy ? 'Healthy' : 'Error'} />
        <StatCard icon={Users} label="Resumes Screened" value={stats.resumesScreened} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent JDs */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Job Descriptions</h3>
            <button
              onClick={() => navigate('/jobs')}
              className="text-coral text-sm flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          {jds.length === 0 ? (
            <p className="text-muted text-sm py-4">No job descriptions yet. Upload one to get started.</p>
          ) : (
            <div className="space-y-3">
              {jds.slice(0, 5).map((jd) => {
                const skills = jd.skills?.primary || [];
                return (
                  <div
                    key={jd.id}
                    className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{jd.title}</p>
                      <p className="text-xs text-muted">{jd.domain}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      {skills.slice(0, 2).map((s) => (
                        <span key={s} className="px-2 py-0.5 text-xs bg-coral/10 text-coral rounded-md">{s}</span>
                      ))}
                      {skills.length > 2 && (
                        <span className="relative group">
                          <span className="px-2 py-0.5 text-xs bg-dark-600 text-muted rounded-md cursor-default">
                            +{skills.length - 2}
                          </span>
                          <span className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-dark-700 border border-coral/40 rounded-lg shadow-xl text-xs text-white whitespace-normal max-w-[220px] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                            {skills.slice(2).join(', ')}
                          </span>
                        </span>
                      )}
                      {skills.length === 0 && (
                        <Badge variant="default">No skills</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Getting Started */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Getting Started</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white">Upload a Job Description</p>
              <p className="text-xs text-muted">PDF, DOCX, or paste text directly</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Upload Resumes</p>
              <p className="text-xs text-muted">Bulk upload multiple PDF/DOCX resumes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">View Results</p>
              <p className="text-xs text-muted">AI-ranked candidates with detailed scoring</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
