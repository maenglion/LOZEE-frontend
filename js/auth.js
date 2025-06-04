// js/auth.js
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { db, auth as firebaseAuthApp } from './firebase-config.js'; // firebase-config.js에서 export한 auth 객체
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

/**
 * 현재 로그인 상태를 감지하고, 콜백 함수를 실행합니다.
 * @param {function} onUserLoggedIn - 사용자가 로그인되어 있을 때 호출될 콜백 (user 객체 전달)
 * @param {function} onUserLoggedOut - 사용자가 로그아웃 상태일 때 호출될 콜백
 */
export function listenAuthState(onUserLoggedIn, onUserLoggedOut) {
    return onAuthStateChanged(firebaseAuthApp, async (user) => {
        if (user) {
            // 사용자가 로그인된 상태
            localStorage.setItem('lozee_userId', user.uid); // UID를 localStorage에 저장
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            let userProfile = null;
            if (userSnap.exists()) {
                userProfile = userSnap.data();
                // 마지막 로그인 시간 업데이트
                try {
                    await updateDoc(userRef, { lastLogin: serverTimestamp() });
                } catch (e) {
                    console.error("Error updating lastLogin:", e);
                }
            }
            onUserLoggedIn(user, userProfile); // user 객체와 프로필 정보 전달
        } else {
            // 사용자가 로그아웃된 상태
            localStorage.removeItem('lozee_userId');
            localStorage.removeItem('lozee_username');
            // ... 기타 로컬 스토리지 클리어 ...
            onUserLoggedOut();
        }
    });
}

/**
 * 이메일과 비밀번호로 새 사용자를 생성합니다.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential|object>} 성공 시 UserCredential, 실패 시 에러 객체
 */
export async function signUpWithEmail(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuthApp, email, password);
        // 이메일 인증 메일 발송
        await sendEmailVerification(userCredential.user);
        console.log("회원가입 성공 및 인증 메일 발송:", userCredential.user.uid);
        return { user: userCredential.user, error: null };
    } catch (error) {
        console.error("회원가입 실패:", error.code, error.message);
        return { user: null, error: error };
    }
}

/**
 * 이메일과 비밀번호로 사용자를 로그인시킵니다.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential|object>} 성공 시 UserCredential, 실패 시 에러 객체
 */
export async function signInWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuthApp, email, password);
        console.log("로그인 성공:", userCredential.user.uid);
        return { user: userCredential.user, error: null };
    } catch (error) {
        console.error("로그인 실패:", error.code, error.message);
        return { user: null, error: error };
    }
}

/**
 * 비밀번호 재설정 이메일을 발송합니다.
 * @param {string} email
 * @returns {Promise<object>} 성공 또는 실패 정보 포함 객체
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(firebaseAuthApp, email);
        console.log("비밀번호 재설정 이메일 발송 성공");
        return { success: true, error: null };
    } catch (error) {
        console.error("비밀번호 재설정 이메일 발송 실패:", error.code, error.message);
        return { success: false, error: error };
    }
}

/**
 * 현재 사용자를 로그아웃시킵니다.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
    try {
        await signOut(firebaseAuthApp);
        console.log("로그아웃 성공");
        // localStorage 클리어는 listenAuthState의 onUserLoggedOut 콜백에서 처리
    } catch (error) {
        console.error("로그아웃 실패:", error);
    }
}

/**
 * Firestore에 사용자 프로필 정보를 저장하거나 업데이트합니다.
 * @param {string} uid - 사용자의 UID
 * @param {object} profileData - 저장할 프로필 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
export async function saveUserProfile(uid, profileData) {
    if (!uid || !profileData) {
        console.error("saveUserProfile: UID 또는 프로필 데이터가 없습니다.");
        return false;
    }
    const userRef = doc(db, "users", uid);
    const dataToSave = {
        uid: uid,
        email: firebaseAuthApp.currentUser ? firebaseAuthApp.currentUser.email : profileData.email, // 인증된 이메일 우선 사용
        ...profileData,
        lastLogin: serverTimestamp()
    };

    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            dataToSave.createdAt = serverTimestamp();
            await setDoc(userRef, dataToSave);
            console.log(`[saveUserProfile] Firestore에 새 사용자 문서 생성: ${uid}`);
        } else {
            await setDoc(userRef, dataToSave, { merge: true });
            console.log(`[saveUserProfile] Firestore 사용자 문서 업데이트: ${uid}`);
        }
        return true;
    } catch (error) {
        console.error(`[saveUserProfile] 사용자 문서 저장/업데이트 실패 (${uid}):`, error.message);
        return false;
    }
}