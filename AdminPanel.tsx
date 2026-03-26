import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  where, 
  importStudentsFromExcel,
  rejectUser,
  approveUser,
  doc,
  updateDoc
} from '../services/firebaseService'; // SỬA: Thêm /services/ vào đường dẫn
import * as XLSX from 'xlsx';

interface PendingUser extends User {
  username?: string;
  password?: string;
  className?: string;
  email?: string;
  isApproved: boolean;
  createdAt: any;
}

const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [students, setStudents] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'students'>('pending');
  const [importLog, setImportLog] = useState<{ success: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // Lấy danh sách giáo viên chờ duyệt
    const pendingQuery = query(
      collection(db, "users"), 
      where("role", "in", [Role.TEACHER, Role.MEMBER]),
      where("isApproved", "==", false)
    );
    
    // Lấy danh sách giáo viên đã duyệt
    const approvedQuery = query(
      collection(db, "users"), 
      where("role", "in", [Role.TEACHER, Role.MEMBER]),
      where("isApproved", "==", true)
    );

    // Lấy danh sách học sinh
    const studentsQuery = query(
      collection(db, "users"), 
      where("role", "==", Role.STUDENT)
    );

    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as PendingUser)));
      setLoading(false);
    });

    const unsubApproved = onSnapshot(approvedQuery, (snapshot) => {
      setApprovedUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as PendingUser)));
    });

    const unsubStudents = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as PendingUser)));
    });

    return () => {
      unsubPending();
      unsubApproved();
      unsubStudents();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const result = await importStudentsFromExcel(data);
        setImportLog(result);
        alert(`Đã nhập xong: ${result.success} học sinh thành công!`);
      } catch (error) {
        alert("Lỗi khi đọc file Excel");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const renderUserList = (users: PendingUser[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="p-4 font-semibold text-gray-600">Tên/Tài khoản</th>
            <th className="p-4 font-semibold text-gray-600">Lớp/Email</th>
            <th className="p-4 font-semibold text-gray-600">Vai trò</th>
            <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={4} className="p-10 text-center text-gray-400">Trống</td></tr>
          ) : (
            users.map(user => (
              <tr key={user.uid} className="border-b border-gray-50 hover:bg-teal-50/30 transition-colors">
                <td className="p-4">
                  <p className="font-medium text-gray-800">{user.displayName || user.name}</p>
                  <p className="text-xs text-gray-500">{user.username || user.email}</p>
                </td>
                <td className="p-4">
                  <span className="text-sm text-gray-600">{user.className || user.email}</span>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs uppercase font-bold">
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  {activeTab === 'pending' ? (
                    <>
                      <button 
                        onClick={() => approveUser(user.uid)}
                        className="px-3 py-1 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
                      >Duyệt</button>
                      <button 
                        onClick={() => rejectUser(user.uid)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                      >Từ chối</button>
                    </>
                  ) : (
                    <button 
                      onClick={() => {
                        const newClass = prompt("Nhập lớp mới:", user.className);
                        if (newClass !== null) updateDoc(doc(db, "users", user.uid), { className: newClass });
                      }}
                      className="text-teal-600 hover:underline text-sm"
                    >Sửa lớp</button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button onClick={onBack} className="text-teal-600 mb-2 flex items-center gap-1 hover:underline">
              ← Quay lại
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Quản trị hệ thống</h1>
          </div>

          {activeTab === 'students' && (
            <div className="flex items-center gap-2">
              <label className={`cursor-pointer bg-teal-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                {isImporting ? 'Đang xử lý...' : 'Nhập file Excel'}
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
          {[
            { id: 'pending', label: 'Chờ duyệt', count: pendingUsers.length },
            { id: 'approved', label: 'Giáo viên', count: approvedUsers.length },
            { id: 'students', label: 'Học sinh', count: students.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label} ({tab.count})
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-500 rounded-full" />}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"></div>
              <p className="text-gray-500">Đang tải dữ và phân tích...</p>
            </div>
          ) : renderUserList(
            activeTab === 'pending' ? pendingUsers : 
            activeTab === 'approved' ? approvedUsers : students
          )}
        </div>

        {importLog && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs border border-gray-200 max-h-40 overflow-auto">
            <p className="font-bold text-teal-700">Kết quả nhập học sinh:</p>
            <p>- Thành công: {importLog.success}</p>
            {importLog.errors.map((err, i) => <p key={i} className="text-red-500">- {err}</p>)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
