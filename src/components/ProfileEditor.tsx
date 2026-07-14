import React from 'react';
import { UserProfile, WorkExperience } from '../types.js';
import { 
  User, 
  BookOpen, 
  Briefcase, 
  Cpu, 
  Award, 
  Settings, 
  Sparkles, 
  Save, 
  Plus, 
  Trash2, 
  FileText, 
  Loader2, 
  CheckCircle,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

// Helper to ensure all profile fields and lists are always defined as clean, valid arrays and objects
function sanitizeProfile(prof: any): UserProfile {
  return {
    contact: {
      name: prof?.contact?.name || '',
      email: prof?.contact?.email || '',
      phone: prof?.contact?.phone || '',
      location: prof?.contact?.location || '',
      linkedin: prof?.contact?.linkedin || '',
      portfolio: prof?.contact?.portfolio || '',
    },
    education: {
      degree: prof?.education?.degree || '',
      institution: prof?.education?.institution || '',
      fieldOfStudy: prof?.education?.fieldOfStudy || '',
      graduationYear: prof?.education?.graduationYear || '',
      gpa: prof?.education?.gpa || '',
    },
    workHistory: (prof?.workHistory || []).map((exp: any) => ({
      company: exp?.company || '',
      role: exp?.role || '',
      startDate: exp?.startDate || '',
      endDate: exp?.endDate || '',
      description: exp?.description || '',
      bullets: Array.isArray(exp?.bullets) ? exp.bullets.filter((b: any) => typeof b === 'string') : []
    })),
    skills: Array.isArray(prof?.skills) ? prof.skills.filter((s: any) => typeof s === 'string') : [],
    certifications: Array.isArray(prof?.certifications) ? prof.certifications.filter((c: any) => typeof c === 'string') : [],
    preferences: {
      salaryExpectation: prof?.preferences?.salaryExpectation || '',
      locations: Array.isArray(prof?.preferences?.locations) ? prof.preferences.locations : [],
      workAuthorization: prof?.preferences?.workAuthorization || '',
      noticePeriod: prof?.preferences?.noticePeriod || '',
      jobTypes: Array.isArray(prof?.preferences?.jobTypes) ? prof.preferences.jobTypes : [],
    },
    standardAnswers: {
      companyReason: prof?.standardAnswers?.companyReason || '',
      diversityAnswer: prof?.standardAnswers?.diversityAnswer || '',
      noticePeriodAnswer: prof?.standardAnswers?.noticePeriodAnswer || '',
      rightToWorkAnswer: prof?.standardAnswers?.rightToWorkAnswer || '',
      salaryExpectationAnswer: prof?.standardAnswers?.salaryExpectationAnswer || '',
      ...prof?.standardAnswers
    }
  };
}

interface ProfileEditorProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export default function ProfileEditor({ profile, onSaveProfile }: ProfileEditorProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<'personal' | 'experience' | 'skills' | 'answers'>('personal');
  const [editedProfile, setEditedProfile] = React.useState<UserProfile>(() => sanitizeProfile(profile));
  const [rawCVText, setRawCVText] = React.useState<string>('');
  const [isParsing, setIsParsing] = React.useState<boolean>(false);
  const [parseSuccess, setParseSuccess] = React.useState<boolean>(false);
  const [saveStatus, setSaveStatus] = React.useState<string>('');

  // Sync state if prop changes
  React.useEffect(() => {
    setEditedProfile(sanitizeProfile(profile));
  }, [profile]);

  // Handle parsing raw CV text with Gemini
  const handleParseCV = async () => {
    if (!rawCVText.trim()) return;
    setIsParsing(true);
    setParseSuccess(false);

    try {
      const res = await fetch('/api/profile/parse-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: rawCVText })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to parse CV');
      }

      const parsedData = await res.json();
      
      // Merge parsed details into current profile safely
      const mergedProfile: UserProfile = sanitizeProfile({
        ...editedProfile,
        contact: {
          ...editedProfile.contact,
          name: parsedData.contact?.name || editedProfile.contact.name,
          email: parsedData.contact?.email || editedProfile.contact.email,
          phone: parsedData.contact?.phone || editedProfile.contact.phone,
          location: parsedData.contact?.location || editedProfile.contact.location,
          linkedin: parsedData.contact?.linkedin || editedProfile.contact.linkedin,
          portfolio: parsedData.contact?.portfolio || editedProfile.contact.portfolio,
        },
        education: {
          degree: parsedData.education?.degree || editedProfile.education.degree,
          institution: parsedData.education?.institution || editedProfile.education.institution,
          fieldOfStudy: parsedData.education?.fieldOfStudy || editedProfile.education.fieldOfStudy,
          graduationYear: parsedData.education?.graduationYear || editedProfile.education.graduationYear,
          gpa: parsedData.education?.gpa || editedProfile.education.gpa,
        },
        workHistory: parsedData.workHistory || editedProfile.workHistory,
        skills: parsedData.skills && parsedData.skills.length > 0 ? parsedData.skills : editedProfile.skills,
        certifications: parsedData.certifications && parsedData.certifications.length > 0 ? parsedData.certifications : editedProfile.certifications
      });

      setEditedProfile(mergedProfile);
      setParseSuccess(true);
      setRawCVText('');
      
      // Auto save after parsing
      onSaveProfile(mergedProfile);
    } catch (err: any) {
      alert(`CV Parser failed: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Save changes manually
  const handleSaveAll = () => {
    onSaveProfile(editedProfile);
    setSaveStatus('Profile Saved!');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  // Quick state update helper
  const updateContact = (key: string, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      contact: { ...prev.contact, [key]: value }
    }));
  };

  const updateEducation = (key: string, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      education: { ...prev.education, [key]: value }
    }));
  };

  const updatePreferences = (key: string, value: any) => {
    setEditedProfile(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value }
    }));
  };

  const updateAnswers = (key: string, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      standardAnswers: { ...prev.standardAnswers, [key]: value }
    }));
  };

  // Experience management
  const handleAddExperience = () => {
    const newExp: WorkExperience = {
      company: 'New Food Corp',
      role: 'QA Associate',
      startDate: '2026-01',
      endDate: '2026-07',
      description: 'Performed standard safety operations.',
      bullets: ['Conducted product checking and chemical audits.']
    };
    setEditedProfile(prev => ({
      ...prev,
      workHistory: [newExp, ...prev.workHistory]
    }));
  };

  const handleUpdateExperience = (idx: number, fields: Partial<WorkExperience>) => {
    setEditedProfile(prev => {
      const copy = [...prev.workHistory];
      copy[idx] = { ...copy[idx], ...fields };
      return { ...prev, workHistory: copy };
    });
  };

  const handleDeleteExperience = (idx: number) => {
    setEditedProfile(prev => ({
      ...prev,
      workHistory: prev.workHistory.filter((_, i) => i !== idx)
    }));
  };

  // Skill & cert list tags
  const [newSkillTag, setNewSkillTag] = React.useState<string>('');
  const handleAddSkill = () => {
    if (newSkillTag.trim() && !editedProfile.skills.includes(newSkillTag.trim())) {
      setEditedProfile(prev => ({
        ...prev,
        skills: [...prev.skills, newSkillTag.trim()]
      }));
      setNewSkillTag('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setEditedProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const [newCertTag, setNewCertTag] = React.useState<string>('');
  const handleAddCert = () => {
    if (newCertTag.trim() && !editedProfile.certifications.includes(newCertTag.trim())) {
      setEditedProfile(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertTag.trim()]
      }));
      setNewCertTag('');
    }
  };

  const handleRemoveCert = (cert: string) => {
    setEditedProfile(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert)
    }));
  };

  const [newLocationTag, setNewLocationTag] = React.useState<string>('');
  const handleAddLocation = () => {
    if (newLocationTag.trim() && !(editedProfile.preferences.locations || []).includes(newLocationTag.trim())) {
      setEditedProfile(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          locations: [...(prev.preferences.locations || []), newLocationTag.trim()]
        }
      }));
      setNewLocationTag('');
    }
  };

  const handleRemoveLocation = (loc: string) => {
    setEditedProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        locations: (prev.preferences.locations || []).filter(l => l !== loc)
      }
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in" id="profile-editor-parent">
      
      {/* 1. Resume Parser & Sub-Tabs Navigation (4 Cols) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* CV AI Parse card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span>Gemini CV Autocomplete</span>
            </h3>
            <span className="text-[9px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-sm font-bold border border-teal-100">AI Enabled</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            Paste your full raw resume (including academic projects, skills, and certifications) below. Gemini will instantly parse, structure, and pre-fill your entire dashboard profile.
          </p>

          <textarea
            value={rawCVText}
            onChange={(e) => setRawCVText(e.target.value)}
            placeholder="Paste your resume text here..."
            className="w-full h-36 p-3 text-xs border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-mono placeholder:font-sans"
          />

          <button
            onClick={handleParseCV}
            disabled={isParsing || !rawCVText.trim()}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 disabled:bg-slate-100 disabled:text-slate-400 transition-colors cursor-pointer"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deconstructing Resume...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract with Gemini</span>
              </>
            )}
          </button>

          {parseSuccess && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-2xl flex items-center space-x-2 text-xs text-green-800 font-medium animate-bounce mt-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Parsed & Loaded successfully!</span>
            </div>
          )}
        </div>

        {/* Profile Navigation Cards */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-200/60">
            <span className="text-xs font-bold text-slate-700">PROFILE SECTIONS</span>
          </div>
          <div className="flex flex-col text-xs font-bold text-slate-600 divide-y divide-slate-100">
            <button
              onClick={() => setActiveSubTab('personal')}
              className={`p-4 text-left flex items-center space-x-2.5 transition-colors ${activeSubTab === 'personal' ? 'bg-teal-50/40 text-teal-750 border-l-4 border-teal-600' : 'hover:bg-slate-50/50'}`}
            >
              <User className="w-4 h-4" />
              <span>Personal & Education</span>
            </button>
            <button
              onClick={() => setActiveSubTab('experience')}
              className={`p-4 text-left flex items-center space-x-2.5 transition-colors ${activeSubTab === 'experience' ? 'bg-teal-50/40 text-teal-750 border-l-4 border-teal-600' : 'hover:bg-slate-50/50'}`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Professional History</span>
            </button>
            <button
              onClick={() => setActiveSubTab('skills')}
              className={`p-4 text-left flex items-center space-x-2.5 transition-colors ${activeSubTab === 'skills' ? 'bg-teal-50/40 text-teal-750 border-l-4 border-teal-600' : 'hover:bg-slate-50/50'}`}
            >
              <Cpu className="w-4 h-4" />
              <span>Skills & Certifications</span>
            </button>
            <button
              onClick={() => setActiveSubTab('answers')}
              className={`p-4 text-left flex items-center space-x-2.5 transition-colors ${activeSubTab === 'answers' ? 'bg-teal-50/40 text-teal-750 border-l-4 border-teal-600' : 'hover:bg-slate-50/50'}`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Standard Form Answers</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Form Editor Pane (8 Cols) */}
      <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl flex flex-col shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/20">
          <h2 className="text-sm font-bold text-slate-850 uppercase tracking-wider">
            {activeSubTab === 'personal' && 'Personal Profile & Academic Background'}
            {activeSubTab === 'experience' && 'Work & Laboratory Experience'}
            {activeSubTab === 'skills' && 'Technical Skills & Regulatory Certifications'}
            {activeSubTab === 'answers' && 'Standard Answer Library'}
          </h2>

          <div className="flex items-center space-x-3">
            {saveStatus && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-2xl font-bold animate-pulse">
                {saveStatus}
              </span>
            )}
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(100vh-220px)] space-y-6" id="editor-form-scroll">
          
          {/* A. PERSONAL SUBTAB */}
          {activeSubTab === 'personal' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Full Name</label>
                  <input
                    type="text"
                    value={editedProfile.contact.name}
                    onChange={(e) => updateContact('name', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Email Address</label>
                  <input
                    type="email"
                    value={editedProfile.contact.email}
                    onChange={(e) => updateContact('email', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Phone Number</label>
                  <input
                    type="text"
                    value={editedProfile.contact.phone}
                    onChange={(e) => updateContact('phone', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Location (City, State)</label>
                  <input
                    type="text"
                    value={editedProfile.contact.location}
                    onChange={(e) => updateContact('location', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">LinkedIn URL</label>
                  <input
                    type="text"
                    value={editedProfile.contact.linkedin}
                    onChange={(e) => updateContact('linkedin', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Portfolio URL</label>
                  <input
                    type="text"
                    value={editedProfile.contact.portfolio}
                    onChange={(e) => updateContact('portfolio', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
              </div>

              {/* Education Block */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-bold text-slate-750 uppercase tracking-wider flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-teal-500" />
                  <span>Academic Qualifications</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Degree & Level</label>
                    <input
                      type="text"
                      value={editedProfile.education.degree}
                      onChange={(e) => updateEducation('degree', e.target.value)}
                      placeholder="e.g. Bachelor of Science"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Institution</label>
                    <input
                      type="text"
                      value={editedProfile.education.institution}
                      onChange={(e) => updateEducation('institution', e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Field of Study / Major</label>
                    <input
                      type="text"
                      value={editedProfile.education.fieldOfStudy}
                      onChange={(e) => updateEducation('fieldOfStudy', e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Graduation Year</label>
                      <input
                        type="text"
                        value={editedProfile.education.graduationYear}
                        onChange={(e) => updateEducation('graduationYear', e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Cumulative GPA</label>
                      <input
                        type="text"
                        value={editedProfile.education.gpa}
                        onChange={(e) => updateEducation('gpa', e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preferences details */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-bold text-slate-750 uppercase tracking-wider flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-teal-500" />
                  <span>Job Search Preferences</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Target Salary Expectation</label>
                    <input
                      type="text"
                      value={editedProfile.preferences.salaryExpectation}
                      onChange={(e) => updatePreferences('salaryExpectation', e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Notice Period / Availability</label>
                    <input
                      type="text"
                      value={editedProfile.preferences.noticePeriod}
                      onChange={(e) => updatePreferences('noticePeriod', e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>
                  <div className="space-y-1 col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500">US Work Authorization Status</label>
                    <input
                      type="text"
                      value={editedProfile.preferences.workAuthorization}
                      onChange={(e) => updatePreferences('workAuthorization', e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                    />
                  </div>

                  {/* Target Locations for Autonomous Discovery */}
                  <div className="space-y-2 col-span-1 md:col-span-2 pt-2">
                    <label className="text-xs font-bold text-slate-500 block">Preferred Job Discovery Locations</label>
                    <p className="text-[11px] text-slate-400">Our autonomous crawler and matches generator will use these target locations to scan for food science positions. Add "Chicagoland Area", "Remote", etc.</p>
                    
                    <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-2xl bg-slate-50/30">
                      {(editedProfile.preferences.locations || []).length === 0 ? (
                        <span className="text-xs text-slate-400 font-bold italic">No preferred locations added yet. (Will default to any location)</span>
                      ) : (
                        (editedProfile.preferences.locations || []).map(loc => (
                          <span 
                            key={loc}
                            className="inline-flex items-center space-x-1.5 bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold shadow-2xs"
                          >
                            <span>{loc}</span>
                            <button 
                              type="button"
                              onClick={() => handleRemoveLocation(loc)}
                              className="text-slate-400 hover:text-rose-650 font-bold text-xs"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="flex space-x-2 max-w-sm pt-1">
                      <input
                        type="text"
                        value={newLocationTag}
                        onChange={(e) => setNewLocationTag(e.target.value)}
                        placeholder="e.g. Chicagoland Area"
                        className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddLocation();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddLocation}
                        className="px-4 py-2 bg-slate-800 text-white font-bold rounded-2xl text-xs hover:bg-slate-900 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. EXPERIENCE SUBTAB */}
          {activeSubTab === 'experience' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-bold">Total historical logs ({editedProfile.workHistory.length})</span>
                <button
                  onClick={handleAddExperience}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Work Role</span>
                </button>
              </div>

              {editedProfile.workHistory.map((exp, idx) => (
                <div key={idx} className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4 relative group">
                  <button
                    onClick={() => handleDeleteExperience(idx)}
                    className="absolute top-4 right-4 p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Company Name</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => handleUpdateExperience(idx, { company: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Role Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => handleUpdateExperience(idx, { role: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Start Date (YYYY-MM)</label>
                      <input
                        type="text"
                        value={exp.startDate}
                        onChange={(e) => handleUpdateExperience(idx, { startDate: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">End Date (YYYY-MM or Present)</label>
                      <input
                        type="text"
                        value={exp.endDate}
                        onChange={(e) => handleUpdateExperience(idx, { endDate: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Role Summary</label>
                    <textarea
                      value={exp.description}
                      onChange={(e) => handleUpdateExperience(idx, { description: e.target.value })}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-bold"
                      rows={2}
                    />
                  </div>

                  {/* Bullets List */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-550 block">Accomplishment Bullets (Strictly Grounded)</label>
                    {(exp.bullets || []).map((bullet, bulletIdx) => (
                      <div key={bulletIdx} className="flex items-center space-x-2">
                        <span className="text-teal-500 font-bold">•</span>
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const copyBullets = [...(exp.bullets || [])];
                            copyBullets[bulletIdx] = e.target.value;
                            handleUpdateExperience(idx, { bullets: copyBullets });
                          }}
                          className="flex-1 text-xs p-1.5 bg-white border border-slate-200 rounded-xl font-bold"
                        />
                        <button
                          onClick={() => {
                            const copyBullets = (exp.bullets || []).filter((_, bIdx) => bIdx !== bulletIdx);
                            handleUpdateExperience(idx, { bullets: copyBullets });
                          }}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        handleUpdateExperience(idx, { bullets: [...(exp.bullets || []), 'Performed regular lab test measurements.'] });
                      }}
                      className="text-[10px] text-teal-600 font-bold flex items-center space-x-0.5 mt-1 hover:text-teal-700"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Bullet Point</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}          {/* C. SKILLS SUBTAB */}
          {activeSubTab === 'skills' && (
            <div className="space-y-8 animate-fade-in">
              {/* Technical Skills Tag Engine */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-755 uppercase tracking-wider flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-teal-500" />
                  <span>Technical & Food Laboratory Competencies</span>
                </h3>
                
                <div className="flex flex-wrap gap-2 p-4 border border-slate-200 rounded-3xl bg-slate-50/30">
                  {editedProfile.skills.map(skill => (
                    <span 
                      key={skill}
                      className="inline-flex items-center space-x-1.5 bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold group shadow-2xs"
                    >
                      <span>{skill}</span>
                      <button 
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-slate-400 hover:text-rose-600 font-bold text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex space-x-2 max-w-sm">
                  <input
                    type="text"
                    value={newSkillTag}
                    onChange={(e) => setNewSkillTag(e.target.value)}
                    placeholder="e.g. HPLC analysis, Moisture analyzer"
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-4 bg-slate-800 text-white font-bold rounded-2xl text-xs hover:bg-slate-900"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Regulatory Certifications Tag Engine */}
              <div className="space-y-3 pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-755 uppercase tracking-wider flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-teal-500" />
                  <span>Professional Safety Certifications</span>
                </h3>
                
                <div className="flex flex-wrap gap-2 p-4 border border-slate-200 rounded-3xl bg-slate-50/30">
                  {editedProfile.certifications.map(cert => (
                    <span 
                      key={cert}
                      className="inline-flex items-center space-x-1.5 bg-teal-50 text-teal-850 border border-teal-200 px-3 py-1.5 rounded-full text-xs font-bold group shadow-2xs"
                    >
                      <span>{cert}</span>
                      <button 
                        onClick={() => handleRemoveCert(cert)}
                        className="text-teal-500 hover:text-rose-600 font-bold text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex space-x-2 max-w-sm">
                  <input
                    type="text"
                    value={newCertTag}
                    onChange={(e) => setNewCertTag(e.target.value)}
                    placeholder="e.g. HACCP Certified, SQF Practitioner"
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    onClick={handleAddCert}
                    className="px-4 bg-slate-800 text-white font-bold rounded-2xl text-xs hover:bg-slate-900"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* D. ANSWERS SUBTAB */}
          {activeSubTab === 'answers' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 bg-teal-50/30 border border-teal-150 rounded-2xl text-xs text-teal-850 font-bold">
                Standard templates for complex application statements. The Gemini agent automatically weaves these values together with the specific company mission, values, and location parameters to construct perfect tailored essays.
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Why do you want to work at our company?</label>
                  <textarea
                    value={editedProfile.standardAnswers.companyReason}
                    onChange={(e) => updateAnswers('companyReason', e.target.value)}
                    className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Diversity, Equity, & Inclusion statement:</label>
                  <textarea
                    value={editedProfile.standardAnswers.diversityAnswer}
                    onChange={(e) => updateAnswers('diversityAnswer', e.target.value)}
                    className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Relocation / Travel availability:</label>
                  <textarea
                    value={editedProfile.standardAnswers.noticePeriodAnswer}
                    onChange={(e) => updateAnswers('noticePeriodAnswer', e.target.value)}
                    className="w-full h-20 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Notice Period / Availability details:</label>
                  <textarea
                    value={editedProfile.standardAnswers.noticePeriodAnswer}
                    onChange={(e) => updateAnswers('noticePeriodAnswer', e.target.value)}
                    className="w-full h-20 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-1 focus:ring-teal-500 font-bold"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
