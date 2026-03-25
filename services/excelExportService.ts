import * as XLSX from 'xlsx';
import { Submission, Room } from '../types';
import { formatScore } from './scoringService';

/**
 * Xuất danh sách kết quả nộp bài của học sinh ra file Excel
 */
export const exportSubmissionsToExcel = (
  submissions: Submission[],
  room: Room
) => {
  if (!submissions || submissions.length === 0) {
    console.error("Không có dữ liệu để xuất Excel");
    return;
  }

  // Chuẩn bị dữ liệu cho file Excel
  const data = submissions.map((sub, index) => {
    // Đảm bảo các trường dữ liệu tồn tại để tránh lỗi undefined khi build
    const mb = sub.scoreBreakdown?.multipleChoice || { correct: 0, total: 0 };
    const tf = sub.scoreBreakdown?.trueFalse || { correct: 0, total: 0 };
    const sa = sub.scoreBreakdown?.shortAnswer || { correct: 0, total: 0 };

    return {
      'STT': index + 1,
      'Họ tên': sub.student?.name || 'N/A',
      'Mã HS/SBD': sub.student?.studentId || '',
      'Lớp': sub.student?.className || '',
      'Điểm số': formatScore(sub.totalScore),
      'Phần trăm (%)': `${sub.percentage}%`,
      'Trắc nghiệm (Đúng/Tổng)': `${mb.correct}/${mb.total}`,
      'Đúng/Sai (Đúng/Tổng)': `${tf.correct}/${tf.total}`,
      'Trả lời ngắn (Đúng/Tổng)': `${sa.correct}/${sa.total}`,
      'Tổng câu đúng': sub.correctCount,
      'Thời gian làm bài (giây)': sub.duration,
      'Số lần thoát tab': sub.tabSwitchCount || 0,
      'Ngày nộp': sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleString('vi-VN') : 'N/A'
    };
  });

  // Tạo worksheet từ dữ liệu JSON
  const ws = XLSX.utils.json_to_sheet(data);

  // Thiết lập độ rộng cột cơ bản để file Excel đẹp hơn
  const wscols = [
    { wch: 5 },  // STT
    { wch: 25 }, // Họ tên
    { wch: 15 }, // Mã HS
    { wch: 10 }, // Lớp
    { wch: 10 }, // Điểm số
    { wch: 12 }, // Phần trăm
    { wch: 20 }, // Trắc nghiệm
    { wch: 20 }, // Đúng/Sai
    { wch: 20 }, // Trả lời ngắn
    { wch: 15 }, // Tổng câu đúng
    { wch: 20 }, // Thời gian
    { wch: 15 }, // Thoát tab
    { wch: 20 }, // Ngày nộp
  ];
  ws['!cols'] = wscols;

  // Tạo workbook và thêm worksheet vào
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kết quả thi');

  // Đặt tên file theo mã phòng và ngày hiện tại
  const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
  const fileName = `KetQua_Phong_${room.code}_${dateStr}.xlsx`;

  // Xuất file (Trigger download)
  XLSX.writeFile(wb, fileName);
};
