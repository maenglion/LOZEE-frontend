// js/firebase-utils.js
// Firestore 유틸리티 모듈: db 인스턴스와 저장 함수 모아두기

import { db } from './js/firebase-config.js';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

/**
 * 세션 로그를 Firestore의 sessions 컬렉션에 저장합니다.
 */
export async function saveSessionLog(userText, aiText, analysis = {}) {
  if (!db) return;
  try {
    await addDoc(collection(db, 'sessions'), {
      userText,
      aiReply: aiText,
      analysis,
      timestamp: serverTimestamp()
    });
    console.log('✅ 세션 로그 저장 완료');
  } catch (err) {
    console.error('❌ 세션 로그 저장 중 오류:', err);
  }
}

/**
 * 사용자 프로필을 Firestore의 users 컬렉션에 저장/업데이트합니다.
 * 저장 항목: 이름, 나이, 사진 URL, 음성 설정, 테마, 선호 주제, 대화 요약 히스토리
 */
export async function saveUserProfile() {
  const userId = localStorage.getItem('cbtUserEmail');
  if (!userId) return;

  const name = localStorage.getItem('lozee_username') || '';
  const age = parseInt(localStorage.getItem('lozee_userage') || '0', 10);
  const photoURL = localStorage.getItem('lozee_photoURL') || '';
  const voicePreference = {
    voiceId: localStorage.getItem('lozee_voice') || '',
    volume: Number(localStorage.getItem('lozee_voice_volume') || 1),
    rate: Number(localStorage.getItem('lozee_voice_rate') || 1)
  };
  const theme = localStorage.getItem('lozee_theme') || 'light';
  const preferredTopics = JSON.parse(localStorage.getItem('lozee_preferredTopics') || '[]');
  const sessionHistorySummary = JSON.parse(localStorage.getItem('lozee_sessionHistorySummary') || '[]');

  try {
    await setDoc(doc(db, 'users', userId), {
      name,
      age,
      photoURL,
      voicePreference,
      theme,
      preferredTopics,
      sessionHistorySummary,
      lastUpdate: serverTimestamp()
    }, { merge: true });
    console.log('✅ 사용자 프로필 저장/업데이트 완료');
  } catch (err) {
    console.error('❌ 사용자 프로필 저장 오류:', err);
  }
}

/**
 * Firebase Storage에 프로필 사진을 업로드하고 URL을 반환합니다.
 * 업로드 후 saveUserProfile()를 호출해 Firestore에 URL 저장
 */
export async function uploadUserPhoto(file) {
  const userId = localStorage.getItem('cbtUserEmail');
  if (!userId || !file) return null;

  const storage = getStorage();
  const photoRef = storageRef(storage, `profilePhotos/${userId}`);
  try {
    await uploadBytes(photoRef, file);
    const url = await getDownloadURL(photoRef);
    localStorage.setItem('lozee_photoURL', url);
    await saveUserProfile();
    console.log('✅ 프로필 사진 업로드 및 저장 완료');
    return url;
  } catch (err) {
    console.error('❌ 프로필 사진 업로드 오류:', err);
    return null;
  }
}
