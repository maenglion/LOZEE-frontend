// Firebase 설정 및 Auth 함수 모듈 가져오기
import { db, auth as firebaseAuth } from './firebase-config.js';
import {
    listenAuthState,
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    saveUserProfile,
    sendVerificationEmail
} from './auth.js';
import { doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// DOM 요소 가져오기 (HTML ID와 정확히 일치하도록 수정)
const steps = {
    authChoice: document.getElementById('stepAuthChoice'),
    login: document.getElementById('stepLogin'),
    passwordReset: document.getElementById('stepPasswordReset'),
    userType: document.getElementById('stepUserType'),
    termsAgreement: document.getElementById('stepTermsAgreement'),
    signUpEmailPassword: document.getElementById('stepSignUpEmailPassword'),
    emailVerification: document.getElementById('stepEmailVerification'),
    nameBirthSelf: document.getElementById('stepNameBirthSelf'),
    caregiverNd: document.getElementById('stepCaregiverNeurodiversity'),
    specialistDiagnosisCaregiver: document.getElementById('stepSpecialistDiagnosisCaregiver'),
    diagnosisType: document.getElementById('stepDiagnosisType'),
    specialistDiagnosisDirectUser: document.getElementById('stepSpecialistDiagnosisDirectUser'),
    nameBirthFamily: document.getElementById('stepNameBirthFamily'),
    finalStart: document.getElementById('stepFinalStart')
};

const goToLoginBtn = document.getElementById('goToLoginBtn');
const goToSignUpBtn = document.getElementById('goToSignUpBtn');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginErrorEl = document.getElementById('loginError');
const loginPasswordError = document.getElementById('loginPasswordError');
const loginBtn = document.getElementById('loginBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const linkToSignUpFromLogin = document.getElementById('linkToSignUpFromLogin');
const linkToLoginFromSignUp = document.getElementById('linkToLoginFromSignUp');
const resetEmailInput = document.getElementById('resetEmail');
const resetErrorEl = document.getElementById('resetError');
const resetSuccessEl = document.getElementById('resetSuccess');
const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');
const userTypeButtons = document.querySelectorAll('.user-type-btn');
const agreeTermsCheckbox = document.getElementById('agreeTerms');
const agreePrivacyCheckbox = document.getElementById('agreePrivacy');
const agreeMarketingCheckbox = document.getElementById('agreeMarketing');
const termsErrorEl = document.getElementById('termsError');
const submitTermsBtn = document.getElementById('submitTermsBtn');
const backToRoleChoiceBtn = document.getElementById('backToRoleChoiceBtn');
const signUpEmailInput = document.getElementById('signUpEmail');
const signUpPasswordInput = document.getElementById('signUpPassword');
const signUpPasswordConfirmInput = document.getElementById('signUpPasswordConfirm');
const signUpEmailError = document.getElementById('signUpEmailError');
const signUpPasswordError = document.getElementById('signUpPasswordError');
const signUpPasswordConfirmError = document.getElementById('signUpPasswordConfirmError');
const createAccountBtn = document.getElementById('createAccountBtn');
const verificationEmailDisplayEl = document.getElementById('verificationEmailDisplay');
const verificationErrorEl = document.getElementById('verificationError');
const checkVerificationBtn = document.getElementById('checkVerificationBtn');
const resendVerificationBtn = document.getElementById('resendVerificationBtn');
const caregiverNdOptionBtns = document.querySelectorAll('.caregiver-nd-btn');
const caregiverNdError = document.getElementById('caregiverNdError');
const submitCaregiverNdBtn = document.getElementById('submitCaregiverNdBtn');
const specialistDiagnosisCaregiverRadios = document.querySelectorAll('input[name="specialistDiagnosisCaregiver"]');
const specialistDiagnosisCaregiverError = document.getElementById('specialistDiagnosisCaregiverError');
const submitSpecialistDiagnosisCaregiverBtn = document.getElementById('submitSpecialistDiagnosisCaregiverBtn');
const diagnosisOptionBtns = document.querySelectorAll('.diagnosis-btn');
const diagnosisError = document.getElementById('diagnosisError');
const submitDiagnosisBtn = document.getElementById('submitDiagnosisBtn');
const specialistDiagnosisDirectUserRadios = document.querySelectorAll('input[name="specialistDiagnosisDirectUser"]');
const specialistDiagnosisDirectUserError = document.getElementById('specialistDiagnosisDirectUserError');
const submitSpecialistDiagnosisDirectUserBtn = document.getElementById('submitSpecialistDiagnosisDirectUserBtn');
const nameSelfInput = document.getElementById('nameSelfInput');
const nameSelfError = document.getElementById('nameSelfError');
const birthYearSelf = document.getElementById('birthYearSelf');
const birthMonthSelf = document.getElementById('birthMonthSelf');
const birthDaySelf = document.getElementById('birthDaySelf');
const birthSelfError = document.getElementById('birthSelfError');
const submitNameBirthSelfBtn = document.getElementById('submitNameBirthSelfBtn');
const nameFamilyInput = document.getElementById('nameFamilyInput');
const nameFamilyError = document.getElementById('nameFamilyError');
const birthYearFamily = document.getElementById('birthYearFamily');
const birthMonthFamily = document.getElementById('birthMonthFamily');
const birthDayFamily = document.getElementById('birthDayFamily');
const birthFamilyError = document.getElementById('birthFamilyError');
const submitNameBirthFamilyBtn = document.getElementById('submitNameFamilyBtn');
const startLozeeConversationBtn = document.getElementById('startLozeeConversationBtn');


// 상태 변수
let currentUserId = null;
let selectedUserType = null;
let tempUserName = null;
let tempUserBirthDate = null;
let tempUserAge = null;
let tempChildName = null;
let tempChildBirthDate = null;
let tempChildAge = null;
let tempSelectedCaregiverNd = [];
let tempSelectedDiagnoses = []; // directUser 본인 또는 caregiver의 자녀/가족 진단명
let tempAgreedTerms = false, tempAgreedPrivacy = false, tempAgreedMarketing = false;
let tempIsSpecialistDiagnosedDirectUser = null;
let tempIsSpecialistDiagnosedChild = null; // 자녀/가족 전문의 진단 여부 (caregiver flow에서 사용)

// 진행 바 DOM 요소
const progressBar = document.getElementById('progress');
const progressText = document.getElementById('progressText');

const caregiverNdTitleEl = document.getElementById('caregiverNdTitle');
const diagnosisTitleEl = document.getElementById('diagnosisTitle');
const nameSelfTitleEl = document.getElementById('nameSelfTitle');
const nameFamilyTitleEl = document.getElementById('nameBirthFamilyTitle');

// 초기 Firebase 인증 확인이 완료되었는지 나타내는 플래그
let isAuthCheckComplete = false;

// 헬퍼 함수: 한글 호격 조사 계산 (gpt-dialog.js에서 가져온 것과 동일)
function getKoreanVocativeParticle(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') return '';
    const lastCharCode = name.charCodeAt(name.length - 1);
    if (lastCharCode < 0xAC00 || lastCharCode > 0xD7A3) return ''; // 한글 음절 범위 밖
    return (lastCharCode - 0xAC00) % 28 === 0 ? '야' : '아'; // 받침 없으면 '야', 있으면 '아'
}

// 헬퍼 함수: 단계 전환 및 진행 바 업데이트
function showStep(stepId) {
    console.log(`[showStep] 단계 전환 시도: ${stepId}`);
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none';
    });

    const targetStep = document.getElementById(stepId);
    if (targetStep) {
        targetStep.classList.add('active');
        targetStep.style.display = 'flex';
        updateProgressBar(stepId);

        // ✅ 단계 전환 시 제목 업데이트 로직 추가
          if (stepId === 'stepCaregiverNeurodiversity' && caregiverNdTitleEl) {
            // '아/야' 대신 '님'을 붙이고, 이름이 없을 경우 '보호자님'으로 표시되도록 수정합니다.
            const titleName = tempUserName ? `${tempUserName}님` : '보호자님';
            caregiverNdTitleEl.innerHTML = `${titleName}에 대해서 알려주시겠어요? <span class="optional-text">(선택 사항)</span>`;
        
        } else if (stepId === 'stepDiagnosisType' && diagnosisTitleEl) {
            if (selectedUserType === 'caregiver') {
                diagnosisTitleEl.textContent = `가족 특성`;
            } else { // directUser
                diagnosisTitleEl.textContent = `당신의 특성`;
            }
        } else if (stepId === 'stepNameBirthSelf' && nameSelfTitleEl) {
            // nameSelfTitleEl은 "정보 입력" 고정 제목이므로 변경 없음.
        } else if (stepId === 'stepNameBirthFamily' && nameFamilyTitleEl) {
            nameFamilyTitleEl.textContent = `가족의 정보를 알려주세요.`;
        }

    } else {
        console.error(`showStep: '${stepId}' 단계를 찾을 수 없습니다. 기본 화면(stepAuthChoice)으로 이동.`);
        const authChoiceStep = document.getElementById('stepAuthChoice');
        if(authChoiceStep) {
            authChoiceStep.classList.add('active');
            authChoiceStep.style.display = 'flex';
        }
        updateProgressBar('stepAuthChoice');
    }
}

