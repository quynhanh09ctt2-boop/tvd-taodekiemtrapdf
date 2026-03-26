import React, { useState, useEffect } from 'react';
// Import các Component - Giả định tất cả nằm trong thư mục components/
import StudentPortal from './components/StudentPortal';
import ExamRoom from './components/ExamRoom';
import PDFExamRoom from './components/PDFExamRoom';
import ResultView from './components/ResultView';
import TeacherDashboard from './components/TeacherDashboard';
import PendingApproval from './components/PendingApproval';
import AdminPanel from './AdminPanel'; 

// Import Types và Services - ĐÃ SỬA ĐƯỜNG DẪN CHUẨN
import { User, Role, Room, StudentInfo, Submission } from '../types';
import { 
  auth, 
  signInWithGoogle, 
  signOutUser, 
  getCurrentUser, 
  loginStudent 
} from '../services/firebaseService'; // Luôn dùng /services/

type AppView = 'landing' | 'student-login' | 'student-portal' | 'exam-room' | 'pdf-exam-room' | 'result' | 'teacher-dashboard' | 'pending-approval' | 'admin-users';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentStudent, setCurrentStudent] = useState<StudentInfo | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.role === Role.ADMIN) setCurrentView('admin-users');
          else if (!user.isApproved) setCurrentView('pending-approval');
          else setCurrentView('teacher-dashboard');
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      if (user.role === Role.ADMIN) setCurrentView('admin-users');
      else if (!user.isApproved) setCurrentView('pending-approval');
      else setCurrentView('teacher-dashboard');
    } catch (error: any) {
      alert(error.message || "Lỗi đăng nhập");
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const student = await loginStudent(loginData.username, loginData.password);
      setCurrentStudent({
        id: student.uid,
        name: student.displayName || student.username || 'Học sinh',
        studentId: student.username,
        className: student.className
      });
      setCurrentView('student-portal');
    } catch (error: any) {
      setLoginError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentStudent(null);
    setCurrentView('landing');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased text-gray-900">
      {currentView === 'landing' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-500 to-teal-700">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
            <h1 className="text-4xl font-black text-teal-600 mb-2">TVD EXAM</h1>
            <p className="text-gray-500 mb-8 font-medium">Hệ thống khảo sát & ôn tập trực tuyến</p>
            
            <div className="space-y-4">
              <button 
                onClick={() => setCurrentView('student-login')}
                className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all active:scale-95"
              >
                HỌC SINH ĐĂNG NHẬP
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <span className="relative px-4 bg-white text-gray-400 text-xs">DÀNH CHO GIÁO VIÊN</span>
              </div>
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-4 border-2 border-gray-100 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-95"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" className="w-5 h-5" alt="G" />
                Đăng nhập với Google
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'student-login' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-teal-50">
          <form onSubmit={handleStudentLogin} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
            <button type="button" onClick={() => setCurrentView('landing')} className="text-teal-600 mb-4 font-medium hover:underline">← Quay lại</button>
            <h2 className="text-2xl font-bold mb-6">Học sinh đăng nhập</h2>
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm mb-4">{loginError}</div>}
            <div className="space-y-4 mb-6">
              <input 
                type="text" placeholder="Tên đăng nhập (Mã HS)" 
                className="w-full p-4 bg-gray-50 rounded-xl border border-transparent focus:border-teal-500 outline-none transition-all"
                value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})}
              />
              <input 
                type="password" placeholder="Mật khẩu" 
                className="w-full p-4 bg-gray-50 rounded-xl border border-transparent focus:border-teal-500 outline-none transition-all"
                value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})}
              />
            </div>
            <button className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all">
              VÀO PHÒNG THI
            </button>
          </form>
        </div>
      )}

      {currentView === 'student-portal' && currentStudent && (
        <StudentPortal student={currentStudent} onLogout={handleLogout} onStartExam={(room, std) => { 
          setCurrentRoom(room); 
          setCurrentStudent(std);
          setCurrentView(room.settings.pdfUrl ? 'pdf-exam-room' : 'exam-room'); 
        }} />
      )}
      
      {currentView === 'exam-room' && currentRoom && currentStudent && (
        <ExamRoom 
          room={currentRoom} 
          student={currentStudent} 
          onSubmitted={(sub) => { setCurrentSubmission(sub); setCurrentView('result'); }} 
          onExit={() => setCurrentView('student-portal')} 
        />
      )}

      {currentView === 'pdf-exam-room' && currentRoom && currentStudent && (
        <PDFExamRoom 
          room={currentRoom} 
          student={currentStudent} 
          onSubmitted={(sub) => { setCurrentSubmission(sub); setCurrentView('result'); }} 
          onExit={() => setCurrentView('student-portal')} 
        />
      )}

      {currentView === 'result' && currentSubmission && currentRoom && (
        <ResultView 
          submission={currentSubmission} 
          room={currentRoom}
          onExit={() => setCurrentView('student-portal')} 
        />
      )}

      {currentView === 'teacher-dashboard' && currentUser && (
        <TeacherDashboard user={currentUser} onLogout={handleLogout} />
      )}

      {currentView === 'pending-approval' && currentUser && (
        <PendingApproval user={currentUser} onLogout={handleLogout} />
      )}

      {currentView === 'admin-users' && (
        <AdminPanel onBack={handleLogout} />
      )}
    </div>
  );
}

export default App;
