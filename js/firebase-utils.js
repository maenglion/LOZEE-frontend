// js/firebase-utils.js
import { db } from './firebase-config.js'; // db 인스턴스 import
import { 
    collection, 
    addDoc, 
    doc, 
    runTransaction, 
    serverTimestamp, 
    getDoc, 
    setDoc, 
    updateDoc, // Firestore v9+ 에서는 setDoc({ merge: true }) 또는 updateDoc 사용
    query, 
    orderBy, 
    limit, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { 
    getStorage, 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';


// 위험 키워드 사전
import { RISK_KEYWORDS, PERSONS, EMOTION_WORDS } from './constants.js';
/**
 * 텍스트에서 위험 태그를 감지하여 배열로 반환
 * - RISK_KEYWORDS 중 하나라도 포함 시 해당 키워드 태그로 추가
 * - PERSONS 중 하나 + EMOTION_WORDS 중 하나가 같이 있을 시 “인물:감정” 태그 추가
 */
function detectRiskTags(text) {
  const tags = new Set();

  const lower = text.toLowerCase();

  // 1) 단어 단위 위험 키워드 검출
  RISK_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) {
      tags.add(kw);
    }
  });

  // 2) 특정인물 + 감정 단어 조합 검출
  PERSONS.forEach((person) => {
    const lowerPerson = person.toLowerCase();
    if (lower.includes(lowerPerson)) {
      // 해당 인물이 문장에 있으면 감정 단어와 결합 가능성 체크
      EMOTION_WORDS.forEach((emo) => {
        if (lower.includes(emo)) {
          tags.add(`${person}:${emo}`);
        }
      });
    }
  });

  return Array.from(tags); // 중복 제거된 배열 리턴
}

/**
 * Journal을 저장하면서, 위험 키워드가 감지되면 notifications 컬렉션에도 알림 생성
 * @param {string} ownerId         – 보호자 또는 자녀의 UID
 * @param {string} topic           – 대화 주제
 * @param {string} summaryText     – GPT가 생성한 요약 텍스트 (string)
 * @param {object} options
 *        options.relatedChildId: string  // 자녀 UID (보호자가 대리 상담할 때)
 *        options.entryType:     string  // "standard" | "child"
 */
export async function saveJournalEntry(ownerId, topic, summaryText, options = {}) {
  const {
    relatedChildId = null,
    entryType = 'standard',
  } = options;

  // 1) 위험 태그 감지
  const riskTags = detectRiskTags(summaryText);

  // 2) journals 컬렉션에 항상 저장
  const journalData = {
    ownerId,
    relatedChildId,
    entryType,       // "standard" 또는 "child"
    topic,
    title: summaryText.substring(0, 25) + (summaryText.length > 25 ? '...' : ''),
    summary: summaryText,
    tags: riskTags,  // 감지된 위험 태그만 담음
    createdAt: serverTimestamp(),
  };

  const journalRef = await addDoc(collection(db, 'journals'), journalData);
  console.log('✅ journals에 문서 저장됨 (ID:', journalRef.id, ')');

  // 3) 위험 태그가 하나라도 있으면 notifications에 알림 생성
  if (entryType === 'child' && riskTags.length > 0 && relatedChildId) {
    // 보호자 ID는 ownerId (child 상담 시 ownerId=보호자) 라고 가정
    const notificationData = {
      parentId: ownerId,
      childId: relatedChildId,
      journalId: journalRef.id,
      type: 'risk_alert',
      // 메시지는 태그에 따라 자유롭게 조합
      message: `위험 신호 감지: [${riskTags.join(', ')}]`,
      createdAt: serverTimestamp(),
      isRead: false
    };
    await addDoc(collection(db, 'notifications'), notificationData);
    console.log('⚠️ notifications에 위험 알림 저장됨');
  }

  return journalRef.id;
}

