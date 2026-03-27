import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

// Import Components - Đảm bảo các file này tồn tại trong thư mục src/components/
import StudentPortal from './components/StudentPortal';
import ExamRoom from './components/ExamRoom';
import PDFExamRoom from './components/PDFExamRoom';
import ResultView from './components/ResultView';
import TeacherDashboard from './components/TeacherDashboard';
import PendingApproval from './components/PendingApproval';
import AdminPanel from './AdminPanel'; 

import { User, Role, Room, StudentInfo, Submission } from './types';
import { 
  auth, 
  signInWithGoogle, 
  signOutUser, 
  getCurrentUser, 
  loginStudent 
} from './services/firebaseService';

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      if (user) {
        try {
          const userData = await getCurrentUser(user.uid);
          if (userData) {
            setCurrentUser(userData);
            if (userData.role === Role.ADMIN || userData.role === Role.DEPUTY) {
              setCurrentView('teacher-dashboard');
            } else if (!userData.isApproved) {
              setCurrentView('pending-approval');
            } else {
              setCurrentView('teacher-dashboard');
            }
          }
        } catch (error) {
          console.error("Auth error:", error);
        }
      } else {
        setCurrentUser(null);
        if (currentView !== 'student-login' && currentView !== 'student-portal') {
          setCurrentView('landing');
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert("Đăng nhập thất bại. Vui lòng thử lại.");
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const student = await loginStudent(loginData.username, loginData.password);
      if (student) {
        setCurrentUser(student);
        setCurrentView('student-portal');
      } else {
        setLoginError('Sai tên đăng nhập hoặc mật khẩu');
      }
    } catch (error) {
      setLoginError('Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentView('landing');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-teal-600 font-medium">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {currentView === 'landing' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-500 to-teal-700 text-white text-center">
          <h1 className="text-5xl font-bold mb-4">TVD Exam Maker</h1>
          <p className="text-xl mb-8 opacity-90">Hệ thống tạo đề và thi trực tuyến dành cho giáo viên & học sinh</p>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <button 
              onClick={() => setCurrentView('student-login')}
              className="flex-1 bg-white text-teal-600 font-bold py-4 px-8 rounded-2xl shadow-xl hover:bg-teal-50 transition-all transform hover:scale-105"
            >
              Học sinh đăng nhập
            </button>
            <button 
              onClick={handleGoogleLogin}
              className="flex-1 bg-teal-800/30 backdrop-blur-sm border-2 border-white/30 text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:bg-teal-800/40 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Giáo viên
            </button>
          </div>
        </div>
      )}

      {currentView === 'student-login' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-teal-50">
          <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-teal-100">
            <button onClick={() => setCurrentView('landing')} className="text-teal-600 mb-6 flex items-center gap-2 hover:underline">
              ← Quay lại
            </button>
            <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Học sinh</h2>
            <p className="text-gray-500 text-center mb-8">Vui lòng đăng nhập để bắt đầu bài thi</p>
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Nhập mã học sinh..."
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                <input 
                  type="password" 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  required
                />
              </div>
              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
              <button className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 mt-4">
                Vào phòng thi
              </button>
            </form>
          </div>
        </div>
      )}

      {currentView === 'student-portal' && currentUser && (
        <StudentPortal user={currentUser} onLogout={handleLogout} onJoinRoom={(room, std) => {
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
          room={currentRoom}\n          onExit={() => setCurrentView('student-portal')} 
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
