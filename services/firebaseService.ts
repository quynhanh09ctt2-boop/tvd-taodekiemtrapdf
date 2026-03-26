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
  onSnapshot,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { Exam, Room, Submission, User, Role } from '../types';

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

export { collection, query, where, getDocs, onSnapshot, doc, setDoc, updateDoc, deleteDoc };

// --- AUTH FUNCTIONS ---
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const newUser: User = {
        id: user.uid,
        name: user.displayName || 'Người dùng',
        email: user.email || '',
        role: Role.MEMBER,
        isApproved: false,
        photoURL: user.photoURL || ''
      };
      await setDoc(doc(db, 'users', user.uid), newUser);
      return newUser;
    }
    return userDoc.data() as User;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOutUser = () => signOut(auth);

export const getCurrentUser = async (uid: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? (userDoc.data() as User) : null;
};

export const loginStudent = async (username: string, pass: string): Promise<User | null> => {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username),
    where('password', '==', pass),
    where('role', '==', Role.STUDENT)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { id: snapshot.docs[0].id, ...data } as User;
};

// --- DATA FUNCTIONS ---
// SỬA: Thêm giá trị mặc định cho role để không lỗi build khi gọi từ AdminPanel
export const approveUser = async (uid: string, role: Role = Role.TEACHER) => {
  await updateDoc(doc(db, 'users', uid), {
    isApproved: true,
    role: role
  });
};

export const rejectUser = async (uid: string) => {
  await deleteDoc(doc(db, 'users', uid));
};

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
        password: String(item.password || '123456'),
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
    return { user: result.user };
  }
  return { user: auth.currentUser };
};

export const getStudentSubmission = async (studentId: string, roomId: string): Promise<Submission | null> => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId),
    where('student.id', '==', studentId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { id: snapshot.docs[0].id, ...data } as Submission;
};