/**
 * 세션 시작 로그를 Firestore의 sessions 컬렉션에 저장합니다.
 * @param {string} userId 현재 사용자 이메일
 * @param {string} topicName 현재 대화 주제
 * @param {string} content 저장할 텍스트 (Assistant가 실제로 설명한 “방법” 텍스트)
 * @returns {Promise<string|null>} 저장된 세션 문서 ID 또는 null
 */
export async function logSessionStart(userId, topicName) {
    if (!db || !userId || !topicName) {
        console.warn("[Firebase Utils] logSessionStart: db, userId 또는 topicName이 없습니다.");
        return null;
    }
    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: userId,
            topic: topicName,
            startedAt: serverTimestamp(),
            status: "active"
        });
        console.log('[Firebase Utils] ✅ 세션 시작 로그 저장 완료, ID:', sessionRef.id);
        return sessionRef.id; // 세션 ID 반환
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 시작 로그 저장 중 오류:', err);
        return null;
    }
}

/**
 * 세션 종료 로그를 Firestore의 sessions 컬렉션에 업데이트합니다.
 * @param {string} sessionId 종료할 세션의 문서 ID
 */
export async function logSessionEnd(sessionId) {
    if (!db || !sessionId) {
        console.warn("[Firebase Utils] logSessionEnd: db 또는 sessionId가 없습니다.");
        return;
    }
    try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await setDoc(sessionRef, { 
            endedAt: serverTimestamp(), 
            status: "ended" 
        }, { merge: true });
        console.log('[Firebase Utils] ✅ 세션 종료 로그 저장 완료, ID:', sessionId);
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 종료 로그 저장 중 오류:', err);
    }
}

/**
 * 대화 내용을 바탕으로 journals 컬렉션에 요약된 저널 항목을 저장합니다.
 * @param {string} userId 현재 사용자 이메일
 * @param {string} currentTopic 현재 대화 주제
 * @param {Array} chatHistory 전체 대화 기록 배열 (메시지 객체 포함)
 * @param {object} analysisDataFromGpt GPT로부터 받은 분석 JSON 객체 
 * (내부에 summaryTitle, conversationSummary, keywords, overallSentiment, 
 * sessionDurationMinutes, userCharCountForThisSession 등 포함)
 * @returns {Promise<string|null>} 저장된 저널 문서 ID 또는 null
 */
export async function saveJournalEntry(userId, currentTopic, chatHistory, analysisDataFromGpt) {
    if (!userId || !currentTopic || !chatHistory || chatHistory.length === 0) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족 (userId, currentTopic, chatHistory). 저널 저장 건너뜀.");
        return null;
    }
    const safeAnalysisData = analysisDataFromGpt || {};

    const userMessages = chatHistory.filter(m => m.role === 'user');
    const assistantMessages = chatHistory.filter(m => m.role === 'assistant');
    const lastUserContent = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "내용 없음";
    const lastAssistantContent = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : "내용 없음";

    const title = safeAnalysisData.summaryTitle || `${currentTopic} 대화 (${new Date().toLocaleDateString('ko-KR', {month:'short', day:'numeric'})})`;
    const summary = safeAnalysisData.conversationSummary || `사용자: ${lastUserContent.substring(0,100)}...\n로지: ${lastAssistantContent.substring(0,100)}...`;
    
    const journalEntry = {
        userId: userId,
        topic: currentTopic,
        title: title,
        summary: summary,
        mood: safeAnalysisData.overallSentiment || "neutral",
        keywords: safeAnalysisData.keywords || [],
        detailedAnalysis: safeAnalysisData, // 전체 분석 객체 저장
        createdAt: serverTimestamp(),
        entryType: "conversation_summary_ai",
        sessionDurationMinutes: safeAnalysisData.sessionDurationMinutes || 0,
        userCharCountForThisSession: safeAnalysisData.userCharCountForThisSession || 0
        // fullChatHistory: chatHistory, // 매우 큰 데이터가 될 수 있으므로 주석 처리
    };

    try {
        const journalRef = await addDoc(collection(db, 'journals'), journalEntry);
        console.log(`[Firebase Utils] ✅ 새 저널 저장 완료, ID: ${journalRef.id}. 주제: ${currentTopic}`);
        return journalRef.id;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 저널 저장 중 오류:", error);
        return null;
    }
}

