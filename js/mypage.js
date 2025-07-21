import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { doc, getDoc, getDocs, collection, query, orderBy, limit, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';
import { storage } from './firebase-config.js';
import {
    getUserProfileData,
    getChildProfileData,
    getDashboardAppointmentsData,
    getRecentJournals,
    getEmergencyAlerts,
    updateProfilePhotoURL
} from './firebase-utils.js';
import { normalizeTags } from './counseling_topics.js';

// DOM 요소
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

// 현재 로그인된 사용자
let currentUser = null;

// --- 헬퍼 함수 ---
function getNeurodiversityText(code) {
    const map = {
        'ASD': '자폐 스펙트럼',
        'ADHD': 'ADHD',
        'Asperger': '아스퍼거',
        'Tic': '틱 장애',
        'LD': '학습 장애',
        'Else': '기타 어려움',
        'Unsure': '진단 없음',
        'NotApplicable': '해당 없음',
        'self_asd': '본인: ASD 성향',
        'self_adhd': '본인: ADHD 성향',
        'spouse_asd': '배우자: ASD 성향',
        'spouse_adhd': '배우자: ADHD 성향',
        'unsure_or_none': '해당 없음'
    };
    return map[code] || code;
}

function calculateDaysSinceJoin(joinDate) {
    if (!joinDate) return '정보 없음';
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDay = joinDate.toDate ? joinDate.toDate() : new Date(joinDate);
    const today = new Date();
    const diffDays = Math.round(Math.abs((today - firstDay) / oneDay));
    return diffDays;
}

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
    if (!currentUser) {
        console.error('사용자 정보 없음');
        document.querySelector('.mypage-content').innerHTML = '<p style="text-align:center; padding: 50px;">로그인 후 마이페이지를 이용할 수 있습니다. <a href="index.html">로그인 페이지로 이동</a></p>';
        return;
    }

    const loggedInUserId = currentUser.uid;
    const userData = await getUserProfileData(loggedInUserId);
    if (!userData) {
        if (userNameDisplayEl) {
            userNameDisplayEl.textContent = '사용자 정보를 찾을 수 없습니다.';
        }
        contentSections.forEach(section => section.style.display = 'none');
        showToast('사용자 정보를 불러오지 못했습니다.');
        return;
    }

    const name = userData.name || '사용자';
    const nickname = userData.nickname || name;
    const userType = userData.userType || 'directUser';
    const diagnoses = userData.diagnoses || [];
    const caregiverInfo = userData.caregiverInfo || {};
    const joinDate = userData.joinDate;

    localStorage.setItem('lozee_isDirectUser', (userType === 'directUser' || (userType === 'caregiver' && diagnoses.length > 0)).toString());
    localStorage.setItem('lozee_role', userType === 'caregiver' ? 'parent' : 'directUser');
    localStorage.setItem('lozee_childId', caregiverInfo.childId || null);
    localStorage.setItem('lozee_userAge', userData.age || '30');

    if (pageTitleEl) pageTitleEl.textContent = `${nickname}의 마이페이지`;
    if (document.getElementById('user-name')) {
        document.getElementById('user-name').textContent = '나의 정보';
    }

    if (userNicknameDisplayEl) userNicknameDisplayEl.textContent = nickname;
    if (userEmailDisplayEl) userEmailDisplayEl.textContent = userData.email || '이메일 정보 없음';
    if (userFullAgeEl) userFullAgeEl.textContent = userData.age !== null ? `만 ${userData.age}세` : '정보 없음';
    if (lastLoginDateEl) lastLoginDateEl.textContent = userData.lastLogin?.toDate().toLocaleString('ko-KR') || '기록 없음';

    if (daysSinceJoinEl && joinDate) {
        daysSinceJoinEl.textContent = calculateDaysSinceJoin(joinDate);
    } else {
        daysSinceJoinEl.textContent = '정보 없음';
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
            const childData = caregiverInfo.childId ? await getChildProfileData(caregiverInfo.childId) : {};
            childNameDisplayEl.textContent = childData.name || caregiverInfo.childName || '정보 없음';
            childFullAgeDisplayEl.textContent = childData.age !== null ? `만 ${childData.age}세` : '정보 없음';
            childDiagnosesListEl.innerHTML = childData.diagnoses?.map(d => `<li>${getNeurodiversityText(d)}</li>`).join('') || '<li>선택된 특성 없음</li>';
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
}

// --- 탭 활성화 ---
function activateTab(tabId) {
    tabMenuItems.forEach(item => item.classList.remove('active'));
    contentSections.forEach(content => content.style.display = 'none');

    const activeTabItem = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
    const activeSection = document.getElementById(tabId + '-section');

    if (activeTabItem && activeSection) {
        activeTabItem.classList.add('active');
        activeSection.style.display = 'flex';
        localStorage.setItem('mypage_active_tab', tabId);
    }
}

// --- 로지와의 약속 렌더링 ---
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
        appointments = appointments.filter(app => {
            if (filterType === 'scheduled') return app.scheduledDate;
            if (filterType === 'importance') return app.totalExpectedProgress;
            return true;
        }).sort((a, b) => {
            if (filterType === 'scheduled') {
                const dateA = a.scheduledDate?.toDate ? a.scheduledDate.toDate().getTime() : Infinity;
                const dateB = b.scheduledDate?.toDate ? b.scheduledDate.toDate().getTime() : Infinity;
                return dateA - dateB;
            } else if (filterType === 'importance') {
                return (b.totalExpectedProgress || 0) - (a.totalExpectedProgress || 0);
            }
            return 0;
        });

        appointmentsListContainerEl.innerHTML = '';

        appointments.forEach(appointment => {
            const card = document.createElement('div');
            card.className = 'info-card appointment-training-card';

            const scheduledDateText = appointment.scheduledDate?.toDate ? appointment.scheduledDate.toDate().toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' }) : '날짜 미정';
            const progressText = `${appointment.currentProgress || 0} / ${appointment.totalExpectedProgress || 0}`;
            const patterns = normalizeTags(appointment.patternsDetected || []);

            let outcomeContent = '';
            if (appointment.outcome) {
                outcomeContent = `<p class="result-text">${appointment.outcome}</p>`;
            } else if (patterns.length > 0) {
                const patternsHtml = patterns.map(p => `<p class="pattern-item"><span class="pattern-label">${p}</span></p>`).join('');
                outcomeContent = `<span class="label">감지된 패턴</span>${patternsHtml}`;
                if (appointment.todo) {
                    outcomeContent += `<div class="result-box sub-result-box"><span class="label">할 일</span><p>${appointment.todo}</p></div>`;
                }
            }

            // 신경다양성 관련 추천 메시지
            let ndRecommendation = '';
            const highRiskPatterns = ['ASD-감각과부하', 'ADHD-충동성', '소진', '카산드라신드롬'];
            if (patterns.some(p => highRiskPatterns.includes(p))) {
                ndRecommendation = `<p class="nd-recommendation">⚠️ 신경다양성 관련 주의: `;
                if (patterns.includes('ASD-감각과부하')) {
                    ndRecommendation += '감각 조절 훈련(예: 조용한 환경 제공)을 고려하세요.';
                } else if (patterns.includes('ADHD-충동성')) {
                    ndRecommendation += '충동 조절 훈련(예: 루틴 설정)을 고려하세요.';
                } else if (patterns.includes('소진') || patterns.includes('카산드라신드롬')) {
                    ndRecommendation += '전문가 상담을 추천드립니다.';
                }
                ndRecommendation += '</p>';
            }

            card.innerHTML = `
                <h2>${appointment.displayText || '훈련'} <button class="edit-button" data-edit-target="appointment-${appointment.id}"></button></h2>
                <p class="detail-item"><span class="label">예정일</span> <span class="value">${scheduledDateText}</span></p>
                <p class="detail-item"><span class="label">진행률</span> <span class="value">${progressText}</span></p>
                <div class="result-box">
                    <span class="label">성과</span>
                    ${outcomeContent}
                    ${ndRecommendation}
                </div>
                <button class="action-button full-width view-details-button" data-type="appointment-details" data-id="${appointment.id}">회차별 성과 상세 보기</button>
            `;
            card.querySelector('.view-details-button').addEventListener('click', () => {
                window.location.href = `appointment-details.html?appointmentId=${appointment.id}`;
            });
            appointmentsListContainerEl.appendChild(card);
        });
    } catch (error) {
        console.error('로지와의 약속 데이터를 불러오는 중 오류 발생:', error);
        appointmentsListContainerEl.innerHTML = '';
        if (noAppointmentsMessageEl) {
            noAppointmentsMessageEl.style.display = 'block';
            noAppointmentsMessageEl.textContent = '약속 정보를 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.';
        }
        showToast('약속 정보를 불러오는 데 실패했습니다.');
    }
}

