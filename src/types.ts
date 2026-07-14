export interface UserProfile {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    portfolio: string;
  };
  education: {
    degree: string;
    institution: string;
    fieldOfStudy: string;
    graduationYear: string;
    gpa: string;
  };
  workHistory: WorkExperience[];
  skills: string[];
  certifications: string[];
  preferences: {
    salaryExpectation: string;
    locations: string[];
    workAuthorization: string;
    noticePeriod: string;
    jobTypes: string[]; // e.g. ["remote", "hybrid", "on-site"]
  };
  standardAnswers: {
    companyReason: string;
    diversityAnswer: string;
    noticePeriodAnswer: string;
    rightToWorkAnswer: string;
    salaryExpectationAnswer: string;
    [key: string]: string;
  };
}

export interface WorkExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  bullets: string[];
}

export interface TailoredCV {
  summary: string;
  highlights: string[];
  bullets: string[]; // tailored bullets matching job description keywords
}

export interface PrefilledAnswer {
  question: string;
  answer: string;
  required: boolean;
  category: string; // e.g., "right_to_work", "salary", "experience", "general"
}

export type ApplicationStatus = 'found' | 'queued' | 'approved' | 'submitted' | 'rejected' | 'interview' | 'offer' | 'skipped';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  source: string; // e.g., 'IFT Careers', 'Greenhouse', 'Indeed', 'Lever'
  url: string;
  fitScore: number;
  fitRationale: string;
  qualificationsGap: string[];
  tailoredCV: TailoredCV;
  tailoredCoverLetter: string;
  prefilledAnswers: PrefilledAnswer[];
  status: ApplicationStatus;
  skipReason?: string;
  submissionDate?: string;
  notes?: string;
  refId?: string;
  createdAt: string;
}

export interface AppConfig {
  threshold: number;
  keywords: string[];
  linkedinToggle: boolean;
}

export interface AppState {
  profile: UserProfile;
  jobs: Job[];
  config: AppConfig;
}
