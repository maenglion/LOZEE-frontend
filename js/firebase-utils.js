// js/firebase-utils.js
import { db } from './firebase-config.js';
import { auth as firebaseAuth } from './firebase-config.js';
import { onAuthStateChanged, getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
    collection,
    addDoc,
    doc,
    runTransaction,
    serverTimestamp,
    getDoc,
    setDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    getDocs,
    where
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js'; // constants.js는 이 파일에 사용됨

/** 텍스트에서 위험 태그를 감지하여 배열로 반환 */
function detectRiskTags(text, detailedAnalysis = {}) {
    const tags = new Set();
    if (typeof text !== 'string') return [];
    const lowerText = text.toLowerCase();
    (ALL_NOTIFICATION_KEYWORDS || []).forEach(kw => { if (lowerText.includes(kw)) tags.add(kw); });
    if (detailedAnalysis.keywords && Array.isArray(detailedAnalysis.keywords)) {
        detailedAnalysis.keywords.forEach(kw => tags.add(String(kw).toLowerCase()));
    }
    if (NOTIFICATION_KEYWORDS?.PERSONS && NOTIFICATION_KEYWORDS?.EMOTION_WORDS) {
        NOTIFICATION_KEYWORDS.PERSONS.forEach(person => {
            if (lowerText.includes(String(person).toLowerCase())) {
                NOTIFICATION_KEYWORDS.EMOTION_WORDS.forEach(emo => {
                    if (lowerText.includes(String(emo).toLowerCase())) tags.add(`${person}:${emo}`);
                });
            }
        });
    }
    return Array.from(tags);
}

const auth = getAuth();
let IDTOKEN = null;
let tokenWaiters = [];

// Firebase 인증 상태 변화 감지 → ID 토큰 초기화
onAuthStateChanged(firebaseAuth, async (user) => {
  if (user) {
    try {
      IDTOKEN = await user.getIdToken();
      console.log("[FirebaseUtils] 🔐 토큰 초기화 완료");
      tokenWaiters.forEach(cb => cb(IDTOKEN));
      tokenWaiters = [];
    } catch (err) {
      console.error("[FirebaseUtils] ❌ 토큰 초기화 실패:", err);
    }
  } else {
    IDTOKEN = null;
    tokenWaiters = [];
    console.warn("[FirebaseUtils] 로그아웃 상태로 토큰 제거됨.");
  }
});

export function getIdToken() {
  return IDTOKEN;
}

export function waitForIdToken(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (IDTOKEN) return resolve(IDTOKEN);
    const timer = setTimeout(() => reject(new Error("ID 토큰 대기 시간 초과")), timeout);
    tokenWaiters.push(token => {
      clearTimeout(timer);
      resolve(token);
    });
  });
}

/**
 * [기존 함수 유지]
 * 생성된 저널 데이터를 Firestore에 저장(또는 업데이트)하는 함수
 * @param {string} sessionId - 저장할 저널의 고유 세션 ID
 * @param {object} journalData - 저장할 저널 데이터 객체
 * @returns {Promise<void>}
 */
export async function saveJournalToFirestore(sessionId, journalData) {
  if (!sessionId || !journalData) {
    console.error("세션 ID 또는 저널 데이터가 없어 저장할 수 없습니다.");
    return;
  }

  try {
    const journalRef = doc(db, 'journals', sessionId);

    await setDoc(journalRef, {
      ...journalData,
      createdAt: serverTimestamp(), // journal.html에서 사용하던 toDate()를 위해 서버 시간을 기록
      updatedAt: serverTimestamp()
    }, { merge: true }); // merge: true 옵션으로 기존 문서를 덮어쓰지 않고 병합

    console.log(`저널이 성공적으로 저장되었습니다 (ID: ${sessionId})`);

  } catch (error) {
    console.error("Firestore에 저널 저장 중 오류:", error);
    throw error; // 오류 발생 시 상위로 전파
  }
}

/**
 * [기존 함수 유지]
 * Journal을 저장하고, 조건에 따라 notifications 컬렉션에도 알림 생성
 * @returns {Promise<string|null>} 저장된 저널 문서 ID 또는 null
 */
