// mypage.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js'; // Firestore SDK 필요
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js'; // Storage SDK 필요
import { storage } from './firebase-config.js'; // storage 객체 가져오기
import {
    getUserProfileData,
    getChildProfileData,
    getDashboardAppointmentsData,
    getRecentJournals,
    getEmergencyAlerts,
    updateProfilePhotoURL,
    // updateUserInfo // 필요시 주석 해제하여 사용
} from './firebase-utils.js';

// DOM 요소들은 그대로 유지
const pageTitleEl = document.querySelector('title');
const tabMenuItems = document.querySelectorAll('.tab-item');
const contentSections = document.querySelectorAll('.content-section');

const userPhotoPlaceholderEl = document.getElementById('userPhotoPlaceholder');
const userProfileImageEl = document.getElementById('userProfileImage');
const userInitialTextEl = document.getElementById('userInitialText');
const profileImageUploadEl = document.getElementById('profileImageUpload');
const editProfilePhotoBtnEl = document.getElementById('editProfilePhotoBtn');

const daysSinceJoinEl = document.getElementById('daysSinceJoin');

const userNameDisplayEl = document.getElementById('userNameDisplay');
const userNicknameDisplayEl = document.getElementById('userNicknameDisplay');
const userEmailDisplayEl = document.getElementById('userEmailDisplay');
const userFullAgeEl = document.getElementById('userFullAge');
const lastLoginDateEl = document.getElementById('lastLoginDate');

const userTypeInfoCardEl = document.getElementById('userTypeInfoCard');
const userTypeDisplayEl = document.getElementById('userTypeDisplay');

const directUserDiagnosisCardEl = document.getElementById('directUserDiagnosisCard');
const userDiagnosesListEl = document.getElementById('userDiagnosesList');
const caregiverPersonalNDCardEl = document.getElementById('caregiverPersonalNDCard');
const caregiverPersonalNeurodiversityListEl = document.getElementById('caregiverPersonalNeurodiversityList');
const childInfoCardEl = document.getElementById('childInfoCard');
const childNameDisplayEl = document.getElementById('childNameDisplay');
const childFullAgeDisplayEl = document.getElementById('childFullAgeDisplay');
const childDiagnosesListEl = document.getElementById('childDiagnosesList');
const addChildBtnEl = document.getElementById('addChildBtn');

const appointmentsListContainerEl = document.getElementById('appointmentsListContainer');
const noAppointmentsMessageEl = document.getElementById('noAppointmentsMessage');
const appointmentFilterSelectEl = document.getElementById('appointmentFilter');

const emergencyAlertsListEl = document.getElementById('emergencyAlertsList');
const emergencyAlertsSectionEl = document.getElementById('alerts-section');

const recentJournalCardListEl = document.getElementById('recentJournalCardList');
const goToJournalListBtnEl = document.getElementById('goToJournalListBtn');

const allCardEditButtons = document.querySelectorAll('.info-card h2 .edit-button');

// 현재 로그인된 사용자 객체 (onAuthStateChanged에서 설정)
let currentUser = null;


// --- 헬퍼 함수 ---
function getNeurodiversityText(code) {
    const map = {
        "ASD": "자폐 스펙트럼", "ADHD": "ADHD", "Asperger": "아스퍼거", "Tic": "틱 장애", "LD": "학습 장애", "Else": "기타 어려움",
        "Unsure": "진단 없음", "NotApplicable": "해당 없음",
        "self_asd": "본인: ASD 성향", "self_adhd": "본인: ADHD 성향",
        "spouse_asd": "배우자: ASD 성향", "spouse_adhd": "배우자: ADHD 성향",
        "unsure_or_none": "해당 없음"
    };
    return map[code] || code;
}

function calculateDaysSinceJoin(joinDate) {
    if (!joinDate) return '정보 없음';
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDay = joinDate.toDate();
    const today = new Date();
    const diffDays = Math.round(Math.abs((firstDay - today) / oneDay));
    return diffDays;
}

