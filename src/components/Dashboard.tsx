import React from 'react';
import { Job, ApplicationStatus } from '../types.js';
import { 
  Briefcase, 
  CheckCircle, 
  Clock, 
  Send, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  ChevronRight, 
  MapPin, 
  Filter, 
  Award,
  Zap,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

interface DashboardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onUpdateJobStatus: (id: string, status: ApplicationStatus) => void;
}

const statusColumns: { key: ApplicationStatus; label: string; color: string; icon: any }[] = [
  { key: 'queued', label: 'Approval Queue', color: 'bg-teal-50 text-teal-800 border-teal-200', icon: Clock },
  { key: 'approved', label: 'Approved (Ready)', color: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: CheckCircle },
  { key: 'submitted', label: 'Submitted', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Send },
  { key: 'interview', label: 'Interviews', color: 'bg-purple-50 text-purple-800 border-purple-200', icon: Calendar },
  { key: 'offer', label: 'Offers', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: Award },
  { key: 'skipped', label: 'Skipped / Rejected', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle }
];

export default function Dashboard({ jobs, onSelectJob, onUpdateJobStatus }: DashboardProps) {
  const [filterSource, setFilterSource] = React.useState<string>('all');
  const [minScore, setMinScore] = React.useState<number>(0);

  // Export the visible pipeline as a CSV for tracking outside the app
  const handleExportCsv = () => {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Title', 'Company', 'Location', 'Status', 'Fit Score', 'Source', 'URL', 'Submitted', 'Ref ID', 'Notes', 'Added'];
    const rows = filteredJobs.map(j => [
      j.title, j.company, j.location, j.status, j.fitScore, j.source, j.url,
      j.submissionDate ? new Date(j.submissionDate).toLocaleDateString() : '',
      j.refId || '', j.notes || '',
      new Date(j.createdAt).toLocaleDateString()
    ].map(escape).join(','));
    const csv = [header.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `foodsci_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered jobs
  const filteredJobs = jobs.filter(job => {
    const matchSource = filterSource === 'all' || job.source.toLowerCase().includes(filterSource.toLowerCase());
    const matchScore = job.fitScore >= minScore;
    return matchSource && matchScore;
  });

  // Calculate metrics
  const totalFound = jobs.length;
  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const approvedCount = jobs.filter(j => j.status === 'approved').length;
  const submittedCount = jobs.filter(j => j.status === 'submitted').length;
  const interviewCount = jobs.filter(j => j.status === 'interview').length;
  
  // Fit rate
  const highFitJobs = jobs.filter(j => j.fitScore >= 80).length;
  const highFitRate = totalFound > 0 ? Math.round((highFitJobs / totalFound) * 100) : 0;

  // List of unique sources
  const sources = Array.from(new Set(jobs.map(j => {
    if (j.source.includes('Greenhouse')) return 'Greenhouse';
    if (j.source.includes('Lever')) return 'Lever';
    if (j.source.includes('Indeed')) return 'Indeed';
    return j.source;
  })));

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-container">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="metrics-grid">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approval Queue</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{queuedCount} <span className="text-xs font-normal text-slate-400">pending</span></h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved & Ready</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{approvedCount} <span className="text-xs font-normal text-slate-400">to file</span></h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submitted Apps</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{submittedCount} <span className="text-xs font-normal text-slate-400">tracked</span></h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match Efficiency</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{highFitRate}% <span className="text-xs font-normal text-teal-600">≥80 fit</span></h3>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700">Filter Engine</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Source Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Source:</span>
            <select 
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Channels</option>
              {sources.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>

          {/* Min Score Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Min Fit Score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value={0}>All Scores</option>
              <option value={60}>≥ 60 (Fair)</option>
              <option value={75}>≥ 75 (Good)</option>
              <option value={85}>≥ 85 (Excellent)</option>
            </select>
          </div>

          {(filterSource !== 'all' || minScore > 0) && (
            <button
              onClick={() => { setFilterSource('all'); setMinScore(0); }}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center space-x-1 font-bold"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg py-1.5 px-3 flex items-center space-x-1.5 cursor-pointer transition-colors"
            title="Download all visible applications as a CSV"
          >
            <ChevronRight className="w-3 h-3 rotate-90" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Kanban Pipeline Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4" id="kanban-pipeline">
        {statusColumns.map((col) => {
          // The skipped column also collects rejected applications
          const colJobs = filteredJobs.filter(j => j.status === col.key || (col.key === 'skipped' && j.status === 'rejected'));
          const ColIcon = col.icon;
          
          return (
            <div key={col.key} className="flex-1 min-w-[250px] bg-slate-100/40 p-4 rounded-3xl border border-slate-200/60 flex flex-col h-[650px]" id={`kanban-col-${col.key}`}>
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/60">
                <div className="flex items-center space-x-2">
                  <span className={`p-1.5 rounded-lg border ${col.color}`}>
                    <ColIcon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-slate-800">{col.label}</span>
                </div>
                <span className="text-xs font-black text-slate-400 bg-white border border-slate-200/60 px-2 py-0.5 rounded-full">{colJobs.length}</span>
              </div>

              {/* Job Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {colJobs.length === 0 ? (
                  <div className="h-28 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs text-slate-400 font-bold">No applications</p>
                  </div>
                ) : (
                  colJobs.map((job) => {
                    const scoreColor = job.fitScore >= 85 
                      ? 'text-emerald-750 bg-emerald-50 border-emerald-100' 
                      : job.fitScore >= 70 
                        ? 'text-teal-750 bg-teal-50 border-teal-100' 
                        : 'text-rose-750 bg-rose-50 border-rose-100';

                    return (
                      <div 
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md hover:border-teal-500 cursor-pointer transition-all duration-150 group"
                        id={`job-card-${job.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${scoreColor}`}>
                            {job.fitScore}% Fit
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            {job.source.split(' ')[0]}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-850 line-clamp-1 group-hover:text-teal-600 transition-colors">
                          {job.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                          {job.company}
                        </p>

                        <div className="flex items-center text-[10px] text-slate-400 mt-3 space-x-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="line-clamp-1">{job.location}</span>
                        </div>

                        {job.notes && (
                          <p className="mt-2 text-[10px] text-slate-500 bg-amber-50/60 border border-amber-100 rounded-lg px-2 py-1 line-clamp-2" title={job.notes}>
                            📝 {job.notes}
                          </p>
                        )}

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-medium">
                            {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          
                          {/* Quick Status Select */}
                          <select
                            value={job.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateJobStatus(job.id, e.target.value as ApplicationStatus)}
                            className="bg-slate-50 border border-slate-200 rounded-md text-[10px] py-0.5 px-1 font-bold text-slate-600 focus:outline-none"
                          >
                            <option value="queued">Queue</option>
                            <option value="approved">Approved</option>
                            <option value="submitted">Submitted</option>
                            <option value="interview">Interview</option>
                            <option value="offer">Offer</option>
                            <option value="rejected">Rejected</option>
                            <option value="skipped">Skipped</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
