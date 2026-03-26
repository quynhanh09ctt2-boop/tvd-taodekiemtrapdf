import React, { useState, useEffect } from 'react';
// Đảm bảo các component này tồn tại đúng tên file (Case-sensitive)
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
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsAuthLoading(true);
      if (user) {
        const userData = await getCurrentUser(user.uid);
        if (userData) {
          setCurrentUser(userData);
          if (!userData.isApproved && userData.role !== Role.STUDENT) {
            setCurrentView('pending-approval');
          } else if (userData.role === Role.ADMIN) {
            setCurrentView('admin-users');
          } else {
            setCurrentView('teacher-dashboard');
          }
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
      const user = await signInWithGoogle();
      if (!user.isApproved) {
        setCurrentView('pending-approval');
      } else if (user.role === Role.ADMIN) {
        setCurrentView('admin-users');
      } else {
        setCurrentView('teacher-dashboard');
      }
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const user = await loginStudent(loginData.username, loginData.password);
    if (user) {
      setCurrentUser(user);
      setCurrentStudent({
        id: user.id,
        name: user.name,
        className: user.className,
        studentId: user.username
      });
      setCurrentView('student-portal');
    } else {
      setLoginError('Sai tài khoản hoặc mật khẩu!');
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
    <div className="min-h-screen bg-gray-50">
      {currentView === 'landing' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl font-bold text-teal-700 mb-8">Hệ Thống Thi Online</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button 
              onClick={() => setCurrentView('student-login')}
              className="p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-teal-500 group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🎓</div>
              <h2 className="text-xl font-bold text-gray-800">Dành cho Học sinh</h2>
              <p className="text-gray-500 mt-2">Đăng nhập bằng mã số để làm bài thi</p>
            </button>
            <button 
              onClick={handleGoogleLogin}
              className="p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-teal-500 group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👨‍🏫</div>
              <h2 className="text-xl font-bold text-gray-800">Dành cho Giáo viên</h2>
              <p className="text-gray-500 mt-2">Đăng nhập Google để quản lý đề thi</p>
            </button>
          </div>
        </div>
      )}

      {currentView === 'student-login' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <form onSubmit={handleStudentLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-6">Đăng nhập Học sinh</h2>
            <input 
              type="text" placeholder="Tên đăng nhập / Mã HS"
              className="w-full p-3 border rounded-lg mb-4"
              value={loginData.username}
              onChange={e => setLoginData({...loginData, username: e.target.value})}
            />
            <input 
              type="password" placeholder="Mật khẩu"
              className="w-full p-3 border rounded-lg mb-4"
              value={loginData.password}
              onChange={e => setLoginData({...loginData, password: e.target.value})}
            />
            {loginError && <p className="text-red-500 text-sm mb-4">{loginError}</p>}
            <button type="submit" className="w-full bg-teal-600 text-white p-3 rounded-lg font-bold hover:bg-teal-700">Đăng nhập</button>
            <button type="button" onClick={() => setCurrentView('landing')} className="w-full mt-4 text-gray-500 text-sm">Quay lại</button>
          </form>
        </div>
      )}

      {currentView === 'student-portal' && currentStudent && (
        <StudentPortal student={currentStudent} onLogout={handleLogout} onJoinRoom={(room, std) => {
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