// 이미지 압축 및 업로드 함수
async function compressAndUploadImage(file, userId) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const CANVAS_SIZE = 120;
                let width = img.width;
                let height = img.height;

                const aspectRatio = width / height;
                if (width > height) {
                    height = CANVAS_SIZE;
                    width = CANVAS_SIZE * aspectRatio;
                } else {
                    width = CANVAS_SIZE;
                    height = CANVAS_SIZE / aspectRatio;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = CANVAS_SIZE;
                canvas.height = CANVAS_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, (CANVAS_SIZE - width) / 2, (CANVAS_SIZE - height) / 2, width, height);

                canvas.toBlob(async (blob) => {
                    const storageRef = ref(storage, `profile_photos/${userId}/${Date.now()}_${file.name}`);
                    try {
                        await uploadBytes(storageRef, blob);
                        const downloadURL = await getDownloadURL(storageRef);
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }, 'image/jpeg', 0.8);
            };
        };
        reader.readAsDataURL(file);
    });
}


// --- 데이터 로드 및 렌더링 ---
async function loadPage() {
    const loggedInUserId = currentUser.uid;

    const userData = await getUserProfileData(loggedInUserId);
    if (!userData) {
        if (userNameDisplayEl) {
            userNameDisplayEl.textContent = '사용자 정보를 찾을 수 없습니다.';
        }
        contentSections.forEach(section => section.style.display = 'none');
        return;
    }

    const name = userData.name || '사용자';
    const nickname = userData.nickname || name;
    const userType = userData.userType;
    const diagnoses = userData.diagnoses || [];
    const caregiverInfo = userData.caregiverInfo || {};
    const joinDate = userData.joinDate;

    localStorage.setItem('lozee_isDirectUser', (userType === 'directUser' || (userType === 'caregiver' && diagnoses.length > 0)).toString());


    if (pageTitleEl) pageTitleEl.textContent = `${nickname}의 마이페이지`;
    
    // user-name h2의 innerHTML을 직접 바꾸지 않고, 텍스트만 업데이트
    if (document.getElementById('user-name')) {
        document.getElementById('user-name').textContent = '나의 정보';
    }

    if (userNicknameDisplayEl) userNicknameDisplayEl.textContent = nickname;
    if (userEmailDisplayEl) userEmailDisplayEl.textContent = userData.email || '이메일 정보 없음';
    if (userFullAgeEl) userFullAgeEl.textContent = userData.age !== null ? `만 ${userData.age}세` : '정보 없음';
    if (lastLoginDateEl) lastLoginDateEl.textContent = userData.lastLogin?.toDate().toLocaleString('ko-KR') || '기록 없음';

    // connection-days 업데이트
    if (daysSinceJoinEl && currentUser && currentUser.metadata && currentUser.metadata.creationTime) {
        const creationDate = new Date(currentUser.metadata.creationTime);
        const today = new Date();
        const diffTime = Math.abs(today - creationDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysSinceJoinEl.textContent = diffDays;
    } else {
        if (daysSinceJoinEl) daysSinceJoinEl.textContent = '정보 없음';
    }


    if (userProfileImageEl && userInitialTextEl) {
        if (userData.profilePhotoURL) {
            userProfileImageEl.src = userData.profilePhotoURL;
            userProfileImageEl.style.display = 'block';
            userInitialTextEl.style.display = 'none';
        } else {
            userProfileImageEl.style.display = 'none';
            userInitialTextEl.style.display = 'flex';
            userInitialTextEl.textContent = name.charAt(0).toUpperCase() || '😊';
        }
    }

    if (userTypeInfoCardEl && userTypeDisplayEl) {
        userTypeInfoCardEl.style.display = 'block';
        userTypeDisplayEl.textContent = userType === 'directUser' ? '당사자' : '보호자';
    }

    if (directUserDiagnosisCardEl && userDiagnosesListEl) {
        if (userType === 'directUser' || (userType === 'caregiver' && diagnoses.length > 0)) {
            directUserDiagnosisCardEl.style.display = 'block';
            userDiagnosesListEl.innerHTML = diagnoses.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 특성 없음</li>';
        } else {
            directUserDiagnosisCardEl.style.display = 'none';
        }
    }

    if (userType === 'caregiver') {
        if (caregiverPersonalNDCardEl && caregiverPersonalNeurodiversityListEl) {
            caregiverPersonalNDCardEl.style.display = 'block';
            caregiverPersonalNeurodiversityListEl.innerHTML = caregiverInfo.caregiverNeurodiversity?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 사항 없음</li>';
        }
        
        if (childInfoCardEl && childNameDisplayEl && childFullAgeDisplayEl && childDiagnosesListEl) {
            childInfoCardEl.style.display = 'block';
            childNameDisplayEl.textContent = caregiverInfo.childName || '정보 없음';
            childFullAgeDisplayEl.textContent = caregiverInfo.childAge !== null ? `만 ${caregiverInfo.childAge}세` : '정보 없음';
            childDiagnosesListEl.innerHTML = caregiverInfo.childDiagnoses?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 특성 없음</li>';
        }
        
        if (emergencyAlertsSectionEl) emergencyAlertsSectionEl.style.display = 'flex';
        await displayEmergencyAlerts(loggedInUserId);
    } else {
        if (caregiverPersonalNDCardEl) caregiverPersonalNDCardEl.style.display = 'none';
        if (childInfoCardEl) childInfoCardEl.style.display = 'none';
        if (emergencyAlertsSectionEl) emergencyAlertsSectionEl.style.display = 'none';
    }

    await renderAppointmentsData(loggedInUserId, 'scheduled');
    await displayRecentJournals(loggedInUserId);

    const initialTab = localStorage.getItem('mypage_active_tab') || 'info';
    activateTab(initialTab);

    attachEditButtonListeners();
}

// ⭐ 모든 .info-card h2 옆 수정 버튼에 대한 클릭 이벤트 리스너 연결 함수 ⭐
function attachEditButtonListeners() {
    document.querySelectorAll('.info-card h2 .edit-button').forEach(button => {
        button.removeEventListener('click', handleEditButtonClick);
        button.addEventListener('click', handleEditButtonClick);
    });
}

function handleEditButtonClick(e) {
    const editTarget = e.currentTarget.dataset.editTarget;
    if (editTarget) {
        alert(`"${editTarget}" 정보 수정 팝업 (미구현)`);
    }
}


// ⭐ 탭 메뉴 활성화 함수 ⭐
function activateTab(tabId) {
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.content-section').forEach(content => { // ⭐ .tab-content -> .content-section
        content.style.display = 'none';
    });

    const activeTabItem = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
    const activeSection = document.getElementById(tabId + '-section'); // HTML 섹션 ID에 맞춤

    if (activeTabItem && activeSection) {
        activeTabItem.classList.add('active');
        activeSection.style.display = 'flex';
        localStorage.setItem('mypage_active_tab', tabId);
    }
}

