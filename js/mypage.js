// js/mypage.js

import { db, storage } from './firebase-config.js';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';
// firebase-utils에서 필요한 함수들을 import
import {
    getUserProfileData,
    getChildProfileData,
    getDashboardAppointmentsData,
    getRecentJournals,
    getEmergencyAlerts,
    updateProfilePhotoURL,
    updateUserInfo // 사용자 정보 업데이트 함수 (예시)
} from './firebase-utils.js';

// --- DOM 요소 ---
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
const userNicknameDisplayEl = document.getElementById('userNicknameDisplay'); // ⭐ 이 요소가 mypage.html에 있어야 합니다.
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
                const MAX_SIZE = 150; // 최대 가로/세로 150px
                let width = img.width;
                let height = img.height;

                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(async (blob) => {
                    const storageRef = ref(storage, `profile_photos/${userId}/${Date.now()}_${file.name}`);
                    try {
                        await uploadBytes(storageRef, blob);
                        const downloadURL = await getDownloadURL(storageRef);
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }, 'image/jpeg', 0.8); // JPEG 형식으로 압축, 퀄리티 80%
            };
        };
        reader.readAsDataURL(file);
    });
}


// --- 데이터 로드 및 렌더링 ---
async function loadPage() {
    const loggedInUserId = localStorage.getItem('lozee_userId');
    if (!loggedInUserId) {
        userNameDisplayEl.textContent = '로그인이 필요합니다.';
        // 모든 섹션 숨김 처리
        contentSections.forEach(section => section.style.display = 'none');
        return;
    }

    // 사용자 프로필 데이터 로드
    const userData = await getUserProfileData(loggedInUserId);
    if (!userData) {
        userNameDisplayEl.textContent = '사용자 정보를 찾을 수 없습니다.';
        contentSections.forEach(section => section.style.display = 'none');
        return;
    }

    const name = userData.name || '사용자';
    const nickname = userData.nickname || name;
    const userType = userData.userType;
    const joinDate = userData.joinDate;

    pageTitleEl.textContent = `${nickname}의 마이페이지`;
    userNameDisplayEl.innerHTML = `나의 정보 <button class="edit-button" data-edit-target="userInfo"></button>`;
    userNicknameDisplayEl.textContent = nickname;
    userEmailDisplayEl.textContent = userData.email || '이메일 정보 없음';
    userFullAgeEl.textContent = userData.age !== null ? `만 ${userData.age}세` : '정보 없음';
    lastLoginDateEl.textContent = userData.lastLogin?.toDate().toLocaleString('ko-KR') || '기록 없음';

    if (joinDate) {
        daysSinceJoinEl.textContent = calculateDaysSinceJoin(joinDate);
    }

    // 프로필 사진 로드 및 표시
    if (userData.profilePhotoURL) {
        userProfileImageEl.src = userData.profilePhotoURL;
        userProfileImageEl.style.display = 'block';
        userInitialTextEl.style.display = 'none';
    } else {
        userProfileImageEl.style.display = 'none';
        userInitialTextEl.style.display = 'flex';
        userInitialTextEl.textContent = name.charAt(0).toUpperCase() || '😊';
    }

    userTypeInfoCardEl.style.display = 'block';
    userTypeDisplayEl.textContent = userType === 'directUser' ? '당사자' : '보호자';
    userTypeDisplayEl.parentNode.innerHTML += ` <button class="edit-button" data-edit-target="userType"></button>`;

    // 특성 및 자녀 정보
    if (userType === 'directUser') {
        directUserDiagnosisCardEl.style.display = 'block';
        userDiagnosesListEl.innerHTML = userData.diagnoses?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 특성 없음</li>';
    } else if (userType === 'caregiver') {
        caregiverPersonalNDCardEl.style.display = 'block';
        childInfoCardEl.style.display = 'block';
        const caregiverInfo = userData.caregiverInfo || {};
        caregiverPersonalNeurodiversityListEl.innerHTML = caregiverInfo.caregiverNeurodiversity?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 사항 없음</li>';
        childNameDisplayEl.textContent = caregiverInfo.childName || '정보 없음';
        childFullAgeDisplayEl.textContent = caregiverInfo.childAge !== null ? `만 ${caregiverInfo.childAge}세` : '정보 없음';
        childDiagnosesListEl.innerHTML = caregiverInfo.childDiagnoses?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 특성 없음</li>';
        
        // 자녀 추가 버튼 활성화 (HTML에 data-edit-target="childInfo" 추가)
        addChildBtnEl.onclick = () => { /* 자녀 추가 로직 */ alert('자녀 추가 기능 (미구현)'); };
        childInfoCardEl.querySelector('h2').innerHTML += ` <button class="edit-button" data-edit-target="childInfo"></button>`;
    }

    // ⭐ 로지와의 약속, 최근 이야기, 위험 알림 데이터 로드 (탭 전환 시에도 호출) ⭐
    renderAppointmentsData(loggedInUserId, 'scheduled'); // 초기 로지와의 약속 데이터 (일정순)
    displayRecentJournals(loggedInUserId); // 최근 이야기
    displayEmergencyAlerts(loggedInUserId); // 위험 알림

    // ⭐ 탭 메뉴 활성화 ⭐
    const initialTab = localStorage.getItem('mypage_active_tab') || 'info';
    activateTab(initialTab);
}