export async function saveJournalEntry(ownerUid, topic, journalDetails, options = {}) {
    if (!ownerUid || !topic || !journalDetails || !journalDetails.summary) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족. 저장 건너뜀.");
        return null;
    }
    const { relatedChildId = null, entryType = 'standard', childName = '아이' } = options;
    const safeDetailedAnalysis = journalDetails.detailedAnalysis || {};
    const riskTags = detectRiskTags(journalDetails.summary, safeDetailedAnalysis);

    const journalData = {
        userId: ownerUid,
        ownerId: ownerUid,
        relatedChildId,
        entryType,
        topic,
        title: journalDetails.title,
        summary: journalDetails.summary,
        mood: journalDetails.mood || "neutral",
        keywords: journalDetails.keywords || [],
        tags: riskTags,
        detailedAnalysis: safeDetailedAnalysis,
        sessionDurationMinutes: journalDetails.sessionDurationMinutes || 0,
        userCharCountForThisSession: journalDetails.userCharCountForThisSession || 0,
        createdAt: serverTimestamp()
    };

    try {
        const journalRef = await addDoc(collection(db, "journals"), journalData);
        console.log(`[Firebase Utils] ✅ 새 저널 저장 완료, ID: ${journalRef.id}.`);
        if (entryType === "child" && riskTags.length > 0 && relatedChildId) {
            const notificationData = {
                parentId: ownerUid,
                childId: relatedChildId,
                childName: childName,
                journalId: journalRef.id,
                type: "risk_alert",
                message: `${childName}의 이야기에서 주의가 필요한 내용 [${riskTags.join(", ")}]이(가) 감지되었습니다.`,
                createdAt: serverTimestamp(),
                isRead: false,
            };
            await addDoc(collection(db, "notifications"), notificationData);
            console.log(`[Firebase Utils] ✅ 위험 알림 생성 완료 for parent: ${ownerUid}`);
        }
        return journalRef.id;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 저널 저장 또는 알림 생성 중 오류:", error);
        return null;
    }
}

/** 세션 시작 로그 저장 */
export async function logSessionStart(userId, topicName) {
    if (!db || !userId || !topicName) return null;
    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: userId,
            topic: topicName,
            startedAt: serverTimestamp(),
            status: "active"
        });
        console.log('[Firebase Utils] ✅ 세션 시작 로그 저장 완료, ID:', sessionRef.id);
        return sessionRef.id;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 시작 로그 저장 중 오류:', err);
        return null;
    }
}

/** 세션 종료 로그 업데이트 */
export async function logSessionEnd(sessionId) {
    if (!db || !sessionId) return;
    try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
            endedAt: serverTimestamp(),
            status: "ended"
        });
        console.log('[Firebase Utils] ✅ 세션 종료 로그 저장 완료, ID:', sessionId);
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 종료 로그 저장 중 오류:', err);
    }
}


/**
 * [기존 함수 유지]
 * 특정 사용자의 모든 저널 데이터를 시간순으로 정렬하여 가져오는 함수
 * @param {string} userId - Firestore의 사용자 UID
 * @returns {Promise<object[]>} - 저널 데이터 배열
 */
export async function getJournalsForUser(userId) {
    if (!userId) return [];

    try {
        const journalsRef = collection(db, 'journals');
        const q = query(journalsRef, where('userId', '==', userId), orderBy('createdAt', 'asc')); // asc -> desc로 변경하는게 최근 순

        const querySnapshot = await getDocs(q);

        const journals = [];
        querySnapshot.forEach((doc) => {
            journals.push({ id: doc.id, ...doc.data() });
        });

        return journals;

    } catch (error) {
        console.error("사용자 저널 데이터 로드 중 오류:", error);
        return []; // 오류 발생 시 빈 배열 반환
    }
}