// ⭐ 로지와의 약속 데이터를 로드하고 렌더링하는 함수 (필터링 포함) ⭐
async function renderAppointmentsData(userId, filterType = 'scheduled') {
    if (!appointmentsListContainerEl) return;

    appointmentsListContainerEl.innerHTML = '<p class="empty-state">로지와의 약속 정보를 불러오는 중입니다...</p>';
    if (noAppointmentsMessageEl) noAppointmentsMessageEl.style.display = 'none';

    try {
        let appointments = await getDashboardAppointmentsData(userId);

        if (!appointments || appointments.length === 0) {
            appointmentsListContainerEl.innerHTML = '';
            if (noAppointmentsMessageEl) {
                noAppointmentsMessageEl.style.display = 'block';
                noAppointmentsMessageEl.textContent = '아직 예약된 훈련이 없습니다.';
            }
            return;
        }

        // 필터링 및 정렬
        if (filterType === 'scheduled') {
            appointments.sort((a, b) => {
                const dateA = a.scheduledDate?.toDate ? a.scheduledDate.toDate().getTime() : Infinity;
                const dateB = b.scheduledDate?.toDate ? b.scheduledDate.toDate().getTime() : Infinity;
                return dateA - dateB;
            });
        } else if (filterType === 'importance') {
            appointments.sort((a, b) => (b.totalExpectedProgress || 0) - (a.totalExpectedProgress || 0));
        }

        appointmentsListContainerEl.innerHTML = '';

        appointments.forEach(appointment => {
            const card = document.createElement('div');
            card.className = 'info-card appointment-training-card';

            const scheduledDateText = appointment.scheduledDate?.toDate ? appointment.scheduledDate.toDate().toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' }) : '날짜 미정';
            const progressText = `${appointment.currentProgress || 0} / ${appointment.totalExpectedProgress || 0}`;

            let outcomeContent = '';
            if (appointment.outcome) {
                outcomeContent = `<p class="result-text">${appointment.outcome}</p>`;
            } else if (appointment.patternsDetected && appointment.patternsDetected.length > 0) {
                const patternsHtml = appointment.patternsDetected.map(p =>
                    `<p class="pattern-item"><span class="pattern-label">${p.label}</span> ${p.text}</p>`
                ).join('');
                outcomeContent = `<span class="label">감지된 패턴</span>${patternsHtml}`;
                if (appointment.todo) {
                    outcomeContent += `<div class="result-box sub-result-box"><span class="label">할 일</span><p>${appointment.todo}</p></div>`;
                }
            }


            card.innerHTML = `
                <h2>${appointment.displayText || '훈련'} <button class="edit-button" data-edit-target="appointment-${appointment.id}"></button></h2>
                <p class="detail-item"><span class="label">예정일</span> <span class="value">${scheduledDateText}</span></p>
                <p class="detail-item"><span class="label">진행률</span> <span class="value">${progressText}</span></p>
                <div class="result-box">
                    <span class="label">성과</span>
                    ${outcomeContent}
                </div>
                <button class="action-button full-width view-details-button" data-type="appointment-details" data-id="${appointment.id}">회차별 성과 상세 보기</button>
            `;
            appointmentsListContainerEl.appendChild(card);
        });

    } catch (error) {
        console.error("로지와의 약속 데이터를 불러오는 중 오류 발생:", error);
        appointmentsListContainerEl.innerHTML = '';
        if (noAppointmentsMessageEl) {
            noAppointmentsMessageEl.style.display = 'block';
            noAppointmentsMessageEl.textContent = '약속 정보를 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.';
        }
    }
}


