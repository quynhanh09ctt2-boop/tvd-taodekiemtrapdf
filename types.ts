// ============ ENUMS ============
export enum Role {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  MEMBER = 'member',
  DEPUTY = 'deputy',
  LEADER = 'leader'
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'writing' | 'unknown';
export type TrueFalseMode = 'equal' | 'stepped' | 'none';

// ============ INTERFACES ============

export interface QuestionOption {
  id: string;
  text: string;
  letter: string; 
  textWithUnderline?: boolean;
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;
  text: string;
  options: QuestionOption[];
  correctAnswer: string;
  solution?: string;
  passage?: string;
  part?: number;
  section?: string;
}

export interface SectionPointsConfig {
  sectionId: string;
  sectionName?: string;
  part: number;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer';
  count: number;
  totalPoints: number;
  pointsPerQuestion: number;
  totalQuestions?: number;
  trueFalseMode?: TrueFalseMode;
}

export interface ExamPointsConfig {
  maxScore: number;
  sections: SectionPointsConfig[];
  autoBalance?: boolean;
}

// Interface dùng cho kết quả parse từ Word và Export HTML
export interface ExamData {
  title: string;
  description?: string;
  questions: Question[];
  totalQuestions: number;
  answers?: { [key: number]: any }; // Đáp án tham chiếu nếu có
  pointsConfig?: ExamPointsConfig;
}

export interface Exam {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  questions: Question[]; 
  pointsConfig?: ExamPointsConfig;
  createdAt?: any;
  updatedAt?: any;
}

export interface Room {
  id: string;
  code: string;
  examId: string;
  teacherId: string;
  status: 'waiting' | 'active' | 'closed';
  opensAt?: any; 
  closesAt?: any;
  timeLimit?: number;
  className?: string;
  classId?: string;
  settings: {
    duration: number;
    shuffledQuestions: boolean;
    shuffledOptions: boolean;
    showResults: boolean;
    allowReview: boolean;
    maxAttempts: number;
    pdfUrl?: string; // Hỗ trợ chế độ thi PDF
    [key: string]: any;
  };
}

export interface StudentInfo {
  id: string;
  name: string;
  studentId?: string;
  email?: string;
  className?: string;
}

export interface ScoreBreakdown {
  multipleChoice: { correct: number; total: number; points: number };
  trueFalse: { correct: number; total: number; points: number };
  shortAnswer: { correct: number; total: number; points: number };
}

export interface Submission {
  id: string;
  roomId: string;
  examId: string;
  student: StudentInfo;
  answers: { [key: number]: any };
  score: number;        // Điểm thô
  totalScore: number;   // Điểm sau khi quy đổi thang 10
  percentage: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  duration: number;
  submittedAt: any;
  tabSwitchCount?: number;
  scoreBreakdown: ScoreBreakdown; // Bắt buộc phải có cho Excel Export
}

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role: Role;
  isApproved: boolean;
  className?: string;
  username?: string; // Dùng cho tài khoản học sinh
}
