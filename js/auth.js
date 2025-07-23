import {
    createUserWithEmailAndPassword,
    sendEmailVerification as firebaseSendEmailVerification, // ✅ 별칭 사용 (sendEmailVerification -> firebaseSendEmailVerification)
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { db, auth as firebaseAuth } from './firebase-config.js';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

/**
 * 현재 로그인 상태를 감지하고, 상태에 따라 적절한 콜백 함수를 실행합니다.
 * @param {function} onUserLoggedIn - 사용자가 로그인되어 있을 때 호출될 콜백 (user 객체와 Firestore 프로필 전달)
 * @param {function} onUserLoggedOut - 사용자가 로그아웃 상태일 때 호출될 콜백 (선택 사항)
 * @param {function} [clearInputFieldsFn] - 입력 필드를 초기화하는 함수 (index.html에서 전달)
 * @param {function} [showStepFn] - 특정 단계를 보여주는 함수 (index.html에서 전달)
 */
export function listenAuthState(onUserLoggedIn, onUserLoggedOut = () => {}, clearInputFieldsFn, showStepFn) { 
    return onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
            localStorage.setItem('lozee_userId', user.uid);
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userProfile = userSnap.exists() ? userSnap.data() : null;

            if (userProfile) { 
                try {
                    await updateDoc(userRef, { lastLogin: serverTimestamp() });
                } catch (e) {
                    console.error("lastLogin 업데이트 실패:", e);
                }
            }
            onUserLoggedIn(user, userProfile);
        } else {
            // 로그아웃 시 localStorage 정리
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('lozee_')) {
                    localStorage.removeItem(key);
                }
            });
            // ✅ 로그아웃 콜백 실행 시 clearInputFieldsFn과 showStepFn을 사용합니다.
            if (typeof clearInputFieldsFn === 'function') clearInputFieldsFn();
            if (typeof showStepFn === 'function') showStepFn('authChoice'); 
            onUserLoggedOut(); 
        }
    });
}

/** 이메일/비밀번호로 새 사용자 생성 */
export async function signUpWithEmail(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await sendVerificationEmail(userCredential.user); 
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: error };
    }
}

/** 이메일/비밀번호로 로그인 */
export async function signInWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: error };
    }
}

/** 비밀번호 재설정 이메일 발송 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(firebaseAuth, email);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error };
    }
}

/** 사용자 프로필 정보 저장/업데이트 */
export async function saveUserProfile(uid, profileData) {
    if (!uid || !profileData) {
        console.error("saveUserProfile: UID 또는 프로필 데이터가 없습니다.");
        return false;
    }
    const userRef = doc(db, "users", uid);
    const dataToSave = {
        uid: uid,
        email: firebaseAuth.currentUser?.email || profileData.email || null,
        ...profileData,
        lastUpdate: serverTimestamp()
    };
    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            dataToSave.createdAt = serverTimestamp();
        }
        await setDoc(userRef, dataToSave, { merge: true });
        console.log(`[saveUserProfile] Firestore 문서 저장/업데이트 성공: ${uid}`);
        return true;
    } catch (error) {
        console.error(`[saveUserProfile] Firestore 문서 저장/업데이트 실패 (${uid}):`, error.message);
        return false;
    }
}

/** 이메일 인증 재전송 */
export async function sendVerificationEmail(user) { // ✅ 이 함수 이름은 유지
    try {
        await firebaseSendEmailVerification(user); // ✅ 별칭으로 가져온 Firebase SDK 함수 호출
        console.log('Verification email sent!');
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error; // 오류 전파
    }
}