// ⭐ 탭 메뉴 활성화 함수 ⭐
function activateTab(tabId) {
    tabMenuItems.forEach(item => {
        item.classList.remove('active');
        const targetSectionId = item.getAttribute('data-tab') + '-section';
        document.getElementById(targetSectionId).style.display = 'none';
    });

    const activeTabItem = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
    const activeSection = document.getElementById(tabId + '-section');

    if (activeTabItem && activeSection) {
        activeTabItem.classList.add('active');
        activeSection.style.display = 'flex'; // section은 flex 컨테이너
        localStorage.setItem('mypage_active_tab', tabId);
    }
}

// ⭐ 로지와의 약속 데이터를 로드하고 렌더링하는 함수 (필터링 포함) ⭐
async function renderAppointmentsData(userId, filterType = 'scheduled') {
    appointmentsListContainerEl.innerHTML = '<p class="empty-state">로지와의 약속 정보를 불러오는 중입니다...</p>';
    noAppointmentsMessageEl.style.display = 'none';

    try {
        let appointments = await getDashboardAppointmentsData(userId); // firebase-utils에서 데이터 가져옴

        if (!appointments || appointments.length === 0) {
            appointmentsListContainerEl.innerHTML = '';
            noAppointmentsMessageEl.style.display = 'block';
            noAppointmentsMessageEl.textContent = '아직 예약된 훈련이 없습니다.';
            return;
        }

        // 필터링 및 정렬 (JS에서 처리)
        if (filterType === 'scheduled') {
            appointments.sort((a, b) => {
                const dateA = a.scheduledDate?.toDate ? a.scheduledDate.toDate().getTime() : Infinity;
                const dateB = b.scheduledDate?.toDate ? b.scheduledDate.toDate().getTime() : Infinity;
                return dateA - dateB;
            });
        } else if (filterType === 'importance') {
            // 중요도(회차 많이 잡힌 순) 정렬 로직 (Firestore 데이터에 importance 필드 필요)
            appointments.sort((a, b) => (b.totalExpectedProgress || 0) - (a.totalExpectedProgress || 0));
        }

        appointmentsListContainerEl.innerHTML = ''; // 기존 내용 초기화

        appointments.forEach(appointment => {
            const card = document.createElement('div');
            card.className = 'info-card appointment-training-card';

            const scheduledDateText = appointment.scheduledDate?.toDate ? appointment.scheduledDate.toDate().toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' }) : '날짜 미정';
            const progressText = `${appointment.currentProgress || 0} / ${appointment.totalExpectedProgress || 0}`;

            let resultContent = `<p class="result-text">${appointment.outcome || '성과 내용 없음'}</p>`;
            if (appointment.patternsDetected && appointment.patternsDetected.length > 0) {
                const patternsHtml = appointment.patternsDetected.map(p =>
                    `<p class="pattern-item"><span class="pattern-label">${p.label}</span> ${p.text}</p>`
                ).join('');
                resultContent = `<span class="label">감지된 패턴</span>${patternsHtml}`;
                if (appointment.todo) {
                    resultContent += `<div class="result-box"><span class="label">할 일</span><p>${appointment.todo}</p></div>`;
                }
            }

            card.innerHTML = `
                <h2>${appointment.displayText || '훈련'} <button class="edit-button" data-edit-target="${appointment.id}"></button></h2>
                <p class="detail-item"><span class="label">예정일</span> <span class="value">${scheduledDateText}</span></p>
                <p class="detail-item"><span class="label">진행률</span> <span class="value">${progressText}</span></p>
                <div class="result-box">
                    <span class="label">성과</span>
                    ${resultContent}
                </div>
                <button class="action-button full-width view-details-button" data-type="${appointment.id}">회차별 성과 상세 보기</button>
            `;
            appointmentsListContainerEl.appendChild(card);
        });

    } catch (error) {
        console.error("로지와의 약속 데이터를 불러오는 중 오류 발생:", error);
        appointmentsListContainerEl.innerHTML = '';
        noAppointmentsMessageEl.style.display = 'block';
        noAppointmentsMessageEl.textContent = '약속 정보를 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.';
    }
}


