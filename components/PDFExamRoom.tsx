import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Room, Exam, StudentInfo, Submission } from './types';
import {
  ensureSignedIn,
  createSubmission,
  submitExam,
  subscribeToRoom,
} from './firebaseService';

type MCAnswers = { [n: number]: string };
type TFAnswers = { [n: number]: string[] };
type SAAnswers = { [n: number]: string };

function mergeAnswers(mc: MCAnswers, tf: TFAnswers, sa: SAAnswers): { [n: number]: string } {
  const all: { [n: number]: string } = {};
  Object.entries(mc).forEach(([k, v]) => { if (v) all[Number(k)] = v; });
  Object.entries(tf).forEach(([k, v]) => {
    const hasAny = (v || []).some(x => x === 'Đ' || x === 'S');
    if (hasAny) {
      all[Number(k)] = JSON.stringify(v);
    }
  });
  Object.entries(sa).forEach(([k, v]) => { if (v && v.trim()) all[Number(k)] = v.trim(); });
  return all;
}

interface PDFExamRoomProps {
  room: Room;
  student: StudentInfo;
  onSubmitted: (submission: Submission) => void;
  onExit: () => void;
}

const PDFExamRoom: React.FC<PDFExamRoomProps> = ({ room, student, onSubmitted, onExit }) => {
  const [mcAnswers, setMCAnswers] = useState<MCAnswers>({});
  const [tfAnswers, setTFAnswers] = useState<TFAnswers>({});
  const [saAnswers, setSAAnswers] = useState<SAAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(room.settings.duration * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAutoSubmit = () => {
    if (!isSubmitting) handleSubmit();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalAnswers = mergeAnswers(mcAnswers, tfAnswers, saAnswers);
      const submissionData = {
        roomId: room.id,
        examId: room.examId,
        student: student,
        answers: finalAnswers,
        duration: room.settings.duration * 60 - timeLeft,
        createdAt: new Date()
      };
      
      const result = await submitExam(submissionData as any);
      onSubmitted(result as any);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi nộp bài!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onMC = (num: number, val: string) => setMCAnswers(p => ({ ...p, [num]: val }));
  
  const onTF = (num: number, idx: number, val: 'Đ' | 'S') => {
    setTFAnswers(p => {
      const arr = [...(p[num] || ['', '', '', ''])];
      arr[idx] = val;
      return { ...p, [num]: arr };
    });
  };

  const onSA = (num: number, val: string) => setSAAnswers(p => ({ ...p, [num]: val }));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="font-bold text-teal-700">{student.name} - Lớp {student.className}</h2>
          <p className="text-xs text-gray-500">Đang thi PDF: {room.id}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl font-mono font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-teal-50 text-teal-600'}`}>
            ⏱️ {formatTime(timeLeft)}
          </div>
          <button 
            onClick={() => window.confirm('Nộp bài ngay?') && handleSubmit()}
            disabled={isSubmitting}
            className="bg-teal-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-200"
          >
            {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-200 p-2">
           <iframe 
             src={room.settings.pdfUrl || ''} 
             className="w-full h-full rounded-lg shadow-inner bg-white"
             title="Đề thi PDF"
           />
        </div>

        <div className="w-80 bg-white border-l overflow-y-auto p-4 space-y-8">
          <section>
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">I. Trắc nghiệm</h3>
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-8">C{i+1}.</span>
                  {['A', 'B', 'C', 'D'].map(L => (
                    <button
                      key={L}
                      onClick={() => onMC(i+1, L)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${mcAnswers[i+1] === L ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-200 hover:border-teal-300'}`}
                    >
                      {L}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">II. Đúng/Sai</h3>
            {[1, 2, 3, 4].map(num => (
              <div key={num} className="mb-4">
                <p className="text-sm font-bold mb-2">Câu {num}:</p>
                {['a', 'b', 'c', 'd'].map((L, idx) => (
                  <div key={L} className="flex items-center justify-between mb-1 px-2">
                    <span className="text-xs">{L})</span>
                    <div className="flex gap-1">
                      {['Đ', 'S'].map(v => (
                        <button
                          key={v}
                          onClick={() => onTF(200 + num, idx, v as any)}
                          className={`w-10 py-1 rounded text-[10px] font-bold border ${tfAnswers[200+num]?.[idx] === v ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section>
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">III. Trả lời ngắn</h3>
            {[1, 2, 3, 4, 5, 6].map(num => (
              <div key={num} className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium w-8">C{num}.</span>
                <input 
                  type="text"
                  value={saAnswers[300+num] || ''}
                  onChange={(e) => onSA(300+num, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="..."
                />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PDFExamRoom;
