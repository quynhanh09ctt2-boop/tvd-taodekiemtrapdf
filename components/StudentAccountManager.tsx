// ============================================================
// StudentAccountManager.tsx
// Component quản lý tài khoản học sinh trong TeacherDashboard
// Đã điều chỉnh: Ép kiểu dữ liệu an toàn & fix lỗi hiển thị nút
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { User, Class, StudentAccount, CreateStudentAccountInput, BulkImportStudentRow, BulkImportResult } from '../types';
import {
  createStudentAccount,
  getStudentAccountsByTeacher,
  deleteStudentAccount,
  resetStudentPassword,
  toggleStudentAccountStatus,
  bulkCreateStudentAccounts,
  isValidUsername,
} from '../services/studentAccountService';
import * as XLSX from 'xlsx';

type CreateStudentInput = CreateStudentAccountInput;
type BulkImportRow      = BulkImportStudentRow;

interface Props {
  teacher: User;
  classes: Class[];
}

type Tab = 'list' | 'create' | 'import';

const StudentAccountManager: React.FC<Props> = ({ teacher, classes }) => {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [accounts, setAccounts] = useState<StudentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create form
  const [form, setForm] = useState<CreateStudentInput>({
    username: '',
    password: '',
    name: '',
    classId: '',
    className: '',
    teacherId: teacher.id,
  });
  const [formError, setFormError] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<BulkImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<StudentAccount | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [teacher.id]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const data = await getStudentAccountsByTeacher(teacher.id);
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.username || !form.password || !form.name) {
      setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (!isValidUsername(form.username)) {
      setFormError('Tên đăng nhập không hợp lệ (3-20 ký tự, chỉ chữ cái, số, gạch dưới).');
      return;
    }

    try {
      setIsCreating(true);
      await createStudentAccount(form);
      setForm({
        username: '',
        password: '',
        name: '',
        classId: '',
        className: '',
        teacherId: teacher.id,
      });
      setActiveTab('list');
      loadAccounts();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Ép kiểu String an toàn cho từng trường dữ liệu
        const formattedData: BulkImportRow[] = data.map((row: any) => ({
          username: String(row.username || row['Tên đăng nhập'] || row['Mã học sinh'] || row['username'] || '').trim(),
          password: String(row.password || row['Mật khẩu'] || '123456').trim(),
          name: String(row.name || row['Họ và tên'] || row['ho_ten'] || row['Họ tên'] || '').trim(),
          className: String(row.className || row['Lớp'] || row['class_name'] || row['Lớp học'] || '').trim()
        })).filter(item => item.username !== '' && item.name !== '');

        setImportData(formattedData);
        if (formattedData.length === 0) {
          setFormError("Không tìm thấy dữ liệu học sinh hợp lệ trong file.");
        } else {
          setFormError("");
        }
      } catch (err) {
        setFormError("Lỗi định dạng file Excel.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleBulkImport = async () => {
    if (importData.length === 0) return;
    try {
      setIsImporting(true);
      setFormError('');
      const result = await bulkCreateStudentAccounts(teacher.id, importData, classes);
      setImportResult(result);
      setFile(null);
      setImportData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadAccounts();
    } catch (err: any) {
      setFormError(String(err.message || "Lỗi khi nhập danh sách"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản của học sinh ${name}?`)) return;
    try {
      await deleteStudentAccount(id);
      loadAccounts();
    } catch (err) {
      alert('Lỗi khi xóa tài khoản');
    }
  };

  const handleToggleStatus = async (account: StudentAccount) => {
    try {
      await toggleStudentAccountStatus(account.id, !account.isApproved);
      loadAccounts();
    } catch (err) {
      alert('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || resetPwd.length < 4) return;
    try {
      setIsResetting(true);
      await resetStudentPassword(resetTarget.id, resetPwd);
      setResetTarget(null);
      setResetPwd('');
      alert('Đã đổi mật khẩu thành công');
    } catch (err) {
      alert('Lỗi khi đổi mật khẩu');
    } finally {
      setIsResetting(false);
    }
  };

  const renderImportTab = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-teal-200 text-center">
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📊</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Nhập danh sách từ Excel</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Tải file Excel chứa các cột: <b>Họ và tên, Tên đăng nhập, Mật khẩu, Lớp</b>.
        </p>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          id="excel-upload"
        />
        <label
          htmlFor="excel-upload"
          className="inline-flex items-center px-6 py-3 bg-white border-2 border-teal-500 text-teal-600 font-bold rounded-2xl hover:bg-teal-50 transition cursor-pointer shadow-sm"
        >
          {file ? '📄 Đổi tệp khác' : '📁 Chọn tệp từ máy tính'}
        </label>

        {file && (
          <div className="mt-8 p-5 bg-teal-50 rounded-2xl border-2 border-teal-100 text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-teal-900">📍 File đã chọn: {file.name}</p>
                <p className="text-sm text-teal-700 mt-1">
                  {importData.length > 0 
                    ? `Phát hiện ${importData.length} dòng dữ liệu hợp lệ.` 
                    : "⚠️ Không tìm thấy dữ liệu hợp lệ. Vui lòng kiểm tra tiêu đề cột."}
                </p>
              </div>
              <button
                onClick={handleBulkImport}
                disabled={isImporting || importData.length === 0}
                className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 whitespace-nowrap"
              >
                {isImporting ? '⏳ Đang tải...' : '🚀 Tải lên ngay'}
              </button>
            </div>
          </div>
        )}
      </div>

      {importResult && (
        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <p className="font-bold text-blue-900">Kết quả nhập dữ liệu:</p>
          <ul className="text-sm text-blue-800 mt-1 list-disc list-inside">
            <li>Thành công: {importResult.success}</li>
            <li>Thất bại: {importResult.failed}</li>
          </ul>
          {importResult.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600 bg-white p-2 rounded-lg max-h-32 overflow-y-auto">
              {importResult.errors.map((err, i) => <p key={i}>- {err}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50/50 rounded-3xl p-2 md:p-6 min-h-[500px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <span className="p-2 bg-teal-600 text-white rounded-xl shadow-lg shadow-teal-200">👥</span>
            Quản lý tài khoản học sinh
          </h2>
          <p className="text-gray-500 text-sm mt-1">Cấp tài khoản định danh cho học sinh làm bài thi</p>
        </div>

        <div className="inline-flex p-1.5 bg-white rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2.5 rounded-xl font-bold transition ${activeTab === 'list' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Danh sách
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 rounded-xl font-bold transition ${activeTab === 'create' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Tạo mới
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-5 py-2.5 rounded-xl font-bold transition ${activeTab === 'import' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Nhập Excel
          </button>
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl flex items-center gap-3 animate-shake">
          <span>⚠️</span>
          <p className="font-medium text-sm">{String(formError)}</p>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center text-gray-400">Đang tải dữ liệu...</div>
          ) : accounts.length === 0 ? (
            <div className="p-20 text-center">
               <div className="text-6xl mb-4">📭</div>
               <p className="text-gray-500 font-medium">Chưa có tài khoản nào được tạo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 font-bold text-gray-600 text-sm uppercase tracking-wider">Học sinh</th>
                    <th className="px-6 py-4 font-bold text-gray-600 text-sm uppercase tracking-wider">Tên đăng nhập</th>
                    <th className="px-6 py-4 font-bold text-gray-600 text-sm uppercase tracking-wider">Lớp</th>
                    <th className="px-6 py-4 font-bold text-gray-600 text-sm uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 font-bold text-gray-600 text-sm uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {accounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-teal-50/30 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                            {acc.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-gray-900">{acc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600">@{acc.username}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                          {acc.className || 'Chưa xếp'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleToggleStatus(acc)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${acc.isApproved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                        >
                          {acc.isApproved ? '● Đang hoạt động' : '● Chờ duyệt'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setResetTarget(acc)}
                            className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg title='Đổi mật khẩu'"
                          >
                            🔑
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc.id, acc.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg title='Xóa tài khoản'"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fadeIn">
          <form onSubmit={handleCreateAccount} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên học sinh *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:outline-none transition"
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tên đăng nhập *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:outline-none transition font-mono"
                  placeholder="van_a_123"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu *</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:outline-none transition"
                  placeholder="******"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Chọn lớp học</label>
              <select
                value={form.classId}
                onChange={e => {
                  const cls = classes.find(c => c.id === e.target.value);
                  setForm({ ...form, classId: e.target.value, className: cls?.name || '' });
                }}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:outline-none transition appearance-none"
              >
                <option value="">-- Không xếp lớp --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl shadow-lg shadow-teal-100 transition transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isCreating ? 'Đang tạo...' : 'TẠO TÀI KHOẢN'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'import' && renderImportTab()}

      {/* Modal Đặt lại mật khẩu */}
      {resetTarget && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm space-y-6 animate-scaleIn">
            <div className="text-center">
               <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔑</div>
               <h3 className="text-xl font-bold text-gray-900">Đổi mật khẩu</h3>
               <p className="text-sm text-gray-500 mt-1">
                 Tài khoản: <span className="font-bold text-teal-600">@{resetTarget.username}</span>
               </p>
            </div>
            <input
              type="text"
              value={resetPwd}
              onChange={e => setResetPwd(e.target.value)}
              placeholder="Mật khẩu mới (ít nhất 4 ký tự)"
              className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:outline-none font-mono text-center text-lg"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setResetTarget(null); setResetPwd(''); }}
                className="flex-1 py-3 border-2 border-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting || resetPwd.length < 4}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {isResetting ? '...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAccountManager;
