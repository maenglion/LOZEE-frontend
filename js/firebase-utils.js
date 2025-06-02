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

// 위험 키워드 사전 (constants.js에서 ALL_NOTIFICATION_KEYWORDS를 가져온다고 가정)
import { ALL_NOTIFICATION_KEYWORDS, NOTIFICATION_KEYWORDS } from './constants.js'; // RISK_KEYWORDS 대신 ALL_NOTIFICATION_KEYWORDS 사용 가정

/**
 * 텍스트에서 위험 태그를 감지하여 배열로 반환
 * constants.js의 ALL_NOTIFICATION_KEYWORDS를 사용합니다.
 * (기존 detectRiskTags 함수와 유사하나, RISK_KEYWORDS 대신 ALL_NOTIFICATION_KEYWORDS 사용 등)
 */
function detectRiskTags(text, detailedAnalysis = {}) {
    const tags = new Set();
    const lowerText = text.toLowerCase();

    // 1. constants.js의 ALL_NOTIFICATION_KEYWORDS를 사용하여 직접적인 위험 키워드 검출
    ALL_NOTIFICATION_KEYWORDS.forEach((kw) => {
        if (lowerText.includes(kw)) {
            tags.add(kw);
        }
    });

    // 2. 상세 분석 결과(detailedAnalysis)에 포함된 키워드도 태그에 추가 (선택 사항)
    if (detailedAnalysis.keywords && Array.isArray(detailedAnalysis.keywords)) {
        detailedAnalysis.keywords.forEach(kw => tags.add(kw.toLowerCase()));
    }

    // 3. (선택 사항) PERSONS와 EMOTION_WORDS 조합도 constants.js에서 관리하고 여기서 활용 가능
    // 예시: NOTIFICATION_KEYWORDS.PERSONS, NOTIFICATION_KEYWORDS.EMOTION_WORDS 가 있다고 가정
    if (NOTIFICATION_KEYWORDS && NOTIFICATION_KEYWORDS.PERSONS && NOTIFICATION_KEYWORDS.EMOTION_WORDS) {
        NOTIFICATION_KEYWORDS.PERSONS.forEach((person) => {
            if (lowerText.includes(person.toLowerCase())) {
                NOTIFICATION_KEYWORDS.EMOTION_WORDS.forEach((emo) => {
                    if (lowerText.includes(emo.toLowerCase())) {
                        tags.add(`${person}:${emo}`);
                    }
                });
            }
        });
    }
    return Array.from(tags);
}

/**
 * Journal을 저장하고, 조건에 따라 notifications 컬렉션에도 알림 생성
 * @param {string} ownerId - 현재 로그인한 사용자의 UID (보호자 또는 자녀)
 * @param {string} topic - 대화 주제
 * @param {object} journalDetails - 저널에 저장될 주요 내용 객체
 * - summary: string (AI가 생성한 대화 요약)
 * - title?: string (요약 앞 25자 또는 AI 생성 제목)
 * - mood?: string (예: "positive", "neutral")
 * - keywords?: string[] (AI가 추출한 키워드)
 * - detailedAnalysis?: object (GPT로부터 받은 전체 분석 객체)
 * - sessionDurationMinutes?: number
 * - userCharCountForThisSession?: number
 * @param {object} options - 추가 옵션
 * - relatedChildId?: string (보호자 모드일 때 자녀 UID)
 * - entryType?: string ("standard" | "child", 기본값: "standard")
 * - childName?: string (알림 메시지에 사용할 자녀 이름, 보호자 모드 & 알림 생성 시)
 */
