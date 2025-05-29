// js/firebase-utils.js
// Firestore 유틸리티 모듈: db 인스턴스와 저장 함수 모아두기

import { db } from './firebase-config.js';
import { collection, addDoc, doc, runTransaction, serverTimestamp, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

/**
 * 세션 로그를 Firestore의 sessions 컬렉션에 저장합니다.
 */
// sessions 컬렉션은 이제 간단한 로그 또는 생략 가능
// 만약 세션 시작/종료 시간만 기록하고 싶다면:
export async function logSessionStart(userId, topicName) {
    if (!db || !userId || !topicName) return null;
    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: userId,
            topic: topicName,
            startedAt: serverTimestamp(),
            status: "active"
        });
        console.log('✅ 세션 시작 로그 저장 완료, ID:', sessionRef.id);
        return sessionRef.id; // 세션 ID 반환
    } catch (err) { console.error('❌ 세션 시작 로그 저장 중 오류:', err); return null; }
}
export async function logSessionEnd(sessionId) {
    if (!db || !sessionId) return;
    try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await setDoc(sessionRef, { endedAt: serverTimestamp(), status: "ended" }, { merge: true });
        console.log('✅ 세션 종료 로그 저장 완료, ID:', sessionId);
    } catch (err) { console.error('❌ 세션 종료 로그 저장 중 오류:', err); }
}



/**
 * 대화 내용을 바탕으로 journals 컬렉션에 요약된 저널 항목을 저장합니다.
 * talk.html에서 GPT로부터 받은 최종 분석 결과(d.analysis)를 활용합니다.
 */
export async function saveJournalEntry(userId, currentTopic, chatHistory, lastAiAnalysis) {
    if (!userId || !currentTopic || !chatHistory || chatHistory.length === 0) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족으로 저널 저장 건너뜀.");
        return null;
    }

    // 마지막 사용자 메시지와 AI 응답 (요약 생성에 필요할 수 있음)
    const lastUserMessage = chatHistory.filter(m => m.role === 'user').pop()?.content || "";
    const lastAiMessage = chatHistory.filter(m => m.role === 'assistant').pop()?.content || "";

    // lastAiAnalysis 객체에서 필요한 정보 추출 (GPT 프롬프트에서 반환된 JSON)
    const analysisData = lastAiAnalysis || {};
    const title = analysisData.summaryTitle || `${currentTopic}에 대한 대화 (${new Date().toLocaleDateString('ko-KR', {month:'short', day:'numeric'})})`;
    const summary = analysisData.conversationSummary || `사용자: ${lastUserMessage.substring(0,50)}...\n로지: ${lastAiMessage.substring(0,50)}...`; // GPT 요약이 없으면 간단히 생성
    const keywords = analysisData.keywords || [];
    const overallSentiment = analysisData.overallSentiment || "neutral";
    // sessionDurationMinutes, userCharCountForThisSession 등도 analysisData에서 가져오거나 talk.html에서 계산해서 전달

    const journalEntry = {
        userId: userId,
        topic: currentTopic,
        title: title,
        summary: summary, // 800자 이내로 GPT가 요약한 내용
        mood: analysisData.mood || overallSentiment, // GPT가 판단한 주요 감정
        keywords: keywords,
        detailedAnalysis: analysisData, // GPT가 반환한 전체 분석 JSON 객체
        createdAt: serverTimestamp(),
        entryType: "conversation_summary_ai",
        // 실제 대화 내용을 chatHistory 그대로 저장할 수도 있지만, 요약본만 저장하는 것이 효율적
        // fullChatHistory: chatHistory, // 필요시 저장 (용량 주의)
        sessionDurationMinutes: analysisData.sessionDurationMinutes || 0, // 세션 지속 시간
        userCharCountForThisSession: analysisData.userCharCountForThisSession || 0 // 사용자 발화 글자 수
    };

    try {
        const journalRef = await addDoc(collection(db, 'journals'), journalEntry);
        console.log(`[Firebase Utils] 새 저널 저장 완료, ID: ${journalRef.id}. 주제: ${currentTopic}`);
        return journalRef.id; // 저장된 저널 ID 반환
    } catch (error) {
        console.error("[Firebase Utils] 저널 저장 중 오류:", error);
        return null;
    }
}


export async function updateTopicStats(userId, topicName) {
  if (!userId || !topicName) {
    console.warn("[Firebase Utils] updateTopicStats: userId 또는 topicName이 없습니다.");
    return;
  }

  // users 컬렉션의 특정 사용자 문서 아래에 topicStats 하위 컬렉션을 사용한다고 가정
  const topicStatRef = doc(db, `users/${userId}/topicStats`, topicName); 

  try {
    await runTransaction(db, async (transaction) => {
      const topicStatDoc = await transaction.get(topicStatRef);
      
      if (!topicStatDoc.exists()) {
        // 해당 주제에 대한 통계 문서가 없으면 새로 생성
        transaction.set(topicStatRef, {
          count: 1, // 첫 대화이므로 횟수는 1
          lastChattedAt: serverTimestamp(), // Firestore 서버 타임스탬프
          firstChattedAt: serverTimestamp(), // 첫 대화 시간이므로 동일
          topicDisplayName: topicName // 실제 주제 표시명 (선택 사항)
        });
      } else {
        // 기존 통계 문서가 있으면 count를 1 증가시키고 lastChattedAt 업데이트
        const newCount = (topicStatDoc.data().count || 0) + 1;
        transaction.update(topicStatRef, {
          count: newCount,
          lastChattedAt: serverTimestamp()
        });
      }
    });
    console.log(`[Firebase Utils] '${topicName}' 주제 통계 업데이트 완료.`);
  } catch (error) {
    console.error(`[Firebase Utils] '${topicName}' 주제 통계 업데이트 중 오류:`, error);
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