// --- 긴급 알림 렌더링 ---
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
                const normalizedKeywords = normalizeTags(alertData.keywords || []);
                const listItem = document.createElement('li');
                listItem.className = `alert-item ${alertData.isRead ? 'read' : 'unread'}`;
                const alertDate = alertData.createdAt?.toDate ? alertData.createdAt.toDate().toLocaleString('ko-KR') : '';
                const highRiskKeywords = ['소진', '카산드라신드롬', 'ASD-감각과부하', 'ADHD-충동성'];
                const isHighRisk = normalizedKeywords.some(k => highRiskKeywords.includes(k));
                listItem.innerHTML = `
                    <p class="alert-message">${alertData.message}</p>
                    <p class="alert-keywords">키워드: ${normalizedKeywords.join(', ') || '없음'}</p>
                    <span class="alert-date">${alertDate}</span>
                    ${isHighRisk ? '<p class="nd-recommendation">⚠️ 전문가 상담을 추천드립니다.</p>' : ''}
                `;
                listItem.onclick = async () => {
                    const journalRef = doc(db, 'users', userId, 'journals', alertData.journalId);
                    const journalDoc = await getDoc(journalRef);
                    if (journalDoc.exists() && (!journalDoc.data().accessRestricted || currentUser.uid === journalDoc.data().userId)) {
                        await setDoc(doc(db, 'users', userId, 'alerts', alertData.journalId), { isRead: true }, { merge: true });
                        listItem.className = 'alert-item read';
                        window.location.href = `journal.html?journalId=${alertData.journalId}`;
                    } else {
                        showToast('이 대화는 접근이 제한되어 있습니다.');
                    }
                };
                emergencyAlertsListEl.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('긴급 알림 로드 중 오류:', error);
        emergencyAlertsListEl.innerHTML = '<li><p>알림을 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.</p></li>';
        showToast('알림을 불러오는 데 실패했습니다.');
    }
}