export async function saveJournalEntry(ownerId, topic, journalDetails, options = {}) {
    if (!ownerId || !topic || !journalDetails || !journalDetails.summary) {
        console.warn("[Firebase Utils] saveJournalEntry: 필수 정보 부족 (ownerId, topic, summary). 저널 저장 건너뜀.");
        return null;
    }

    const {
        relatedChildId = null, // 보호자가 자녀에 대해 이야기할 때 해당 자녀의 UID
        entryType = 'standard',  // 'standard': 본인 저널, 'child': 보호자가 자녀에 대해 기록한 저널
        childName = '아이'       // 알림 메시지에 사용될 자녀 이름 (기본값 '아이')
    } = options;

    const safeDetailedAnalysis = journalDetails.detailedAnalysis || {};

    // 1. 위험 태그 감지 (요약 + 상세 분석의 키워드 모두 활용 가능)
    const riskTags = detectRiskTags(journalDetails.summary, safeDetailedAnalysis);

    // 2. journals 컬렉션에 저장할 데이터 구성
    const journalData = {
        userId: ownerId, // Firestore 필드명 일관성을 위해 ownerId 대신 userId 사용 (또는 ownerId로 통일)
        ownerId: ownerId, // 명시적으로 ownerId도 저장 (쿼리 유연성)
        relatedChildId,
        entryType,
        topic,
        title: journalDetails.title || journalDetails.summary.substring(0, 30) + (journalDetails.summary.length > 30 ? "..." : ""),
        summary: journalDetails.summary,
        mood: journalDetails.mood || safeDetailedAnalysis.overallSentiment || "neutral",
        keywords: journalDetails.keywords || safeDetailedAnalysis.keywords || [],
        tags: riskTags, // 감지된 위험/감정 키워드 배열 (위험 알림용)
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

        // 3. 알림 생성 조건 및 로직 (DB 구조에 맞게 수정)
        // 보호자가 'child' 타입으로 저널을 기록했거나 (보호자가 자녀에 대해 상담),
        // 또는 자녀가 직접 'standard' 타입으로 저널을 기록했을 때 위험 태그가 감지되면 알림 생성
        let shouldNotify = false;
        let notificationParentId = null;
        let notificationChildId = null;
        let notificationChildName = childName; // 기본값 사용

        if (entryType === "child" && riskTags.length > 0 && relatedChildId) {
            // 시나리오 1: 보호자가 자녀(relatedChildId)에 대해 'child' 타입 저널 기록 중 위험 감지
            shouldNotify = true;
            notificationParentId = ownerId; // 알림 받을 부모 = 저널 작성자(보호자)
            notificationChildId = relatedChildId; // 위험 감지된 자녀
            // childName은 options에서 전달받은 값을 사용
        } else if (entryType === "standard" && riskTags.length > 0) {
            // 시나리오 2: 자녀(ownerId)가 'standard' 타입 저널 기록 중 위험 감지
            // 이 경우, 이 자녀와 연결된 부모를 찾아야 함 (users 컬렉션 등에서)
            // 여기서는 간단히 ownerId (자녀)의 부모가 있다고 가정하고, 부모 ID를 찾아야 함
            // 실제 구현에서는 users/{ownerId} 문서에서 parentId 필드 등을 조회해야 함
            // const userDoc = await getDoc(doc(db, "users", ownerId));
            // if (userDoc.exists() && userDoc.data().linkedParentId) {
            //   shouldNotify = true;
            //   notificationParentId = userDoc.data().linkedParentId;
            //   notificationChildId = ownerId; // 위험 감지된 자녀 = 저널 작성자
            //   notificationChildName = userDoc.data().name || '자녀';
            // }
            // --> 위의 자녀가 직접 작성 시 부모 찾는 로직은 users 컬렉션 구조에 따라 추가 구현 필요.
            // --> 현재는 entryType === "child" 일 때만 알림이 가도록 되어있으므로,
            //     자녀가 직접 작성한 저널에서 부모에게 알림을 보내려면 이 로직 수정 및 부모-자녀 연결 정보 필요.
            //     우선은 기존 로직(entryType === "child")에 집중합니다.
        }


        if (shouldNotify && notificationParentId && notificationChildId) {
            const notificationData = {
                parentId: notificationParentId,
                childId: notificationChildId,
                childName: notificationChildName, // 알림에 표시될 자녀 이름
                journalId: journalRefId,
                type: "risk_alert",
                message: `${notificationChildName}의 이야기에서 주의가 필요한 내용 [${riskTags.join(", ")}]이(가) 감지되었습니다.`,
                createdAt: serverTimestamp(),
                isRead: false,
            };
            await addDoc(collection(db, "notifications"), notificationData);
            console.log(`[Firebase Utils] ✅ 위험 알림 생성 완료 for parent: ${notificationParentId}, child: ${notificationChildId}`);
        }
        return journalRefId;

    } catch (error) {
        console.error("[Firebase Utils] ❌ 저널 저장 또는 알림 생성 중 오류:", error);
        return null; // 오류 발생 시 null 반환
    }
}


