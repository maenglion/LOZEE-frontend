// js/firebase-utils.js
import { db } from './firebase-config.js';
import {
    collection, addDoc, doc, runTransaction, serverTimestamp,
    getDoc, setDoc, updateDoc, query, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js';

/**
 * localStorage에서 사용자 UID를 가져옵니다.
 * UID가 없다면 index.html에서 생성/저장 후 talk.html로 넘어와야 합니다.
 * 이 함수는 UID가 이미 설정되었다고 가정하고 가져오는 역할만 합니다.
 * @returns {string|null} 사용자 UID 또는 null
 */
export function getOrCreateUserId() { // 이름은 유지하되, 생성 책임은 index.html로
    const userId = localStorage.getItem('lozee_userId');
    if (!userId) {
        console.error("getOrCreateUserId: localStorage에 lozee_userId가 없습니다. index.html에서 UID 설정이 필요합니다.");
        // window.location.href = 'index.html'; // 문제가 심각하면 시작페이지로 강제 이동
        return null;
    }
    console.log('[Firebase Utils] 사용자 UID 사용 (from localStorage):', userId);
    return userId;
}

function detectRiskTags(text, detailedAnalysis = {}) { /* ... 이전과 동일 ... */
    const tags = new Set();
    if (typeof text !== 'string') return Array.from(tags);
    const lowerText = text.toLowerCase();
    (ALL_NOTIFICATION_KEYWORDS || []).forEach((kw) => {
        if (lowerText.includes(kw)) { tags.add(kw); }
    });
    if (detailedAnalysis.keywords && Array.isArray(detailedAnalysis.keywords)) {
        detailedAnalysis.keywords.forEach(kw => tags.add(String(kw).toLowerCase()));
    }
    if (NOTIFICATION_KEYWORDS && NOTIFICATION_KEYWORDS.PERSONS && NOTIFICATION_KEYWORDS.EMOTION_WORDS) {
        NOTIFICATION_KEYWORDS.PERSONS.forEach((person) => {
            if (lowerText.includes(String(person).toLowerCase())) {
                NOTIFICATION_KEYWORDS.EMOTION_WORDS.forEach((emo) => {
                    if (lowerText.includes(String(emo).toLowerCase())) { tags.add(`${person}:${emo}`); }
                });
            }
        });
    }
    return Array.from(tags);
}

export async function saveJournalEntry(ownerUid, topic, journalDetails, options = {}) { /* ... 이전 UID 기반 코드와 거의 동일 ... */
    if (!ownerUid || !topic || !journalDetails || !journalDetails.summary) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족. 저널 저장 건너뜀.");
        return null;
    }
    const { relatedChildId = null, entryType = 'standard', childName = '아이' } = options;
    const safeDetailedAnalysis = journalDetails.detailedAnalysis || {};
    const summaryForRiskDetection = journalDetails.summary || "";
    const riskTags = detectRiskTags(summaryForRiskDetection, safeDetailedAnalysis);

    const journalData = {
        userId: ownerUid, // 작성자 UID
        ownerId: ownerUid, // 명시적 ownerId
        relatedChildId, entryType, topic,
        title: journalDetails.title || summaryForRiskDetection.substring(0, 30) + (summaryForRiskDetection.length > 30 ? "..." : ""),
        summary: summaryForRiskDetection,
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
        console.log(`[Firebase Utils] ✅ 새 저널 저장 완료, ID: ${journalRefId}. 주제: ${topic}, 타입: ${entryType}`);

        let shouldNotify = false;
        let notificationParentId = null;
        let notificationChildIdForAlert = null;
        let notificationChildName = childName;

        if (entryType === "child" && riskTags.length > 0 && relatedChildId) {
            shouldNotify = true;
            notificationParentId = ownerUid; // 보호자 UID
            notificationChildIdForAlert = relatedChildId; // 자녀 UID
        }
        // 자녀가 직접 작성한 저널(entryType: "standard", ownerUid: 자녀UID)에서 부모에게 알림 보내는 로직은 추가 구현 필요

        if (shouldNotify && notificationParentId && notificationChildIdForAlert) {
            const notificationData = {
                parentId: notificationParentId,
                childId: notificationChildIdForAlert,
                childName: notificationChildName,
                journalId: journalRefId,
                type: "risk_alert",
                message: `${notificationChildName}의 이야기에서 주의가 필요한 내용 [${riskTags.join(", ")}]이(가) 감지되었습니다.`,
                createdAt: serverTimestamp(),
                isRead: false,
            };
            await addDoc(collection(db, "notifications"), notificationData);
            console.log(`[Firebase Utils] ✅ 위험 알림 생성 완료 for parent: ${notificationParentId}, child: ${notificationChildIdForAlert}`);
        }
        return journalRefId;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 저널 저장 또는 알림 생성 중 오류:", error.message, error);
        return null;
    }
}