// 헬퍼 함수: 진행 바 업데이트
function updateProgressBar(currentStepId) {
    let stepsOrder;
    // userType이 아직 선택되지 않았다면 (초기 로드 시) 기본 흐름 사용
    if (selectedUserType === 'caregiver') { // 보호자 흐름
        stepsOrder = [
            'stepUserType', 'stepTermsAgreement', 'stepSignUpEmailPassword', 'stepEmailVerification',
            'stepNameBirthSelf',
            'stepCaregiverNeurodiversity',
            'stepNameBirthFamily',
            'stepDiagnosisType', // 자녀용
            'stepSpecialistDiagnosisCaregiver', // 자녀용
            'stepFinalStart'
        ];
    } else { // directUser 흐름
        stepsOrder = [
            'stepUserType', 'stepTermsAgreement', 'stepSignUpEmailPassword', 'stepEmailVerification',
            'stepNameBirthSelf',
            'stepDiagnosisType', // 본인용
            'stepSpecialistDiagnosisDirectUser', // 본인용
            'stepFinalStart'
        ];
    }

    const currentStepIndex = stepsOrder.indexOf(currentStepId);
    // 회원가입 흐름 단계에만 진행률 표시
    // stepAuthChoice, stepLogin, stepPasswordReset에서는 진행바를 표시하지 않음
    // stepEmailVerification에서는 진행바를 표시하도록 수정
    if (currentStepIndex === -1 || currentStepId === 'stepAuthChoice' || currentStepId === 'stepLogin' || currentStepId === 'stepPasswordReset') {
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
        return;
    }

    const totalSteps = stepsOrder.length;
    const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${currentStepIndex + 1}/${totalSteps}단계`;
    console.log(`[updateProgressBar] 현재 단계: ${currentStepId}, 진행률: ${progressPercent.toFixed(1)}%`);
}


// 헬퍼 함수: 토스트 메시지 표시
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '10px 20px',
        borderRadius: '5px', zIndex: '1000', fontSize: '14px'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// 헬퍼 함수: 입력 필드 및 임시 상태 초기화
function clearInputFields() {
    console.log("[clearInputFields] 입력 필드 및 상태 초기화 시작");
    document.querySelectorAll('input').forEach(input => {
        if (input.type === 'text' || input.type === 'email' || input.type === 'password' || input.type === 'date') {
            input.value = '';
        } else if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = false;
        }
    });
    document.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.success-message').forEach(el => el.textContent = '');

    document.querySelectorAll('.diagnosis-btn.active').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.caregiver-nd-btn.active').forEach(btn => btn.classList.remove('active'));

    // 모든 임시 상태 변수 초기화
    selectedUserType = null;
    tempUserName = null;
    tempUserBirthDate = null;
    tempUserAge = null;
    tempChildName = null;
    tempChildBirthDate = null;
    tempChildAge = null;
    tempSelectedCaregiverNd = [];
    tempSelectedDiagnoses = [];
    tempIsSpecialistDiagnosedDirectUser = null;
    tempIsSpecialistDiagnosedChild = null; // 보호자 흐름에서만 자녀 진단용으로 사용
    tempAgreedTerms = false;
    tempAgreedPrivacy = false;
    tempAgreedMarketing = false;

    console.log("[clearInputFields] 입력 필드 및 상태 초기화 완료");
}

// 헬퍼 함수: 생년월일 선택지 생성
function populateBirthDateOptions(yearEl, monthEl, dayEl, maxAge = 90, minAge = 0) {
    console.log("[populateBirthDateOptions] 생년월일 선택지 생성 시작");
    if (!yearEl || !monthEl || !dayEl) return;

    const currentYear = new Date().getFullYear();
    yearEl.innerHTML = '<option value="">년</option>';
    for (let y = currentYear - minAge; y >= currentYear - maxAge; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}년`;
        yearEl.add(opt);
    }
    monthEl.innerHTML = '<option value="">월</option>';
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = String(m).padStart(2, '0');
        opt.textContent = `${m}월`;
        monthEl.add(opt);
    }
    dayEl.innerHTML = '<option value="">일</option>';
    for (let d = 1; d <= 31; d++) {
        const opt = document.createElement('option');
        opt.value = String(d).padStart(2, '0');
        opt.textContent = `${d}일`;
        dayEl.add(opt);
    }
    console.log("[populateBirthDateOptions] 생년월일 선택지 생성 완료");
}