/** 사용자 주제별 통계 업데이트 */
export async function updateTopicStats(userId, topicName, entryType = "standard") {
    if (!userId || !topicName) return;
    const role = localStorage.getItem('lozee_role');
    // 보호자 계정이 자녀 관련 저널을 볼 때 topicStats에 반영하지 않으려면 이대로 두고,
    // 모든 저널을 반영하려면 이 if 블록을 주석 처리해야 합니다.
    if (role === 'parent' && entryType === 'child') {
        console.log(`[Firebase Utils] 보호자(${userId})의 자녀 관련 저널(${topicName})은 보호자 개인의 topicStats에 반영하지 않습니다.`);
        return;
    }
    const topicStatRef = doc(db, `users/${userId}/topicStats`, topicName);
    try {
        await runTransaction(db, async (transaction) => {
            const topicStatDoc = await transaction.get(topicStatRef);
            if (!topicStatDoc.exists()) {
                // 문서가 없으면 새로 생성
                transaction.set(topicStatRef, { count: 1, lastChattedAt: serverTimestamp() });
            } else {
                // 문서가 있으면 count 증가
                const newCount = (topicStatDoc.data().count || 0) + 1;
                transaction.update(topicStatRef, { count: newCount, lastChattedAt: serverTimestamp() });
            }
        });
        console.log(`[Firebase Utils] ✅ '${topicName}' 주제 통계(${userId}) 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ '${topicName}' 주제 통계 업데이트 중 오류:`, error);
    }
}

/** 사용자 전체 통계 업데이트 */
export async function updateUserOverallStats(userId, userType, totalUserCharsToSave) {
    if (!userId) return;
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            totalUserCharCount: totalUserCharsToSave,
            lastLogin: serverTimestamp()
        });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 전체 통계 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 전체 통계 업데이트 중 오류:`, error);
    }
}

/**
 * 상담 예약 시도 정보를 Firestore에 저장하는 함수
 * @param {string} userId - 현재 로그인한 사용자 ID
 * @param {object} reservationData - 저장할 예약 데이터
 * @returns {Promise<string|null>} - 성공 시 문서 ID, 실패 시 null
 */
export async function saveReservation(userId, reservationData) {
  if (!userId) {
    console.error("예약 저장을 위한 사용자 ID가 없습니다.");
    return null;
  }
  try {
    const reservationsColRef = collection(db, 'users', userId, 'reservations');
    const docRef = await addDoc(reservationsColRef, {
      ...reservationData,
      timestamp: serverTimestamp() // 서버 시간을 기준으로 저장
    });
    console.log("예약 정보가 성공적으로 저장되었습니다:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Firestore에 예약 정보 저장 중 오류 발생:", error);
    return null;
  }
}

// ** 새로 추가할 함수: detectSensitiveRisk **
/**
 * 텍스트에서 민감하거나 위험한 내용을 감지하는 함수
 * 자살, 자해, 학폭, 폭력 등 위험 키워드를 포함합니다.
 * @param {string} text - 감지할 텍스트
 * @returns {boolean} - 위험 내용 감지 시 true, 아니면 false
 */
export function detectSensitiveRisk(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    const lowerText = text.toLowerCase();

    // 자살, 자해, 학폭, 폭력 등 민감하거나 위험한 키워드 목록
    const sensitiveKeywords = [
        '자살', '죽고싶다', '죽을까', '살고싶지않아', '극단적선택', '삶을포기', '세상끝내고싶다', // 자살 관련
        '자해', '상처내다', '피나다', '때리다', '칼', '아프게하다', // 자해/폭력 관련
        '학폭', '학교폭력', '괴롭힘', '따돌림', '왕따', '맞았다', '때렸다', // 학폭 관련
        '위험해', '죽을래', '죽여', '끝내버리자' // 기타 위험 표현
    ];

    for (const keyword of sensitiveKeywords) {
        if (lowerText.includes(keyword)) {
            console.warn(`[민감/위험 감지] 키워드: "${keyword}"`);
            return true; // 위험 키워드 감지 시 true 반환
        }
    }

    // 만약 기존의 detectRiskTags 함수가 더 일반적인 위험 태그를 감지한다면,
    // 필요에 따라 detectRiskTags의 결과도 여기에 포함시킬 수 있습니다.
    // (단, detectRiskTags가 이 파일 내에서 선언되었거나 import 되어야 합니다.)
    // const riskTags = detectRiskTags(text);
    // if (riskTags.length > 0) {
    //     // detectRiskTags가 감지한 내용도 민감하다고 판단한다면
    //     // console.warn(`[민감/위험 감지] Risk Tags: ${riskTags.join(', ')}`);
    //     // return true;
    // }

    return false; // 위험 내용 없음
}

// 사용자 분석 정보 불러오기
async function loadAnalysisDataFromFirestore(userId) {
  const q = query(
    collection(db, "journals"),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  const allResults = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.detailedAnalysis) {
      allResults.push(data.detailedAnalysis);
    }
  });
  return allResults;
}
