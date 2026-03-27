import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, Room, StudentInfo } from '../types';
import {
  auth,
  signOutUser,
  getRoomByCode,
  getRoomsForStudent,
  getStudentSubmission,
  getCurrentUser,
  getClass,
  ensureSignedIn,
} from '../services/firebaseService';
import StudentHistory from './StudentHistory';

interface StudentPortalProps {
  onJoinRoom: (room: Room, student: StudentInfo, submissionId?: string) => void;
  onLogout: () => void;
  onBack?: () => void;
}

type LoginMode = 'select' | 'google' | 'anonymous';
type ActiveTab  = 'join' | 'history';

const StudentPortal: React.FC<StudentPortalProps> = ({ onJoinRoom, onLogout, onBack }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [activeTab, setActiveTab]   = useState<ActiveTab>('join');

  // Available rooms for student's classes
  const [availableRooms, setAvailableRooms]   = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms]   = useState(false);

  // Room code input (manual fallback)
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Resolved class names (from classIds)
  const [userClassNames, setUserClassNames] = useState<string[]>([]);

  // ── Helpers ──
  const resolveClassNames = useCallback(async (user: User) => {
    if (!user.classIds || user.classIds.length === 0) return;
    const names: string[] = [];
    for (const classId of user.classIds) {
      const cls = await getClass(classId);
      if (cls) names.push(cls.name);
    }
    setUserClassNames(names);
  }, []);

  const fetchAvailableRooms = useCallback(async (user: User) => {
    if (!user.classIds || user.classIds.length === 0) return;
    setIsLoadingRooms(true);
    try {
      const rooms = await getRoomsForStudent(user.classIds);
      setAvailableRooms(rooms);
    } catch (err) {
      console.error('fetchAvailableRooms error:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // ── Auth listener ──
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user && user.role === Role.STUDENT) {
          setCurrentUser(user);
          await resolveClassNames(user);
          await fetchAvailableRooms(user);
        }
      } catch (err) {
        console.error('Auth state error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, [resolveClassNames, fetchAvailableRooms]);

  const handleLogout = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ── Join room directly from the list ──
  const handleJoinRoomDirect = async (room: Room) => {
    if (!currentUser) return;
    setIsJoining(true);
    try {
      let studentClassName: string | undefined = userClassNames[0];
      if (room.classId && currentUser.classIds) {
        const idx = currentUser.classIds.indexOf(room.classId);
        if (idx >= 0 && idx < userClassNames.length) studentClassName = userClassNames[idx];
      }

      const studentInfo: StudentInfo = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
        className: studentClassName,
      };

      const existing = await getStudentSubmission(room.id, currentUser.id);
      if (existing?.status === 'submitted') {
        alert('✅ Bạn đã nộp bài rồi!\n\nKhông thể làm lại.');
        return;
      }
      onJoinRoom(room, studentInfo, existing?.id);
    } catch (err) {
      console.error('Join room direct error:', err);
      alert('❌ Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsJoining(false);
    }
  };

  // ── Join room via manual code ──
  const handleJoinRoomByCode = async () => {
    if (!roomCode.trim()) { alert('⚠️ Vui lòng nhập mã phòng!'); return; }
    if (!currentUser)     { alert('⚠️ Vui lòng đăng nhập trước!'); return; }

    if (currentUser.role !== Role.STUDENT) {
      alert('⚠️ Tài khoản này không phải HỌC SINH.\n\nVui lòng đăng xuất và đăng nhập ở Cổng Giáo viên.');
      return;
    }
    if (!currentUser.classIds || currentUser.classIds.length === 0) {
      alert('⚠️ Bạn chưa được thêm vào lớp nào!\n\nVui lòng liên hệ giáo viên để được thêm vào lớp.');
      return;
    }

    setIsJoining(true);
    try {
      const room = await getRoomByCode(roomCode.trim().toUpperCase());
      if (!room)                                             { alert('❌ Không tìm thấy phòng thi với mã này!'); return; }
      if (room.status === 'closed')                          { alert('❌ Phòng thi đã đóng!'); return; }
      if (room.status === 'waiting' && !room.allowLateJoin)  { alert('❌ Phòng thi chưa bắt đầu!'); return; }

      // Kiểm tra thời gian mở/đóng
      const now = Date.now();
      if (room.opensAt && now < new Date(room.opensAt).getTime()) {
        alert(`⏳ Phòng thi chưa mở!\nSẽ mở lúc: ${new Date(room.opensAt).toLocaleString('vi-VN')}`);
        return;
      }
      if (room.closesAt && now >= new Date(room.closesAt).getTime()) {
        alert(`⛔ Phòng thi đã hết giờ!\nĐã đóng lúc: ${new Date(room.closesAt).toLocaleString('vi-VN')}`);
        return;
      }

      // Kiểm tra lớp
      if (room.classId && !currentUser.classIds?.includes(room.classId)) {
        alert(`❌ Bạn không thuộc lớp "${room.className || 'này'}"!\n\nPhòng thi này chỉ dành cho học sinh trong lớp.`);
        return;
      }

      let studentClassName: string | undefined = userClassNames[0];
      if (room.classId && currentUser.classIds) {
        const classIndex = currentUser.classIds.indexOf(room.classId);
        if (classIndex >= 0 && classIndex < userClassNames.length) {
          studentClassName = userClassNames[classIndex];
        }
      }

      const studentInfo: StudentInfo = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
        className: studentClassName,
      };

      const existingSubmission = await getStudentSubmission(room.id, currentUser.id);
      if (existingSubmission?.status === 'submitted') {
        alert('✅ Bạn đã nộp bài rồi!\n\nKhông thể làm lại.');
        return;
      }
      onJoinRoom(room, studentInfo, existingSubmission?.id);
    } catch (err) {
      console.error('Join room error:', err);
      alert('❌ Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsJoining(false);
    }
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-teal-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4" />
          <p className="text-teal-700">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  // ── ĐÃ DUYỆT — GIAO DIỆN CHÍNH ──
  if (currentUser) {
    const hasClass = userClassNames.length > 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-purple-50 p-4">
        <div className="max-w-2xl mx-auto pt-8">

          {/* User card */}
          <div className="bg-white rounded-2xl shadow-xl p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-2xl border-2 border-teal-300">
                  🎓
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{currentUser.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {userClassNames.length > 0 ? (
                      userClassNames.map((name, idx) => (
                        <span key={idx} className="bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full border border-teal-100">
                          Lớp: {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs italic">Chưa tham gia lớp nào</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                title="Đăng xuất"
              >
                🚪 Đăng xuất
              </button>
            </div>

            {!hasClass && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-sm text-yellow-800">
                ⚠️ Bạn chưa được thêm vào lớp nào. Vui lòng liên hệ giáo viên để được thêm vào lớp.
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex bg-white rounded-2xl shadow-lg p-1.5 mb-5 gap-1.5">
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'join'
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              🏠 Vào thi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              📋 Lịch sử bài làm
            </button>
          </div>

          {/* ── Tab: Vào thi ── */}
          {activeTab === 'join' && (
            <div className="space-y-4">

              {/* Danh sách phòng thi đang mở */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    📌 Phòng thi của bạn
                  </h2>
                  <button
                    onClick={() => currentUser && fetchAvailableRooms(currentUser)}
                    disabled={isLoadingRooms}
                    className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 disabled:opacity-40"
                  >
                    {isLoadingRooms ? <span className="animate-spin inline-block">↻</span> : '↻'} Làm mới
                  </button>
                </div>

                {isLoadingRooms ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Đang tải...</p>
                  </div>
                ) : availableRooms.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="text-sm">Không có phòng thi nào đang mở cho lớp của bạn</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableRooms.map(room => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        onJoin={() => handleJoinRoomDirect(room)}
                        disabled={isJoining}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Nhập mã thủ công */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🔑 Nhập mã phòng thủ công
                </h2>
                <div className="mb-4">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoinRoomByCode()}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full px-4 py-4 text-3xl text-center font-mono font-bold border-2 border-gray-300 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-200 focus:outline-none uppercase tracking-[0.3em]"
                    disabled={isJoining}
                  />
                </div>
                <button
                  onClick={handleJoinRoomByCode}
                  disabled={isJoining || !roomCode.trim() || !hasClass}
                  className="w-full py-3 rounded-xl font-bold text-white transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                >
                  {isJoining ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Đang kiểm tra...
                    </span>
                  ) : '🚀 Vào Phòng Thi'}
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Lịch sử ── */}
          {activeTab === 'history' && (
            <StudentHistory student={currentUser} />
          )}

        </div>
      </div>
    );
  }

  return null;
};

// ── RoomCard ──
const RoomCard: React.FC<{
  room: Room;
  onJoin: () => void;
  disabled?: boolean;
}> = ({ room, onJoin, disabled }) => {
  const statusBadge =
    room.status === 'active'
      ? { label: '🟢 Đang thi', cls: 'bg-green-100 text-green-700' }
      : { label: '🟡 Chờ mở', cls: 'bg-yellow-100 text-yellow-700' };

  const closesAt = room.closesAt ? new Date(room.closesAt) : null;

  return (
    <div className="border-2 border-gray-100 rounded-xl p-4 hover:border-teal-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-gray-800 truncate">{room.examTitle}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>🔑 {room.code}</span>
            <span>⏱ {room.timeLimit} phút</span>
            {room.className && <span>🏫 {room.className}</span>}
            {closesAt && (
              <span>🕐 Đóng lúc {closesAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
        </div>
        <button
          onClick={onJoin}
          disabled={disabled}
          className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-white text-sm transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
        >
          Vào thi →
        </button>
      </div>
    </div>
  );
};

// ── Google SVG icon ──
const GoogleIcon: React.FC = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default StudentPortal;
