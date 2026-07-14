import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDbData, saveDbData, syncFromFirestore } from './server/db.js';
import { UserProfile, Job, PrefilledAnswer, TailoredCV } from './src/types.js';

dotenv.config();

// Firebase Admin — used only to verify Google ID tokens issued by Firebase Auth.
// Verification only needs the projectId (public certs are fetched from Google).
let adminAuthReady = false;
try {
  const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf-8'));
  if (fbConfig.projectId) {
    if (getAdminApps().length === 0) {
      initializeAdminApp({ projectId: fbConfig.projectId });
    }
    adminAuthReady = true;
    console.log(`[Auth] Firebase Admin initialized for token verification (project: ${fbConfig.projectId})`);
  }
} catch (err: any) {
  console.warn('[Auth] Firebase Admin initialization failed — API auth will reject all requests:', err.message);
}

// Emails permitted to use the app (comma-separated in .env)
const AUTHORIZED_EMAILS = (process.env.AUTHORIZED_ADMINS || 'hamza3mahmood@gmail.com,fajngir@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Initialize Express
const app = express();
const PORT = 3000;

// Set up body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy Gemini Client Initializer
function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please supply GEMINI_API_KEY in the Secrets panel.');
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Utility to clean and parse JSON securely
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

// Robust wrapper to generate content with fallback and retries if the primary model fails (e.g. 503 high demand)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithFallback(aiClient: GoogleGenAI, params: any) {
  const modelsToTry = [
    params.model || 'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini API] Trying model ${model} (attempt ${attempt}/${maxRetries})...`);
        const result = await aiClient.models.generateContent({
          ...params,
          model: model
        });
        console.log(`[Gemini API] Successfully generated content using ${model}`);
        return result;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || JSON.stringify(error) || String(error);
        console.warn(`[Gemini API] Model ${model} (attempt ${attempt}/${maxRetries}) failed:`, errorMessage);

        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          console.log(`[Gemini API] Waiting ${delay}ms before retrying ${model}...`);
          await sleep(delay);
        }
      }
    }
    console.warn(`[Gemini API] All attempts for model ${model} failed. Trying next fallback model...`);
  }

  throw new Error(`Gemini API execution failed after trying multiple models and retrying. Last error: ${lastError?.message || JSON.stringify(lastError) || lastError}`);
}

// Protect all /api/* routes: verify the Firebase ID token from the Authorization header,
// then check the verified email against the allow-list. Spoofing a header is no longer enough —
// the token signature is validated against Google's public certs.
app.use('/api', async (req, res, next) => {
  const authHeader = req.headers['authorization']?.toString() || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing sign-in token. Please sign in with Google.' });
  }

  if (!adminAuthReady) {
    return res.status(503).json({ error: 'Auth is not configured on the server (missing firebase-applet-config.json).' });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase();

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: Token does not contain a verified email.' });
    }
    if (!AUTHORIZED_EMAILS.includes(email)) {
      return res.status(403).json({ error: `Access denied: ${email} is not on the authorized user list.` });
    }

    (req as any).userEmail = email;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Unauthorized: Sign-in token is invalid or expired. Please sign in again.' });
  }
});

// Lightweight identity check used by the client right after Google sign-in
app.get('/api/auth/me', (req, res) => {
  res.json({ email: (req as any).userEmail });
});

// REST APIs - Config & Data Store
app.get('/api/state', (req, res) => {
  try {
    const data = getDbData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve application state', details: err.message });
  }
});

