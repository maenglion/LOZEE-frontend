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

// constants.js에서 위험 키워드 관련 데이터를 가져온다고 가정
// 실제 파일 경로 및 변수명 확인 필요
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js';

/**
 * localStorage에서 사용자 UID를 가져오거나, 없으면 생성하여 저장하고 반환합니다.
 * 또한 Firestore에 해당 사용자의 기본 문서를 확인/생성/업데이트합니다.
 * @returns {string|null} 사용자 UID 또는 null (localStorage 접근 불가 시)
 */


 export function getOrCreateUserId() {
  const userId = localStorage.getItem('lozee_userId');
  if (!userId) {
    console.error("getOrCreateUserId: localStorage에 lozee_userId가 없습니다. 앱 시작점에서 익명 로그인 또는 사용자 로그인이 필요합니다.");
    // 필요하다면 여기서 다시 익명 로그인을 시도하거나, null을 반환하여 오류 처리를 유도할 수 있습니다.
    // window.location.href = 'index.html'; // 또는 오류 페이지로
    return null;
  }
  console.log('[Firebase Utils] 기존 사용자 UID 사용:', userId);
  return userId;
}

    // Firestore에 사용자 문서 확인/생성/업데이트
    if (userId && db) { // db 인스턴스가 유효할 때만 실행
        const userRef = doc(db, "users", userId);
        try {
            const userSnap = await getDoc(userRef);
            const userName = localStorage.getItem('lozee_username') || (userId.startsWith('guest_') ? '게스트' : '사용자');
            const userRole = localStorage.getItem('lozee_role') || 'child';
            const userTypeValue = (userRole === 'parent') ? 'caregiver' : 'directUser';

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: userId, // UID 명시적 저장
                    name: userName,
                    role: userRole,
                    userType: userTypeValue,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    totalUserCharCount: 0,
                    // 기타 필요한 초기 필드
                });
                console.log(`[Firebase Utils] Firestore에 새 사용자 문서 생성: ${userId}`);
            } else {
                // 기존 사용자는 마지막 접속 시간만 업데이트 (필요시 다른 정보도 업데이트 가능)
                await updateDoc(userRef, {
                    lastLogin: serverTimestamp(),
                    // 이름이나 역할이 변경될 수 있으므로, 필요시 업데이트
                    name: userName,
                    role: userRole,
                    userType: userTypeValue
                });
                console.log(`[Firebase Utils] Firestore 사용자 문서 업데이트 (lastLogin 등): ${userId}`);
            }
        } catch (error) {
            console.error(`[Firebase Utils] 사용자 문서 확인/생성 실패 (${userId}):`, error.message);
            // 여기서 권한 오류(Missing or insufficient permissions)가 발생할 수 있음
            // Firestore 보안 규칙이 guest_... UID의 쓰기를 허용하는지 확인 필요
        }
    }
    return userId;



function detectRiskTags(text, detailedAnalysis = {}) {
    const tags = new Set();
    if (typeof text !== 'string') return Array.from(tags); // text가 문자열이 아니면 빈 배열 반환
    const lowerText = text.toLowerCase();

    (ALL_NOTIFICATION_KEYWORDS || []).forEach((kw) => {
        if (lowerText.includes(kw)) {
            tags.add(kw);
        }
    });

    if (detailedAnalysis.keywords && Array.isArray(detailedAnalysis.keywords)) {
        detailedAnalysis.keywords.forEach(kw => tags.add(String(kw).toLowerCase()));
    }

    if (NOTIFICATION_KEYWORDS && NOTIFICATION_KEYWORDS.PERSONS && NOTIFICATION_KEYWORDS.EMOTION_WORDS) {
        NOTIFICATION_KEYWORDS.PERSONS.forEach((person) => {
            if (lowerText.includes(String(person).toLowerCase())) {
                NOTIFICATION_KEYWORDS.EMOTION_WORDS.forEach((emo) => {
                    if (lowerText.includes(String(emo).toLowerCase())) {
                        tags.add(`${person}:${emo}`);
                    }
                });
            }
        });
    }
    return Array.from(tags);
}

