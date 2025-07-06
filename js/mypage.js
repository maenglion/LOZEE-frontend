// mypage.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import {
    getUserProfileData,
    getChildProfileData,
    getDashboardAppointmentsData,
    getRecentJournals,
    getEmergencyAlerts
} from './firebase-utils.js'; // firebase-utils.js에서 필요한 함수들을 가져옴

let currentUser = null;

// DOMContentLoaded 이벤트 리스너: HTML 문서가 완전히 로드되고 파싱된 후 실행
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("사용자 로그인됨:", currentUser.uid);
            await loadUserProfile();
            await loadDashboardData();
            await loadRecentJournals();
            await loadEmergencyAlerts();
            updateConnectionDays(user); // ⭐ 추가: 가입일 계산 및 표시 함수 호출
        } else {
            currentUser = null;
            console.log("사용자 로그아웃됨.");
            // 로그인 페이지로 리다이렉트 또는 UI 업데이트
            window.location.href = 'login.html'; // 예시: 로그인 페이지로 이동
        }
    });

    // 탭 클릭 이벤트 리스너
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const tabId = event.target.dataset.tab;
            openTab(tabId);
        });
    });

    // 초기 탭 설정 (기본은 'my-info' 탭)
    openTab('my-info');
});

// ⭐ 함수 추가: 가입일 계산 및 표시
function updateConnectionDays(user) {
    if (user && user.metadata && user.metadata.creationTime) {
        const creationDate = new Date(user.metadata.creationTime);
        const today = new Date();
        const diffTime = Math.abs(today - creationDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 밀리초를 일로 변환

        const connectionDaysElement = document.getElementById('connection-days');
        if (connectionDaysElement) {
            connectionDaysElement.textContent = diffDays;
        }
    } else {
        console.warn("사용자 가입일 정보를 찾을 수 없습니다.");
    }
}

async function loadUserProfile() {
    if (!currentUser) return;
    const profileData = await getUserProfileData(currentUser.uid);
    if (profileData) {
        document.getElementById('user-name').textContent = profileData.displayName || '사용자';
        document.getElementById('user-email').textContent = profileData.email || '이메일 없음';
        // 프로필 사진 업데이트 (Storage에서 URL 가져와서 설정)
        const profilePhotoElement = document.getElementById('profile-photo');
        if (profileData.profilePhotoURL) {
            profilePhotoElement.src = profileData.profilePhotoURL;
        } else {
            profilePhotoElement.src = 'https://via.placeholder.com/100'; // 기본 이미지
        }

        // 자녀 정보 (보호자 계정일 경우)
        if (profileData.role === 'parent' && profileData.childId) {
            const childData = await getChildProfileData(currentUser.uid, profileData.childId);
            if (childData) {
                document.getElementById('child-name').textContent = childData.name || '자녀';
                document.getElementById('child-age').textContent = childData.age ? `${childData.age}세` : '';
                document.getElementById('child-traits').textContent = childData.traits ? `(${childData.traits})` : '';
                document.getElementById('child-info-section').style.display = 'block'; // 자녀 정보 섹션 보이기
            }
        } else {
            document.getElementById('child-info-section').style.display = 'none'; // 자녀 정보 섹션 숨기기
        }
    }
}

async function loadDashboardData() {
    if (!currentUser) return;
    const appointments = await getDashboardAppointmentsData(currentUser.uid);
    const appointmentsList = document.getElementById('appointments-list');
    appointmentsList.innerHTML = ''; // 기존 내용 지우기

    if (appointments && appointments.length > 0) {
        appointments.forEach(appointment => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="appointment-header">
                    <h3>${appointment.displayText || '훈련'}</h3>
                    ${appointment.isNew ? '<span class="new-badge">NEW</span>' : ''}
                </div>
                <p class="appointment-date">예정일: ${appointment.scheduledDate ? new Date(appointment.scheduledDate.toDate()).toLocaleDateString() : '미정'}</p>
                ${appointment.currentProgress !== undefined && appointment.totalExpectedProgress !== undefined ?
                    `<div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${(appointment.currentProgress / appointment.totalExpectedProgress) * 100 || 0}%;"></div>
                    </div>
                    <p class="progress-text">${appointment.currentProgress}/${appointment.totalExpectedProgress} 진행</p>` : ''
                }
                <p class="appointment-outcome">${appointment.outcome || ''}</p>
                ${appointment.patternsDetected && appointment.patternsDetected.length > 0 ?
                    `<div class="patterns-detected">
                        <h4>감지된 패턴:</h4>
                        ${appointment.patternsDetected.map(p => `<p><strong>${p.label}:</strong> ${p.text}</p>`).join('')}
                    </div>` : ''
                }
                ${appointment.todo ? `<p class="appointment-todo">할 일: ${appointment.todo}</p>` : ''}
            `;
            appointmentsList.appendChild(li);
        });
    } else {
        appointmentsList.innerHTML = '<p>예정된 훈련이 없습니다.</p>';
    }
}

async function loadRecentJournals() {
    if (!currentUser) return;
    const journals = await getRecentJournals(currentUser.uid, 5); // 최근 5개 저널 로드
    const journalsList = document.getElementById('journals-list');
    journalsList.innerHTML = '';

    if (journals && journals.length > 0) {
        journals.forEach(journal => {
            const li = document.createElement('li');
            li.innerHTML = `
                <h3>${journal.title || journal.topic || '제목 없음'}</h3>
                <p class="journal-date">${journal.createdAt ? new Date(journal.createdAt.toDate()).toLocaleDateString() : '날짜 미정'}</p>
                <p>${journal.summary || '내용 없음'}</p>
                <div class="journal-tags">
                    ${(journal.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;
            journalsList.appendChild(li);
        });
    } else {
        journalsList.innerHTML = '<p>최근 이야기가 없습니다.</p>';
    }
}

async function loadEmergencyAlerts() {
    if (!currentUser) return;
    const alerts = await getEmergencyAlerts(currentUser.uid, 3); // 최근 3개 알림 로드
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';

    if (alerts && alerts.length > 0) {
        alerts.forEach(alert => {
            const li = document.createElement('li');
            li.className = alert.isRead ? 'read' : 'unread';
            li.innerHTML = `
                <p class="alert-message">${alert.message}</p>
                <span class="alert-date">${alert.createdAt ? new Date(alert.createdAt.toDate()).toLocaleString() : '날짜 미정'}</span>
            `;
            alertsList.appendChild(li);
        });
    } else {
        alertsList.innerHTML = '<p>새로운 위험 알림이 없습니다.</p>';
    }
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
}

// 로그아웃 기능 (필요시 추가)
document.getElementById('logout-button').addEventListener('click', async () => {
    try {
        await auth.signOut();
        alert('로그아웃 되었습니다.');
        window.location.href = 'login.html'; // 로그인 페이지로 리다이렉트
    } catch (error) {
        console.error("로그아웃 중 오류:", error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
});