import React, { useState, useEffect } from 'react';
// Import các Component từ thư mục components
import StudentPortal from './components/StudentPortal';
import ExamRoom from './components/ExamRoom';
import PDFExamRoom from './components/PDFExamRoom';
import ResultView from './components/ResultView';
import TeacherDashboard from './components/TeacherDashboard';
import PendingApproval from './components/PendingApproval';
import AdminPanel from './AdminPanel'; 

// Import Types và Services từ thư mục gốc hoặc services
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
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const user = await getCurrentUser(firebaseUser.uid);
        if (user) {
          setCurrentUser(user);
          if (user.role === Role.ADMIN) setCurrentView('admin-users');
          else if (!user.isApproved) setCurrentView('pending-approval');
          else setCurrentView('teacher-dashboard');
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentStudent(null);
    setCurrentView('landing');
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const student = await loginStudent(loginData.username, loginData.password);
      if (student) {
        setCurrentStudent(student);
        setCurrentView('student-portal');
      } else {
        setLoginError('Sai tài khoản hoặc mật khẩu');
      }
    } catch (err) {
      setLoginError('Lỗi đăng nhập hệ thống');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  // Giao diện Landing Page
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-teal-600 mb-4">TH TRẦN VĂN DƯ</h1>
          <p className="text-gray-500 text-xl font-medium">Hệ thống khảo sát & thi trực tuyến</p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <button 
            onClick={() => setCurrentView('student-login')}
            className="p-8 bg-white border-2 border-gray-100 rounded-3xl shadow-xl hover:border-teal-500 transition-all group w-64"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🎓</div>
            <div className="font-bold text-xl text-gray-800">Học sinh</div>
            <p className="text-gray-500 text-sm mt-2">Vào thi bằng mã phòng hoặc tài khoản</p>
          </button>
          <button 
            onClick={() => signInWithGoogle()}
            className="p-8 bg-white border-2 border-gray-100 rounded-3xl shadow-xl hover:border-teal-500 transition-all group w-64"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">👨‍🏫</div>
            <div className="font-bold text-xl text-gray-800">Giáo viên</div>
            <p className="text-gray-500 text-sm mt-2">Quản lý đề thi & lớp học</p>
          </button>
        </div>
      </div>
    );
  }

  // Giao diện Đăng nhập học sinh
  if (currentView === 'student-login') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleStudentLogin} className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Đăng nhập Học sinh</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
              <input type="text" required value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <input type="password" required value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all">Đăng nhập</button>
            <button type="button" onClick={() => setCurrentView('landing')} className="w-full text-gray-500 text-sm py-2">Quay lại</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'student-portal' && currentStudent && (
        <StudentPortal onJoinRoom={(room, std) => { 
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
