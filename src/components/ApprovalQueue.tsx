import React from 'react';
import { Job, ApplicationStatus, PrefilledAnswer, TailoredCV, UserProfile } from '../types.js';
import { 
  FileText, 
  Mail, 
  FileCheck, 
  ThumbsUp, 
  ThumbsDown, 
  Play, 
  Terminal, 
  CheckCircle, 
  AlertCircle, 
  PenTool, 
  Save, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  Info,
  Loader2,
  Copy,
  Download,
  Check,
  X,
  Sparkles
} from 'lucide-react';

interface ApprovalQueueProps {
  jobs: Job[];
  profile: UserProfile;
  onUpdateJob: (job: Job) => void;
  onRefreshJobs: () => void;
}

export default function ApprovalQueue({ jobs, profile, onUpdateJob, onRefreshJobs }: ApprovalQueueProps) {
  // We care about jobs that are either 'queued' or 'approved'
  const pendingJobs = jobs.filter(j => j.status === 'queued' || j.status === 'approved');
  const [selectedJobId, setSelectedJobId] = React.useState<string>(pendingJobs[0]?.id || '');
  
  // Active tab in document review: 'rationale' | 'cv' | 'letter' | 'answers'
  const [activeTab, setActiveTab] = React.useState<'rationale' | 'cv' | 'letter' | 'answers'>('rationale');

  // Edited states
  const [editMode, setEditMode] = React.useState<boolean>(false);
  const [editedSummary, setEditedSummary] = React.useState<string>('');
  const [editedHighlights, setEditedHighlights] = React.useState<string[]>([]);
  const [editedBullets, setEditedBullets] = React.useState<string[]>([]);
  const [editedCoverLetter, setEditedCoverLetter] = React.useState<string>('');
  const [editedAnswers, setEditedAnswers] = React.useState<PrefilledAnswer[]>([]);

  // Skip state
  const [showSkipModal, setShowSkipModal] = React.useState<boolean>(false);
  const [skipReason, setSkipReason] = React.useState<string>('');

  // Apply Assistant state: saving final drafts, then the manual copy-paste assistant panel
  const [isPreparing, setIsPreparing] = React.useState<boolean>(false);
  const [assistantOpen, setAssistantOpen] = React.useState<boolean>(false);
  const [prepareError, setPrepareError] = React.useState<string>('');
  const [submissionRefId, setSubmissionRefId] = React.useState<string>('');
  const [submissionNotes, setSubmissionNotes] = React.useState<string>('');

  // Copying & Exporting helpers
  const [copiedField, setCopiedField] = React.useState<string>('');
  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleExportPackage = () => {
    if (!selectedJob) return;
    const content = `# Job Application Package: ${selectedJob.title} at ${selectedJob.company}
Generated via FoodSci Apply on ${new Date().toLocaleDateString()}
Portal Link: ${selectedJob.url || 'N/A'}
Fit Score: ${selectedJob.fitScore}%

======================================================================
1. TAILORED CV PROFESSIONAL SUMMARY
======================================================================
${editedSummary}

======================================================================
2. CORE QUALIFICATIONS HIGHLIGHTS
======================================================================
${editedHighlights.map(hl => `- ${hl}`).join('\n')}

======================================================================
3. OPTIMIZED WORK ACCOMPLISHMENTS BULLETS
======================================================================
${editedBullets.map(b => `- ${b}`).join('\n')}

======================================================================
4. TAILORED COVER LETTER
======================================================================
${editedCoverLetter}

======================================================================
5. AUTO-FILLED APPLICATION FORM ANSWERS
======================================================================
${editedAnswers.map(ans => `Q: ${ans.question}\nA: ${ans.answer}\n`).join('\n---\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedJob.company.replace(/\s+/g, '_')}_${selectedJob.title.replace(/\s+/g, '_')}_Application_Package.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedJob = pendingJobs.find(j => j.id === selectedJobId) || pendingJobs[0];

  // Sync edited states when selected job changes or edit mode enters
  React.useEffect(() => {
    if (selectedJob) {
      setEditedSummary(selectedJob.tailoredCV?.summary || '');
      setEditedHighlights([...(selectedJob.tailoredCV?.highlights || [])]);
      setEditedBullets([...(selectedJob.tailoredCV?.bullets || [])]);
      setEditedCoverLetter(selectedJob.tailoredCoverLetter || '');
      setEditedAnswers(selectedJob.prefilledAnswers ? JSON.parse(JSON.stringify(selectedJob.prefilledAnswers)) : []);

      // Reset the assistant panel
      setAssistantOpen(false);
      setPrepareError('');
      setSubmissionRefId('');
      setSubmissionNotes('');
    }
    // Depend on the job ID only: the job OBJECT gets a new identity every time the
    // jobs list refreshes (e.g. right after saving drafts), and resetting on that
    // would instantly close the Apply Assistant after it opens.
  }, [selectedJobId]);

  if (pendingJobs.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center max-w-2xl mx-auto space-y-4 shadow-2xs">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <FileCheck className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Your Approval Queue is Clean!</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          The autonomous food science agent has categorized all discovered postings. Add new postings via the **Discovery** search tab to run scoring, tailoring, and CV optimization.
        </p>
      </div>
    );
  }

  // Handle Save draft changes
  const handleSaveDraft = () => {
    if (!selectedJob) return;
    const updated: Job = {
      ...selectedJob,
      tailoredCV: {
        summary: editedSummary,
        highlights: editedHighlights,
        bullets: editedBullets
      },
      tailoredCoverLetter: editedCoverLetter,
      prefilledAnswers: editedAnswers
    };
    onUpdateJob(updated);
    setEditMode(false);
  };

  // Skip job listing
  const handleSkipJob = async () => {
    if (!selectedJob) return;
    const updated: Job = {
      ...selectedJob,
      status: 'skipped',
      skipReason: skipReason || 'Skipped by user during manual review.'
    };
    onUpdateJob(updated);
    setShowSkipModal(false);
    setSkipReason('');
    
    // Auto select next job
    const remaining = pendingJobs.filter(j => j.id !== selectedJob.id);
    if (remaining.length > 0) {
      setSelectedJobId(remaining[0].id);
    }
  };

  // Save final drafts to the server, then open the manual Apply Assistant.
  // Nothing is auto-submitted — the user applies on the real portal themselves.
  const handlePreparePackage = async () => {
    if (!selectedJob) return;
    setIsPreparing(true);
    setPrepareError('');

    try {
      const res = await fetch('/api/jobs/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          finalCoverLetter: editedCoverLetter,
          finalCV: {
            summary: editedSummary,
            highlights: editedHighlights,
            bullets: editedBullets
          },
          finalAnswers: editedAnswers
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save final drafts');

      onUpdateJob(data.job);
      setAssistantOpen(true);
    } catch (err: any) {
      setPrepareError(err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const scoreColor = selectedJob.fitScore >= 85 
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
    : selectedJob.fitScore >= 70 
      ? 'text-teal-700 bg-teal-50 border-teal-200' 
      : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-[calc(100vh-140px)]" id="approval-queue-parent">
      
      {/* Left List Pane (4 Cols) */}
      <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl flex flex-col h-full overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-800">Pending Approvals</h3>
          <span className="text-[10px] bg-teal-100 text-teal-850 px-2.5 py-0.5 rounded-full font-black">
            {pendingJobs.length} active
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="queue-list">
          {pendingJobs.map((job) => {
            const isSelected = job.id === selectedJobId;
            const cardScoreColor = job.fitScore >= 85 ? 'bg-emerald-500' : job.fitScore >= 70 ? 'bg-teal-500' : 'bg-rose-500';
            
            return (
              <div 
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`p-4 cursor-pointer transition-all duration-150 relative ${
                  isSelected ? 'bg-teal-50/40 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                }`}
                id={`queue-item-${job.id}`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-gray-800 line-clamp-1 pr-4">{job.title}</h4>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cardScoreColor}`} />
                </div>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">{job.company}</p>
                
                <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
                  <span>{job.source}</span>
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span className="text-gray-700">{job.fitScore}% score</span>
                    {job.status === 'approved' && (
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm text-[9px] border border-indigo-100">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Detail Pane (8 Cols) */}
      <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl flex flex-col h-full overflow-hidden shadow-sm">
        {/* Header Block */}
        <div className="p-5 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-800 leading-tight">{selectedJob.title}</h2>
              <a href={selectedJob.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-teal-600 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {selectedJob.company} • <span className="italic">{selectedJob.location}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start sm:self-center">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 font-bold text-xs ${scoreColor}`}>
              <span>Fit Score:</span>
              <span className="text-sm">{selectedJob.fitScore}%</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200/60 bg-slate-50/50 text-xs font-medium text-slate-500">
          <button 
            onClick={() => { setActiveTab('rationale'); }}
            className={`px-4 py-3 border-b-2 font-bold transition-all ${activeTab === 'rationale' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent hover:text-slate-650'}`}
          >
            Fit Audit
          </button>
          <button 
            onClick={() => { setActiveTab('cv'); }}
            className={`px-4 py-3 border-b-2 font-bold transition-all ${activeTab === 'cv' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent hover:text-slate-650'}`}
          >
            Tailored CV
          </button>
          <button 
            onClick={() => { setActiveTab('letter'); }}
            className={`px-4 py-3 border-b-2 font-bold transition-all ${activeTab === 'letter' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent hover:text-slate-650'}`}
          >
            Cover Letter
          </button>
          <button 
            onClick={() => { setActiveTab('answers'); }}
            className={`px-4 py-3 border-b-2 font-bold transition-all ${activeTab === 'answers' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent hover:text-slate-650'}`}
          >
            Form Answers ({editedAnswers.length})
          </button>
        </div>

        {/* Tab Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6" id="tab-body-pane">
          
          {/* 1. Fit Audit Rationale Tab */}
          {activeTab === 'rationale' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 bg-teal-50/30 border border-teal-100 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center space-x-1">
                  <Info className="w-4 h-4" />
                  <span>AI Fit Rationale</span>
                </h4>
                <p className="text-xs text-teal-900 leading-relaxed font-medium">
                  {selectedJob.fitRationale}
                </p>
              </div>

              {/* Qualifications Gap Check */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Qualifications / Knowledge Gaps Detected</span>
                </h4>
                
                {selectedJob.qualificationsGap && selectedJob.qualificationsGap.length > 0 ? (
                  <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {selectedJob.qualificationsGap.map((gap, i) => (
                      <div key={i} className="flex items-start space-x-2 text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                        <span>{gap}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 font-medium">
                    No qualification gaps detected! Your profile perfectly meets the candidate criteria.
                  </p>
                )}
              </div>

              {/* Original Job Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Original Job Posting Details</h4>
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl h-52 overflow-y-auto text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono">
                  {selectedJob.description}
                </div>
              </div>
            </div>
          )}

          {/* 2. Tailored CV Tab */}
          {activeTab === 'cv' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">RESUME GROUNDING SYSTEM: GENERATED COMPLIANCE BULLETS</span>
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Edit CV Draft</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleSaveDraft}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft Changes</span>
                  </button>
                )}
              </div>

              {/* CV Preview Block */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs font-sans text-xs">
                {/* Header Profile Section (from the saved user profile) */}
                <div className="bg-slate-900 p-5 text-white space-y-1">
                  <h3 className="text-sm font-bold tracking-wide">{profile.contact.name}</h3>
                  <p className="text-[10px] text-slate-300">
                    {[profile.contact.location, profile.contact.email, `${profile.education.institution} ${profile.education.degree}`].filter(Boolean).join(' | ')}
                  </p>
                </div>

                <div className="p-5 space-y-4 bg-white">
                  {/* Executive Summary */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                        Professional Profile Summary
                      </h4>
                      {!editMode && (
                        <button
                          id="copy-summary-btn"
                          type="button"
                          onClick={() => handleCopyToClipboard(editedSummary, 'summary')}
                          className="text-[10px] text-teal-650 hover:text-teal-850 font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedField === 'summary' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {editMode ? (
                      <textarea
                        value={editedSummary}
                        onChange={(e) => setEditedSummary(e.target.value)}
                        className="w-full h-20 p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 font-medium"
                      />
                    ) : (
                      <p className="text-gray-600 leading-relaxed font-medium">
                        {editedSummary}
                      </p>
                    )}
                  </div>

                  {/* Highlights */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-1 uppercase tracking-wider text-[10px]">
                      Core Optimized Qualifications
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {editedHighlights.map((hl, idx) => (
                        <div key={idx} className="bg-gray-50 p-2.5 rounded border border-gray-100 font-medium text-gray-600">
                          {editMode ? (
                            <input
                              type="text"
                              value={hl}
                              onChange={(e) => {
                                const copy = [...editedHighlights];
                                copy[idx] = e.target.value;
                                setEditedHighlights(copy);
                              }}
                              className="w-full bg-white border border-gray-200 text-xs p-1"
                            />
                          ) : (
                            <span>{hl}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tailored Bullets */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-1 mb-1">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">
                        Optimized Work History Bullets (Reflecting posting terms)
                      </h4>
                      {!editMode && (
                        <button
                          id="copy-bullets-btn"
                          type="button"
                          onClick={() => handleCopyToClipboard(editedBullets.map(b => `• ${b}`).join('\n'), 'bullets')}
                          className="text-[10px] text-teal-650 hover:text-teal-850 font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedField === 'bullets' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy All Bullets</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <ul className="space-y-2.5">
                      {editedBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-slate-600 font-bold leading-relaxed">
                          <span className="text-teal-600 font-black mt-0.5">•</span>
                          {editMode ? (
                            <textarea
                              value={bullet}
                              onChange={(e) => {
                                const copy = [...editedBullets];
                                copy[idx] = e.target.value;
                                setEditedBullets(copy);
                              }}
                              className="w-full h-12 text-xs p-1 bg-slate-50 border border-slate-200 rounded"
                            />
                          ) : (
                            <span>{bullet}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-100 rounded-2xl flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-teal-850 font-bold">
                  <strong>Grounding note:</strong> The AI is instructed to draw only from your saved profile and never invent experience — but it can still make mistakes. Always review every bullet before sending it to an employer.
                </p>
              </div>
            </div>
          )}

          {/* 3. Cover Letter Tab */}
          {activeTab === 'letter' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-400">PORTAL DRAFT PAD: ≤250-WORD GENERATION</span>
                  {!editMode && (
                        <button
                          id="copy-letter-btn"
                          type="button"
                          onClick={() => handleCopyToClipboard(editedCoverLetter, 'coverLetter')}
                          className="text-[10px] text-teal-650 hover:text-teal-850 font-bold flex items-center space-x-1 cursor-pointer"
                        >
                      {copiedField === 'coverLetter' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Letter</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Edit Letter Draft</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleSaveDraft}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft Changes</span>
                  </button>
                )}
              </div>

              {editMode ? (
                <textarea
                  value={editedCoverLetter}
                  onChange={(e) => setEditedCoverLetter(e.target.value)}
                  className="w-full h-96 p-4 text-xs font-mono border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 bg-slate-50/50 leading-relaxed"
                />
              ) : (
                <div className="bg-slate-50/50 border border-slate-200 p-6 rounded-2xl font-sans text-xs text-slate-700 leading-relaxed whitespace-pre-line shadow-xs font-bold">
                  {editedCoverLetter}
                </div>
              )}
            </div>
          )}

          {/* 4. Form Answers Tab */}
          {activeTab === 'answers' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">AUTO-FILLED ATS FORM QUESTIONS</span>
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Edit Form Answers</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleSaveDraft}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Answers</span>
                  </button>
                )}
              </div>

              {editedAnswers.length === 0 ? (
                <p className="text-xs text-slate-450 text-center py-8 font-bold">No specific questions parsed for this application. General credentials will be supplied.</p>
              ) : (
                <div className="space-y-4">
                  {editedAnswers.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-start">
                        <label className="text-xs font-bold text-slate-705 flex items-center space-x-1">
                          <span>{item.question}</span>
                          {item.required && <span className="text-rose-500">*</span>}
                        </label>
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-sm uppercase tracking-wide font-black">
                          {item.category}
                        </span>
                      </div>
                      
                      {editMode ? (
                        <textarea
                          value={item.answer}
                          onChange={(e) => {
                            const copy = [...editedAnswers];
                            copy[idx].answer = e.target.value;
                            setEditedAnswers(copy);
                          }}
                          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 font-bold"
                          rows={2}
                        />
                      ) : (
                        <div className="relative group">
                          <p className="text-xs text-slate-650 bg-white p-2.5 pr-12 rounded border border-slate-100 font-bold leading-relaxed">
                            {item.answer}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(item.answer, `answer-${idx}`)}
                            className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-teal-650 font-bold rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                            title="Copy answer"
                          >
                            {copiedField === `answer-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Action Tray at the bottom */}
        <div className="p-4 border-t border-slate-200/60 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSkipModal(true)}
              className="px-4 py-2 text-xs font-black text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Skip Posting
            </button>
            <button
              id="export-package-btn"
              onClick={handleExportPackage}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Download tailored CV, cover letter and form answers"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Package (.md)</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {prepareError && (
              <span className="text-[11px] text-rose-600 font-bold max-w-xs truncate" title={prepareError}>
                {prepareError}
              </span>
            )}
            {editMode && (
              <button
                onClick={() => setEditMode(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-400 hover:text-slate-650"
              >
                Cancel
              </button>
            )}

            <button
              onClick={handlePreparePackage}
              disabled={isPreparing}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center space-x-2 shadow-xs transition-colors cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Final Drafts...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Approve & Open Apply Assistant</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Skip Modal Overlay */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 max-w-md w-full space-y-4 shadow-lg">
            <h3 className="text-sm font-bold text-slate-800">Skip Job Posting</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              Why are you skipping <strong>{selectedJob.title}</strong>? Your feedback feeds into the scoring engine threshold to optimize future matching precision.
            </p>
            
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="e.g. Relocation package isn't sufficient / Too high travel requirements / Commute is too long..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500"
              rows={3}
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button 
                onClick={() => setShowSkipModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-650"
              >
                Cancel
              </button>
              <button 
                onClick={handleSkipJob}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Manual Apply Assistant Panel (copy-paste helper — the user submits on the real portal) */}
      {assistantOpen && selectedJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full h-[620px] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
            {/* Assistant Header */}
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-850 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Direct Apply Assistant</span>
                  <h3 className="text-sm font-extrabold text-white">
                    Submit Materials to {selectedJob.company}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setAssistantOpen(false);
                  onRefreshJobs();
                }}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
                title="Close Assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assistant Body split screen */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-slate-50">
              
              {/* Left Column (Step-by-Step Portal Guide - 5 cols) */}
              <div className="md:col-span-5 p-6 overflow-y-auto border-r border-slate-200/80 space-y-6 h-full flex flex-col justify-between bg-white scrollbar-thin">
                <div className="space-y-5">
                  <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl space-y-1.5">
                    <h4 className="text-xs font-extrabold text-teal-850 flex items-center space-x-1.5">
                      <Info className="w-4 h-4 text-teal-650 flex-shrink-0" />
                      <span>The Direct-Submit Standard</span>
                    </h4>
                    <p className="text-[11px] text-teal-750 font-bold leading-relaxed">
                      Enterprise career sites (Workday, Greenhouse, Lever) protect their forms behind anti-bot walls and CAPTCHAs, preventing direct automated background submittals. Follow these quick steps to apply securely in under 60 seconds!
                    </p>
                  </div>

                  {/* Step 1 */}
                  <div className="space-y-2">
                    <span className="inline-block bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      Step 1
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Launch Official Career Form</h5>
                    <p className="text-[11px] text-slate-500 font-bold">
                      Open {selectedJob.company}'s official application portal in a new browser tab.
                    </p>
                    <a
                      href={selectedJob.url || `https://www.google.com/search?q=${encodeURIComponent(selectedJob.company + " " + selectedJob.title + " careers")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 w-full justify-center py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-2xl transition-all shadow-xs cursor-pointer"
                    >
                      <span>Open Career Portal Link ↗</span>
                    </a>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-150">
                    <span className="inline-block bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      Step 2
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Copy & Paste Custom Materials</h5>
                    <p className="text-[11px] text-slate-500 font-bold">
                      Use the quick-copy buttons in the right panel to instantly copy your resume summary, tailored bullets, cover letter, and pre-filled answers.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="space-y-3 pt-3 border-t border-slate-150">
                    <div className="space-y-1">
                      <span className="inline-block bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Step 3
                      </span>
                      <h5 className="text-xs font-bold text-slate-800">Save Application Proof</h5>
                      <p className="text-[11px] text-slate-500 font-bold">
                        Once submitted, log your tracking credentials to keep your active dashboard up-to-date.
                      </p>
                    </div>

                    <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                          Application Reference ID / Req # (Optional)
                        </label>
                        <input
                          type="text"
                          value={submissionRefId}
                          onChange={(e) => setSubmissionRefId(e.target.value)}
                          placeholder="e.g. Req-910248 or 527183"
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl mt-1 focus:ring-1 focus:ring-teal-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                          Internal Logging Notes
                        </label>
                        <textarea
                          value={submissionNotes}
                          onChange={(e) => setSubmissionNotes(e.target.value)}
                          placeholder="e.g. Applied via Workday. Attached tailored cover letter."
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl mt-1 focus:ring-1 focus:ring-teal-500 font-bold"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      // Save submission updates locally in db
                      const updatedJob: Job = {
                        ...selectedJob,
                        status: 'submitted',
                        submissionDate: new Date().toISOString(),
                        notes: submissionNotes || `Logged successfully with Reference ID: ${submissionRefId || 'N/A'}`,
                        refId: submissionRefId || undefined
                      };
                      onUpdateJob(updatedJob);
                      setAssistantOpen(false);
                      onRefreshJobs();
                    }}
                    className="w-full py-3 bg-slate-900 hover:bg-black text-white text-xs font-extrabold rounded-2xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Mark Application as Submitted & Track</span>
                  </button>
                </div>
              </div>

              {/* Right Column (Tailored Assets Copy-Paste Clipboard - 7 cols) */}
              <div className="md:col-span-7 p-6 overflow-y-auto space-y-5 h-full scrollbar-thin">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Your Application Clipboard
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Click any field to copy instantly
                  </span>
                </div>

                {/* Summarized Profile Card */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-teal-650 uppercase tracking-wider">
                      1. Resume Profile Summary
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(editedSummary, 'hud-summary')}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedField === 'hud-summary' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Summary</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-650 bg-slate-50 p-3 rounded-xl border border-slate-100 font-bold leading-relaxed">
                    {editedSummary}
                  </p>
                </div>

                {/* Work History Bullets */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-teal-650 uppercase tracking-wider">
                      2. Tailored CV bullets
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(editedBullets.map(b => `• ${b}`).join('\n'), 'hud-bullets')}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedField === 'hud-bullets' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Bullets</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                    {editedBullets.map((bullet, idx) => (
                      <p key={idx} className="text-xs text-slate-650 font-bold leading-relaxed flex items-start">
                        <span className="text-teal-500 mr-1.5 select-none">•</span>
                        <span>{bullet}</span>
                      </p>
                    ))}
                  </div>
                </div>

                {/* Tailored Cover Letter */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-teal-650 uppercase tracking-wider">
                      3. Tailored Cover Letter
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(editedCoverLetter, 'hud-cover')}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedField === 'hud-cover' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Letter</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-slate-650 bg-slate-50 p-3 rounded-xl border border-slate-100 font-bold leading-relaxed whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                    {editedCoverLetter}
                  </pre>
                </div>

                {/* Prefilled Questions list */}
                {editedAnswers.length > 0 && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <span className="text-[10px] font-black text-teal-650 uppercase tracking-wider block">
                      4. ATS Custom Question Answers
                    </span>
                    <div className="space-y-3">
                      {editedAnswers.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-[11px] text-slate-550 font-extrabold">Q: {item.question}</p>
                          <div className="relative">
                            <p className="text-xs text-slate-650 bg-slate-50 p-2.5 pr-12 rounded-xl border border-slate-100 font-bold leading-relaxed">
                              {item.answer}
                            </p>
                            <button
                              onClick={() => handleCopyToClipboard(item.answer, `hud-ans-${idx}`)}
                              className="absolute right-2 top-1.5 p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Copy Answer"
                            >
                              {copiedField === `hud-ans-${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