// --- 기존 함수들 (logSessionStart, logSessionEnd, saveManualJournalEntry, updateTopicStats, updateUserOverallStats, saveUserProfileData, uploadUserPhoto) ---
// 이 함수들은 중복 선언된 saveJournalEntry를 제거했으므로 그대로 유지하거나,
// 새로운 saveJournalEntry 인터페이스에 맞춰 호출 부분을 수정해야 할 수 있습니다.
// 특히 updateTopicStats는 entryType을 인자로 받아 필터링하는 로직이 추가되었습니다.

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
        return sessionRef.id;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 세션 시작 로그 저장 중 오류:', err);
        return null;
    }
}

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


export async function saveManualJournalEntry(userId, topic, content) {
    if (!userId || !topic || !content) {
        console.warn("[Firebase Utils] saveManualJournalEntry: 필수 정보 부족.");
        return null;
    }
    const journalEntry = {
        userId: userId, // 함수 인자 userId 사용
        ownerId: userId, // 명시적 ownerId
        topic: topic || "로지의 설명",
        title: `로지가 알려준 ${topic} 방법 (수동저장)`,
        summary: content,
        mood: "informative",
        keywords: ["설명", "방법", topic],
        tags: [], // 수동 저장은 위험 태그 감지 안 함
        detailedAnalysis: {
            conversationSummary: content.substring(0, 200),
            overallSentiment: "neutral"
        },
        createdAt: serverTimestamp(),
        entryType: "manual_save_explanation",
        relatedChildId: null // 수동 저장은 본인 것
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

export async function updateTopicStats(userId, topicName, entryType = "standard") { // entryType 인자 추가 및 기본값 설정
    if (!userId || !topicName) {
        console.warn("[Firebase Utils] updateTopicStats: userId 또는 topicName이 없습니다.");
        return;
    }

    // Firestore에서 사용자 역할(userType)을 가져오거나, localStorage 값을 신뢰할 수 있다면 그것을 사용.
    // 여기서는 localStorage 값을 사용한다고 가정 (talk.js에서 호출 시 정확한 userType 전달 필요)
    // 또는, 이 함수 호출 전에 userType을 결정하여 인자로 넘겨받는 것이 더 안전.
    // 지금은 entryType만으로 판단.
    // 보호자가 자녀에 대해 기록한 저널('child' 타입)은 보호자의 topicStats에 반영하지 않음.
    const role = localStorage.getItem('lozee_role'); // 'parent' or 'child'
    if (role === 'parent' && entryType === 'child') {
         console.log(`[Firebase Utils] 보호자(${userId})의 자녀 관련 저널(${topicName}, type:${entryType})은 보호자 개인의 topicStats에 반영하지 않습니다.`);
         return;
    }
    // 만약 자녀(role==='child')가 직접 standard 저널을 남겼다면, 자녀의 topicStats는 업데이트 되어야 함.
    // 위 조건은 "보호자"가 "자녀에 대해" 남긴 기록만 제외함.

    const topicStatRef = doc(db, `users/${userId}/topicStats`, topicName);
    try {
        let latestTitleForTopic = `${topicName} 관련 최근 대화`;
        const journalsQuery = query(
            collection(db, 'journals'),
            where('userId', '==', userId), // 또는 ownerId
            where('topic', '==', topicName),
            ...(entryType === 'standard' ? [where('entryType', '==', 'standard')] : []), // 본인 저널만 고려
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
                    topicDisplayName: topicName, // 실제 화면 표시용 이름 사용 권장
                    latestJournalTitle: latestTitleForTopic,
                    keywords: [] // 초기 키워드 배열
                });
            } else {
                const newCount = (topicStatDoc.data().count || 0) + 1;
                // 키워드는 최신 저널의 키워드로 덮어쓰거나, 기존 것과 병합할 수 있음 (여기서는 덮어쓰기 예시)
                const latestKeywords = latestJournalSnapshot.empty ? [] : (latestJournalSnapshot.docs[0].data().keywords || []);
                transaction.update(topicStatRef, {
                    count: newCount,
                    lastChattedAt: serverTimestamp(),
                    latestJournalTitle: latestTitleForTopic,
                    keywords: latestKeywords // 최근 저널 키워드로 업데이트
                });
            }
        });
        console.log(`[Firebase Utils] ✅ '${topicName}' 주제 통계(${userId}, type:${entryType}) 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ '${topicName}' 주제 통계(${userId}) 업데이트 중 오류:`, error);
    }
}

