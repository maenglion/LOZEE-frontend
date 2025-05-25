// js/firebase-utils.js
// Firestore 유틸리티 모듈: db 인스턴스와 저장 함수 모아두기

import { db } from '../firebase-config.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

/**
 * 세션 로그를 Firestore의 sessions 컬렉션에 저장합니다.
 * @param {string} userText  사용자 발화 텍스트
 * @param {string} aiText    AI 응답 텍스트
 * @param {object} analysis  분석 객체 (sentiment, keywords 등)
 */
export async function saveSessionLog(userText, aiText, analysis = {}) {
  if (!db) {
    console.warn('Firestore DB가 초기화되지 않았습니다.');
    return;
  }
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