export async function saveManualJournalEntry(userId, topic, content) {
if (!userId || !topic || !content) {
        console.warn("[Firebase Utils] saveManualJournalEntry: 필수 정보 부족.");
        return null;
    }
    const journalEntry = {
        userId: userId,
        topic: topic || "로지의 설명", // 주제가 없다면 기본값
        title: `로지가 알려준 ${topic} 방법 (수동저장)`, // 자동 제목 생성
        summary: content, // AI의 설명 내용
        mood: "informative", // 또는 neutral
        keywords: ["설명", "방법", topic],
        detailedAnalysis: { 
            conversationSummary: content.substring(0, 200), // 간단 요약
            overallSentiment: "neutral" 
        },
        createdAt: serverTimestamp(),
        entryType: "manual_save_explanation", // 구분용 타입
    };
    try {
        const journalRef = await addDoc(collection(db, 'journals'), journalEntry);
        console.log(`[Firebase Utils] ✅ 수동 저장 저널 생성 완료, ID: ${journalRef.id}`);
        return journalRef.id;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 수동 저장 저널 생성 오류:", error);
        throw error; 
    }
}

/**
 * 특정 주제에 대한 사용자 통계를 업데이트합니다.
 * @param {string} userId 현재 사용자 이메일
 * @param {string} topicName 현재 대화 주제
 */
export async function updateTopicStats(userId, topicName) {
    if (!userId || !topicName) {
        console.warn("[Firebase Utils] updateTopicStats: userId 또는 topicName이 없습니다.");
        return;
    }
    const topicStatRef = doc(db, `users/${userId}/topicStats`, topicName); 
    try {
        // 가장 최근 저널의 제목을 가져오기 위한 쿼리
        let latestTitleForTopic = `${topicName} 관련 최근 대화`; // 기본값
        const journalsQuery = query(
            collection(db, 'journals'),
            where('userId', '==', userId),
            where('topic', '==', topicName),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const latestJournalSnapshot = await getDocs(journalsQuery);
        if (!latestJournalSnapshot.empty) {
            const latestJournalData = latestJournalSnapshot.docs[0].data();
            if (latestJournalData && latestJournalData.title) {
                 latestTitleForTopic = latestJournalData.title;
            }
        }

        await runTransaction(db, async (transaction) => {
            const topicStatDoc = await transaction.get(topicStatRef);
            if (!topicStatDoc.exists()) {
                transaction.set(topicStatRef, {
                    count: 1,
                    lastChattedAt: serverTimestamp(),
                    firstChattedAt: serverTimestamp(),
                    topicDisplayName: topicName,
                    latestJournalTitle: latestTitleForTopic 
                });
            } else {
                const newCount = (topicStatDoc.data().count || 0) + 1;
                transaction.update(topicStatRef, {
                    count: newCount,
                    lastChattedAt: serverTimestamp(),
                    latestJournalTitle: latestTitleForTopic
                });
            }
        });
        console.log(`[Firebase Utils] ✅ '${topicName}' 주제 통계 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ '${topicName}' 주제 통계 업데이트 중 오류:`, error);
    }
}

/**
 * Firestore users 문서에 사용자의 전체 누적 대화 통계를 업데이트합니다.
 * @param {string} userId 현재 사용자 이메일
 * @param {string} userType 사용자 유형 ("directUser" 또는 "caregiver")
 * @param {number} totalUserCharsToSave 이번 세션까지의 총 누적 발화 글자 수
 */
export async function updateUserOverallStats(userId, userType, totalUserCharsToSave) {
    if (!userId || !userType) {
        console.warn("[Firebase Utils] updateUserOverallStats: userId 또는 userType이 없습니다.");
        return;
    }
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef); // 현재 세션 카운트 가져오기 위해 읽기

        let updates = { 
            totalUserCharCount: totalUserCharsToSave,
            lastLogin: serverTimestamp() 
        };

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userType === 'directUser') {
                // users 문서의 최상위 totalSessionCount 또는 directUser.totalSessionCount 업데이트
                const currentCount = userData.totalSessionCount || (userData.directUser ? userData.directUser.totalSessionCount : 0) || 0;
                updates.totalSessionCount = currentCount + 1;
            } else if (userType === 'caregiver') {
                 // users 문서의 최상위 childTotalSessionCount 또는 caregiver.childTotalSessionCount 업데이트
                const currentCount = userData.childTotalSessionCount || (userData.caregiver ? userData.caregiver.childTotalSessionCount : 0) || 0;
                updates.childTotalSessionCount = currentCount + 1;
            }
        } else { // 사용자가 없으면 (이론상 발생하면 안됨, index.html에서 생성하므로)
            if (userType === 'directUser') updates.totalSessionCount = 1;
            else if (userType === 'caregiver') updates.childTotalSessionCount = 1;
        }
        
        await setDoc(userRef, updates, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 전체 통계 업데이트 완료:`, updates);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 전체 통계 업데이트 중 오류:`, error);
    }
}

