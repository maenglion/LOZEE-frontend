// js/firebase-utils.js
import { db } from './firebase-config.js';
import { auth as firebaseAuth } from './firebase-config.js';
import { onAuthStateChanged, getAuth, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
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

export async function saveJournalToFirestore(sessionId, journalData) {
  if (!sessionId || !journalData) {
    console.error("세션 ID 또는 저널 데이터가 없어 저장할 수 없습니다.");
    return;
  }
  try {
    const journalRef = doc(db, 'journals', sessionId);
    await setDoc(journalRef, {
      ...journalData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`저널이 성공적으로 저장되었습니다 (ID: ${sessionId})`);
  } catch (error) {
    console.error("Firestore에 저널 저장 중 오류:", error);
    throw error;
  }
}

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

export async function saveReservation(userId, reservationData) {
  if (!userId) {
    console.error("예약 저장을 위한 사용자 ID가 없습니다.");
    return null;
  }
  try {
    const reservationsColRef = collection(db, 'users', userId, 'reservations');
    const docRef = await addDoc(reservationsColRef, {
      ...reservationData,
      timestamp: serverTimestamp()
    });
    console.log("예약 정보가 성공적으로 저장되었습니다:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Firestore에 예약 정보 저장 중 오류 발생:", error);
    return null;
  }
}

export function detectSensitiveRisk(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    const lowerText = text.toLowerCase();
    const sensitiveKeywords = [
        '자살', '죽고싶다', '죽을까', '살고싶지않아', '극단적선택', '삶을포기', '세상끝내고싶다',
        '자해', '상처내다', '피나다', '때리다', '칼', '아프게하다',
        '학폭', '학교폭력', '괴롭힘', '따돌림', '왕따', '맞았다', '때렸다',
        '위험해', '죽을래', '죽여', '끝내버리자'
    ];
    for (const keyword of sensitiveKeywords) {
        if (lowerText.includes(keyword)) {
            console.warn(`[민감/위험 감지] 키워드: "${keyword}"`);
            return true;
        }
    }
    return false;
}

export async function loadAnalysisDataFromFirestore(userId) {
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


// --- 마이페이지 관련 신규/수정 함수 ---

/**
 * [신규] 사용자 프로필 기본 정보 조회 (마이페이지 '내 정보' 탭용)
 * @param {string} userId - 사용자 UID
 * @returns {Promise<object|null>} 사용자 데이터 또는 null
 */
export async function getUserProfileData(userId) {
    if (!userId) {
        console.error("getUserProfileData: 사용자 ID가 필요합니다.");
        return null;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            return { id: userSnap.id, ...userSnap.data() };
        } else {
            console.warn(`getUserProfileData: 사용자 문서(${userId})를 찾을 수 없습니다.`);
            return null;
        }
    } catch (error) {
        console.error("getUserProfileData: 사용자 프로필 정보 로드 중 오류:", error);
        return null;
    }
}

/**
 * [신규] 보호자의 자녀 프로필 정보 조회 (마이페이지 '내 정보' 탭용)
 * @param {string} userId - 보호자 UID
 * @param {string} childId - 자녀 UID (보호자 문서 내 childId 필드 참조)
 * @returns {Promise<object|null>} 자녀 데이터 또는 null
 */
export async function getChildProfileData(userId, childId) {
    if (!userId || !childId) {
        console.error("getChildProfileData: 보호자 및 자녀 ID가 필요합니다.");
        return null;
    }
    try {
        // 현재 자녀 정보는 보호자 문서 내 caregiverInfo에 포함되어 있다고 가정.
        // 만약 자녀 정보가 별도 users 컬렉션 문서로 있다면 해당 경로를 사용해야 함.
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists() && userSnap.data().caregiverInfo) {
            // caregiverInfo 내의 자녀 정보를 반환
            // 실제 데이터베이스 구조에 따라 childId를 사용하여 자녀의 별도 문서를 조회할 수도 있음.
            return userSnap.data().caregiverInfo;
        } else {
            console.warn(`getChildProfileData: 보호자 문서(${userId}) 또는 자녀 정보(${childId})를 찾을 수 없습니다.`);
            return null;
        }
    } catch (error) {
        console.error("getChildProfileData: 자녀 프로필 정보 로드 중 오류:", error);
        return null;
    }
}


/**
 * [신규] 대시보드 (마이페이지 '로지와의 약속' 탭)에 표시될 훈련 데이터 조회
 * 각 훈련 유형별 (스몰 토크, 관계 감정 등) 최신 진행 상태를 가져옴.
 * Firestore에 users/{userId}/userTrainings/{trainingId} 경로의 컬렉션이 있다고 가정
 * @param {string} userId - 사용자 UID
 * @returns {Promise<object[]>} 훈련 데이터 배열 (각 훈련 문서의 데이터)
 */
export async function getDashboardAppointmentsData(userId) {
    if (!userId) {
        console.error("getDashboardAppointmentsData: 사용자 ID가 필요합니다.");
        return [];
    }
    // ⭐ 마이페이지 이미지에 보이는 훈련 항목들을 기준으로 ID 정의
    const trainingTypes = [
        'smallTalk',            // 스몰 토크
        'relationEmotion',      // 관계 감정 살펴보기
        'cognitiveDistortion',  // 인지 왜곡 살펴보기
        // 'angerManagement',   // 분노 조절 (필요시 추가)
        // 'selfUnderstanding'  // 자기 이해 (필요시 추가)
    ];

    const appointmentsData = [];
    try {
        for (const type of trainingTypes) {
            const trainingDocRef = doc(db, `users/${userId}/userTrainings`, type);
            const trainingSnap = await getDoc(trainingDocRef);
            if (trainingSnap.exists()) {
                appointmentsData.push({ id: trainingSnap.id, ...trainingSnap.data() });
            } else {
                // 문서가 없으면 기본 더미 데이터 생성 또는 빈 값으로 처리
                // 마이페이지 이미지를 채우기 위한 더미 데이터 예시 (실제 구현 시 Firestore에서 관리)
                let dummyData = {
                    id: type,
                    displayText: "", // 마이페이지에 표시될 이름
                    scheduledDate: serverTimestamp(), // 임시 날짜
                    currentProgress: 0,
                    totalExpectedProgress: 0,
                    outcome: "아직 진행된 내용이 없습니다.",
                    isNew: false // NEW 점 기본 false
                };
                if (type === 'smallTalk') {
                    dummyData.displayText = "스몰 토크";
                    dummyData.scheduledDate = new Date("2025-07-01T15:15:00Z");
                    dummyData.currentProgress = 3;
                    dummyData.totalExpectedProgress = 20;
                    dummyData.outcome = "상대방에게 너무 많은 정보를 한번에 쏟아내게 되면, 상대는 대화의 흐름을 파악하기 어려워. 우리 조금 더 연습해보자.";
                } else if (type === 'relationEmotion') {
                    dummyData.displayText = "관계 감정 살펴보기";
                    dummyData.scheduledDate = new Date("2025-07-05T15:15:00Z");
                    dummyData.currentProgress = 5;
                    dummyData.totalExpectedProgress = 10;
                    dummyData.outcome = "지금 너는 엄마의 행동에 대한 패턴이 파악되면 서 엄마를 거부하고 있어. 엄마와 관련된 너의 감정 단어들을 보면 ...";
                } else if (type === 'cognitiveDistortion') {
                    dummyData.displayText = "인지 왜곡 살펴보기";
                    dummyData.scheduledDate = new Date("2025-07-06T09:30:00Z");
                    dummyData.currentProgress = 0;
                    dummyData.totalExpectedProgress = 6;
                    dummyData.patternsDetected = [
                        { label: "과장된 오류", text: `"나는 아이를 위해 이토록 노력하는데, 왜 나는 늘 손해를 보며, 사람들은 나를 이해해주지 않지? 결국? 이건 너무 불공평해."` },
                        { label: "흑백논리", text: `"그렇게 애를 키웠는데도 안되니 우리 아이의 사회성은 완전히 망가진 거나 다름 없어. 희망이 없어."` }
                    ];
                    dummyData.todo = "우리는 이 생각들을 다른 각도에서 생각해 보는 연습을 할거야.";
                }
                appointmentsData.push(dummyData); // 더미 데이터 추가
            }
        }
        return appointmentsData;
    } catch (error) {
        console.error("getDashboardAppointmentsData: 훈련 데이터 로드 중 오류:", error);
        return [];
    }
}

/**
 * [수정] 최근 저널 목록 조회 (마이페이지 '최근 이야기' 탭용)
 * @param {string} userId - 사용자 UID
 * @param {number} limitCount - 가져올 저널의 최대 개수
 * @returns {Promise<object[]>} 저널 데이터 배열
 */
export async function getRecentJournals(userId, limitCount = 10) { // 기본값 10으로 설정
    if (!userId) return [];
    try {
        const journalsRef = collection(db, 'journals');
        const q = query(
            journalsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'), // 최신 순으로 정렬
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const journals = [];
        querySnapshot.forEach((doc) => {
            journals.push({ id: doc.id, ...doc.data() });
        });
        return journals;
    } catch (error) {
        console.error("getRecentJournals: 최근 저널 로드 중 오류:", error);
        return [];
    }
}

/**
 * [수정] 긴급 알림 목록 조회 (마이페이지 '위험 알림' 탭용)
 * @param {string} parentId - 보호자 UID
 * @param {number} limitCount - 가져올 알림의 최대 개수
 * @returns {Promise<object[]>} 알림 데이터 배열
 */
export async function getEmergencyAlerts(parentId, limitCount = 5) { // 기본값 5로 설정
    if (!parentId) return [];
    try {
        const q = query(
            collection(db, "notifications"),
            where("parentId", "==", parentId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const alerts = [];
        querySnapshot.forEach(docSnap => {
            alerts.push({ id: docSnap.id, ...docSnap.data() });
        });
        return alerts;
    } catch (error) {
        console.error("getEmergencyAlerts: 긴급 알림 로드 중 오류:", error);
        return [];
    }
}

// ** 마이페이지에서 프로필 사진 URL 업데이트 **
export async function updateProfilePhotoURL(userId, photoURL) {
    if (!userId || !photoURL) {
        console.error("updateProfilePhotoURL: 사용자 ID와 사진 URL이 필요합니다.");
        return;
    }
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { profilePhotoURL: photoURL });
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 프로필 사진 URL 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 프로필 사진 URL 업데이트 중 오류:`, error);
        throw error;
    }
}

// ** 마이페이지에서 사용자/자녀 정보 업데이트 (선택 사항 - 필요한 경우 구현) **
// 예시: 닉네임, 나이, 특성 등 업데이트
export async function updateUserInfo(userId, dataToUpdate) {
    if (!userId || !dataToUpdate) {
        console.error("updateUserInfo: 사용자 ID와 업데이트할 데이터가 필요합니다.");
        return;
    }
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, dataToUpdate);
        console.log(`[Firebase Utils] ✅ 사용자(${userId}) 정보 업데이트 완료.`);
    } catch (error) {
        console.error(`[Firebase Utils] ❌ 사용자(${userId}) 정보 업데이트 중 오류:`, error);
        throw error;
    }
}

/**
 * [신규] 사용자에게 이메일 인증 메일을 보내는 함수
 * @param {firebase.User} user - 현재 로그인된 Firebase User 객체
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(user) {
    if (!user) {
        console.error("sendVerificationEmail: 사용자 객체가 없습니다.");
        throw new Error("사용자 객체가 없어 인증 메일을 보낼 수 없습니다.");
    }
    try {
        await sendEmailVerification(user);
        console.log("✅ 인증 메일이 성공적으로 전송되었습니다.");
    } catch (error) {
        console.error("❌ 인증 메일 전송 중 오류:", error);
        throw error; // 오류 전파
    }
}

/**
 * [신규] 이메일과 비밀번호로 로그인 시도 후, 인증 여부 확인 및 메일 전송
 * 이 함수는 로그인 페이지의 signInWithEmailAndPassword를 대체할 수 있습니다.
 * @param {string} email - 사용자 이메일
 * @param {string} password - 사용자 비밀번호
 * @returns {Promise<firebase.User|null>} - 로그인 성공 시 User 객체, 실패 시 null
 */
export async function handleSignInWithEmailAndPassword(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            console.warn("이메일이 인증되지 않았습니다. 인증 메일을 재전송합니다.");
            await sendVerificationEmail(user);
            alert("📩 이메일 인증이 필요합니다. 인증 메일을 다시 보냈어요. 메일함을 확인해 주세요.");
            return null; // 인증되지 않은 상태로 간주
        } else {
            console.log("✅ 로그인 성공 및 이메일 인증 완료:", user.email);
            return user;
        }
    } catch (error) {
        let errorMessage = "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "비밀번호가 일치하지 않습니다.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "등록되지 않은 이메일 주소입니다.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "유효하지 않은 이메일 주소 형식입니다.";
        }
        console.error("❌ 로그인 실패:", error.code, error.message);
        alert(errorMessage);
        throw error; // 오류 전파
    }
}