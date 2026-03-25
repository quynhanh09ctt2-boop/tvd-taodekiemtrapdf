import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
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
} from './firebaseService'; // Đã chỉnh sửa đường dẫn cho khớp với file bạn gửi
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
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser));
      setPendingUsers(users);
      setLoading(false);
    });

    // Lấy danh sách giáo viên đã duyệt
    const approvedQuery = query(
      collection(db, "users"), 
      where("role", "in", [Role.TEACHER, Role.MEMBER]),
      where("isApproved", "==", true)
    );
    const unsubApproved = onSnapshot(approvedQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser));
      setApprovedUsers(users);
    });

    // Lấy danh sách học sinh
    const studentQuery = query(
      collection(db, "users"), 
      where("role", "==", Role.STUDENT)
    );
    const unsubStudents = onSnapshot(studentQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser));
      setStudents(users);
    });

    return () => {
      unsubPending();
      unsubApproved();
      unsubStudents();
    };
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId);
      alert('Đã duyệt tài khoản thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi khi duyệt tài khoản');
    }
  };

  const handleReject = async (userId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa yêu cầu này?')) {
      try {
        await rejectUser(userId);
      } catch (error) {
        console.error(error);
        alert('Lỗi khi xóa tài khoản');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportLog(null);

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
        alert(`Đã nhập xong: ${result.success} thành công, ${result.errors.length} lỗi.`);
      } catch (err) {
        alert('Lỗi khi đọc file Excel');
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const renderUserList = (users: PendingUser[]) => {
    if (users.length === 0) {
      return (
        <div className="py-12 text-center text-gray-400">
          Không có dữ liệu hiển thị
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Thông tin</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Vai trò / Lớp</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-800">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email || user.username}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    user.role === Role.STUDENT ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {user.role === Role.STUDENT ? `Lớp: ${user.className}` : user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {activeTab === 'pending' && (
                      <button
                        onClick={() => handleApprove(user.id)}
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                        title="Duyệt"
                      >
                        Duyệt
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(user.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Quản trị hệ thống</h1>
          <p className="text-gray-500 mt-1">Quản lý người dùng và phê duyệt tài khoản</p>
        </div>
        <button 
          onClick={onBack}
          className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm font-medium"
        >
          ← Quay lại
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-teal-500/5 border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 p-2 bg-gray-50/50">
          {[
            { id: 'pending', label: 'Chờ duyệt', count: pendingUsers.length },
            { id: 'approved', label: 'Đã duyệt', count: approvedUsers.length },
            { id: 'students', label: 'Học sinh', count: students.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-teal-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-teal-100 text-teal-600' : 'bg-gray-200 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'students' && (
            <div className="mb-6 p-4 bg-teal-50 rounded-2xl border border-teal-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-teal-800">
                <strong>Nhập học sinh:</strong> Tải file Excel (.xlsx) chứa cột <strong>name, username, password, className</strong>.
              </div>
              <label className={`cursor-pointer px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                {isImporting ? 'Đang xử lý...' : 'Chọn file Excel'}
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100">
              {activeTab === 'pending' ? renderUserList(pendingUsers) : 
               activeTab === 'approved' ? renderUserList(approvedUsers) : 
               renderUserList(students)}
            </div>
          )}

          {importLog && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs overflow-auto max-h-40 border border-gray-200">
              <p className="font-bold mb-2">Kết quả nhập file:</p>
              <p className="text-green-600">- Thành công: {importLog.success}</p>
              {importLog.errors.map((err, i) => (
                <p key={i} className="text-red-500">- {err}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
