/**
 * Core type definitions for Canvas Time Estimator
 */

export interface Assignment {
  id: string | number;
  title: string;
  courseName: string;
  courseId: number;
  dueDate: string;
  type: AssignmentType;
  description: string;
  pointsPossible: number;
  htmlUrl: string;
  submissionTypes: string[];
  estimatedMinutes: number | null;
  estimationConfidence: 'low' | 'medium' | 'high' | null;
}

export type AssignmentType =
  | 'assignment'
  | 'quiz'
  | 'discussion'
  | 'essay'
  | 'project'
  | 'exam'
  | 'page'
  | 'announcement'
  | 'event'
  | 'note';

export interface AssignmentResponse {
  assignments: Assignment[];
  fromCache: boolean;
  lastUpdated: number;
  error?: string;
}

export interface Settings {
  canvasUrl: string;
  apiToken: string;
  aiProvider: 'none' | 'openai' | 'anthropic';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  estimationModel: string;
  showNotifications: boolean;
  refreshInterval: number;
  lookaheadDays: number;
  injectBadges: boolean;
}

export interface TimeEstimate {
  estimatedMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
}

export interface WeeklyStats {
  totalMinutes: number;
  assignmentCount: number;
  byDay: {
    date: string;
    minutes: number;
    count: number;
  }[];
  byCourse: {
    courseName: string;
    minutes: number;
    count: number;
  }[];
}

// Message types for chrome.runtime.sendMessage
export type MessageType =
  | { type: 'GET_ASSIGNMENTS' }
  | { type: 'REFRESH_ASSIGNMENTS' }
  | { type: 'GET_CACHED_ASSIGNMENTS' }
  | { type: 'ESTIMATE_SINGLE'; assignment: Partial<Assignment> }
  | { type: 'TEST_CONNECTION'; url: string; token: string };