async function displayEmergencyAlerts(userId) {
    emergencyAlertsListEl.innerHTML = '<li>알림을 불러오는 중입니다...</li>';
    try {
        const alerts = await getEmergencyAlerts(userId); // firebase-utils에서 가져옴
        if (!alerts || alerts.length === 0) {
            emergencyAlertsListEl.innerHTML = '<li><p>응급상황이 발생하지 않았어요. 😊</p></li>';
        } else {
            emergencyAlertsListEl.innerHTML = '';
            alerts.forEach(alertData => {
                const listItem = document.createElement('li');
                const alertDate = alertData.createdAt?.toDate ? alertData.createdAt.toDate().toLocaleString('ko-KR') : '';
                listItem.innerHTML = `<strong>[${alertData.childName || '아이'}] ${alertData.message}</strong><span class="alert-date">${alertDate}</span>`;
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
    recentJournalCardListEl.innerHTML = '<p>최근 이야기 목록을 불러오는 중...</p>';
    try {
        const journals = await getRecentJournals(userId); // firebase-utils에서 가져옴
        if (!journals || journals.length === 0) {
            recentJournalCardListEl.innerHTML = `<p>아직 로지와 나눈 이야기가 없어요.</p>`;
        } else {
            recentJournalCardListEl.innerHTML = '';
            journals.forEach(journal => {
                const card = document.createElement('div');
                card.className = 'session-card-wide';
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
// 탭 메뉴 클릭 이벤트
tabMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        activateTab(tabId);
        // 약속 탭의 경우 필터도 초기화
        if (tabId === 'appointments') {
            appointmentFilterSelectEl.value = 'scheduled';
            renderAppointmentsData(localStorage.getItem('lozee_userId'), 'scheduled');
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

        const loggedInUserId = localStorage.getItem('lozee_userId');
        if (!loggedInUserId) {
            alert('로그인 후 사진을 변경할 수 있습니다.');
            return;
        }

        try {
            // 로딩 스피너/메시지 표시
            userInitialTextEl.textContent = '...';
            userInitialTextEl.style.display = 'flex';
            userProfileImageEl.style.display = 'none';
            editProfilePhotoBtnEl.disabled = true;

            const photoURL = await compressAndUploadImage(file, loggedInUserId);
            
            // Firestore 사용자 문서 업데이트 (프로필 사진 URL 저장)
            await updateProfilePhotoURL(loggedInUserId, photoURL); // firebase-utils 함수 사용

            // UI 업데이트
            userProfileImageEl.src = photoURL;
            userProfileImageEl.style.display = 'block';
            userInitialTextEl.style.display = 'none';
            alert('프로필 사진이 성공적으로 업데이트되었습니다!');

        } catch (error) {
            console.error("프로필 사진 업로드 또는 업데이트 오류:", error);
            alert('프로필 사진 업데이트에 실패했습니다. 다시 시도해주세요.');
            // 실패 시 원래 상태로 복구
            userProfileImageEl.style.display = userProfileImageEl.src ? 'block' : 'none';
            userInitialTextEl.style.display = userProfileImageEl.src ? 'none' : 'flex';
            userInitialTextEl.textContent = localStorage.getItem('lozee_username')?.charAt(0).toUpperCase() || '😊';
        } finally {
            editProfilePhotoBtnEl.disabled = false;
        }
    });
}

// 필터 변경 이벤트
if (appointmentFilterSelectEl) {
    appointmentFilterSelectEl.addEventListener('change', (e) => {
        const filterType = e.target.value;
        renderAppointmentsData(localStorage.getItem('lozee_userId'), filterType);
    });
}

if(goToJournalListBtnEl) goToJournalListBtnEl.onclick = () => { window.location.href = 'journal-list.html'; };
if(addChildBtnEl) addChildBtnEl.onclick = () => { alert('자녀 추가 기능 (미구현)'); }; // 임시


// ⭐ 모든 .info-card h2 옆 수정 버튼에 대한 클릭 이벤트 (예시) ⭐
allEditButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const editTarget = e.target.dataset.editTarget;
        if (editTarget) {
            alert(`"${editTarget}" 정보 수정 팝업 (미구현)`);
            // 여기에 실제 정보 수정 팝업을 띄우는 로직 구현
        }
    });
});


document.addEventListener('DOMContentLoaded', loadPage);