export async function saveJournalEntry(ownerUid, topic, journalDetails, options = {}) {
    if (!ownerUid || !topic || !journalDetails || !journalDetails.summary) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족. 저널 저장 건너뜀.");
        return null;
    }

    const {
        relatedChildId = null,
        entryType = 'standard',
        childName = '아이'
    } = options;

    const safeDetailedAnalysis = journalDetails.detailedAnalysis || {};
    const summaryForRiskDetection = journalDetails.summary || "";
    const riskTags = detectRiskTags(summaryForRiskDetection, safeDetailedAnalysis);

    const journalData = {
        userId: ownerUid, // Firestore 필드명 일관성 (작성자 UID)
        ownerId: ownerUid, // 명시적으로 ownerId도 저장
        relatedChildId,
        entryType,
        topic,
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

        // 시나리오 1: 보호자가 자녀에 대해 'child' 타입 저널 기록 중 위험 감지
        if (entryType === "child" && riskTags.length > 0 && relatedChildId) {
            shouldNotify = true;
            notificationParentId = ownerUid; // 알림 받을 부모 = 저널 작성자(보호자)
            notificationChildIdForAlert = relatedChildId;
        }
        // 시나리오 2: 자녀(ownerUid)가 'standard' 타입 저널 기록 중 위험 감지 (추가 구현 필요)
        // else if (entryType === "standard" && riskTags.length > 0 && ownerUid !== someAdminOrSystemId) {
        //   const userDoc = await getDoc(doc(db, "users", ownerUid));
        //   if (userDoc.exists() && userDoc.data().linkedParentId) { // 자녀 문서에 연결된 부모 UID가 있다면
        //     shouldNotify = true;
        //     notificationParentId = userDoc.data().linkedParentId;
        //     notificationChildIdForAlert = ownerUid; // 위험 감지된 자녀 = 저널 작성자
        //     notificationChildName = userDoc.data().name || '자녀';
        //   }
        // }

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

export async function logSessionStart(uid, topicName) { // userId -> uid로 변경
    if (!db || !uid || !topicName) {
        console.warn("[Firebase Utils] logSessionStart: db, uid 또는 topicName이 없습니다.");
        return null;
    }
    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: uid, // 필드명도 userId로 통일 권장
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

export async function logSessionEnd(sessionId) { /* ... 기존과 동일 ... */
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

export async function saveManualJournalEntry(uid, topic, content) { // userId -> uid
    if (!uid || !topic || !content) { /* ... */ return null; }
    const journalEntry = {
        userId: uid, // ⭐ UID 사용
        ownerId: uid,
        topic: topic || "로지의 설명",
        title: `로지가 알려준 ${topic} 방법 (수동저장)`,
        summary: content,
        mood: "informative",
        keywords: ["설명", "방법", topic],
        tags: [],
        detailedAnalysis: {
            conversationSummary: content.substring(0, 200),
            overallSentiment: "neutral"
        },
        createdAt: serverTimestamp(),
        entryType: "manual_save_explanation", // 이 타입은 보호자 통계에 포함되지 않도록
        relatedChildId: null
    };
    try { /* ... 기존과 동일 ... */
        const journalRef = await addDoc(collection(db, 'journals'), journalEntry);
        console.log(`[Firebase Utils] ✅ 수동 저장 저널 생성 완료, ID: ${journalRef.id}`);
        return journalRef.id;
    } catch (error) {
        console.error("[Firebase Utils] ❌ 수동 저장 저널 생성 오류:", error);
        throw error;
    }
}

export async function updateTopicStats(uid, topicName, entryType = "standard") { // userId -> uid
    if (!uid || !topicName) { /* ... */ return; }

    const role = localStorage.getItem('lozee_role'); // 이 값은 클라이언트 측 값
    // 서버측 함수에서 localStorage 직접 참조는 불가능. 만약 서버리스 함수라면 클라이언트에서 전달받아야 함.
    // 여기서는 클라이언트 firebase-utils.js로 가정하고 진행.
    // 보호자가 자녀 관련 저널('child' 타입)을 남긴 경우, 보호자 본인의 topicStats에는 반영 안 함.
    if (role === 'parent' && entryType === 'child') {
         console.log(`[Firebase Utils] 보호자(${uid})의 자녀 관련 저널(${topicName}, type:${entryType})은 보호자 개인의 topicStats에 반영하지 않습니다.`);
         return;
    }

    const topicStatRef = doc(db, `users/${uid}/topicStats`, topicName); // ⭐ UID 사용
    try {
        let latestTitleForTopic = `${topicName} 관련 최근 대화`;
        const journalsQuery = query(
            collection(db, 'journals'),
            where('userId', '==', uid), // ⭐ UID 사용
            where('topic', '==', topicName),
            // entryType이 standard인 것만 통계에 포함할지, 아니면 topicName이 같은 모든 저널을 포함할지 결정 필요
            // 현재는 entryType으로 함수 초반에 필터링했으므로, 여기서는 추가 필터링 없이 진행
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const latestJournalSnapshot = await getDocs(journalsQuery);
        let latestKeywordsForTopic = [];
        if (!latestJournalSnapshot.empty) {
            const latestJournalData = latestJournalSnapshot.docs[0].data();
            if (latestJournalData && latestJournalData.title) {
                 latestTitleForTopic = latestJournalData.title;
            }
            if (latestJournalData && latestJournalData.keywords) { // keywords 필드가 있다고 가정
                latestKeywordsForTopic = latestJournalData.keywords;
            }
        }

        await runTransaction(db, async (transaction) => {
            const topicStatDoc = await transaction.get(topicStatRef);
            if (!topicStatDoc.exists()) {
                transaction.set(topicStatRef, {
                    count: 1,
                    lastChattedAt: serverTimestamp(),
                    firstChattedAt: serverTimestamp(),
                    topicDisplayName: topicName, // 실제 화면 표시용 이름
                    latestJournalTitle: latestTitleForTopic,
                    keywords: latestKeywordsForTopic // 초기 키워드 저장
                });
            } else {
                const newCount = (topicStatDoc.data().count || 0) + 1;
                transaction.update(topicStatRef, {
                    count: newCount,
                    lastChattedAt: serverTimestamp(),
                    latestJournalTitle: latestTitleForTopic,
                    keywords: latestKeywordsForTopic // 최신 키워드로 업데이트 (또는 병합)
                });
            }
        });
        console.log(`[Firebase Utils] ✅ '${topicName}' 주제 통계(${uid}, type:${entryType}) 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ '${topicName}' 주제 통계(${uid}) 업데이트 중 오류:`, error);
    }
}

export async function updateUserOverallStats(uid, userTypeValue, totalUserCharsToSave) { // userId -> uid, userType -> userTypeValue
    if (!uid || !userTypeValue) { /* ... */ return; }
    try {
        const userRef = doc(db, 'users', uid); // ⭐ UID 사용
        const userSnap = await getDoc(userRef);

        let updates = {
            totalUserCharCount: totalUserCharsToSave,
            lastLogin: serverTimestamp()
        };

        // 세션 카운트는 userType (directUser/caregiver) 기준으로 users 문서의 필드를 업데이트
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userTypeValue === 'directUser') {
                updates.totalSessionCount = (userData.totalSessionCount || 0) + 1;
            } else if (userTypeValue === 'caregiver') {
                // 보호자가 자녀에 대해 사용한 세션 카운트 (예: childTotalSessionCount)
                // 또는 보호자 자신의 세션 카운트(totalSessionCount) 중 어떤 것을 올릴지 정책 필요
                // 여기서는 '보호자 자신의 사용'으로 간주하고 totalSessionCount를 올린다고 가정
                 updates.totalSessionCount = (userData.totalSessionCount || 0) + 1;
                 // 만약 자녀관련세션이면, updates.childTotalSessionCount = (userData.childTotalSessionCount || 0) + 1;
            }
        } else { // 새 사용자 문서라면
            updates.totalSessionCount = 1; // 기본값
            // if (userTypeValue === 'caregiver') updates.childTotalSessionCount = 1; // 필요시
        }

        await setDoc(userRef, updates, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${uid}) 전체 통계 업데이트 완료:`, updates);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${uid}) 전체 통계 업데이트 중 오류:`, error);
    }
}

export async function saveUserProfileData(uid, profileDataToSave) { // userId -> uid
    if (!uid || !profileDataToSave || Object.keys(profileDataToSave).length === 0) { /* ... */ return; }
    try {
        const userDocRef = doc(db, 'users', uid); // ⭐ UID 사용
        await setDoc(userDocRef, {
            ...profileDataToSave,
            lastUpdate: serverTimestamp()
        }, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${uid}) 프로필 정보 업데이트 완료.`);
    } catch (err) {
        console.error(`[Firebase Utils] ❌ 사용자(${uid}) 프로필 정보 업데이트 오류:`, err);
    }
}

export async function uploadUserPhoto(uid, file) { // userId -> uid
    if (!uid || !file) { /* ... */ return null; }
    const storage = getStorage();
    const photoRef = storageRef(storage, `profilePhotos/${uid}/${file.name}`); // ⭐ UID 사용
    try {
        const snapshot = await uploadBytes(photoRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Firebase Utils] ✅ 프로필 사진 업로드 성공, URL:', url);

        const userDocRef = doc(db, 'users', uid); // ⭐ UID 사용
        await setDoc(userDocRef, { photoURL: url, lastUpdate: serverTimestamp() }, { merge: true });
        console.log('[Firebase Utils] ✅ Firestore에 photoURL 업데이트 완료.');
        localStorage.setItem('lozee_photoURL', url);
        return url;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 프로필 사진 업로드 또는 Firestore 업데이트 오류:', err);
        return null;
    }
}