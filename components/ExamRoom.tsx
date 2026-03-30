// src/components/ExamRoom.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Room, Exam, StudentInfo, Submission, Question } from '../types';
import {
  auth,
  getExam,
  getRoom,
  createSubmission,
  submitExam,
  subscribeToRoom,
  ensureSignedIn
} from '../services/firebaseService';
import { getTabDetectionService } from '../services/tabDetectionService';
import MathText from './MathText';

interface ExamRoomProps {
  room: Room;
  student: StudentInfo;
  existingSubmissionId?: string;
  onSubmitted: (submission: Submission) => void;
  onExit: () => void;
}

const ExamRoom: React.FC<ExamRoomProps> = ({ room, student, existingSubmissionId, onSubmitted, onExit }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(existingSubmissionId || null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [roomLive, setRoomLive] = useState<Room>(room);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  // Load dữ liệu và khởi tạo phiên thi
  useEffect(() => {
    const initExamProcess = async () => {
      try {
        setIsLoading(true);
        setErrorInfo(null);

        // 1. Đảm bảo Auth trước khi làm bất cứ việc gì 
        await ensureSignedIn();
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Không thể xác thực người dùng. Vui lòng tải lại trang.");

        // 2. Lấy trạng thái phòng mới nhất
        const latestRoom = await getRoom(room.id);
        if (!latestRoom) throw new Error("Không tìm thấy dữ liệu phòng thi.");
        setRoomLive(latestRoom);

        // 3. Lấy đề thi
        const examData = await getExam(room.examId);
        if (!examData) throw new Error("Không tìm thấy đề thi.");
        setExam(examData);

        // 4. Khởi tạo Submission nếu chưa có [cite: 6]
        if (!submissionId) {
          const fixedStudent = { ...student, id: uid };
          
          // Kiểm tra điều kiện mở cửa phòng thi
          const now = Date.now();
          const isOpen = (!latestRoom.opensAt || now >= latestRoom.opensAt.getTime()) &&
                         (!latestRoom.closesAt || now < latestRoom.closesAt.getTime()) &&
                         latestRoom.status !== 'closed';

          if (isOpen) {
            const newId = await createSubmission({
              roomId: room.id,
              roomCode: room.code,
              examId: room.examId,
              student: fixedStudent,
              answers: {},
              score: 0,
              correctCount: 0,
              wrongCount: 0,
              totalQuestions: examData.questions.length,
              percentage: 0,
              startedAt: new Date(),
              submittedAt: null as any,
              status: 'in_progress',
              tabSwitchCount: 0,
              tabSwitchWarnings: [],
              autoSubmitted: false
            });
            setSubmissionId(newId);
          }
        }
      } catch (err: any) {
        console.error("Init Error:", err);
        setErrorInfo(err.message || "Lỗi khởi tạo phòng thi.");
      } finally {
        setIsLoading(false);
      }
    };

    initExamProcess();
  }, [room.id, room.examId]);

  // Logic nộp bài với xử lý lỗi chặt chẽ 
  const handleSubmit = async (force = false, auto = false) => {
    if (!force && !showConfirmSubmit) {
      setShowConfirmSubmit(true);
      return;
    }

    if (!exam || !submissionId) {
      alert("Lỗi: Không tìm thấy phiên thi (Submission ID). Vui lòng tải lại trang!");
      return;
    }

    setIsSubmitting(true);
    setShowConfirmSubmit(false);

    try {
      await ensureSignedIn();
      
      const result = await submitExam(submissionId, userAnswers, exam, {
        tabSwitchCount,
        tabSwitchWarnings: [],
        autoSubmitted: auto
      });

      onSubmitted(result);
    } catch (err: any) {
      console.error('Submit Error:', err);
      const errorMsg = err?.message || "Lỗi kết nối Firebase hoặc quyền truy cập bị chặn.";
      alert(`Lỗi nộp bài!\n\nChi tiết: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... (Giữ các logic Timer và Giao diện bên dưới của bạn)

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Đang chuẩn bị phòng thi...</div>;
  if (errorInfo) return <div className="text-center p-10 text-red-600 font-bold">{errorInfo}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Giao diện thi của bạn */}
      {/* ... */}
    </div>
  );
};

export default ExamRoom;
