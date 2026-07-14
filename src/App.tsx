import React from 'react';
import { AppState, UserProfile, Job, ApplicationStatus, AppConfig } from './types.js';
import Dashboard from './components/Dashboard.js';
import ApprovalQueue from './components/ApprovalQueue.js';
import ProfileEditor from './components/ProfileEditor.js';
import JobSearch from './components/JobSearch.js';
import GoogleSignIn from './components/GoogleSignIn.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, getIdToken } from './lib/firebase.js';
import {
  FlaskConical, 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Search, 
  Settings, 
  Github, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  CheckCircle2,
  Trash2,
  LogOut
} from 'lucide-react';

// Global fetch interceptor: attaches the verified Firebase ID token to every
// /api/* request and triggers a global sign-out on 401 (invalid/expired token).
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const isApiCall = typeof input === 'string' && input.startsWith('/api/');

  if (isApiCall && auth.currentUser) {
    const token = await getIdToken();
    if (token) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('Authorization', `Bearer ${token}`);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['Authorization', `Bearer ${token}`]);
      } else {
        (init.headers as any)['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  const response = await originalFetch.call(this, input, init);

  if (response.status === 401 && isApiCall) {
    // Token invalid or expired — sign out globally
    signOut(auth).catch(() => {});
    window.dispatchEvent(new CustomEvent('auth-unauthorized'));
  }

  return response;
};

export default function App() {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'queue' | 'discovery' | 'profile' | 'settings'>('dashboard');
  const [state, setState] = React.useState<AppState | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authReady, setAuthReady] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');

  // Track the real Firebase auth session
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email ?? null);
      if (!user) setState(null);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Fetch full application state on mount
  const fetchState = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/state');
      if (res.status === 401 || res.status === 403) {
        // Interceptor / auth listener will handle sign-out
        return;
      }
      if (!res.ok) throw new Error('Could not synchronize state with Express server');
      const data = await res.json();
      setState(data);
    } catch (err: any) {
      setError(err.message || 'Server connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (userEmail) {
      fetchState();
    } else {
      setIsLoading(false);
    }
  }, [userEmail]);

  React.useEffect(() => {
    const handleUnauthorized = () => {
      setUserEmail(null);
      setState(null);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  // API Call: Save Profile
  const handleSaveProfile = async (newProfile: UserProfile) => {
    if (!state) return;
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      if (!res.ok) throw new Error('Failed to persist profile');
      const data = await res.json();
      setState(prev => prev ? { ...prev, profile: data.profile } : null);
    } catch (err: any) {
      alert(`Error updating profile: ${err.message}`);
    }
  };

  // API Call: Update Job Details/Status
  const handleUpdateJob = async (updatedJob: Job) => {
    if (!state) return;
    try {
      const res = await fetch(`/api/jobs/${updatedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedJob)
      });
      if (!res.ok) throw new Error('Failed to update job metadata');
      const freshJob = await res.json();
      
      setState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: prev.jobs.map(j => j.id === freshJob.id ? freshJob : j)
        };
      });
    } catch (err: any) {
      alert(`Error updating job: ${err.message}`);
    }
  };

  // API Call: Quick Status Switch from Kanban
  const handleUpdateJobStatus = async (id: string, status: ApplicationStatus) => {
    if (!state) return;
    const targetJob = state.jobs.find(j => j.id === id);
    if (!targetJob) return;

    const fieldsToUpdate: Partial<Job> = { status };
    if (status === 'submitted') {
      fieldsToUpdate.submissionDate = new Date().toISOString();
    }

    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldsToUpdate)
      });
      if (!res.ok) throw new Error('Status update rejected by backend');
      const freshJob = await res.json();

      setState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: prev.jobs.map(j => j.id === id ? freshJob : j)
        };
      });
    } catch (err: any) {
      alert(`Error moving application: ${err.message}`);
    }
  };

  // API Call: Add placeholder Job
  const handleAddJob = async (newJob: Job): Promise<Job | null> => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob)
      });
      
      if (res.status === 409) {
        alert('A job posting with this exact company and title already exists in your pipeline.');
        return null;
      }
      
      if (!res.ok) throw new Error('Failed to register job posting');
      const savedJob = await res.json();
      
      setState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: [savedJob, ...prev.jobs]
        };
      });
      return savedJob;
    } catch (err: any) {
      alert(`Pipeline error: ${err.message}`);
      return null;
    }
  };

  // API Call: Run AI Scoring and Tailoring
  const handleTailorJob = async (jobId: string): Promise<Job | null> => {
    try {
      const res = await fetch('/api/jobs/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      if (!res.ok) throw new Error('Gemini tailoring pipeline returned an error');
      const freshJob = await res.json();

      setState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: prev.jobs.map(j => j.id === jobId ? freshJob : j)
        };
      });
      return freshJob;
    } catch (err: any) {
      alert(`Scoring Pipeline failed: ${err.message}`);
      return null;
    }
  };

  // API Call: Update App Config Settings
  const handleSaveConfig = async (newConfig: Partial<AppConfig>) => {
    if (!state) return;
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!res.ok) throw new Error('Settings update rejected');
      const data = await res.json();
      setState(prev => prev ? { ...prev, config: data.config } : null);
      alert('Global discovery matching rule-sets updated successfully!');
    } catch (err: any) {
      alert(`Settings error: ${err.message}`);
    }
  };

  // API Call: Delete a job
  const handleDeleteJob = async (id: string) => {
    if (!state) return;
    if (!confirm('Are you sure you want to permanently delete this application from your tracker?')) return;
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      setState(prev => prev ? { ...prev, jobs: prev.jobs.filter(j => j.id !== id) } : null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        <h3 className="text-sm font-bold text-slate-700">Connecting to FoodSci Apply Agent...</h3>
        <p className="text-xs text-slate-400">Verifying cloud credentials and database synchronization</p>
      </div>
    );
  }

  if (!userEmail) {
    return <GoogleSignIn onLoginSuccess={(email) => setUserEmail(email)} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-150 max-w-md text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Database Connection Interrupted</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Could not initialize a session with the Express local server. Ensure the background dev server is active on port 3000.
          </p>
          <button 
            onClick={fetchState}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Premium Navigation Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40" id="header-bar">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xl tracking-tighter">
              F
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800">
                FoodSci<span className="text-teal-600">Apply</span>
              </h1>
              <p className="text-[10px] text-teal-600 font-bold tracking-wider uppercase">Agent: Active</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="hidden md:flex space-x-1.5" id="nav-menu">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100/80'}`}
            >
              <span className="flex items-center space-x-1.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Pipeline</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all relative ${activeTab === 'queue' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100/80'}`}
            >
              <span className="flex items-center space-x-1.5">
                <ClipboardList className="w-4 h-4" />
                <span>Approval Queue</span>
              </span>
              {state && state.jobs.filter(j => j.status === 'queued' || j.status === 'approved').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {state.jobs.filter(j => j.status === 'queued' || j.status === 'approved').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('discovery')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'discovery' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100/80'}`}
            >
              <span className="flex items-center space-x-1.5">
                <Search className="w-4 h-4" />
                <span>Discovery Search</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'profile' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100/80'}`}
            >
              <span className="flex items-center space-x-1.5">
                <FileText className="w-4 h-4" />
                <span>My Profile</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'settings' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100/80'}`}
            >
              <span className="flex items-center space-x-1.5">
                <Settings className="w-4 h-4" />
                <span>Rules Config</span>
              </span>
            </button>
          </nav>

          {/* User Avatar & Settings Panel Quick-View */}
          <div className="flex items-center space-x-4">
            <span className="text-[11px] bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-bold border border-teal-100 hidden lg:inline-block">
              {userEmail}
            </span>
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-black select-none" title={`Authenticated as ${userEmail}`}>
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : 'HM'}
            </div>
            <button
              onClick={() => {
                signOut(auth).catch(() => {});
                setState(null);
              }}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              title="Sign Out of Google Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Subheader Navigation Menu */}
      <div className="md:hidden bg-white border-b border-slate-200 grid grid-cols-5 text-center text-[10px] font-bold text-slate-500 divide-x divide-slate-100" id="mobile-nav">
        <button onClick={() => setActiveTab('dashboard')} className={`py-3 ${activeTab === 'dashboard' ? 'text-teal-600 bg-teal-50/20' : ''}`}>Pipeline</button>
        <button onClick={() => setActiveTab('queue')} className={`py-3 relative ${activeTab === 'queue' ? 'text-teal-600 bg-teal-50/20' : ''}`}>
          Queue
          {state && state.jobs.filter(j => j.status === 'queued' || j.status === 'approved').length > 0 && (
            <span className="absolute top-1 right-2 bg-teal-500 text-white text-[8px] px-1 rounded-full">
              {state.jobs.filter(j => j.status === 'queued' || j.status === 'approved').length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('discovery')} className={`py-3 ${activeTab === 'discovery' ? 'text-teal-600 bg-teal-50/20' : ''}`}>Discovery</button>
        <button onClick={() => setActiveTab('profile')} className={`py-3 ${activeTab === 'profile' ? 'text-teal-600 bg-teal-50/20' : ''}`}>Profile</button>
        <button onClick={() => setActiveTab('settings')} className={`py-3 ${activeTab === 'settings' ? 'text-teal-600 bg-teal-50/20' : ''}`}>Config</button>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8" id="main-frame">
        {state && (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                jobs={state.jobs} 
                onSelectJob={(job) => {
                  // Direct click on job redirects to Approval Queue and selects it!
                  setActiveTab('queue');
                }}
                onUpdateJobStatus={handleUpdateJobStatus}
              />
            )}

            {activeTab === 'queue' && (
              <ApprovalQueue
                jobs={state.jobs}
                profile={state.profile}
                onUpdateJob={handleUpdateJob}
                onRefreshJobs={fetchState}
              />
            )}

            {activeTab === 'discovery' && (
              <JobSearch 
                jobs={state.jobs} 
                onAddJob={handleAddJob}
                onTailorJob={handleTailorJob}
                onNavigateToQueue={() => setActiveTab('queue')}
                onRefreshJobs={fetchState}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileEditor 
                profile={state.profile} 
                onSaveProfile={handleSaveProfile}
              />
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fade-in" id="settings-frame">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Matching Threshold & Rule Sets</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Define constraints for the autonomous scoring pass and daily scrapers.</p>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                  {/* Fit Score Threshold */}
                  <div className="pt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-bold text-slate-700">Minimum Fit Score Threshold</label>
                      <span className="font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-100">
                        {state.config.threshold}% and above
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Postings scored lower than this will be filtered out and won't appear in the queue.</p>
                    <input 
                      type="range" 
                      min="50" 
                      max="90" 
                      value={state.config.threshold} 
                      onChange={(e) => handleSaveConfig({ threshold: Number(e.target.value) })}
                      className="w-full accent-teal-600 cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Keywords Selection */}
                  <div className="pt-4 space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Job Discovery Search Keywords</label>
                    <p className="text-[11px] text-slate-400">Keywords used by the autonomous scheduler to query niche food science boards.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {state.config.keywords.map(kw => (
                        <span key={kw} className="bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1">
                          <span>{kw}</span>
                          <button 
                            onClick={() => {
                              const updated = state.config.keywords.filter(k => k !== kw);
                              handleSaveConfig({ keywords: updated });
                            }}
                            className="text-slate-400 hover:text-rose-600 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    
                    {/* Add keyword input */}
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem('newKeyword') as HTMLInputElement;
                      if (input.value.trim() && !state.config.keywords.includes(input.value.trim())) {
                        const updated = [...state.config.keywords, input.value.trim()];
                        handleSaveConfig({ keywords: updated });
                        input.value = '';
                      }
                    }} className="flex space-x-2 max-w-xs">
                      <input 
                        type="text" 
                        name="newKeyword"
                        placeholder="e.g. sensory evaluation" 
                        className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg flex-1 focus:ring-1 focus:ring-teal-500"
                      />
                      <button type="submit" className="px-3 bg-slate-800 text-white font-bold rounded-lg text-xs hover:bg-slate-900 cursor-pointer">
                        Add
                      </button>
                    </form>
                  </div>

                  {/* LinkedIn Easy Apply Toggle */}
                  <div className="pt-4 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-md pr-6">
                      <label className="text-xs font-bold text-slate-700 block">LinkedIn Easy Apply Module</label>
                      <span className="text-[10px] text-rose-600 font-black bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-sm uppercase tracking-wide inline-block">
                        ⚠️ ToS Warning
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Automating LinkedIn submissions violates their Terms of Service and introduces account-ban risks. Keep this disabled unless you explicitly accept the compliance risks.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={state.config.linkedinToggle} 
                        onChange={(e) => handleSaveConfig({ linkedinToggle: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* Permanent Job listings purge for resetting */}
                  <div className="pt-6 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Delete All Applications</h4>
                      <p className="text-[11px] text-slate-400">Clear all records and pipeline listings back to seed default state.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('Are you absolutely sure you want to delete all job listings in your workspace pipeline? This action cannot be undone.')) {
                          try {
                            const res = await fetch('/api/state');
                            const data = await res.json();
                            // clear except seed defaults or update status
                            for (const job of data.jobs) {
                              await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
                            }
                            fetchState();
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }
                      }}
                      className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge Listings</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Styled Footer */}
      <footer className="bg-white border-t border-gray-100 py-6" id="footer-bar">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-gray-400 font-medium">
          <div className="flex items-center space-x-1.5">
            <span>© 2026 FoodSci Apply Agent. Designed by Hamza Mahmood for autonomous careers.</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hover:text-gray-600 cursor-pointer">Security Protocol v1.1</span>
            <span>•</span>
            <span className="hover:text-gray-600 cursor-pointer">Grounding Validator Active</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