app.put('/api/profile', (req, res) => {
  try {
    const newProfile: UserProfile = req.body;
    const data = getDbData();
    data.profile = newProfile;
    saveDbData(data);
    res.json({ message: 'Profile updated successfully', profile: data.profile });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

app.put('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    const data = getDbData();
    data.config = { ...data.config, ...newConfig };
    saveDbData(data);
    res.json({ message: 'Configuration updated successfully', config: data.config });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update config', details: err.message });
  }
});

// GET list of jobs
app.get('/api/jobs', (req, res) => {
  try {
    const data = getDbData();
    res.json(data.jobs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve jobs', details: err.message });
  }
});

// POST a new job manually or before tailoring
app.post('/api/jobs', (req, res) => {
  try {
    const newJob: Job = req.body;
    const data = getDbData();
    
    // Simple validation
    if (!newJob.title || !newJob.company) {
      return res.status(400).json({ error: 'Job Title and Company are required' });
    }

    // Set defaults if not provided
    newJob.id = newJob.id || `job-${Date.now()}`;
    newJob.status = newJob.status || 'found';
    newJob.createdAt = newJob.createdAt || new Date().toISOString();
    newJob.prefilledAnswers = newJob.prefilledAnswers || [];
    newJob.tailoredCV = newJob.tailoredCV || { summary: '', highlights: [], bullets: [] };
    newJob.tailoredCoverLetter = newJob.tailoredCoverLetter || '';
    
    // Check if duplicate (company + title)
    const duplicate = data.jobs.find(
      j => j.title.toLowerCase().trim() === newJob.title.toLowerCase().trim() &&
           j.company.toLowerCase().trim() === newJob.company.toLowerCase().trim()
    );
    if (duplicate) {
      return res.status(409).json({ error: 'A job posting with this title and company already exists.' });
    }

    data.jobs.unshift(newJob);
    saveDbData(data);
    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save job', details: err.message });
  }
});

// PUT to update an existing job's status or other details
app.put('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;
    const data = getDbData();
    
    const jobIndex = data.jobs.findIndex(j => j.id === id);
    if (jobIndex === -1) {
      return res.status(404).json({ error: 'Job not found' });
    }

    data.jobs[jobIndex] = { ...data.jobs[jobIndex], ...updatedFields };
    saveDbData(data);
    res.json(data.jobs[jobIndex]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update job', details: err.message });
  }
});

// DELETE a job listing
app.delete('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    
    const initialLength = data.jobs.length;
    data.jobs = data.jobs.filter(j => j.id !== id);
    
    if (data.jobs.length === initialLength) {
      return res.status(404).json({ error: 'Job not found' });
    }

    saveDbData(data);
    res.json({ message: 'Job deleted successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete job', details: err.message });
  }
});

// AI ENDPOINT 1: Parse CV text into Profile structure
app.post('/api/profile/parse-cv', async (req, res) => {
  try {
    const { cvText } = req.body;
    if (!cvText || cvText.trim().length === 0) {
      return res.status(400).json({ error: 'No CV content provided.' });
    }

    const aiClient = getAIClient();

    const systemPrompt = `You are an expert AI resume-parsing system designed to extract structured information from resumes of Food Science and laboratory professionals. 
Your goal is to parse the raw text CV of a user into a perfectly clean, structured JSON format matching the specified schema. 
Be accurate, extract standard certifications (like HACCP, PCQI, SQF, BRC) and wet lab / sensory technical skills cleanly. Do not invent any values. Leave missing values empty instead of fabricating them.`;

    const userPrompt = `Parse the following raw text CV and structure it:
\n\n--- BEGIN CV ---
${cvText}
--- END CV ---`;

    const response = await generateContentWithFallback(aiClient, {
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contact: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                portfolio: { type: Type.STRING }
              },
              required: ["name"]
            },
            education: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING },
                institution: { type: Type.STRING },
                fieldOfStudy: { type: Type.STRING },
                graduationYear: { type: Type.STRING },
                gpa: { type: Type.STRING }
              }
            },
            workHistory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  role: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  description: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["company", "role"]
              }
            },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            certifications: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["contact", "workHistory", "skills"]
        }
      }
    });

    const parsedJson = cleanAndParseJson(response.text);
    res.json(parsedJson);
  } catch (err: any) {
    console.error('Error parsing CV via Gemini:', err);
    res.status(500).json({ error: 'Failed to parse CV via Gemini', details: err.message });
  }
});

