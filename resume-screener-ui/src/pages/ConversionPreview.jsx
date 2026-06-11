import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getConversion, updateConversion, downloadConversion } from '../services/api';

export default function ConversionPreview() {
  const { conversionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [conversionId]);

  const fetchData = async () => {
    try {
      const res = await getConversion(conversionId);
      setData(res.data);
    } catch {
      toast.error('Failed to load conversion data');
      navigate('/convert');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateConversion(conversionId, {
        personal: data.personal,
        experience_summary: data.experience_summary,
        skills_summary: data.skills_summary,
        projects: data.projects,
        other_experience: data.other_experience,
        education: data.education,
        certifications: data.certifications,
      });
      setData(res.data);
      toast.success('Saved & DOCX regenerated!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await downloadConversion(conversionId);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.original_file_name?.replace(/\.[^.]+$/, '')}_LTM_Format.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const updateField = (path, value) => {
    setData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 size={32} className="text-coral animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/convert')} className="text-muted hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Edit Conversion</h1>
            <p className="text-muted text-xs">{data.original_file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-coral hover:bg-coral/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save & Regenerate
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-medium border border-dark-600 transition-colors"
          >
            <Download size={14} /> Download DOCX
          </button>
        </div>
      </div>

      {/* Personal Info */}
      <Section title="Personal Information">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name" value={data.personal?.name} onChange={(v) => updateField('personal.name', v)} />
          <Input label="PS ID" value={data.personal?.ps_id} onChange={(v) => updateField('personal.ps_id', v)} />
          <Input label="Mobile" value={data.personal?.mobile} onChange={(v) => updateField('personal.mobile', v)} />
          <Input label="Email" value={data.personal?.email} onChange={(v) => updateField('personal.email', v)} />
        </div>
      </Section>

      {/* Experience Summary */}
      <Section title="Experience Summary">
        <div className="space-y-2">
          {(data.experience_summary || []).map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-coral focus:outline-none"
                value={item}
                onChange={(e) => {
                  const updated = [...data.experience_summary];
                  updated[i] = e.target.value;
                  updateField('experience_summary', updated);
                }}
              />
              <button onClick={() => {
                const updated = data.experience_summary.filter((_, idx) => idx !== i);
                updateField('experience_summary', updated);
              }} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={14} /></button>
            </div>
          ))}
          <button
            onClick={() => updateField('experience_summary', [...(data.experience_summary || []), ''])}
            className="text-coral text-xs flex items-center gap-1 hover:underline"
          ><Plus size={12} /> Add bullet</button>
        </div>
      </Section>

      {/* Skills Summary */}
      <Section title="Skills Summary">
        <div className="grid grid-cols-1 gap-3">
          <Input label="Domain" value={data.skills_summary?.domain} onChange={(v) => updateField('skills_summary.domain', v)} />
          <Input label="Programming Languages" value={data.skills_summary?.programming_languages} onChange={(v) => updateField('skills_summary.programming_languages', v)} />
          <Input label="Tools" value={data.skills_summary?.tools} onChange={(v) => updateField('skills_summary.tools', v)} />
          <Input label="Project Overview" value={data.skills_summary?.project_overview} onChange={(v) => updateField('skills_summary.project_overview', v)} />
        </div>
      </Section>

      {/* Projects */}
      <Section title="Key Projects">
        <div className="space-y-4">
          {(data.projects || []).map((proj, i) => (
            <div key={i} className="bg-dark-900 border border-dark-600 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-coral text-xs font-medium">Project {i + 1}</span>
                <button onClick={() => {
                  const updated = data.projects.filter((_, idx) => idx !== i);
                  updateField('projects', updated);
                }} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Project Name" value={proj.project_name} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], project_name: v}; updateField('projects', u); }} />
                <Input label="Team Size" value={proj.team_size} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], team_size: v}; updateField('projects', u); }} />
                <Input label="Start Date" value={proj.start_date} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], start_date: v}; updateField('projects', u); }} />
                <Input label="End Date" value={proj.end_date} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], end_date: v}; updateField('projects', u); }} />
              </div>
              <TextArea label="Description" value={proj.description} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], description: v}; updateField('projects', u); }} />
              <Input label="Technologies" value={proj.technologies} onChange={(v) => { const u = [...data.projects]; u[i] = {...u[i], technologies: v}; updateField('projects', u); }} />
              <div>
                <label className="text-muted text-xs mb-1 block">Role & Contributions</label>
                {(proj.role_contributions || []).map((c, ci) => (
                  <div key={ci} className="flex gap-2 mb-1">
                    <input
                      className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-sm focus:border-coral focus:outline-none"
                      value={c}
                      onChange={(e) => {
                        const u = [...data.projects];
                        u[i] = {...u[i], role_contributions: u[i].role_contributions.map((r, ri) => ri === ci ? e.target.value : r)};
                        updateField('projects', u);
                      }}
                    />
                    <button onClick={() => {
                      const u = [...data.projects];
                      u[i] = {...u[i], role_contributions: u[i].role_contributions.filter((_, ri) => ri !== ci)};
                      updateField('projects', u);
                    }} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => {
                  const u = [...data.projects];
                  u[i] = {...u[i], role_contributions: [...(u[i].role_contributions || []), '']};
                  updateField('projects', u);
                }} className="text-coral text-xs flex items-center gap-1 hover:underline mt-1"><Plus size={10} /> Add</button>
              </div>
            </div>
          ))}
          <button
            onClick={() => updateField('projects', [...(data.projects || []), { project_name: '', team_size: '', start_date: '', end_date: '', description: '', role_contributions: [], technologies: '' }])}
            className="text-coral text-sm flex items-center gap-1 hover:underline"
          ><Plus size={14} /> Add Project</button>
        </div>
      </Section>

      {/* Education */}
      <Section title="Education">
        {(data.education || []).map((edu, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Degree" value={edu.degree} onChange={(v) => { const u = [...data.education]; u[i] = {...u[i], degree: v}; updateField('education', u); }} />
            <Input label="Institution" value={edu.institution} onChange={(v) => { const u = [...data.education]; u[i] = {...u[i], institution: v}; updateField('education', u); }} />
            <Input label="Year Range" value={edu.year_range} onChange={(v) => { const u = [...data.education]; u[i] = {...u[i], year_range: v}; updateField('education', u); }} />
            <Input label="Percentage/CGPA" value={edu.percentage} onChange={(v) => { const u = [...data.education]; u[i] = {...u[i], percentage: v}; updateField('education', u); }} />
          </div>
        ))}
      </Section>

      {/* Certifications */}
      <Section title="Certifications">
        <div className="space-y-2">
          {(data.certifications || []).map((cert, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-coral focus:outline-none"
                placeholder="Certification name"
                value={cert.name}
                onChange={(e) => { const u = [...data.certifications]; u[i] = {...u[i], name: e.target.value}; updateField('certifications', u); }}
              />
              <input
                className="w-48 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-coral focus:outline-none"
                placeholder="Validity"
                value={cert.validity}
                onChange={(e) => { const u = [...data.certifications]; u[i] = {...u[i], validity: e.target.value}; updateField('certifications', u); }}
              />
              <button onClick={() => {
                const u = data.certifications.filter((_, idx) => idx !== i);
                updateField('certifications', u);
              }} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={14} /></button>
            </div>
          ))}
          <button
            onClick={() => updateField('certifications', [...(data.certifications || []), { name: '', validity: '' }])}
            className="text-coral text-xs flex items-center gap-1 hover:underline"
          ><Plus size={12} /> Add certification</button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
      <h3 className="text-white font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div>
      <label className="text-muted text-xs mb-1 block">{label}</label>
      <input
        className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-coral focus:outline-none"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="text-muted text-xs mb-1 block">{label}</label>
      <textarea
        className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-coral focus:outline-none resize-none"
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
