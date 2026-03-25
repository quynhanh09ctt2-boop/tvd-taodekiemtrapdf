import React, { useEffect, useState } from 'react';
// Import types từ thư mục cha
import { User, Exam, Room, Submission, Class, ExamData, ExamPointsConfig } from '../types';

// Import services từ thư mục ../services/
import {
  createExam,
  getExamsByTeacher,
  deleteExam,
  createRoom,
  getRoomsByTeacher,
  updateRoomStatus,
  deleteRoom,
  subscribeToSubmissions,
  getExam,
  createClass,
  getClassesByTeacher,
  getStudentsInClass,
  deleteClass,
  removeStudentFromClass
} from '../services/firebaseService';

import { parseWordToExam, validateExamData } from '../services/mathWordParserService';
import { formatScore, createDefaultPointsConfig } from '../services/scoringService';
import { exportSubmissionsToExcel } from '../services/excelExportService';

// Import các component con cùng nằm trong thư mục components
import SubmissionDetailView from './SubmissionDetailView';
import PointsConfigEditor from './PointsConfigEditor';
import PDFExamCreator from './PDFExamCreator';

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'exams' | 'rooms' | 'results' | 'classes';

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States cho Upload/Create Exam
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPDFCreator, setShowPDFCreator] = useState(false);

  // States cho Room & Results
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);

  // State cho Class management
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [user.uid]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedExams, fetchedRooms, fetchedClasses] = await Promise.all([
        getExamsByTeacher(user.uid),
        getRoomsByTeacher(user.uid),
        getClassesByTeacher(user.uid)
      ]);
      setExams(fetchedExams);
      setRooms(fetchedRooms);
      setClasses(fetchedClasses);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logic xử lý file Word
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const examData = await parseWordToExam(file);
      const validation = validateExamData(examData);
      
      if (!validation.valid) {
        setUploadError(validation.errors.join(', '));
        return;
      }

      const newExam: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'> = {
        title: examData.title || file.name.replace('.docx', ''),
        teacherId: user.uid,
        questions: examData.questions,
        pointsConfig: createDefaultPointsConfig(examData.questions)
      };

      await createExam(newExam);
      await loadData();
      alert('Tải lên đề thi thành công!');
    } catch (error: any) {
      setUploadError(error.message || 'Lỗi khi xử lý file');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Theo dõi kết quả phòng thi
  useEffect(() => {
    if (!selectedRoomId) {
      setSubmissions([]);
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    if (room) {
      getExam(room.examId).then(setCurrentExam);
    }

    const unsubscribe = subscribeToSubmissions(selectedRoomId, (data) => {
      setSubmissions(data.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => unsubscribe();
  }, [selectedRoomId, rooms]);

  const loadClassStudents = async (classId: string) => {
    const students = await getStudentsInClass(classId);
    setClassStudents(students);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-100">
            {user.displayName?.charAt(0) || 'T'}
          </div>
          <div>
            <h1 className="font-bold text-gray-800">Bảng điều khiển Giáo viên</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
          Đăng xuất
        </button>
      </header>

      {/* Tabs */}
      <div className="flex px-6 bg-white border-b overflow-x-auto no-scrollbar">
        {[
          { id: 'exams', label: '📚 Đề thi', color: 'teal' },
          { id: 'rooms', label: '🏠 Phòng thi', color: 'blue' },
          { id: 'results', label: '📊 Kết quả', color: 'orange' },
          { id: 'classes', label: '👥 Lớp học', color: 'purple' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? `border-teal-600 text-teal-600` 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'exams' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex gap-4">
               <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-8 bg-white hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer group">
                  <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                  <span className="font-bold text-gray-700">Tải lên file Word (.docx)</span>
                  <span className="text-xs text-gray-400 mt-1 text-center">Hệ thống tự nhận diện câu hỏi Toán, trắc nghiệm và đúng/sai</span>
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
               </label>

               <button 
                  onClick={() => setShowPDFCreator(true)}
                  className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-8 bg-white hover:border-orange-400 hover:bg-orange-50 transition-all cursor-pointer group"
               >
                  <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">📕</span>
                  <span className="font-bold text-gray-700">Tạo đề từ file PDF</span>
                  <span className="text-xs text-gray-400 mt-1 text-center">Dành cho đề thi có sẵn file PDF (vẽ phiếu trả lời)</span>
               </button>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 animate-shake">
                ⚠️ {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map(exam => (
                <div key={exam.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center text-xl">📝</div>
                    <button 
                      onClick={() => confirm('Xóa đề thi này?') && deleteExam(exam.id).then(loadData)}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑️
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-800 line-clamp-2 mb-2">{exam.title}</h3>
                  <div className="flex gap-4 text-xs text-gray-400 font-medium">
                    <span>❓ {exam.questions?.length || 0} câu</span>
                    <span>📅 {exam.createdAt?.toDate ? exam.createdAt.toDate().toLocaleDateString('vi-VN') : 'Mới'}</span>
                  </div>
                  <button 
                    onClick={() => {
                      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                      createRoom({
                        code,
                        examId: exam.id,
                        teacherId: user.uid,
                        status: 'waiting',
                        settings: {
                          duration: 40,
                          shuffledQuestions: false,
                          shuffledOptions: false,
                          showResults: true,
                          allowReview: true,
                          maxAttempts: 1
                        }
                      }).then(() => { setActiveTab('rooms'); loadData(); });
                    }}
                    className="w-full mt-4 py-2 bg-gray-50 text-teal-600 rounded-xl text-sm font-bold hover:bg-teal-600 hover:text-white transition-all"
                  >
                    Tạo phòng thi
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Các tab khác giữ nguyên logic nhưng đảm bảo dùng đúng helper/service */}
        {activeTab === 'results' && (
           <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-4 items-center">
                <span className="font-bold text-gray-700">Chọn phòng:</span>
                <select 
                  value={selectedRoomId} 
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-teal-500 outline-none font-medium"
                >
                  <option value="">-- Danh sách phòng thi --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.code} - {r.className || 'Tự do'}</option>
                  ))}
                </select>
                <button 
                  onClick={() => exportSubmissionsToExcel(submissions, rooms.find(r => r.id === selectedRoomId)?.code || 'ketqua')}
                  disabled={!selectedRoomId || submissions.length === 0}
                  className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold disabled:opacity-50"
                >
                  Xuất Excel
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Học sinh</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Lớp</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Điểm số</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Thời gian</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {submissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-teal-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">{sub.student.name}</td>
                        <td className="px-6 py-4 text-gray-500">{sub.student.className}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full font-bold">
                            {formatScore(sub.score)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-400 text-sm">
                          {sub.createdAt?.toDate ? sub.createdAt.toDate().toLocaleTimeString('vi-VN') : 'Vừa xong'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedSubmission(sub)}
                            className="text-teal-600 font-bold text-sm hover:underline"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}
      </main>

      {/* Modals */}
      {showPDFCreator && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <PDFExamCreator 
              teacherId={user.uid}
              teacherName={user.displayName || 'Giáo viên'}
              onSave={async (exam) => {
                await createExam(exam as any);
                setShowPDFCreator(false);
                loadData();
              }}
              onCancel={() => setShowPDFCreator(false)}
            />
          </div>
        </div>
      )}

      {selectedSubmission && currentExam && (
        <SubmissionDetailView
          submission={selectedSubmission}
          exam={currentExam}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