export async function logSessionStart(uid, topicName) { /* ... 이전 UID 기반 코드와 동일 ... */
    if (!db || !uid || !topicName) {
        console.warn("[Firebase Utils] logSessionStart: db, uid 또는 topicName이 없습니다.");
        return null;
    }
    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: uid,
            topic: topicName,
            startedAt: serverTimestamp(),
            status: "active"
        });
        console.log('[Firebase Utils] ✅ 세션 시작 로그 저장 완료, ID:', sessionRef.id);
        return sessionRef.id;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 시작 로그 저장 중 오류:', err.message, err);
        return null;
    }
}
export async function logSessionEnd(sessionId) { /* ... 이전과 동일 ... */
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
export async function saveManualJournalEntry(uid, topic, content) { /* ... 이전 UID 기반 코드와 동일 ... */
    if (!uid || !topic || !content) { return null; }
    const journalEntry = {
        userId: uid, ownerId: uid, topic: topic || "로지의 설명",
        title: `로지가 알려준 ${topic} 방법 (수동저장)`, summary: content, mood: "informative",
        keywords: ["설명", "방법", topic], tags: [],
        detailedAnalysis: { conversationSummary: content.substring(0, 200), overallSentiment: "neutral" },
        createdAt: serverTimestamp(), entryType: "manual_save_explanation", relatedChildId: null
    };
    try {
        const journalRef = await addDoc(collection(db, 'journals'), journalEntry);
        console.log(`[Firebase Utils] ✅ 수동 저장 저널 생성 완료, ID: ${journalRef.id}`);
        return journalRef.id;
    } catch (error) { console.error("[Firebase Utils] ❌ 수동 저장 저널 생성 오류:", error); throw error; }
}
export async function updateTopicStats(uid, topicName, entryType = "standard") { /* ... 이전 UID 기반 코드와 동일 (localStorage 참조 부분은 클라이언트 측 값이라는 점 인지) ... */
    if (!uid || !topicName) { return; }
    const role = localStorage.getItem('lozee_role');
    if (role === 'parent' && entryType === 'child') {
         console.log(`[Firebase Utils] 보호자(${uid})의 자녀 관련 저널(${topicName}, type:${entryType})은 보호자 개인의 topicStats에 반영하지 않습니다.`);
         return;
    }
    const topicStatRef = doc(db, `users/${uid}/topicStats`, topicName);
    try {
        let latestTitleForTopic = `${topicName} 관련 최근 대화`;
        let latestKeywordsForTopic = [];
        const journalsQuery = query( collection(db, 'journals'), where('userId', '==', uid), where('topic', '==', topicName), orderBy('createdAt', 'desc'), limit(1));
        const latestJournalSnapshot = await getDocs(journalsQuery);
        if (!latestJournalSnapshot.empty) {
            const latestJournalData = latestJournalSnapshot.docs[0].data();
            if (latestJournalData?.title) latestTitleForTopic = latestJournalData.title;
            if (latestJournalData?.keywords) latestKeywordsForTopic = latestJournalData.keywords;
        }
        await runTransaction(db, async (transaction) => {
            const topicStatDoc = await transaction.get(topicStatRef);
            if (!topicStatDoc.exists()) {
                transaction.set(topicStatRef, { count: 1, lastChattedAt: serverTimestamp(), firstChattedAt: serverTimestamp(), topicDisplayName: topicName, latestJournalTitle: latestTitleForTopic, keywords: latestKeywordsForTopic });
            } else {
                const newCount = (topicStatDoc.data().count || 0) + 1;
                transaction.update(topicStatRef, { count: newCount, lastChattedAt: serverTimestamp(), latestJournalTitle: latestTitleForTopic, keywords: latestKeywordsForTopic });
            }
        });
        console.log(`[Firebase Utils] ✅ '${topicName}' 주제 통계(${uid}, type:${entryType}) 업데이트 완료.`);
    } catch (error) { console.error(`[Firebase Utils] ❌ '${topicName}' 주제 통계(${uid}) 업데이트 중 오류:`, error); }
}
export async function updateUserOverallStats(uid, userTypeValue, totalUserCharsToSave) { /* ... 이전 UID 기반 코드와 동일 ... */
    if (!uid || !userTypeValue) { return; }
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        let updates = { totalUserCharCount: totalUserCharsToSave, lastLogin: serverTimestamp() };
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userTypeValue === 'directUser') {
                updates.totalSessionCount = (userData.totalSessionCount || 0) + 1;
            } else if (userTypeValue === 'caregiver') {
                 updates.totalSessionCount = (userData.totalSessionCount || 0) + 1; // 보호자 자신의 사용도 카운트
                 // updates.childTotalSessionCount = (userData.childTotalSessionCount || 0) + 1; // 자녀 관련 사용 카운트는 필요시
            }
        } else {
            updates.totalSessionCount = 1;
            // if (userTypeValue === 'caregiver') updates.childTotalSessionCount = 1;
        }
        await setDoc(userRef, updates, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${uid}) 전체 통계 업데이트 완료:`, updates);
    } catch (error) { console.error(`[Firebase Utils] ❌ 사용자(${uid}) 전체 통계 업데이트 중 오류:`, error); }
}
export async function saveUserProfileData(uid, profileDataToSave) { /* ... 이전 UID 기반 코드와 동일 ... */
    if (!uid || !profileDataToSave || Object.keys(profileDataToSave).length === 0) { return; }
    try {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, { ...profileDataToSave, lastUpdate: serverTimestamp() }, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${uid}) 프로필 정보 업데이트 완료.`);
    } catch (err) { console.error(`[Firebase Utils] ❌ 사용자(${uid}) 프로필 정보 업데이트 오류:`, err); }
}
export async function uploadUserPhoto(uid, file) { /* ... 이전 UID 기반 코드와 동일 ... */
    if (!uid || !file) { return null; }
    const storage = getStorage();
    const photoRef = storageRef(storage, `profilePhotos/${uid}/${file.name}`);
    try {
        const snapshot = await uploadBytes(photoRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Firebase Utils] ✅ 프로필 사진 업로드 성공, URL:', url);
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, { photoURL: url, lastUpdate: serverTimestamp() }, { merge: true });
        localStorage.setItem('lozee_photoURL', url);
        return url;
    } catch (err) { console.error('[Firebase Utils] ❌ 프로필 사진 업로드 또는 Firestore 업데이트 오류:', err); return null; }
}