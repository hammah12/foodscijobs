import React from 'react';
import { Job, ApplicationStatus } from '../types.js';
import { 
  Search, 
  MapPin, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Building, 
  ChevronRight,
  TrendingUp,
  FilePlus2,
  FileText
} from 'lucide-react';

interface JobSearchProps {
  jobs: Job[];
  onAddJob: (job: Job) => Promise<Job | null>;
  onTailorJob: (jobId: string) => Promise<Job | null>;
  onNavigateToQueue: () => void;
  onRefreshJobs?: () => void;
}

export default function JobSearch({ jobs, onAddJob, onTailorJob, onNavigateToQueue, onRefreshJobs }: JobSearchProps) {
  const [manualTitle, setManualTitle] = React.useState<string>('');
  const [manualCompany, setManualCompany] = React.useState<string>('');
  const [manualLocation, setManualLocation] = React.useState<string>('');
  const [manualDescription, setManualDescription] = React.useState<string>('');
  const [manualUrl, setManualUrl] = React.useState<string>('');
  const [manualSource, setManualSource] = React.useState<string>('Greenhouse');

  // Interactive status flags
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [processStep, setProcessStep] = React.useState<string>('');
  const [generatedJob, setGeneratedJob] = React.useState<Job | null>(null);

  // Form error
  const [formError, setFormError] = React.useState<string>('');

  // Automated Scan states
  const [isScanning, setIsScanning] = React.useState<boolean>(false);
  const [scanStep, setScanStep] = React.useState<string>('');
  const [scanLogMessages, setScanLogMessages] = React.useState<string[]>([]);
  const [scanResultCount, setScanResultCount] = React.useState<number | null>(null);
  const [activeTailoringId, setActiveTailoringId] = React.useState<string>('');

  // Search real job listings via the server (Adzuna API + Gemini fit scoring)
  const handleAutoScan = async () => {
    setIsScanning(true);
    setScanResultCount(null);
    setScanStep('Searching Adzuna for live listings...');
    setScanLogMessages([
      'Querying the Adzuna job search API with your configured keywords...',
      'This may take ~20-30 seconds while Gemini scores each result against your profile.'
    ]);

    try {
      const res = await fetch('/api/jobs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Job search returned a server error');

      setScanLogMessages(prev => [
        ...prev,
        data.count > 0
          ? `[SUCCESS] Found ${data.count} new listing${data.count === 1 ? '' : 's'} and scored them against your profile.`
          : '[DONE] No new listings found — everything matching your keywords is already in your pipeline.'
      ]);
      setScanResultCount(data.count);
      onRefreshJobs?.();
    } catch (err: any) {
      setScanLogMessages(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setScanStep('');
      setIsScanning(false);
    }
  };

  const handleTailorDiscoveredJob = async (jobId: string) => {
    setActiveTailoringId(jobId);
    try {
      const tailored = await onTailorJob(jobId);
      if (tailored) {
        onRefreshJobs?.();
      }
    } catch (err: any) {
      alert(`Could not tailor: ${err.message}`);
    } finally {
      setActiveTailoringId('');
    }
  };

  const handleDeleteDiscoveredJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to dismiss this discovered opening?')) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshJobs?.();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle scoring and tailoring manual inputs
  const handleScoreAndTailor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFormError('');
    setGeneratedJob(null);

    if (!manualTitle || !manualCompany || !manualDescription) {
      setFormError('Job Title, Company Name, and Full Description are required.');
      return;
    }

    setIsProcessing(true);
    setProcessStep('Registering job listing inside local memory database...');

    try {
      // 1. Register the new job in found status
      const placeholderJob: Job = {
        id: `job-${Date.now()}`,
        title: manualTitle,
        company: manualCompany,
        location: manualLocation || 'Remote / Hybrid',
        description: manualDescription,
        url: manualUrl || 'https://boards.greenhouse.io/',
        source: `${manualSource} Direct`,
        status: 'found',
        fitScore: 0,
        fitRationale: '',
        qualificationsGap: [],
        tailoredCV: { summary: '', highlights: [], bullets: [] },
        tailoredCoverLetter: '',
        prefilledAnswers: [],
        createdAt: new Date().toISOString()
      };

      const savedJob = await onAddJob(placeholderJob);
      if (!savedJob) return;

      // 2. Run sequential loading logs for highly responsive craft visual experience
      const steps = [
        'Fetching job structural taxonomy and metadata...',
        'Running Gemini 3.5 Flash entry-level verification...',
        'Cross-referencing HACCP, PCQI certifications against prerequisites...',
        'Mapping Davis Food Science coursework against technical responsibilities...',
        'Formulating structured scoring and fit rationales...',
        'Generating optimized resume highlights & keyword-tailored bullets...',
        'Writing compelling cover letter (grounded in actual history)...',
        'Pre-filling application questions and compiling final bundle...'
      ];

      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < steps.length) {
          setProcessStep(steps[stepIdx]);
          stepIdx++;
        } else {
          clearInterval(interval);
        }
      }, 700);

      // 3. Trigger actual AI tailoring in background
      const tailoredJob = await onTailorJob(savedJob.id);
      clearInterval(interval);

      if (tailoredJob) {
        setGeneratedJob(tailoredJob);
        
        // Reset forms
        setManualTitle('');
        setManualCompany('');
        setManualLocation('');
        setManualDescription('');
        setManualUrl('');
      } else {
        throw new Error('AI tailoring returned empty package.');
      }

    } catch (err: any) {
      setFormError(`AI pipeline error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // Pre-fill fields with an easy mock button for Greenhouse or Lever
  const handleLoadMockPosting = (type: 'Greenhouse' | 'Lever') => {
    if (type === 'Greenhouse') {
      setManualTitle('Associate Food Technologist (QA & Safety)');
      setManualCompany('Impossible Foods');
      setManualLocation('Redwood City, CA (On-site)');
      setManualSource('Greenhouse');
      setManualUrl('https://boards.greenhouse.io/impossiblefoods/jobs/52718301');
      setManualDescription(`We are looking for an Associate Food Technologist to join our Quality Assurance group. You will run daily physical and sensory QA controls on meat-alternative products.

Requirements:
- Bachelor's degree in Food Science, Biochemistry, or related discipline.
- International HACCP Alliance certification is a major plus.
- Knowledge of standard wet chemistry methods (pH, moisture, solids).`);
    } else {
      setManualTitle('Sensory Technician');
      setManualCompany('Givaudan Flavors');
      setManualLocation('East Hanover, NJ');
      setManualSource('Lever');
      setManualUrl('https://jobs.lever.co/givaudan/392-12-8');
      setManualDescription(`Givaudan is seeking a Sensory Technician to coordinate and execute consumer flavor evaluations. You will prepare sensory samples, maintain testing databases, run stand-ins for trained panelists.

Qualifications:
- BS in Food Science or Sensory Evaluation studies.
- Experience with Compusense or sensory descriptive systems is highly preferred.
- High attention to sterile preparation and documentation.`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in" id="job-search-parent">
      
      {/* Left panel (7 cols): Job Add / Manual Paste Form */}
      <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Configure Manual Job Tailor</h3>
            <p className="text-xs text-slate-550 mt-0.5">Input any job posting from corporate ATS networks to auto-score and optimize materials.</p>
          </div>
          
          <div className="flex space-x-2">
            <button 
              type="button"
              onClick={() => handleLoadMockPosting('Greenhouse')}
              className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 text-[10px] font-bold rounded-2xl border border-teal-200 cursor-pointer"
            >
              + Impossible Foods
            </button>
            <button 
              type="button"
              onClick={() => handleLoadMockPosting('Lever')}
              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded-2xl border border-indigo-200 cursor-pointer"
            >
              + Givaudan
            </button>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-800 flex items-start space-x-2 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleScoreAndTailor} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Job Title *</label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g. Associate Sensory Scientist"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Company *</label>
              <input
                type="text"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                placeholder="e.g. McCormick & Company"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Location</label>
              <input
                type="text"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="e.g. Hunt Valley, MD (Hybrid)"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">ATS Board Source</label>
              <select
                value={manualSource}
                onChange={(e) => setManualSource(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
              >
                <option value="Greenhouse">Greenhouse ATS</option>
                <option value="Lever">Lever ATS</option>
                <option value="Workday">Workday Direct</option>
                <option value="IFT Careers">IFT Careers (Niche)</option>
                <option value="Indeed">Indeed Redirect</option>
              </select>
            </div>

            <div className="space-y-1 col-span-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-500">Application URL</label>
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/company/jobs/123456"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">Paste Full Job Description *</label>
            <textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Paste responsibilities, requirements, preferred certifications..."
              className="w-full h-44 p-3 text-xs border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI Pipeline Active...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Score & Tailor Job Listing</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right panel (5 cols): AI Progress Console, Scanner or Discovered Listings */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Scraper Scanner CLI Loader */}
        {isScanning && (
          <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 text-green-400 font-mono text-[11px] space-y-4 shadow-xl h-80 flex flex-col overflow-hidden animate-fade-in" id="scanner-output">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-300">Live Job Search Active</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {scanLogMessages.map((msg, idx) => (
                <p key={idx} className={msg.startsWith('[SUCCESS]') ? 'text-emerald-400 font-bold' : msg.startsWith('[ERROR]') ? 'text-rose-400' : 'text-slate-400'}>
                  &gt; {msg}
                </p>
              ))}
              {scanStep && <p className="font-bold text-slate-100 animate-pulse">&gt; {scanStep}</p>}
            </div>
          </div>
        )}

        {/* State A: Loading console during manual matching */}
        {isProcessing && (
          <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 text-green-400 font-mono text-[11px] space-y-4 shadow-xl h-96 flex flex-col overflow-hidden">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
              <span className="font-bold text-slate-300">Matching Engine Feed</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              <p className="text-slate-500">&gt; Sending your profile and the job description to Gemini...</p>
              <p className="text-teal-400">&gt; Generating fit score, tailored CV, cover letter and form answers...</p>
              <p className="font-bold text-slate-100">&gt; CURRENT ACTIVE TASK: {processStep}</p>
            </div>
          </div>
        )}

        {/* State B: Success Scorecard */}
        {generatedJob && !isProcessing && (
          <div className="bg-white p-6 rounded-3xl border-2 border-teal-500 shadow-md space-y-5 animate-fade-in" id="scorecard-block">
            <div className="flex items-center space-x-2 text-teal-600 font-bold text-sm">
              <CheckCircle className="w-5 h-5" />
              <span>AI Tailoring Package Assembled!</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div>
                <h4 className="text-xs font-bold text-slate-800">{generatedJob.title}</h4>
                <p className="text-[11px] text-slate-500 font-bold">{generatedJob.company}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-900">{generatedJob.fitScore}%</span>
                <p className="text-[9px] text-slate-400 uppercase font-bold">Fit Score</p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Matching Rationale</h5>
              <p className="text-xs text-slate-600 leading-relaxed font-bold">
                {generatedJob.fitRationale}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToQueue}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <span>Go to Approval Queue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* State C: Auto-Scan & Active Scrapers Control Panel */}
        {!isProcessing && !generatedJob && !isScanning && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-teal-500" />
                  <span>Live Job Discovery</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Search real listings via the Adzuna job API.</p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                Adzuna API
              </span>
            </div>

            <p className="text-xs text-slate-550 leading-relaxed font-bold">
              Searches live postings using your keywords from Rules Config, then Gemini scores each one against your profile. Results land below, ready for tailoring.
            </p>

            <button
              type="button"
              onClick={handleAutoScan}
              disabled={isScanning}
              className="w-full py-3 bg-slate-900 hover:bg-black disabled:opacity-60 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Search Live Jobs Now</span>
            </button>
          </div>
        )}

        {/* State D: List of Discovered Found Jobs needing approval/tailoring */}
        {!isProcessing && !isScanning && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Discovered Opportunities ({jobs.filter(j => j.status === 'found').length})</span>
              <span className="text-[10px] text-slate-400 font-normal normal-case">Status: Found</span>
            </h4>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
              {jobs.filter(j => j.status === 'found').length === 0 ? (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <AlertCircle className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold">No un-tailored scan results yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Trigger an auto-scan above or paste a manual job to begin.</p>
                </div>
              ) : (
                jobs.filter(j => j.status === 'found').map((job) => (
                  <div key={job.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 line-clamp-1">{job.title}</h5>
                        <p className="text-[11px] text-slate-500 font-bold">{job.company}</p>
                      </div>
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 font-black text-[10px] px-1.5 py-0.5 rounded">
                        {job.fitScore}% Fit
                      </span>
                    </div>

                    <div className="flex items-center text-[10px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      <span>{job.location}</span>
                    </div>

                    {job.fitRationale && (
                      <p className="text-[10px] text-slate-600 line-clamp-2 bg-white p-2 rounded-lg border border-slate-100 font-bold">
                        {job.fitRationale}
                      </p>
                    )}

                    <div className="flex space-x-2 pt-1.5 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => handleTailorDiscoveredJob(job.id)}
                        disabled={activeTailoringId === job.id}
                        className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-xl text-[10px] flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        {activeTailoringId === job.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Tailoring...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-Tailor & Queue</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDiscoveredJob(job.id)}
                        className="px-2.5 py-1.5 border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 font-bold rounded-xl text-[10px] cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
