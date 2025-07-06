// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js"; // ✅ 정확한 모듈 경로

// 실제 LOZEE 프로젝트 설정값으로 교체한 firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyBnuL-CEvcU4NiIyG4yOe6mQjMnh9aArIY",
  authDomain: "lozee-af4d3.firebaseapp.com",
  projectId: "lozee-af4d3",
  storageBucket: "lozee-af4d3.appspot.com",
  messagingSenderId: "838397276113",
  appId: "1:838397276113:web:fc8cb3bdf59ecd52fabaf0",
  measurementId: "G-C23DLE9GZ4"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore 및 Auth 인스턴스 내보내기
export const db = getFirestore(app);
export const auth = getAuth(app);

// firebaseConfig 객체 자체를 default export 할 필요는 일반적으로 없습니다.
// export default firebaseConfig; // 이 라인 제거 또는 주석 처리