async function displayEmergencyAlerts(userId) {
    if (!emergencyAlertsListEl) return;
    emergencyAlertsListEl.innerHTML = '<li>알림을 불러오는 중입니다...</li>';
    try {
        const alerts = await getEmergencyAlerts(userId);
        if (!alerts || alerts.length === 0) {
            emergencyAlertsListEl.innerHTML = '<li><p>확인이 필요한 알림이 없습니다. 😊</p></li>';
        } else {
            emergencyAlertsListEl.innerHTML = '';
            alerts.forEach(alertData => {
                const listItem = document.createElement('li');
                // HTML에 'alerts-section'이 있으므로 alerts-list에는 li만 추가
                listItem.className = `alert-item ${alertData.isRead ? 'read' : 'unread'}`; // CSS 클래스 추가
                const alertDate = alertData.createdAt?.toDate ? alertData.createdAt.toDate().toLocaleString('ko-KR') : '';
                listItem.innerHTML = `
                    <p class="alert-message">${alertData.message}</p>
                    <span class="alert-date">${alertDate}</span>
                `;
                listItem.onclick = () => { window.location.href = `journal.html?journalId=${alertData.journalId}`; };
                emergencyAlertsListEl.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error("긴급 알림 로드 중 오류:", error);
        emergencyAlertsListEl.innerHTML = '<li><p>알림을 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.</p></li>';
    }
}

async function displayRecentJournals(userId) {
    if (!recentJournalCardListEl) return;
    recentJournalCardListEl.innerHTML = '<p>최근 이야기 목록을 불러오는 중...</p>';
    try {
        const journals = await getRecentJournals(userId);
        if (!journals || journals.length === 0) {
            recentJournalCardListEl.innerHTML = `<p>아직 로지와 나눈 이야기가 없어요.</p>`;
        } else {
            recentJournalCardListEl.innerHTML = '';
            journals.forEach(journal => {
                const card = document.createElement('div');
                card.className = 'session-card-wide'; // mypage.css에 정의된 클래스
                card.innerHTML = `<h3>${journal.title || '제목 없는 이야기'}</h3><p>${journal.summary?.substring(0, 100) || ''}...</p>`;
                card.onclick = () => { window.location.href = `journal.html?journalId=${journal.id}`; };
                recentJournalCardListEl.appendChild(card);
            });
        }
    } catch (error) {
        console.error("최근 저널 로드 중 오류:", error);
        recentJournalCardListEl.innerHTML = '<p>이야기를 불러오는 데 실패했습니다.</p>';
    }
}


// --- 이벤트 리스너 ---
// 탭 메뉴 클릭 이벤트 (HTML에서 button.tab-item으로 변경됨)
document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        activateTab(tabId);
        // 약속 탭의 경우 필터도 초기화하고 데이터 다시 로드
        if (tabId === 'appointments') {
            if (appointmentFilterSelectEl) appointmentFilterSelectEl.value = 'scheduled';
            renderAppointmentsData(currentUser.uid, 'scheduled');
        } else if (tabId === 'journals') {
            displayRecentJournals(currentUser.uid); // 데이터 다시 로드
        } else if (tabId === 'alerts') {
            displayEmergencyAlerts(currentUser.uid); // 데이터 다시 로드
        }
    });
});


