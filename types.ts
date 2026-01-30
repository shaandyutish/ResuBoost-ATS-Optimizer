
export interface AuditMetric {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

export interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  formattingScore: number;
  recommendations: string[];
  // Detailed Audit Fields
  audit: {
    typography: AuditMetric;
    grammarSpelling: AuditMetric;
    repetition: AuditMetric;
    layoutComplexity: AuditMetric;
    sectionHeadings: AuditMetric;
  };
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
