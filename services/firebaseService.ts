import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  addDoc,
  limit
} from 'firebase/firestore';
import { Exam, Room, Submission, User, Role, StudentInfo } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAcB408T-dgwVpxAKog5AUk4peZkONkWPM",
  authDomain: "taodepdf1503.firebaseapp.com",
  projectId: "taodepdf1503",
  storageBucket: "taodepdf1503.firebasestorage.app",
  messagingSenderId: "906406380218",
  appId: "1:906406380218:web:6d22613f58942290543883"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-export các hàm firestore để sử dụng ở các component khác
export { collection, query, where, getDocs, onSnapshot, doc, setDoc, updateDoc, deleteDoc };

// --- AUTH FUNCTIONS ---
export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const firebaseUser = result.user;

  // Kiểm tra xem user đã tồn tại trong Firestore chưa
  const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
  
  if (userDoc.exists()) {
    return { id: userDoc.id, ...userDoc.data() } as User;
  } else {
    // Nếu chưa có, tạo user mới với quyền mặc định là Member và chờ duyệt
    const newUser: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'Người dùng mới',
      email: firebaseUser.email || '',
      avatar: firebaseUser.photoURL || '',
      role: Role.MEMBER,
      isApproved: false,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  }
};

/**
 * Hàm đăng nhập dành cho học sinh bằng username và password cấp sẵn
 */
export const loginStudent = async (username: string, password: string): Promise<StudentInfo | null> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username),
      where('password', '==', password),
      where('role', '==', Role.STUDENT),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        name: userData.name,
        studentId: userData.username,
        className: userData.className || 'N/A'
      } as StudentInfo;
    }
    return null;
  } catch (error) {
    console.error("Login student error:", error);
    return null;
  }
};

export const signOutUser = () => signOut(auth);

// --- ROOM & EXAM FUNCTIONS ---
export const getRoom = async (roomId: string): Promise<Room | null> => {
  const docSnap = await getDoc(doc(db, 'rooms', roomId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Room : null;
};

export const getExam = async (examId: string): Promise<Exam | null> => {
  const docSnap = await getDoc(doc(db, 'exams', examId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Exam : null;
};

// --- SUBMISSION FUNCTIONS ---
export const getSubmissionsByStudent = async (studentId: string): Promise<Submission[]> => {
  const q = query(
    collection(db, 'submissions'),
    where('student.id', '==', studentId),
    orderBy('submittedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
};

export const getSubmissionsByRoom = async (roomId: string): Promise<Submission[]> => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId),
    orderBy('submittedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
};

export const createSubmission = async (data: any) => {
  return await addDoc(collection(db, 'submissions'), {
    ...data,
    submittedAt: serverTimestamp()
  });
};

// --- USER MANAGEMENT ---
export const approveUser = async (userId: string) => {
  await updateDoc(doc(db, 'users', userId), { isApproved: true });
};

export const rejectUser = async (userId: string) => {
  await deleteDoc(doc(db, 'users', userId));
};

export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as User;
  }
  return null;
};

/**
 * Hàm nhập danh sách học sinh từ file Excel
 * Mong đợi dữ liệu từ Excel có các cột: name, username, password, className
 */
export const importStudentsFromExcel = async (data: any[]) => {
  let successCount = 0;
  const errors: string[] = [];

  for (const item of data) {
    try {
      if (!item.username || !item.name) {
        errors.push(`Bỏ qua dòng không có username hoặc tên: ${JSON.stringify(item)}`);
        continue;
      }

      const studentId = `std_${item.username}`;
      const studentData = {
        name: item.name,
        username: String(item.username),
        password: String(item.password || '123456'), // Mặc định là 123456 nếu không có
        className: item.className || 'Chưa xếp lớp',
        role: Role.STUDENT,
        isApproved: true,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', studentId), studentData);
      successCount++;
    } catch (err: any) {
      errors.push(`Lỗi khi nhập ${item.username}: ${err.message}`);
    }
  }

  return { success: successCount, errors };
};

export const ensureSignedIn = async () => {
  if (!auth.currentUser) {
    const result = await signInAnonymously(auth);
    return result;
  }
  return { user: auth.currentUser };
};

export const getStudentSubmission = async (studentId: string, roomId: string): Promise<Submission | null> => {
  const q = query(
    collection(db, 'submissions'),
    where('student.id', '==', studentId),
    where('roomId', '==', roomId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Submission : null;
};