// --- 최근 이야기 렌더링 ---
async function displayRecentJournals(userId) {
    if (!recentJournalCardListEl) return;
    recentJournalCardListEl.innerHTML = '<p>최근 이야기 목록을 불러오는 중...</p>';
    try {
        const journals = await getRecentJournals(userId);
        if (!journals || journals.length === 0) {
            recentJournalCardListEl.innerHTML = `<p>아직 로지와 나눈 이야기가 없어요.</p>`;
        } else {
            recentJournalCardListEl.innerHTML = '';
            const groupedJournals = journals.reduce((acc, journal) => {
                const [mainTopic, subTopic] = journal.title.split(' > ').slice(0, 2);
                const key = `${mainTopic || '대화'} > ${subTopic || '기타'}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(journal);
                return acc;
            }, {});

            Object.keys(groupedJournals).forEach(key => {
                const group = groupedJournals[key];
                const groupEl = document.createElement('div');
                groupEl.className = 'journal-group';
                groupEl.innerHTML = `<h4>${key}</h4>`;
                group.forEach(journal => {
                    const normalizedTags = normalizeTags(journal.tags || []);
                    const card = document.createElement('div');
                    card.className = 'session-card-wide';
                    card.innerHTML = `
                        <h3>${journal.title || '제목 없는 이야기'}</h3>
                        <p>${journal.summary?.substring(0, 100) || ''}...</p>
                        <p class="journal-tags">태그: ${normalizedTags.join(', ') || '없음'}</p>
                    `;
                    card.onclick = async () => {
                        const journalRef = doc(db, 'users', userId, 'journals', journal.id);
                        const journalDoc = await getDoc(journalRef);
                        if (journalDoc.exists() && (!journalDoc.data().accessRestricted || currentUser.uid === journalDoc.data().userId)) {
                            window.location.href = `journal.html?journalId=${journal.id}`;
                        } else {
                            showToast('이 대화는 접근이 제한되어 있습니다.');
                        }
                    };
                    groupEl.appendChild(card);
                });
                recentJournalCardListEl.appendChild(groupEl);
            });
        }
    } catch (error) {
        console.error('최근 저널 로드 중 오류:', error);
        recentJournalCardListEl.innerHTML = '<p>이야기를 불러오는 데 실패했습니다.</p>';
        showToast('이야기를 불러오는 데 실패했습니다.');
    }
}

// --- 이벤트 리스너 ---
function attachEditButtonListeners() {
    document.querySelectorAll('.info-card h2 .edit-button').forEach(button => {
        button.removeEventListener('click', handleEditButtonClick);
        button.addEventListener('click', handleEditButtonClick);
    });
}

function handleEditButtonClick(e) {
    const editTarget = e.currentTarget.dataset.editTarget;
    if (editTarget) {
        showToast(`"${editTarget}" 정보 수정 팝업 (미구현)`);
    }
}

tabMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        activateTab(tabId);
        if (tabId === 'appointments' && currentUser) {
            if (appointmentFilterSelectEl) appointmentFilterSelectEl.value = 'scheduled';
            renderAppointmentsData(currentUser.uid, 'scheduled');
        } else if (tabId === 'journals' && currentUser) {
            displayRecentJournals(currentUser.uid);
        } else if (tabId === 'alerts' && currentUser) {
            displayEmergencyAlerts(currentUser.uid);
        }
    });
});

if (editProfilePhotoBtnEl && profileImageUploadEl) {
    editProfilePhotoBtnEl.addEventListener('click', () => {
        profileImageUploadEl.click();
    });

    profileImageUploadEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!currentUser) {
            showToast('로그인 후 사진을 변경할 수 있습니다.');
            return;
        }

        try {
            if (userInitialTextEl) userInitialTextEl.textContent = '...';
            if (userInitialTextEl) userInitialTextEl.style.display = 'flex';
            if (userProfileImageEl) userProfileImageEl.style.display = 'none';
            if (editProfilePhotoBtnEl) editProfilePhotoBtnEl.disabled = true;

            const photoURL = await compressAndUploadImage(file, currentUser.uid);
            await updateProfilePhotoURL(currentUser.uid, photoURL);

            if (userProfileImageEl) userProfileImageEl.src = photoURL;
            if (userProfileImageEl) userProfileImageEl.style.display = 'block';
            if (userInitialTextEl) userInitialTextEl.style.display = 'none';
            showToast('프로필 사진이 성공적으로 업데이트되었습니다!');
        } catch (error) {
            console.error('프로필 사진 업로드 또는 업데이트 오류:', error);
            showToast('프로필 사진 업데이트에 실패했습니다.');
            if (userProfileImageEl) userProfileImageEl.style.display = userProfileImageEl.src ? 'block' : 'none';
            if (userInitialTextEl) userInitialTextEl.style.display = userProfileImageEl.src ? 'none' : 'flex';
            if (userInitialTextEl) userInitialTextEl.textContent = localStorage.getItem('lozee_username')?.charAt(0).toUpperCase() || '😊';
        } finally {
            if (editProfilePhotoBtnEl) editProfilePhotoBtnEl.disabled = false;
        }
    });
}

if (appointmentFilterSelectEl) {
    appointmentFilterSelectEl.addEventListener('change', (e) => {
        if (currentUser) {
            renderAppointmentsData(currentUser.uid, e.target.value);
        }
    });
}

if (goToJournalListBtnEl) {
    goToJournalListBtnEl.onclick = () => {
        window.location.href = 'journal-list.html';
    };
}

if (addChildBtnEl) {
    addChildBtnEl.onclick = () => {
        showToast('자녀 추가 기능 (미구현)');
    };
}

const logoutButtonEl = document.getElementById('logout-button');
if (logoutButtonEl) {
    logoutButtonEl.addEventListener('click', async () => {
        try {
            await auth.signOut();
            showToast('로그아웃 되었습니다.');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('로그아웃 중 오류:', error);
            showToast('로그아웃 중 오류가 발생했습니다.');
        }
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        padding: '12px 18px',
        borderRadius: '10px',
        zIndex: '9999',
        fontSize: '14px'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.querySelectorAll('[data-disabled-soon]').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        showToast('🚧 곧 구현될 예정입니다. 조금만 기다려주세요!');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            console.log('사용자 로그인됨:', user.uid);
            loadPage();
        } else {
            console.log('사용자 로그아웃됨.');
            if (document.getElementById('pageTitle')) document.getElementById('pageTitle').textContent = '로그인 필요';
            document.querySelector('.mypage-content').innerHTML = '<p style="text-align:center; padding: 50px;">로그인 후 마이페이지를 이용할 수 있습니다. <a href="index.html">로그인 페이지로 이동</a></p>';
        }
    });
});