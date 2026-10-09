export interface ExamOption {
  id: string;
  label: string; // 'A', 'B', 'C', 'D', etc.
  text: string;
}

export interface ExamQuestion {
  id: string;
  number: number;
  category?: string;
  question: string;
  options: ExamOption[];
  correctOptionId: string;
  correctOptionIds?: string[]; // Supports 1, 2, or more correct answers explicitly
  explanation?: string;
  points: number;
}

export interface ExamSchema {
  id: string;
  title: string;
  subject: string;
  description: string;
  durationMinutes: number;
  passingScorePercent: number;
  questions: ExamQuestion[];
}

export interface ExamAttemptRecord {
  id: string;
  userId?: string;
  libraryItemId?: string;
  examId?: string;
  examVersionHash?: string;
  examTitle: string;
  subject: string;
  completedAt: string;
  timestamp?: number; // Epoch ms in user's local clock
  completed?: boolean; // true for completed attempts
  scoreEarned: number;
  totalPoints: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  timeSpentSeconds?: number | null; // Active/elapsed seconds; null/undefined if legacy without duration
  questionTimesSeconds?: Record<string, number>; // Active seconds per question ID
  isActiveTime?: boolean; // true when active time tracking was used
  passed: boolean;
}

export interface FolderNode {
  id: string;
  name: string;
  description?: string;
  parentId: string | null; // null means root level
  createdAt: string;
}

export interface LibraryExamItem {
  id: string;
  folderId: string | null; // null means root level
  exam: ExamSchema;
  rawJson: string;
  updatedAt: string;
  lastScorePercent?: number;
}