// 헬퍼 함수: 나이 계산
function calculateAge(year, month, day) {
    if (!year || !month || !day) return null;
    const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
}

// 헬퍼 함수: localStorage 설정 및 리다이렉트
function setLocalStorageAndRedirect(userProfile, ageForTalkContext, childData = null, isCaregiverNeurodiverse = false) {
    localStorage.setItem('lozee_profile', JSON.stringify(userProfile));
    localStorage.setItem('lozee_ageForTalkContext', ageForTalkContext !== null ? ageForTalkContext.toString() : (userProfile.age !== null ? userProfile.age.toString() : '30'));
    if (childData) {
        localStorage.setItem('lozee_childData', JSON.stringify(childData));
    } else {
        localStorage.removeItem('lozee_childData');
    }

    // 설정할 키를 제외한 기존 lozee_ 키를 모두 지웁니다.
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('lozee_') && !['lozee_profile', 'lozee_ageForTalkContext', 'lozee_childData'].includes(key)) {
            localStorage.removeItem(key);
        }
    });

    localStorage.setItem('lozee_userId', userProfile.uid);
    localStorage.setItem('lozee_username', userProfile.name);
    localStorage.setItem('lozee_role', userProfile.role);
    localStorage.setItem('lozee_userType', JSON.stringify(userProfile.userType));
    localStorage.setItem('lozee_userEmail', userProfile.email);

    if (userProfile.userType.includes('caregiver') && userProfile.caregiverInfo) {
        localStorage.setItem('lozee_childName', userProfile.caregiverInfo.childName || '아이');
        localStorage.setItem('lozee_childAge', userProfile.caregiverInfo.childAge?.toString() || '0');
        localStorage.setItem('lozee_diagnoses', JSON.stringify(userProfile.caregiverInfo.childDiagnoses || []));
        localStorage.setItem('lozee_parentIsND', JSON.stringify(isCaregiverNeurodiverse));
        localStorage.setItem('lozee_caregiver_neurodiversity', JSON.stringify(userProfile.caregiverInfo.caregiverNeurodiversity || []));
        localStorage.setItem('lozee_isChildDiagnosedBySpecialist', JSON.stringify(userProfile.caregiverInfo.isChildDiagnosedBySpecialist || false));
    } else if (userProfile.userType.includes('directUser')) {
        localStorage.setItem('lozee_diagnoses', JSON.stringify(userProfile.diagnoses || []));
        localStorage.setItem('lozee_isDirectUserDiagnosedBySpecialist', JSON.stringify(userProfile.isDirectUserDiagnosedBySpecialist || false));
    }
    console.log("모든 정보 localStorage 저장 완료. talk.html로 이동합니다.");
    window.location.href = 'talk.html';
}


// --- 이벤트 핸들러 바인딩 ---
// 초기 화면 이동 버튼
if (goToLoginBtn) goToLoginBtn.onclick = () => { clearInputFields(); showStep('stepLogin'); };
if (goToSignUpBtn) goToSignUpBtn.onclick = () => { clearInputFields(); showStep('stepUserType'); };
if (linkToSignUpFromLogin) linkToSignUpFromLogin.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('stepUserType'); };
if (linkToLoginFromSignUp) linkToLoginFromSignUp.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('stepLogin'); };
if (forgotPasswordBtn) forgotPasswordBtn.onclick = () => { clearInputFields(); showStep('stepPasswordReset'); };
if (backToLoginBtn) backToLoginBtn.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('stepLogin'); };
if (backToRoleChoiceBtn) backToRoleChoiceBtn.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('stepUserType'); };