// 프로필 사진 업로드 이벤트
if (editProfilePhotoBtnEl && profileImageUploadEl) {
    editProfilePhotoBtnEl.addEventListener('click', () => {
        profileImageUploadEl.click(); // 숨겨진 input 클릭
    });

    profileImageUploadEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const loggedInUserId = currentUser ? currentUser.uid : null;
        if (!loggedInUserId) {
            alert('로그인 후 사진을 변경할 수 있습니다.');
            return;
        }

        try {
            // 로딩 스피너/메시지 표시
            if (userInitialTextEl) userInitialTextEl.textContent = '...';
            if (userInitialTextEl) userInitialTextEl.style.display = 'flex';
            if (userProfileImageEl) userProfileImageEl.style.display = 'none';
            if (editProfilePhotoBtnEl) editProfilePhotoBtnEl.disabled = true;

            const photoURL = await compressAndUploadImage(file, loggedInUserId);
            
            await db.collection('users').doc(loggedInUserId).update({ // updateProfilePhotoURL 대신 직접 Firestore 접근
                profilePhotoURL: photoURL
            });

            // UI 업데이트
            if (userProfileImageEl) userProfileImageEl.src = photoURL;
            if (userProfileImageEl) userProfileImageEl.style.display = 'block';
            if (userInitialTextEl) userInitialTextEl.style.display = 'none';
            alert('프로필 사진이 성공적으로 업데이트되었습니다!');

        } catch (error) {
            console.error("프로필 사진 업로드 또는 업데이트 오류:", error);
            alert('프로필 사진 업데이트에 실패했습니다. 다시 시도해주세요.');
            // 실패 시 원래 상태로 복구
            if (userProfileImageEl) userProfileImageEl.style.display = userProfileImageEl.src ? 'block' : 'none';
            if (userInitialTextEl) userInitialTextEl.style.display = userProfileImageEl.src ? 'none' : 'flex';
            if (userInitialTextEl) userInitialTextEl.textContent = localStorage.getItem('lozee_username')?.charAt(0).toUpperCase() || '😊';
        } finally {
            if (editProfilePhotoBtnEl) editProfilePhotoBtnEl.disabled = false;
        }
    });
}

// 필터 변경 이벤트
if (appointmentFilterSelectEl) {
    appointmentFilterSelectEl.addEventListener('change', (e) => {
        const filterType = e.target.value;
        renderAppointmentsData(currentUser.uid, filterType);
    });
}

if(goToJournalListBtnEl) goToJournalListBtnEl.onclick = () => { window.location.href = 'journal-list.html'; };
if(addChildBtnEl) addChildBtnEl.onclick = () => { alert('자녀 추가 기능 (미구현)'); }; // 임시

// 로그아웃 버튼 이벤트 (gnb.js로 이동했거나, 여기에 있으면 유지)
const logoutButtonEl = document.getElementById('logout-button');
if (logoutButtonEl) {
    logoutButtonEl.addEventListener('click', async () => {
        try {
            await auth.signOut();
            alert('로그아웃 되었습니다.');
            window.location.href = 'index.html'; // 로그인 페이지 대신 초기화면으로 이동
        } catch (error) {
            console.error("로그아웃 중 오류:", error);
            alert('로그아웃 중 오류가 발생했습니다.');
        }
    });
}

// DOM이 로드된 후 Firebase 인증 상태 확인
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        currentUser = user; // 전역 currentUser 변수 설정
        if (user) {
            console.log("사용자 로그인됨:", user.uid);
            loadPage(); // 로그인 상태일 때만 페이지 로드
        } else {
            console.log("사용자 로그아웃됨.");
            // 로그인 필요 메시지 표시
            if (document.getElementById('pageTitle')) document.getElementById('pageTitle').textContent = '로그인 필요';
            document.querySelector('.mypage-content').innerHTML = '<p style="text-align:center; padding: 50px;">로그인 후 마이페이지를 이용할 수 있습니다. <a href="index.html">로그인 페이지로 이동</a></p>';
            // 모든 DOM 요소 초기화 및 숨기기 로직 추가
        }
    });
});