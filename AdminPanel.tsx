import React, { useState, useEffect } from 'react';
import { User, Role } from './types'; // SỬA: Thay ../ thành ./ vì file nằm cùng cấp
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
} from './services/firebaseService'; // SỬA: Thay ../ thành ./
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
      where("role", "in", [Role.TEACHER, Role.MEMBER, Role.ADMIN, Role.DEPUTY, Role.LEADER]),
      where("isApproved", "==", true)
    );

    // Lấy danh sách học sinh
    const studentQuery = query(
      collection(db, "users"),
      where("role", "==", Role.STUDENT)
    );

    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser)));
      setLoading(false);
    });

    const unsubApproved = onSnapshot(approvedQuery, (snapshot) => {
      setApprovedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser)));
    });

    const unsubStudents = onSnapshot(studentQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingUser)));
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
        alert(`Đã nhập xong ${result.success} học sinh!`);
      } catch (error) {
        console.error("Lỗi nhập file:", error);
        alert("Có lỗi khi xử lý file Excel.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const renderUserList = (users: PendingUser[]) => {
    if (users.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-gray-400">Không có dữ liệu hiển thị</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Thông tin</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Vai trò / Lớp</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} className="w-10 h-10 rounded-full border border-gray-200" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold">
                        {user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email || user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    user.role === Role.STUDENT ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {user.role === Role.STUDENT ? (user.className || 'Học sinh') : user.role.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {!user.isApproved && user.role !== Role.STUDENT && (
                      <button 
                        onClick={() => approveUser(user.id, Role.TEACHER)}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Duyệt"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if(confirm('Xác nhận xóa người dùng này?')) rejectUser(user.id);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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

  const tabs = [
    { id: 'pending', label: 'Chờ duyệt', count: pendingUsers.length },
    { id: 'approved', label: 'Giáo viên', count: approvedUsers.length },
    { id: 'students', label: 'Học sinh', count: students.length },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center text-gray-500 hover:text-teal-600 transition-colors mb-2 group"
            >
              <svg className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Quản trị hệ thống</h1>
            <p className="text-gray-500">Quản lý người dùng và danh sách học sinh</p>
          </div>

          <div className="flex items-center gap-3">
            <label className={`
              cursor-pointer flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl
              hover:bg-teal-700 transition-all shadow-sm shadow-teal-200
              ${isImporting ? 'opacity-50 pointer-events-none' : ''}
            `}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>{isImporting ? 'Đang nhập...' : 'Nhập học sinh Excel'}</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
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
            {importLog.errors.map((err, idx) => (
              <p key={idx} className="text-red-500">- {err}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