/**
 * 사용자 프로필을 Firestore의 users 컬렉션에 저장/업데이트합니다.
 * (이 함수는 mypage.html에서 '프로필 수정' 시 사용)
 */
export async function saveUserProfileData(userId, profileDataToSave) {
    if (!userId || !profileDataToSave || Object.keys(profileDataToSave).length === 0) {
        console.warn("[Firebase Utils] saveUserProfileData: 저장할 데이터가 없거나 사용자 ID가 없습니다.");
        return;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        // Firestore 필드 경로에 점(.)이 포함된 경우, 직접 객체로 만들거나 updateDoc을 사용해야 합니다.
        // 여기서는 profileDataToSave가 이미 점 표기법을 사용한 키를 포함하지 않는다고 가정하고 setDoc으로 병합합니다.
        // 만약 profileDataToSave가 {'directUser.diagnoses': [...]} 형태라면, setDoc(..., {merge:true})이 아닌
        // updateDoc(userDocRef, profileDataToSave)를 사용하거나, 중첩된 객체로 만들어야 합니다.
        // 현재는 mypage.html에서 최상위 필드 또는 caregiver 맵 내부 필드를 업데이트하는 것으로 가정합니다.
        await setDoc(userDocRef, {
            ...profileDataToSave,
            lastUpdate: serverTimestamp() 
        }, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 프로필 정보 업데이트 완료.`);
    } catch (err) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 프로필 정보 업데이트 오류:`, err);
    }
}

/**
 * Firebase Storage에 프로필 사진을 업로드하고 URL을 반환합니다.
 * (이 함수는 mypage.html에서 사진 업로드 시 사용)
 */
export async function uploadUserPhoto(userId, file) {
    if (!userId || !file) {
        console.warn("[Firebase Utils] uploadUserPhoto: userId 또는 파일이 없습니다.");
        return null;
    }
    const storage = getStorage(); // getStorage() 호출
    const photoRef = storageRef(storage, `profilePhotos/${userId}/${file.name}`);
    try {
        const snapshot = await uploadBytes(photoRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Firebase Utils] ✅ 프로필 사진 업로드 성공, URL:', url);
        
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { photoURL: url, lastUpdate: serverTimestamp() }, { merge: true });
        console.log('[Firebase Utils] ✅ Firestore에 photoURL 업데이트 완료.');
        localStorage.setItem('lozee_photoURL', url);
        return url;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 프로필 사진 업로드 또는 Firestore 업데이트 오류:', err);
        return null;
    }
}