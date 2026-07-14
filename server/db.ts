import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { AppState, UserProfile, Job, AppConfig } from '../src/types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Initialize Firebase Client DB if config exists
let db: Firestore | null = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.projectId) {
      // Check if app is already initialized to avoid duplicate app errors
      const app = getApps().length === 0 
        ? initializeApp(config)
        : getApp();

      db = getFirestore(app, config.firestoreDatabaseId || undefined);
      console.log('[Firebase] Client SDK initialized successfully with database:', config.firestoreDatabaseId || '(default)');
    }
  }
} catch (err: any) {
  console.warn('[Firebase] Initialization error. Running in local fallback mode:', err.message);
}

// Helper to ensure database directory exists
function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData = getInitialSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

let hasSyncedFromFirestore = false;
let isSyncing = false;

export async function syncFromFirestore() {
  if (!db || hasSyncedFromFirestore) return;
  try {
    console.log('[Firebase] Syncing latest state from cloud database...');
    
    // 1. Profile
    const profileDocRef = doc(db, 'profile', 'user');
    const profileSnap = await getDoc(profileDocRef);
    const profileData = profileSnap.exists() ? profileSnap.data() : null;

    // 2. Config
    const configDocRef = doc(db, 'config', 'settings');
    const configSnap = await getDoc(configDocRef);
    const configData = configSnap.exists() ? (configSnap.get('threshold') !== undefined ? configSnap.data() : null) : null;

    // 3. Jobs
    const jobsColRef = collection(db, 'jobs');
    const jobsSnapshot = await getDocs(jobsColRef);
    const jobsList: any[] = [];
    jobsSnapshot.forEach(docSnap => {
      jobsList.push(docSnap.data());
    });

    if (profileData || configData || jobsList.length > 0) {
      ensureDbExists();
      const currentLocal = getInitialSeedData();
      const syncedState: AppState = {
        profile: (profileData as UserProfile) || currentLocal.profile,
        config: (configData as AppConfig) || currentLocal.config,
        jobs: jobsList.length > 0 ? jobsList : currentLocal.jobs
      };
      
      // Sort jobs by createdAt desc
      if (syncedState.jobs) {
        syncedState.jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      fs.writeFileSync(DB_FILE, JSON.stringify(syncedState, null, 2), 'utf-8');
      console.log(`[Firebase] Successfully synced ${jobsList.length} jobs and user profile from the cloud.`);
    } else {
      console.log('[Firebase] Cloud database is empty. Seeding local state to the cloud...');
      ensureDbExists();
      const localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      await seedFirestoreFromLocal(localData);
    }
    hasSyncedFromFirestore = true;
  } catch (err: any) {
    console.error('[Firebase] Sync from Firestore failed (falling back to local):', err.message);
  }
}

async function seedFirestoreFromLocal(localData: AppState) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'profile', 'user'), localData.profile);
    await setDoc(doc(db, 'config', 'settings'), localData.config);
    for (const job of localData.jobs) {
      await setDoc(doc(db, 'jobs', job.id), job);
    }
    console.log('[Firebase] Local database successfully seeded to live cloud storage.');
  } catch (err: any) {
    console.error('[Firebase] Failed to seed cloud database:', err.message);
  }
}

export function getDbData(): AppState {
  ensureDbExists();
  const dataStr = fs.readFileSync(DB_FILE, 'utf-8');
  
  if (!hasSyncedFromFirestore && !isSyncing && db) {
    isSyncing = true;
    syncFromFirestore().then(() => {
      isSyncing = false;
    }).catch(err => {
      isSyncing = false;
      console.error('[Firebase] Background sync error:', err);
    });
  }
  
  return JSON.parse(dataStr);
}

