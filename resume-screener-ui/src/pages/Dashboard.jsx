import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Layers, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { StatCard, Card, Badge, Button, Skeleton } from '../components/UI';
import { getJDs, healthCheck } from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jds: 0, healthy: false });
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [jdRes, healthRes] = await Promise.all([
          getJDs().catch(() => ({ data: [] })),
          healthCheck().catch(() => ({ data: { status: 'unhealthy' } })),
        ]);
        setJds(Array.isArray(jdRes.data) ? jdRes.data : []);
        setStats({
          jds: Array.isArray(jdRes.data) ? jdRes.data.length : 0,
          healthy: healthRes.data?.status === 'healthy',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-muted mt-1">Welcome to LTM Resume Screener</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/jobs')}>
            <Plus size={16} /> New JD
          </Button>
          <Button onClick={() => navigate('/upload')}>
            <Upload size={16} /> Upload Resumes
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Job Descriptions" value={stats.jds} accent />
        <StatCard icon={Layers} label="System Status" value={stats.healthy ? 'Healthy' : 'Error'} />
        <StatCard icon={Upload} label="Quick Action" value="Upload" />
        <StatCard icon={TrendingUp} label="AI Powered" value="GPT-4o" />
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
              {jds.slice(0, 5).map((jd) => (
                <div
                  key={jd.id}
                  className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{jd.title}</p>
                    <p className="text-xs text-muted">{jd.domain}</p>
                  </div>
                  <Badge variant="default">
                    {jd.skills?.mandatory?.length || 0} skills
                  </Badge>
                </div>
              ))}
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