export async function updateUserOverallStats(userId, userType, totalUserCharsToSave) {
    if (!userId) { // userType은 이 함수 내부 로직에서 직접 사용되지 않으므로 제외 가능
        console.warn("[Firebase Utils] updateUserOverallStats: userId가 없습니다.");
        return;
    }
    try {
        const userRef = doc(db, 'users', userId);
        // 세션 카운트 로직은 journal 저장 시점에 entryType에 따라 분기하여 처리하는 것이 더 명확할 수 있음.
        // 여기서는 우선 totalUserCharCount와 lastLogin만 업데이트.
        // 세션 카운트는 logSessionStart/End 또는 saveJournalEntry에서 userType을 기준으로 업데이트하는 것을 고려.
        let updates = {
            totalUserCharCount: totalUserCharsToSave, // talk.js에서 누적된 값을 정확히 전달해야 함
            lastLogin: serverTimestamp()
        };

        // 전체 세션 수 업데이트 로직 (선택적, 필요시 활성화)
        // 이 로직은 UserType별로 세션 카운트를 증가시키므로,
        // talk.js에서 updateUserOverallStats 호출 시 정확한 userType을 전달해야 함.
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userType === 'directUser' || userType === 'child') { // 자녀가 직접 사용할 때
                const currentCount = userData.totalSessionCount || (userData.directUser?.totalSessionCount) || 0;
                updates.totalSessionCount = currentCount + 1;
            } else if (userType === 'caregiver' || userType === 'parent') { // 보호자가 사용할 때 (자녀 관련 세션)
                 // 이 카운트는 '보호자가 자녀를 위해 사용한 세션 수'인지,
                 // '보호자 본인의 세션 수'인지 명확히 구분 필요.
                 // 현재는 보호자의 자녀 관련 활동 세션 수로 가정
                const currentCount = userData.childTotalSessionCount || (userData.caregiver?.childTotalSessionCount) || 0;
                updates.childTotalSessionCount = currentCount + 1;
            }
        } else {
            if (userType === 'directUser' || userType === 'child') updates.totalSessionCount = 1;
            else if (userType === 'caregiver' || userType === 'parent') updates.childTotalSessionCount = 1;
        }

        await setDoc(userRef, updates, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 전체 통계 업데이트 완료:`, updates);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 전체 통계 업데이트 중 오류:`, error);
    }
}

export async function saveUserProfileData(userId, profileDataToSave) {
    if (!userId || !profileDataToSave || Object.keys(profileDataToSave).length === 0) {
        console.warn("[Firebase Utils] saveUserProfileData: 저장할 데이터가 없거나 사용자 ID가 없습니다.");
        return;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, {
            ...profileDataToSave,
            lastUpdate: serverTimestamp()
        }, { merge: true });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 프로필 정보 업데이트 완료.`);
    } catch (err) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 프로필 정보 업데이트 오류:`, err);
    }
}

export async function uploadUserPhoto(userId, file) {
    if (!userId || !file) {
        console.warn("[Firebase Utils] uploadUserPhoto: userId 또는 파일이 없습니다.");
        return null;
    }
    const storage = getStorage();
    const photoRef = storageRef(storage, `profilePhotos/${userId}/${file.name}`);
    try {
        const snapshot = await uploadBytes(photoRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Firebase Utils] ✅ 프로필 사진 업로드 성공, URL:', url);

        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { photoURL: url, lastUpdate: serverTimestamp() }, { merge: true });
        console.log('[Firebase Utils] ✅ Firestore에 photoURL 업데이트 완료.');
        localStorage.setItem('lozee_photoURL', url); // 클라이언트 localStorage에도 업데이트
        return url;
    } catch (err) {
        console.error('[Firebase Utils] ❌ 프로필 사진 업로드 또는 Firestore 업데이트 오류:', err);
        return null;
    }
}