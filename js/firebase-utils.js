// js/firebase-utils.js
import { db } from './firebase-config.js';
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
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js';

/** 텍스트에서 위험 태그를 감지하여 배열로 반환 */
function detectRiskTags(text, detailedAnalysis = {}) {
    const tags = new Set();
    if (typeof text !== 'string') return Array.from(tags);
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

/**
 * Journal을 저장하고, 조건에 따라 notifications 컬렉션에도 알림 생성
 * @param {string} ownerUid - 현재 로그인한 사용자의 UID (보호자 또는 자녀)
 * @param {string} topic - 대화 주제
 * @param {object} journalDetails - 저널에 저장될 주요 내용 객체
 * @param {object} options - 추가 옵션
 * @returns {Promise<string|null>} 저장된 저널 문서 ID 또는 null
 */
export async function saveJournalEntry(ownerUid, topic, journalDetails, options = {}) {
    if (!ownerUid || !topic || !journalDetails || !journalDetails.summary) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족 (ownerUid, topic, summary). 저널 저장 건너뜀.");
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
        title: journalDetails.title, // talk.js에서 생성한 제목 사용
        summary: journalDetails.summary, // talk.js에서 생성한 요약 사용
        mood: journalDetails.mood || safeDetailedAnalysis.overallSentiment || "neutral",
        keywords: journalDetails.keywords || safeDetailedAnalysis.keywords || [],
        tags: riskTags,
        detailedAnalysis: safeDetailedAnalysis,
        sessionDurationMinutes: journalDetails.sessionDurationMinutes || 0,
        userCharCountForThisSession: journalDetails.userCharCountForThisSession || 0,
        createdAt: serverTimestamp()
    };

    let journalRefId = null;
    try {
        const journalRef = await addDoc(collection(db, "journals"), journalData);
        journalRefId = journalRef.id;
        console.log(`[Firebase Utils] ✅ 새 저널 저장 완료, ID: ${journalRefId}.`);

        // 알림 생성 로직 (자녀 관련 대화에서 위험 태그 감지 시)
        if (entryType === "child" && riskTags.length > 0 && relatedChildId) {
            const notificationData = {
                parentId: ownerUid,
                childId: relatedChildId,
                childName: childName,
                journalId: journalRefId, // 생성된 저널 ID 사용
                type: "risk_alert",
                message: `${childName}의 이야기에서 주의가 필요한 내용 [${riskTags.join(", ")}]이(가) 감지되었습니다.`,
                createdAt: serverTimestamp(),
                isRead: false,
            };
            await addDoc(collection(db, "notifications"), notificationData);
            console.log(`[Firebase Utils] ✅ 위험 알림 생성 완료 for parent: ${ownerUid}`);
        }
        return journalRefId;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 저널 저장 또는 알림 생성 중 오류:", error);
        return null;
    }
}

// ... (logSessionStart, updateUserOverallStats 등 나머지 함수들은 이전 답변과 동일하게 유지) ...