// AI ENDPOINT 2: Tailor CV, Cover letter and Form answers for a specific job
app.post('/api/jobs/tailor', async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const data = getDbData();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job listing not found' });
    }

    const aiClient = getAIClient();

    const profile = data.profile;

    const systemPrompt = `You are FoodSci Apply's autonomous matching and tailoring agent. Your mission is to help a recent Food Science graduate secure entry-level roles.
You must perform the following tasks based on the provided USER PROFILE and JOB DESCRIPTION:
1. Score the job from 0 to 100 based on alignment with the user's qualifications and entry-level safety (0-2 years, QC, QA, R&D assistant, lab technician, sensory).
2. Write a detailed, realistic, constructive 1-paragraph fit rationale. Highlight alignment with skills (HACCP, environmental swabbing, wet-lab, titration, HPLC).
3. Identify a list of qualifications gaps (e.g., physical requirements, certifications or specific software/tools mentioned in the job description that the user lacks).
4. Generate a tailored CV variation (strict grounding: NEVER fabricate experience, but focus bullets and summary on relevant keywords like GMP, SQF, FDA, microbial assays, or textures).
5. Compose a polished, professional, compelling Cover Letter of exactly 200-250 words, grounded in actual work experience, expressing enthusiasm for the company and explaining why they are a perfect fit.
6. Infer 3-4 standard/technical application questions (e.g. rights to work, relocation, HACCP, or tools) and pre-fill tailored, accurate answers based on the user's preferences and actual profile details.`;

    const userPrompt = `### USER PROFILE:
${JSON.stringify(profile, null, 2)}

### JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}

Generate the JSON payload for this application package.`;

    const response = await generateContentWithFallback(aiClient, {
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fitScore: { type: Type.INTEGER },
            fitRationale: { type: Type.STRING },
            qualificationsGap: { type: Type.ARRAY, items: { type: Type.STRING } },
            tailoredCV: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["summary", "highlights", "bullets"]
            },
            tailoredCoverLetter: { type: Type.STRING },
            prefilledAnswers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  required: { type: Type.BOOLEAN },
                  category: { type: Type.STRING }
                },
                required: ["question", "answer", "required", "category"]
              }
            }
          },
          required: ["fitScore", "fitRationale", "qualificationsGap", "tailoredCV", "tailoredCoverLetter", "prefilledAnswers"]
        }
      }
    });

    const parsedJson = cleanAndParseJson(response.text);
    
    // Update the job with the generated data
    job.fitScore = parsedJson.fitScore;
    job.fitRationale = parsedJson.fitRationale;
    job.qualificationsGap = parsedJson.qualificationsGap;
    job.tailoredCV = parsedJson.tailoredCV;
    job.tailoredCoverLetter = parsedJson.tailoredCoverLetter;
    job.prefilledAnswers = parsedJson.prefilledAnswers;
    job.status = 'queued'; // Move to approval queue after tailoring!

    // Save back to DB
    const jobIndex = data.jobs.findIndex(j => j.id === jobId);
    data.jobs[jobIndex] = job;
    saveDbData(data);

    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to tailor application via Gemini', details: err.message });
  }
});

