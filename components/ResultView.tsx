import React from 'react';
// Sửa đường dẫn import types từ thư mục cha
import { Submission, Room, Exam, Question } from '../types';
import MathText from './MathText';

interface ResultViewProps {
  submission: Submission;
  room: Room;
  exam?: Exam;
  onExit: () => void;
  onRetry?: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({
  submission,
  room,
  exam,
  onExit,
  onRetry
}) => {
  // Lấy cấu hình hiển thị từ phòng thi
  const canShowCorrectAnswers = room.settings?.showResults ?? true;
  const canShowExplanations = room.settings?.allowReview ?? true;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs} giây`;
  };

  // Tính toán phần trăm nếu chưa có
  const displayPercentage = submission.percentage ?? 
    (submission.totalQuestions > 0 ? (submission.score / submission.totalScore) * 100 : 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 mb-8">
          <div className="bg-teal-600 p-8 text-center text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Kết quả bài thi</h2>
            <h1 className="text-3xl font-bold">{exam?.title || 'Đề thi trực tuyến'}</h1>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              <div className="bg-teal-50 p-4 rounded-2xl text-center">
                <p className="text-xs text-teal-600 font-bold uppercase mb-1">Điểm số</p>
                <p className="text-3xl font-black text-teal-700">{submission.score.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-2xl text-center">
                <p className="text-xs text-orange-600 font-bold uppercase mb-1">Đúng</p>
                <p className="text-3xl font-black text-orange-700">{submission.correctCount}/{submission.totalQuestions}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl text-center">
                <p className="text-xs text-blue-600 font-bold uppercase mb-1">Tỷ lệ</p>
                <p className="text-3xl font-black text-blue-700">{displayPercentage.toFixed(0)}%</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl text-center">
                <p className="text-xs text-purple-600 font-bold uppercase mb-1">Thời gian</p>
                <p className="text-xl font-black text-purple-700 mt-1">{formatDuration(submission.duration)}</p>
              </div>
            </div>

            {/* Danh sách câu hỏi và đáp án (Nếu giáo viên cho phép) */}
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span>📝 Chi tiết bài làm</span>
                {!canShowCorrectAnswers && <span className="text-xs font-normal text-gray-400">(Đáp án đúng đã bị ẩn)</span>}
              </h3>
              
              {(exam?.questions || []).map((question: Question, index: number) => {
                const userAnswer = submission.answers[question.number];
                const isCorrect = userAnswer === question.correctAnswer;
                
                return (
                  <div key={question.id || index} className={`p-5 rounded-2xl border-2 transition-all ${
                    isCorrect ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'
                  }`}>
                    <div className="flex gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="mb-3 text-gray-800 font-medium">
                          <MathText html={question.text} />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <div className={`text-sm p-3 rounded-xl border ${
                            isCorrect ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'
                          }`}>
                            <strong>Bạn chọn:</strong> {userAnswer || '(Không trả lời)'}
                            {isCorrect ? ' ✓' : ' ✗'}
                          </div>
                          
                          {canShowCorrectAnswers && !isCorrect && (
                            <div className="text-sm p-3 rounded-xl bg-teal-100 text-teal-700 border border-teal-200">
                              <strong>Đáp án đúng:</strong> {question.correctAnswer}
                            </div>
                          )}
                        </div>

                        {canShowExplanations && question.solution && (
                          <div className="mt-4 p-4 bg-white/60 rounded-xl border border-dashed border-blue-200 text-sm">
                            <strong className="text-blue-600 block mb-1">💡 Lời giải chi tiết:</strong>
                            <MathText html={question.solution} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <button 
                onClick={onExit}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Quay lại trang chủ
              </button>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="flex-1 py-4 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all"
                >
                  Thi lại
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultView;