// 로그인 버튼
if (loginBtn) loginBtn.onclick = async () => {
    console.log("[loginBtn] 로그인 시도");
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    loginErrorEl.textContent = '';
    loginPasswordError.textContent = '';

    if (!email) loginErrorEl.textContent = "이메일을 입력해주세요.";
    if (!password) loginPasswordError.textContent = "비밀번호를 입력해주세요.";
    if (!email || !password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = "로그인 중...";
    const { user, error } = await signInWithEmail(email, password);
    loginBtn.disabled = false;
    loginBtn.textContent = "로그인";
    if (error) {
        console.error("[loginBtn] 로그인 실패:", error);
        let errorMessage = "로그인 실패: ";
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "유효하지 않은 이메일 형식입니다.";
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
                break;
            default:
                errorMessage = error.message;
        }
        if (loginErrorEl) {
            loginErrorEl.innerHTML = errorMessage;
            const goToLoginLinkAuthError = document.getElementById('goToLoginLinkAuthError');
            if (goToLoginLinkAuthError) {
                goToLoginLinkAuthError.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('login'); };
            }
        }
    } else if (user) {
        if (user.emailVerified) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().userType) {
                const userProfile = userDoc.data();
                let ageForTalk = userProfile.age;
                let childDataForRedirect = null;
                let isCaregiverNeurodiverse = false;

                if (typeof userProfile.userType === 'string') { userProfile.userType = [userProfile.userType]; }
                if (Array.isArray(userProfile.userType) && userProfile.userType.includes('caregiver') && userProfile.caregiverInfo) {
                    ageForTalk = userProfile.caregiverInfo.childAge;
                    childDataForRedirect = userProfile.caregiverInfo;
                    isCaregiverNeurodiverse = userProfile.caregiverInfo.caregiverNeurodiversity?.length > 0 && !userProfile.caregiverInfo.caregiverNeurodiversity.includes('unsure_or_none');
                }
                showToast("로그인 성공!");
                setLocalStorageAndRedirect(userProfile, ageForTalk, childDataForRedirect, isCaregiverNeurodiverse);
            } else {
                console.log("[loginBtn] 사용자 프로필 없음 또는 userType 누락, 프로필 설정 단계로 이동");
                currentUserId = user.uid; // 새 가입자를 위해 currentUserId 설정
                showStep('stepUserType'); // 프로필 완성을 위한 사용자 유형 선택으로 이동
            }
        } else {
            console.log("[loginBtn] 이메일 미인증, emailVerification으로 이동");
            if (verificationEmailDisplayEl) verificationEmailDisplayEl.textContent = user.email;
            showStep('stepEmailVerification');
            localStorage.setItem('lozee_tempEmailForVerification', user.email);
            showToast('이메일 인증이 필요합니다. 인증 이메일을 확인해주세요.');
        }
    }
};

// 비밀번호 재설정 이메일 발송
if (sendResetEmailBtn) sendResetEmailBtn.onclick = async () => {
    console.log("[sendResetEmailBtn] 비밀번호 재설정 이메일 발송 시도");
    const email = resetEmailInput.value.trim();
    resetErrorEl.textContent = '';
    resetSuccessEl.textContent = '';
    if (!email) { resetErrorEl.textContent = "이메일을 입력해주세요."; return; }
    sendResetEmailBtn.disabled = true; sendResetEmailBtn.textContent = "발송 중...";
    try {
        await resetPassword(email);
        resetSuccessEl.textContent = "비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요. (등록된 계정이 없는 경우 메일이 발송되지 않을 수 있습니다.)";
        showToast("비밀번호 재설정 이메일을 보냈습니다.");
    } catch (error) {
        console.error("[sendResetEmailBtn] 비밀번호 재설정 이메일 전송 실패:", error);
        if (error.code === 'auth/invalid-email') resetErrorEl.textContent = "유효하지 않은 이메일 형식입니다.";
        else if (error.code === 'auth/user-not-found') resetErrorEl.textContent = "등록되지 않은 이메일입니다.";
        else resetErrorEl.textContent = "이메일 발송에 실패했습니다. 다시 시도해주세요.";
    } finally {
        sendResetEmailBtn.disabled = false;
        sendResetEmailBtn.textContent = "재설정 이메일 발송";
    }
};

// 사용자 유형 선택 (directUser/caregiver)
userTypeButtons.forEach(button => {
    button.onclick = () => {
        selectedUserType = button.dataset.usertype;
        showStep('stepTermsAgreement');
    };
});

// 약관 동의 제출
if (submitTermsBtn) submitTermsBtn.onclick = () => {
    console.log("[submitTermsBtn] 약관 동의 확인");
    termsErrorEl.textContent = '';
    if (!agreeTermsCheckbox.checked || !agreePrivacyCheckbox.checked) {
        termsErrorEl.textContent = "필수 약관에 모두 동의해주세요.";
        return;
    }
    tempAgreedTerms = agreeTermsCheckbox.checked;
    tempAgreedPrivacy = agreePrivacyCheckbox.checked;
    tempAgreedMarketing = agreeMarketingCheckbox.checked;
    showStep('stepSignUpEmailPassword');
};