// JOB DISCOVERY ENDPOINT: Search REAL job listings via the Adzuna API,
// then score each result against the user's profile with Gemini.
// Free API keys: https://developer.adzuna.com
app.post('/api/jobs/scan', async (req, res) => {
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      return res.status(501).json({
        error: 'Job search is not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to your .env file (free keys at developer.adzuna.com).'
      });
    }

    const data = getDbData();
    const { config, profile } = data;
    const country = (process.env.ADZUNA_COUNTRY || 'us').toLowerCase();

    // Build the search query from the user's configured keywords + location preference
    const keywords = (config.keywords && config.keywords.length > 0)
      ? config.keywords.join(' ')
      : 'food science technologist quality';

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '10',
      what_or: keywords,
      'content-type': 'application/json'
    });
    const preferredLocation = profile.preferences?.locations?.[0];
    if (preferredLocation) params.set('where', preferredLocation);

    const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
    const adzunaRes = await fetch(adzunaUrl);
    if (!adzunaRes.ok) {
      const body = await adzunaRes.text().catch(() => '');
      throw new Error(`Adzuna API returned ${adzunaRes.status}: ${body.slice(0, 200)}`);
    }
    const payload: any = await adzunaRes.json();
    const results: any[] = payload.results || [];

    // Filter out listings already in the database (match on title + company)
    const fresh = results.filter(rj => {
      const title = (rj.title || '').toLowerCase().trim();
      const company = (rj.company?.display_name || '').toLowerCase().trim();
      return title && !data.jobs.some(
        ej => ej.title.toLowerCase().trim() === title && ej.company.toLowerCase().trim() === company
      );
    }).slice(0, 6);

    if (fresh.length === 0) {
      return res.json({ success: true, count: 0, jobs: [] });
    }

    // Score the real listings against the user profile with Gemini (best-effort:
    // if scoring fails, listings are still saved unscored).
    let scores: { index: number; fitScore: number; fitRationale: string; qualificationsGap: string[] }[] = [];
    try {
      const aiClient = getAIClient();
      const listingSummaries = fresh.map((rj, index) => ({
        index,
        title: rj.title,
        company: rj.company?.display_name || 'Unknown',
        location: rj.location?.display_name || '',
        description: (rj.description || '').slice(0, 1500)
      }));

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-2.5-flash',
        contents: `### USER PROFILE:\n${JSON.stringify(profile, null, 2)}\n\n### JOB LISTINGS:\n${JSON.stringify(listingSummaries, null, 2)}\n\nScore each listing for this candidate.`,
        config: {
          systemInstruction: `You are a job-fit scoring agent for an entry-level Food Science graduate.
For EACH job listing provided, return: the listing's index, a fitScore (0-100, based on alignment with the candidate's skills, certifications, and entry-level suitability), a concise 1-2 sentence fitRationale, and a qualificationsGap array of requirements the candidate appears to lack. Base your judgment ONLY on the provided profile and listing text — do not invent details. Note that listing descriptions may be truncated.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER },
                    fitScore: { type: Type.INTEGER },
                    fitRationale: { type: Type.STRING },
                    qualificationsGap: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['index', 'fitScore', 'fitRationale', 'qualificationsGap']
                }
              }
            },
            required: ['scores']
          }
        }
      });
      scores = cleanAndParseJson(response.text).scores || [];
    } catch (scoreErr: any) {
      console.warn('[Scan] Gemini scoring failed, saving listings unscored:', scoreErr.message);
    }

    const addedJobs: Job[] = fresh.map((rj, index) => {
      const score = scores.find(s => s.index === index);
      return {
        id: `job-adzuna-${rj.id || `${Date.now()}-${index}`}`,
        title: rj.title,
        company: rj.company?.display_name || 'Unknown',
        location: rj.location?.display_name || '',
        description: rj.description || '',
        source: 'Adzuna',
        url: rj.redirect_url || '',
        fitScore: score?.fitScore ?? 0,
        fitRationale: score?.fitRationale || '',
        qualificationsGap: score?.qualificationsGap || [],
        tailoredCV: { summary: '', highlights: [], bullets: [] },
        tailoredCoverLetter: '',
        prefilledAnswers: [],
        status: 'found' as const,
        createdAt: rj.created || new Date().toISOString()
      };
    });

    data.jobs.unshift(...addedJobs);
    saveDbData(data);
    res.json({ success: true, count: addedJobs.length, jobs: addedJobs });
  } catch (err: any) {
    console.error('Error scanning jobs:', err);
    res.status(500).json({ error: 'Job search failed', details: err.message });
  }
});

// PREPARE APPLICATION PACKAGE: saves the user's final drafts and marks the job 'approved'.
// Nothing is auto-submitted — the user applies manually via the Apply Assistant, then
// explicitly marks the job as submitted (PUT /api/jobs/:id with status 'submitted').
app.post('/api/jobs/prepare', (req, res) => {
  const { jobId, finalCoverLetter, finalCV, finalAnswers } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  const data = getDbData();
  const jobIndex = data.jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Job listing not found' });
  }

  const job = data.jobs[jobIndex];
  job.status = 'approved';
  job.tailoredCoverLetter = finalCoverLetter || job.tailoredCoverLetter;
  job.tailoredCV = finalCV || job.tailoredCV;
  job.prefilledAnswers = finalAnswers || job.prefilledAnswers;

  data.jobs[jobIndex] = job;
  saveDbData(data);

  res.json({ success: true, message: 'Final drafts saved. Application package is ready.', job });
});

// START EXPRESS + VITE INTEGRATION
async function startServer() {
  // Sync state from Firebase Firestore cloud database on boot
  try {
    await syncFromFirestore();
  } catch (err: any) {
    console.warn('[Firebase] Initial cloud sync on boot bypassed:', err.message);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodSci Apply full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
