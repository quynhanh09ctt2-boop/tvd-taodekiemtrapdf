/**
 * Scoring Service v2 - Hệ thống tính điểm linh hoạt
 */

import { 
  Exam, 
  Question, 
  ScoreBreakdown, 
  ExamPointsConfig, 
  SectionPointsConfig, 
  TrueFalseMode 
} from '../types';

/**
 * Map QuestionType sang SectionPointsConfig questionType
 */
function mapQuestionType(type: string): 'multiple_choice' | 'true_false' | 'short_answer' {
  if (type === 'true_false') return 'true_false';
  if (type === 'short_answer' || type === 'writing') return 'short_answer';
  return 'multiple_choice';
}

/**
 * Định dạng điểm số (ví dụ: 8.25, 7.0)
 */
export function formatScore(score: number): string {
  if (score === undefined || score === null || isNaN(score)) return '0.0';
  // Làm tròn đến 2 chữ số thập phân và loại bỏ số 0 thừa
  return parseFloat(score.toFixed(2)).toString();
}

/**
 * Phát hiện các section từ danh sách câu hỏi
 */
export function detectSections(questions: Question[]): SectionPointsConfig[] {
  const sections: SectionPointsConfig[] = [];
  const sectionMap = new Map<
    string,
    {
      type: 'multiple_choice' | 'true_false' | 'short_answer';
      count: number;
      part: number;
    }
  >();

  questions.forEach((q) => {
    const part = q.part || Math.floor(q.number / 100) || 1;
    const mappedType = mapQuestionType(q.type || 'multiple_choice');
    const key = `part${part}_${mappedType}`;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, { type: mappedType, count: 0, part });
    }
    sectionMap.get(key)!.count++;
  });

  sectionMap.forEach((value, key) => {
    sections.push({
      sectionId: key,
      part: value.part,
      questionType: value.type,
      count: value.count,
      totalPoints: 0, // Sẽ được cấu hình sau
      pointsPerQuestion: 0
    });
  });

  return sections.sort((a, b) => a.part - b.part);
}

/**
 * Tính toán chi tiết điểm số
 */
export function calculateDetailedScore(
  questions: Question[],
  answers: { [key: number]: any },
  config: ExamPointsConfig
): { score: number; totalScore: number; breakdown: ScoreBreakdown } {
  
  const breakdown: ScoreBreakdown = {
    multipleChoice: { correct: 0, total: 0, points: 0 },
    trueFalse: { correct: 0, total: 0, points: 0 },
    shortAnswer: { correct: 0, total: 0, points: 0 }
  };

  questions.forEach((q) => {
    const userAnswer = answers[q.number];
    const isCorrect = String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    const type = mapQuestionType(q.type);
    
    // Tìm cấu hình điểm cho phần này
    const sectionConfig = config.sections.find(s => 
      s.part === q.part && s.questionType === type
    );

    const points = isCorrect ? (sectionConfig?.pointsPerQuestion || 0) : 0;

    if (type === 'multiple_choice') {
      breakdown.multipleChoice.total++;
      if (isCorrect) {
        breakdown.multipleChoice.correct++;
        breakdown.multipleChoice.points += points;
      }
    } else if (type === 'true_false') {
      breakdown.trueFalse.total++;
      if (isCorrect) {
        breakdown.trueFalse.correct++;
        breakdown.trueFalse.points += points;
      }
    } else {
      breakdown.shortAnswer.total++;
      if (isCorrect) {
        breakdown.shortAnswer.correct++;
        breakdown.shortAnswer.points += points;
      }
    }
  });

  const totalRawScore = breakdown.multipleChoice.points + breakdown.trueFalse.points + breakdown.shortAnswer.points;
  
  return {
    score: totalRawScore,
    totalScore: totalRawScore, // Có thể quy đổi thang điểm ở đây nếu cần
    breakdown
  };
}

/**
 * Lấy xếp loại dựa trên phần trăm
 */
export function getGradeInfo(percentage: number) {
  if (percentage >= 90) return { grade: 'A+', color: 'text-red-600',    bg: 'bg-red-100',   emoji: '🏆', label: 'Xuất sắc' };
  if (percentage >= 80) return { grade: 'A',  color: 'text-orange-600', bg: 'bg-orange-100', emoji: '🌟', label: 'Giỏi' };
  if (percentage >= 65) return { grade: 'B',  color: 'text-teal-600',   bg: 'bg-teal-100',   emoji: '📚', label: 'Khá' };
  if (percentage >= 50) return { grade: 'C',  color: 'text-yellow-600', bg: 'bg-yellow-100', emoji: '💪', label: 'Trung bình' };
  if (percentage >= 40) return { grade: 'D',  color: 'text-orange-600', bg: 'bg-orange-100', emoji: '📖', label: 'Yếu' };
  return { grade: 'F', color: 'text-red-600', bg: 'bg-red-100', emoji: '😞', label: 'Kém' };
}

export function getTotalCorrectCount(breakdown: ScoreBreakdown): number {
  return breakdown.multipleChoice.correct + breakdown.trueFalse.correct + breakdown.shortAnswer.correct;
}

export function getTotalWrongCount(breakdown: ScoreBreakdown, totalQuestions: number): number {
  return totalQuestions - getTotalCorrectCount(breakdown);
}

export function validatePointsConfig(config: ExamPointsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.maxScore <= 0) errors.push('Thang điểm phải lớn hơn 0');

  const totalPoints = config.sections.reduce((sum, s) => sum + s.totalPoints, 0);
  if (Math.abs(totalPoints - config.maxScore) > 0.01) {
    errors.push(`Tổng điểm các phần (${totalPoints.toFixed(2)}) phải bằng thang điểm (${config.maxScore})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