// 계정 생성 및 인증 메일 발송
if (createAccountBtn) createAccountBtn.onclick = async () => {
    console.log("[createAccountBtn] 계정 생성 시도");
    const email = signUpEmailInput.value.trim();
    const password = signUpPasswordInput.value;
    const passwordConfirm = signUpPasswordConfirmInput.value;
    signUpEmailError.textContent = '';
    signUpPasswordError.textContent = '';
    signUpPasswordConfirmError.textContent = '';

    if (!email) signUpEmailError.textContent = "이메일을 입력해주세요.";
    if (!password) signUpPasswordError.textContent = "비밀번호를 입력해주세요.";
    if (password !== passwordConfirm) signUpPasswordConfirmError.textContent = "비밀번호가 일치하지 않습니다.";
    if (!email || !password || password !== passwordConfirm) return;
    if (password.length < 6) { signUpPasswordError.textContent = "비밀번호는 6자리 이상이어야 합니다."; return; }

    createAccountBtn.disabled = true; createAccountBtn.textContent = "계정 생성 중...";
    const { user, error } = await signUpWithEmail(email, password);
    createAccountBtn.disabled = false; createAccountBtn.textContent = "계정 생성 및 인증 메일 발송";
    if (error) {
        console.error("[createAccountBtn] 계정 생성 실패:", error);
        let errorMessage = "계정 생성 실패: ";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = `이미 사용 중인 이메일입니다. <a href="#" id="goToLoginLinkAuthError" style="color: #fff; text-decoration: underline;">로그인 페이지로 이동</a>`;
                break;
            case 'auth/invalid-email':
                errorMessage = "유효하지 않은 이메일 형식입니다.";
                break;
            case 'auth/weak-password':
                errorMessage = "비밀번호가 너무 약합니다. 6자리 이상으로 설정해주세요.";
                break;
            default:
                errorMessage = error.message;
        }
        if (signUpEmailError) { // signUpErrorEl 대신 signUpEmailError를 사용하여 더 구체적으로 지정
            signUpEmailError.innerHTML = errorMessage;
            const goToLoginLinkAuthError = document.getElementById('goToLoginLinkAuthError');
            if (goToLoginLinkAuthError) goToLoginLinkAuthError.onclick = (e) => { e.preventDefault(); clearInputFields(); showStep('stepLogin'); };
        }
    } else if (user) {
        showToast("회원가입 성공! 인증 메일을 보냈습니다.");
        if (verificationEmailDisplayEl) verificationEmailDisplayEl.textContent = email;
        localStorage.setItem('lozee_tempEmailForVerification', email);
        currentUserId = user.uid; // 성공적인 가입 후 currentUserId 설정
        showStep('stepEmailVerification');
    }
};

// 이메일 인증 확인
if (checkVerificationBtn) checkVerificationBtn.onclick = async () => {
    console.log("[checkVerificationBtn] 이메일 인증 확인");
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
        console.log("[checkVerificationBtn] 현재 사용자 없음, 로그인 페이지로 이동");
        if (verificationErrorEl) verificationErrorEl.textContent = "사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.";
        showStep('stepLogin');
        return;
    }
    checkVerificationBtn.disabled = true; checkVerificationBtn.textContent = "확인 중...";
    await currentUser.reload(); // 최신 emailVerified 상태를 얻기 위해 사용자 새로고침
    checkVerificationBtn.disabled = false; checkVerificationBtn.textContent = "이메일 인증 완료";

    if (currentUser.emailVerified) {
        console.log("[checkVerificationBtn] 이메일 인증 완료, 사용자 ID:", currentUser.uid);
        currentUserId = currentUser.uid;
        localStorage.setItem('lozee_userId', currentUserId);
        if (verificationErrorEl) verificationErrorEl.textContent = '';

        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        if (userDoc.exists() && userDoc.data().userType) {
            const userProfile = userDoc.data();
            let ageForTalk = userProfile.age;
            let childDataForRedirect = null;
            let isCaregiverNeurodiverse = false;

            if (typeof userProfile.userType === 'string') { userProfile.userType = [userProfile.userType]; }
            if (Array.isArray(userProfile.userType) && userProfile.userType.includes('caregiver') && userProfile.caregiverInfo) {
                ageForTalk = userProfile.caregiverInfo.childAge;
                childDataForRedirect = userProfile.caregiverInfo;
                isCaregiverNeurodiverse = userProfile.caregiverInfo.caregiverNeurodiversity?.length > 0 && !userProfile.caregiverInfo.caregiverNeurodiversity.includes('unsure_or_none');
            }
            showToast("로그인 성공!");
            setLocalStorageAndRedirect(userProfile, ageForTalk, childDataForRedirect, isCaregiverNeurodiverse);
        } else { // 프로필이 없거나 불완전한 경우 (새 가입자 또는 프로필이 불완전한 기존 사용자)
            console.log("[checkVerificationBtn] 사용자 프로필 없음, 프로필 설정 시작");
            // userType이 이미 선택된 경우(예: 이전 세션 또는 부분 가입), 거기서부터 재개할 수 있습니다.
            // 단순화를 위해 nameBirthSelf로 이동합니다.
            // selectedUserType이 여전히 null이면, 로그인 후 방금 인증을 완료했을 수 있습니다.
            // 이 경우 사용자 유형을 다시 물어봐야 합니다.
            if (!selectedUserType) {
                 showStep('stepUserType');
            } else {
                showStep('stepNameBirthSelf'); // 본인 이름/생년월일 입력으로 이동
            }
        }
    } else {
        console.log("[checkVerificationBtn] 이메일 인증 미완료");
        if (verificationErrorEl) verificationErrorEl.textContent = "아직 이메일 인증이 완료되지 않았습니다. 메일함의 인증 링크를 클릭해주세요.";
    }
};