export function saveDbData(data: AppState) {
  ensureDbExists();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  
  if (db) {
    // Write profile
    setDoc(doc(db, 'profile', 'user'), data.profile).catch(err => {
      console.error('[Firebase] Error saving profile to cloud:', err.message);
    });
    
    // Write config
    setDoc(doc(db, 'config', 'settings'), data.config).catch(err => {
      console.error('[Firebase] Error saving config to cloud:', err.message);
    });
    
    // Write existing jobs
    for (const job of data.jobs) {
      setDoc(doc(db, 'jobs', job.id), job).catch(err => {
        console.error(`[Firebase] Error saving job ${job.id} to cloud:`, err.message);
      });
    }

    // Delete removed jobs
    getDocs(collection(db, 'jobs')).then(snapshot => {
      snapshot.forEach(docSnap => {
        if (!data.jobs.some(j => j.id === docSnap.id)) {
          deleteDoc(doc(db, 'jobs', docSnap.id)).catch(err => {
            console.error(`[Firebase] Error deleting job ${docSnap.id} from cloud:`, err.message);
          });
        }
      });
    }).catch(err => {
      console.error('[Firebase] Error scanning cloud jobs for cleanup:', err.message);
    });
  }
}

// Full seed data for out-of-the-box fidelity
function getInitialSeedData(): AppState {
  const defaultProfile: UserProfile = {
    contact: {
      name: "Hamza Mahmood",
      email: "hamza3mahmood@gmail.com",
      phone: "+1 (555) 019-2834",
      location: "San Jose, CA",
      linkedin: "linkedin.com/in/hamzamahmood-foodsci",
      portfolio: "hamzamahmood.me"
    },
    education: {
      degree: "Bachelor of Science",
      institution: "University of California, Davis",
      fieldOfStudy: "Food Science & Technology (QA/QC track)",
      graduationYear: "2026",
      gpa: "3.78"
    },
    workHistory: [
      {
        company: "UC Davis Sensory Evaluation Center",
        role: "Sensory Lab Assistant",
        startDate: "2025-09",
        endDate: "2026-06",
        description: "Assisted in the execution of consumer panels, sensory descriptive testing, and sample preparation for multiple commercial research projects.",
        bullets: [
          "Prepared and standardized daily sensory panels containing 50+ customized food formulations adhering to strict sterile and temperature protocols.",
          "Coded and maintained blind-tasting records using sensory software (Compusense) for statistical data analysis (ANOVA, PCA).",
          "Presented analytical sensory reports directly to lead researchers, identifying volatile oxidation trends in plant-based dairy substitutes."
        ]
      },
      {
        company: "Pacific Food Labs",
        role: "Quality Control Intern",
        startDate: "2025-06",
        endDate: "2025-09",
        description: "Assisted the senior food safety team in carrying out regular wet-chemistry analysis and microbiological assays on incoming raw materials and finished goods.",
        bullets: [
          "Performed daily physicochemical and raw product testing: pH, moisture content, water activity (aw), brix, and viscosity on 40+ production batches.",
          "Conducted environmental swabbing and plating (Aerobic Plate Count, Yeast & Mold) for pathogen control in compliance with FDA FSMA rules.",
          "Drafted Standard Operating Procedures (SOPs) for a newly integrated automated refractometer system, cutting staff training cycles by 40%."
        ]
      }
    ],
    skills: [
      "HACCP Auditing",
      "Microbiology Assays",
      "HPLC & GC-MS Basics",
      "Compusense & Sensory Software",
      "FDA FSMA Guidelines",
      "Moisture & pH Analysis",
      "Refractometry & Viscometry",
      "Statistical Analysis (R, ANOVA)",
      "Technical SOP Writing"
    ],
    certifications: [
      "HACCP Certified (International HACCP Alliance)",
      "FSPCA Preventive Controls for Human Food (PCQI) Certificate",
      "ServSafe Food Protection Manager"
    ],
    preferences: {
      salaryExpectation: "$65,000 - $75,000",
      locations: ["Bay Area, CA", "Sacramento, CA", "Remote"],
      workAuthorization: "Authorized to work in the US without sponsorship",
      noticePeriod: "Immediate availability",
      jobTypes: ["on-site", "hybrid"]
    },
    standardAnswers: {
      companyReason: "As a Food Science graduate, I have followed your team's innovative approach to food safety and product formulation. My hands-on training with advanced laboratory equipment and sensory descriptive analysis aligns directly with your quality standard. I am highly motivated to bring my rigorous scientific training to support your team's continued success.",
      diversityAnswer: "Growing up in a multicultural household, I witnessed first-hand how diverse culinary traditions foster collaboration. In college, I collaborated with multi-disciplinary engineering and life-science teams to develop a localized food-waste reduction product, where different academic perspectives were key to solving raw ingredient degradation. I thrive in teams that bring together diverse technical backgrounds.",
      noticePeriodAnswer: "I have graduated and completed my academic commitments; I am available to start immediately and do not require any transition period.",
      rightToWorkAnswer: "I am a US citizen and am fully authorized to work in the United States. I do not require sponsorship now or in the future.",
      salaryExpectationAnswer: "My target salary range is $65,000 - $75,000 per year, but I am open and flexible to discuss the overall compensation package based on growth opportunities."
    }
  };

  const defaultJobs: Job[] = [
    {
      id: "job-001",
      title: "R&D Assistant (Plant-Based Proteins)",
      company: "Beyond Meat",
      location: "El Segundo, CA (Hybrid)",
      description: "We are seeking a highly passionate R&D Assistant to join our rapid prototyping food lab. You will support food chemists in analyzing plant protein isolates, preparing extrusion samples, and running objective texture analysis (TPA). \n\nRequired Qualifications:\n- BS in Food Science, Chemistry, or Chemical Engineering.\n- Laboratory experience conducting benchtop formulation work.\n- Experience with food texture profile analyzers (TPA) and pH analysis is preferred.",
      source: "Greenhouse / Company ATS",
      url: "https://boards.greenhouse.io/beyondmeat/jobs/4827101",
      fitScore: 92,
      fitRationale: "Your background in UC Davis Food Science paired with hands-on formulation work and plant-based protein analysis during your sensory lab assistantship matches 95% of the qualifications. The role's emphasis on physicochemical metrics (pH, moisture, texture profile) directly aligns with your intern experience.",
      qualificationsGap: [
        "Experience with industrial-scale extrusion (you have benchtop formulation and wet chemistry experience, but no industrial pilot-plant operation)."
      ],
      tailoredCV: {
        summary: "Rigorous UC Davis Food Science & Technology graduate with hands-on food chemistry, plant-based formulation analysis, and sensory evaluation experience. Proficient in wet-chemistry methods, pH, texture analysis, and FDA compliance, seeking to apply analytical lab precision to support Beyond Meat's protein prototyping.",
        highlights: [
          "UC Davis Food Science degree with high GPA (3.78) and extensive laboratory chemistry coursework.",
          "Executed plant-based formulation evaluation, identifying volatile oxidation trends in milk substitutes.",
          "Certified in HACCP and PCQI with direct experience drafting technical lab SOPs."
        ],
        bullets: [
          "Coordinated with food researchers to analyze and prepare plant-protein emulsion samples for consumer tasting panels.",
          "Conducted detailed water activity (aw), moisture, and pH assays on 40+ lab batches, aligning with Beyond Meat standard testing.",
          "Documented texture profile analysis (TPA) and viscosity measurements to quantify plant protein structural stability."
        ]
      },
      tailoredCoverLetter: "Dear Beyond Meat Hiring Team,\n\nI am writing to express my enthusiastic interest in the R&D Assistant position. As a recent Food Science & Technology graduate from UC Davis, I have focused my studies and research assistants on plant-based alternatives and physical-chemical food attributes. \n\nDuring my time at the UC Davis Sensory Evaluation Center, I standardized daily tasting panels for plant-based dairy substitutes, directly measuring volatile oxidation trends and correlating chemistry indicators to consumer acceptability. This project sparked my deep interest in protein structural stability. Additionally, during my internship at Pacific Food Labs, I performed wet-chemistry assays (pH, brix, moisture analysis) on over 40 batches, gaining the rapid troubleshooting and documentation skills necessary for a fast-paced laboratory.\n\nBeyond Meat's mission of transforming global food systems through protein science resonates with me on a personal and professional level. I am eager to contribute my hands-on laboratory experience, HACCP compliance awareness, and scientific curiosity to your prototyping team. Thank you for your time and consideration.\n\nSincerely,\nHamza Mahmood",
      prefilledAnswers: [
        {
          question: "What is your highest level of education in Food Science or related fields?",
          answer: "Bachelor of Science in Food Science & Technology (UC Davis)",
          required: true,
          category: "education"
        },
        {
          question: "Do you have experience operating a Texture Analyzer (TPA)? Please describe.",
          answer: "Yes, in my UC Davis food chemistry laboratory courses and at the Sensory Center, I analyzed plant-based sample firmness and cohesive attributes using viscometers and objective testing systems.",
          required: true,
          category: "experience"
        },
        {
          question: "What are your salary expectations?",
          answer: "$68,000",
          required: true,
          category: "salary"
        },
        {
          question: "Will you now or in the future require visa sponsorship to work in the US?",
          answer: "No, I do not require sponsorship.",
          required: true,
          category: "right_to_work"
        }
      ],
      status: "queued",
      createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString() // 36 hours ago
    },
    {
      id: "job-002",
      title: "Quality Assurance Specialist (Entry Level)",
      company: "Clif Bar",
      location: "Twin Falls, ID (On-Site)",
      description: "Join our state-of-the-art baking bakery in Twin Falls. The QA Specialist is responsible for performing inline testing, executing environmental swabbing programs, verifying metal detector CCPs, and ensuring compliance with our SQF Level 3 food safety program. \n\nRequirements:\n- Bachelor's degree in Food Science, Microbiology, or Biology.\n- HACCP Certified.\n- Familiarity with GFSI audit standards (SQF/BRC) is highly desirable.",
      source: "Lever / Company ATS",
      url: "https://jobs.lever.co/clifbar/84918-912",
      fitScore: 84,
      fitRationale: "You possess a Food Science degree and are HACCP certified under the International HACCP Alliance, which fully ticks the core requirements. Your internship focused extensively on environmental swabbing and pathogen assays, which aligns perfectly with this bakery safety role.",
      qualificationsGap: [
        "Familiarity with SQF Level 3 (you understand basic HACCP and PCQI principles, but do not have formal SQF implementation experience)."
      ],
      tailoredCV: {
        summary: "HACCP & PCQI certified UC Davis Food Science graduate with practical experience in raw ingredient wet chemistry, microbiology testing, and environmental monitoring. Trained in FDA FSMA compliance, GMPs, and standard pathogen testing (Aerobic Plate Count, Yeast/Mold), seeking to ensure rigorous product safety at Clif Bar.",
        highlights: [
          "Certified in HACCP and FSPCA Preventive Controls (PCQI) for human food safety.",
          "Conducted environmental swabbing and microbial plating on production floors.",
          "Experienced in drafting laboratory SOPs and validating critical safety instruments."
        ],
        bullets: [
          "Monitored facility GMP compliance and conducted sterile environmental swabs for yeast, mold, and pathogen monitoring.",
          "Validated laboratory instrument calibrations and maintained analytical records for compliance with FDA FSMA standards.",
          "Authored standard operating procedures (SOPs) for product validation tests, aligning with GFSI/SQF standards."
        ]
      },
      tailoredCoverLetter: "Dear Clif Bar Recruitment Team,\n\nI am thrilled to submit my application for the Quality Assurance Specialist position at your Twin Falls bakery. Having recently graduated from UC Davis with a degree in Food Science & Technology and earned my HACCP and FSPCA PCQI certifications, I have dedicated my training to food safety systems and chemical/microbial monitoring.\n\nMy experience as a Quality Control Intern at Pacific Food Labs gave me a solid grounding in day-to-day food safety protocols. I carried out extensive wet-chemistry assays (viscosity, water activity, brix) and environmental swabbing runs. I maintained sterile microbiological plates (Aerobic Plate, Yeast & Mold), validating pathogen control lines. Importantly, I also drafted standard operational protocols (SOPs) for testing equipment, which reduced operator error and ensured audit-ready records. This direct alignment with GMP and FDA FSMA compliance makes me confident in my ability to uphold Clif Bar's SQF standards.\n\nI admire Clif Bar's commitment to clean, organic, and sustainable energy food products. Working at your advanced Twin Falls plant would represent an incredible opportunity to leverage my passion for rigorous quality assurance. Thank you for reviewing my credentials.\n\nWarm regards,\nHamza Mahmood",
      prefilledAnswers: [
        {
          question: "Are you currently HACCP Certified?",
          answer: "Yes, I am certified under the International HACCP Alliance.",
          required: true,
          category: "certification"
        },
        {
          question: "Please summarize your experience with environmental swabbing or pathogen monitoring.",
          answer: "During my internship at Pacific Food Labs, I performed daily sterile environmental swabbing, mapped sample locations across high-risk hygiene lines, and plated Aerobic and Yeast/Mold assays.",
          required: true,
          category: "experience"
        },
        {
          question: "Are you willing to relocate to Twin Falls, ID?",
          answer: "Yes, I am highly interested in Twin Falls and ready to relocate.",
          required: true,
          category: "general"
        }
      ],
      status: "queued",
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString() // 12 hours ago
    },
    {
      id: "job-003",
      title: "Lab Associate (Microbiology Safety)",
      company: "Tyson Foods",
      location: "Springdale, AR (On-Site)",
      description: "The Lab Associate performs standardized biological and chemical assays on raw poultry and packaged meats. Requires 1-2 years of clinical, food safety, or quality laboratory experience. Must be comfortable managing high sample volume and sterile preparation.",
      source: "Indeed Search Redirect",
      url: "https://tysonfoods.careers/jobs/827110",
      fitScore: 71,
      fitRationale: "Your food science microbiology background is solid, but the listing requests 1-2 years of experience. Your 3-month full-time internship and 9-month student assistant role together sum to ~1 year of experience, making you a viable candidate, though with minor experience gaps.",
      qualificationsGap: [
        "1-2 years full-time experience (you have academic lab work and an internship)."
      ],
      tailoredCV: {
        summary: "Analytical Food Microbiologist and UC Davis graduate with extensive benchtop training in sample preparation, microbial plating, and aseptic techniques. Proficient in compliance monitoring (HACCP) and documentation, looking to secure high-volume pathogen screening at Tyson Foods.",
        highlights: [
          "Hands-on sterile microbial assays: Aerobic Plate, Yeast, and Mold.",
          "Trained in high-volume laboratory workflows with attention to aseptic safety.",
          "PCQI and International HACCP Alliance certifications."
        ],
        bullets: [
          "Prepared and homogenized meat/substitute samples for quantitative microbiological plating using sterile techniques.",
          "Maintained chemical safety documents and calibrated critical laboratory water activity meters daily.",
          "Collaborated on complex sensory-microbiology panels for rapid shelf-life testing projects."
        ]
      },
      tailoredCoverLetter: "Dear Tyson Foods Hiring Team,\n\nI am writing to express my interest in the Lab Associate position in Springdale. As a Food Science graduate from UC Davis with a specialized track in Food Microbiology and Safety, I bring hands-on experience in sterile plating, environmental swabbing, and standard safety assays.\n\nThrough my Quality Control internship at Pacific Food Labs and research assistance at UC Davis, I developed strong aseptic bench skills. I have prepared and homogenized raw materials, conducted swabbing campaigns, and monitored microbial growth plates for pathogens. I understand how essential speed, accuracy, and sterile protocols are in preventing batch contamination and maintaining a safe supply chain for Tyson Foods' consumers.\n\nI am PCQI certified and appreciate Tyson's industry-leading safety standards. I am eager to join your dedicated lab team. Thank you for your consideration.\n\nSincerely,\nHamza Mahmood",
      prefilledAnswers: [
        {
          question: "Do you have 1-2 years of professional food laboratory experience?",
          answer: "Yes, I have approximately 12 months of combined food laboratory experience through my Quality Control internship at Pacific Food Labs and my role as a Sensory Lab Assistant at UC Davis.",
          required: true,
          category: "experience"
        }
      ],
      status: "queued",
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() // 2 days ago
    }
  ];

  return {
    profile: defaultProfile,
    jobs: defaultJobs,
    config: {
      threshold: 70,
      keywords: ["food scientist", "food technologist", "lab technician", "QA technician", "quality assurance", "R&D assistant", "sensory", "microbiology lab"],
      linkedinToggle: false
    }
  };
}
