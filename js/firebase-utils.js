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
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js';

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

/**
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

/** 사용자 주제별 통계 업데이트 */
export async function updateTopicStats(userId, topicName, entryType = "standard") {
    if (!userId || !topicName) return;
    const role = localStorage.getItem('lozee_role');
    if (role === 'parent' && entryType === 'child') {
        console.log(`[Firebase Utils] 보호자(${userId})의 자녀 관련 저널(${topicName})은 보호자 개인의 topicStats에 반영하지 않습니다.`);
        return;
    }
    const topicStatRef = doc(db, `users/${userId}/topicStats`, topicName);
    try {
        await runTransaction(db, async (transaction) => {
            const topicStatDoc = await transaction.get(topicStatRef);
            if (!topicStatDoc.exists()) {
                transaction.set(topicStatRef, { count: 1, lastChattedAt: serverTimestamp() });
            } else {
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