// 인증 메일 재발송
if (resendVerificationBtn) resendVerificationBtn.onclick = async () => {
    console.log("[resendVerificationBtn] 인증 메일 재발송 시도");
    const emailToResend = localStorage.getItem('lozee_tempEmailForVerification');
    const currentUser = firebaseAuth.currentUser;
    if (!emailToResend && !currentUser) {
        showToast("사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
        showStep('stepLogin');
        return;
    }
    const userToResend = currentUser || { email: emailToResend };
    try {
        await sendVerificationEmail(userToResend);
        showToast("인증 메일을 다시 보냈습니다.");
    } catch (error) {
        console.error("[resendVerificationBtn] 인증 메일 재발송 실패:", error);
        showToast("인증 메일 재발송에 실패했습니다: " + error.message);
    }
};

// 본인 이름 및 생년월일 제출 (모든 사용자가 이 단계를 거침)
if (submitNameBirthSelfBtn) submitNameBirthSelfBtn.onclick = async () => {
    const name = nameSelfInput.value.trim();
    const year = birthYearSelf.value;
    const month = birthMonthSelf.value;
    const day = birthDaySelf.value;
    nameSelfError.textContent = ''; birthSelfError.textContent = '';

    if (!name) { nameSelfError.textContent = '이름(또는 별명)을 입력해주세요.'; return; }
    if (!year || !month || !day) { birthSelfError.textContent = '생년월일을 모두 선택해주세요.'; return; }

    tempUserName = name;
    tempUserBirthDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    tempUserAge = calculateAge(year, month, day);

    // ✅ 사용자 유형에 따라 다음 단계 결정 (본인 정보 입력 후 분기)
    if (selectedUserType === 'caregiver') {
        showStep('stepCaregiverNeurodiversity'); // 보호자는 보호자 본인 신경다양성 선택 단계로
    } else { // directUser
        showStep('stepDiagnosisType'); // 당사자는 자신의 특성 이해하기 단계로
    }
};

// 보호자 신경다양성 선택
caregiverNdOptionBtns.forEach(button => {
    button.onclick = () => {
        const ndType = button.dataset.nd;
        console.log("[caregiverNdOptionBtns] 신경다양성 선택:", ndType);
        if (ndType === 'unsure_or_none') {
            caregiverNdOptionBtns.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tempSelectedCaregiverNd = [ndType];
        } else {
            document.querySelector('.caregiver-nd-btn[data-nd="unsure_or_none"]')?.classList.remove('active');
            tempSelectedCaregiverNd = tempSelectedCaregiverNd.filter(d => d !== 'unsure_or_none');
            button.classList.toggle('active');
            if (!tempSelectedCaregiverNd.includes(ndType)) {
                tempSelectedCaregiverNd.push(ndType);
            } else {
                tempSelectedCaregiverNd = tempSelectedCaregiverNd.filter(d => d !== ndType);
            }
        }
        if (caregiverNdError) caregiverNdError.textContent = '';
    };
});

// 보호자 신경다양성 제출
if (submitCaregiverNdBtn) submitCaregiverNdBtn.onclick = () => {
    console.log("[submitCaregiverNdBtn] 보호자 신경다양성 제출:", tempSelectedCaregiverNd);
    if (caregiverNdError) caregiverNdError.textContent = '';
    tempSelectedCaregiverNd = Array.from(document.querySelectorAll('.caregiver-nd-btn.active')).map(btn => btn.dataset.nd);
    if (tempSelectedCaregiverNd.length === 0) {
        tempSelectedCaregiverNd = ['unsure_or_none']; // 아무것도 선택되지 않은 경우 기본값
    }
    // 보호자 본인의 신경다양성 선택 후, 자녀의 이름/생년월일로 이동
    populateBirthDateOptions(birthYearFamily, birthMonthFamily, birthDayFamily, 18, 0); // 자녀의 생년월일 (최대 18세, 최소 0세)
    showStep('stepNameBirthFamily');
};

// 자녀 또는 가족 이름 및 생년월일
if (submitNameBirthFamilyBtn) submitNameBirthFamilyBtn.onclick = () => {
    const name = nameFamilyInput.value.trim();
    const year = birthYearFamily.value;
    const month = birthMonthFamily.value;
    const day = birthDayFamily.value;
    nameFamilyError.textContent = ''; birthFamilyError.textContent = '';

    if (!name) { nameFamilyError.textContent = '아이(또는 가족)의 이름을 입력해주세요.'; return; }
    if (!year || !month || !day) { birthFamilyError.textContent = '아이(또는 가족)의 생년월일을 모두 선택해주세요.'; return; }

    tempChildName = name;
    tempChildBirthDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    tempChildAge = calculateAge(year, month, day);
    showStep('stepDiagnosisType'); // 다음으로 자녀의 진단명 선택
};

// 본인 신경다양성 선택 (directUser 및 caregiver의 자녀)
diagnosisOptionBtns.forEach(button => {
    button.onclick = () => {
        const diagnosis = button.dataset.diagnosis;
        console.log("[diagnosisOptionBtns] 신경다양성 선택:", diagnosis);
        const isExclusive = (diagnosis === 'NotApplicable'); // 'Unsure'는 이 목록에 없음
        if (isExclusive) {
            diagnosisOptionBtns.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tempSelectedDiagnoses = [diagnosis];
        } else {
            document.querySelector('.diagnosis-btn[data-diagnosis="NotApplicable"]')?.classList.remove('active');
            button.classList.toggle('active');
            if (!tempSelectedDiagnoses.includes(diagnosis)) {
                tempSelectedDiagnoses.push(diagnosis);
            } else {
                tempSelectedDiagnoses = tempSelectedDiagnoses.filter(d => d !== diagnosis);
            }
        }
        if (diagnosisError) diagnosisError.textContent = '';
    };
});

// 신경다양성 제출
if (submitDiagnosisBtn) submitDiagnosisBtn.onclick = () => {
    console.log("[submitDiagnosisBtn] 신경다양성 제출:", tempSelectedDiagnoses);
    if (tempSelectedDiagnoses.length === 0) {
        if (diagnosisError) diagnosisError.textContent = "하나 이상 선택해주세요.";
        return;
    }
    if (diagnosisError) diagnosisError.textContent = '';
    tempSelectedDiagnoses = Array.from(document.querySelectorAll('.diagnosis-btn.active')).map(btn => btn.dataset.diagnosis);

    // selectedUserType에 따라 다음 단계 결정 (전문의 진단 여부)
    if (selectedUserType === 'caregiver') {
        showStep('stepSpecialistDiagnosisCaregiver'); // 자녀의 전문의 진단으로 이동
    } else { // directUser
        showStep('stepSpecialistDiagnosisDirectUser'); // 본인 전문의 진단으로 이동
    }
};

// 보호자 및 자녀 전문의 진단 여부 (보호자 흐름)
if (submitSpecialistDiagnosisCaregiverBtn) submitSpecialistDiagnosisCaregiverBtn.onclick = () => {
    console.log("[submitSpecialistDiagnosisCaregiverBtn] 자녀 전문의 진단 여부 확인");
    if (specialistDiagnosisCaregiverError) specialistDiagnosisCaregiverError.textContent = '';
    const selectedValue = document.querySelector('input[name="specialistDiagnosisCaregiver"]:checked')?.value;
    if (selectedValue === undefined) {
        if (specialistDiagnosisCaregiverError) specialistDiagnosisCaregiverError.textContent = "선택해주세요.";
        return;
    }
    tempIsSpecialistDiagnosedChild = (selectedValue === 'true');
    console.log("[submitSpecialistDiagnosisCaregiverBtn] 자녀 전문의 진단 여부:", tempIsSpecialistDiagnosedChild);

    showStep('stepFinalStart');
};

// 본인 전문의 진단 여부 (directUser 흐름)
if (submitSpecialistDiagnosisDirectUserBtn) submitSpecialistDiagnosisDirectUserBtn.onclick = () => {
    console.log("[submitSpecialistDiagnosisDirectUserBtn] 본인 전문의 진단 여부 확인");
    if (specialistDiagnosisDirectUserError) specialistDiagnosisDirectUserError.textContent = '';
    const selectedValue = document.querySelector('input[name="specialistDiagnosisDirectUser"]:checked')?.value;
    if (selectedValue === undefined) {
        if (specialistDiagnosisDirectUserError) specialistDiagnosisDirectUserError.textContent = "선택해주세요.";
        return;
    }
    tempIsSpecialistDiagnosedDirectUser = (selectedValue === 'true');

    showStep('stepFinalStart');
};

// 대화 시작 (프로필 최종 저장)
if (startLozeeConversationBtn) startLozeeConversationBtn.onclick = async () => {
    if (!currentUserId) {
        showToast("사용자 인증 정보가 없습니다. 다시 로그인해주세요.");
        showStep('stepLogin');
        return;
    }

    let profileData = {
        uid: currentUserId, // UID가 프로필 데이터에 포함되도록 함
        name: tempUserName,
        email: firebaseAuth.currentUser?.email,
        birthDate: tempUserBirthDate,
        age: tempUserAge,
        agreements: {
            terms: tempAgreedTerms,
            privacy: tempAgreedPrivacy,
            marketing: tempAgreedMarketing,
            agreedAt: serverTimestamp()
        },
        lastUpdate: serverTimestamp(),
        userType: [],
        role: selectedUserType === 'caregiver' ? 'parent' : 'self',
        diagnoses: [], // directUser 또는 신경다양성 특성을 가진 보호자 본인용
        isDirectUserDiagnosedBySpecialist: false
    };

    // userType 배열 구성
    profileData.userType.push(selectedUserType);
    const isCaregiverNeurodiverse = tempSelectedCaregiverNd.length > 0 && !tempSelectedCaregiverNd.includes('unsure_or_none');
    if (selectedUserType === 'caregiver' && isCaregiverNeurodiverse) {
        profileData.userType.push('directUser'); // 보호자도 신경다양성 특성이 있는 경우 directUser 유형 추가
    }

    let ageForTalkContext = profileData.age;
    let childDataForRedirect = null;

    if (selectedUserType === 'caregiver') {
        profileData.caregiverInfo = {
            caregiverNeurodiversity: tempSelectedCaregiverNd,
            // isCaregiverDiagnosedBySpecialist: tempIsSpecialistDiagnosedCaregiver, // 이 단계는 자녀 진단용이므로 제거됨
            childName: tempChildName,
            childBirthDate: tempChildBirthDate,
            childAge: tempChildAge,
            childDiagnoses: tempSelectedDiagnoses,
            isChildDiagnosedBySpecialist: tempIsSpecialistDiagnosedChild
        };
        profileData.diagnoses = []; // 보호자의 메인 프로필에서 직접 진단명 제거
        ageForTalkContext = tempChildAge;
        childDataForRedirect = profileData.caregiverInfo;
    } else { // directUser
        profileData.diagnoses = tempSelectedDiagnoses;
        profileData.isDirectUserDiagnosedBySpecialist = tempIsSpecialistDiagnosedDirectUser;
    }

    startLozeeConversationBtn.disabled = true;
    startLozeeConversationBtn.textContent = "저장 중...";
    const saveSuccess = await saveUserProfile(currentUserId, profileData);
    startLozeeConversationBtn.disabled = false;
    startLozeeConversationBtn.textContent = "로지와 대화 시작하기";
    if (saveSuccess) {
        showToast("프로필 저장 성공!");
        setLocalStorageAndRedirect(profileData, ageForTalkContext, childDataForRedirect, isCaregiverNeurodiverse);
    } else {
        showToast("프로필 저장에 실패했습니다. 다시 시도해주세요.");
    }
};

// 페이지 로드 시 Firebase 인증 상태 감지 및 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log("[DOMContentLoaded] Index.html 로드 완료");
    populateBirthDateOptions(birthYearSelf, birthMonthSelf, birthDaySelf, 90, 3); // 본인 생년월일 (최대 90세, 최소 3세)
    populateBirthDateOptions(birthYearFamily, birthMonthFamily, birthDayFamily, 18, 0); // 자녀/가족 생년월일 (최대 18세, 최소 0세)

    // '애니메이션 비활성화' 관련 이벤트 리스너를 삭제했습니다.

    // jQuery <path> 오류 방어 코드 (기존 그대로 유지)
    console.log("[DOMContentLoaded] jQuery 확인:", typeof window.jQuery !== 'undefined' ? "jQuery 로드됨" : "jQuery 로드되지 않음");
    const paths = document.querySelectorAll('path');
    paths.forEach(path => {
        try {
            const dValue = path.getAttribute('d');
            if (dValue && !dValue.match(/^[MLHVCSQTAmlhvcsqta][0-9,. -]*$/)) {
                console.warn("[SVG Debug] 유효하지 않은 path d 속성:", dValue);
                path.setAttribute('d', 'M0,0 L10,10');
            }
        } catch (e) {
            console.error("[SVG Debug] path 처리 오류:", e);
        }
    });


    // Firebase 인증 상태 감지
    listenAuthState(
        async (user, userProfile) => {
            console.log("[listenAuthState] 로그인 상태 감지. UID:", user.uid);
            currentUserId = user.uid;
            isAuthCheckComplete = true; // 인증 확인 완료

            if (!user.emailVerified) {
                console.log("[listenAuthState] 이메일 미인증, emailVerification으로 이동");
                showToast('이메일 인증이 필요합니다. 인증 이메일을 확인해주세요.');
                if (verificationEmailDisplayEl) verificationEmailDisplayEl.textContent = user.email;
                localStorage.setItem('lozee_tempEmailForVerification', user.email);
                showStep('stepEmailVerification');
                return;
            }

            if (userProfile && userProfile.userType) {
                console.log("[listenAuthState] 사용자 프로필 존재:", userProfile);
                const userProfileForRedirect = { ...userProfile, uid: user.uid }; // UID 포함 확인

                if (typeof userProfileForRedirect.userType === 'string') {
                    userProfileForRedirect.userType = [userProfileForRedirect.userType];
                }
                // 보호자도 신경다양성 특성이 있는 경우 userType에 'directUser' 다시 추가
                if (Array.isArray(userProfileForRedirect.userType) && userProfileForRedirect.userType.includes('caregiver') &&
                    userProfileForRedirect.caregiverInfo?.caregiverNeurodiversity?.length > 0 &&
                    !userProfileForRedirect.caregiverInfo.caregiverNeurodiversity.includes('unsure_or_none')) {
                    if (!userProfileForRedirect.userType.includes('directUser')) {
                        userProfileForRedirect.userType.push('directUser');
                    }
                }

                let ageForTalk = userProfileForRedirect.age;
                let childDataForRedirect = null;
                let isCaregiverNeurodiverse = false;

                if (userProfileForRedirect.userType.includes('caregiver') && userProfileForRedirect.caregiverInfo) {
                    ageForTalk = userProfileForRedirect.caregiverInfo.childAge;
                    childDataForRedirect = userProfileForRedirect.caregiverInfo;
                    isCaregiverNeurodiverse = userProfileForRedirect.caregiverInfo.caregiverNeurodiversity?.length > 0 &&
                        !userProfileForRedirect.caregiverInfo.caregiverNeurodiversity.includes('unsure_or_none');
                }
                setLocalStorageAndRedirect(userProfileForRedirect, ageForTalk, childDataForRedirect, isCaregiverNeurodiverse);
            } else {
                console.log("[listenAuthState] 사용자 프로필 없음 또는 불완전, userType으로 이동");
                showStep('stepUserType');
            }
        },
        () => { // 로그아웃 콜백
            console.log("[listenAuthState] 로그아웃 상태 감지.");
            currentUserId = null;
            isAuthCheckComplete = true; // 인증 확인 완료
            clearInputFields();
            showStep('stepAuthChoice');
            showToast('로그아웃 상태입니다.');
        },
        () => { // onAuthReady 콜백 (초기 인증 확인 완료 후 호출됨)
            // 이 콜백은 이제 초기 탐색에 덜 중요합니다.
            // (onLoggedIn/onLoggedOut이 처리하기 때문입니다.)
            // 필요한 경우 다른 인증 후 로직에 사용할 수 있습니다.
        },
        showStep // showStep 함수 전달
    );

    // 인증 확인이 매우 느린 경우를 위한 대체 (위 설정으로는 발생하기 어려움)
    setTimeout(() => {
        if (!isAuthCheckComplete) {
            console.log("[DOMContentLoaded] 인증 확인이 완료되지 않아 authChoice를 대체 화면으로 표시합니다.");
            showStep('stepAuthChoice');
        }
    }, 500); // 인증 상태가 결정될 시간을 500ms 줍니다.
});