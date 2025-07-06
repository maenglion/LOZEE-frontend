// js/mypage.js

import { db, storage } from './firebase-config.js'; // storage 모듈 추가
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

// --- DOM 요소 ---
const pageTitleEl = document.querySelector('title');
const tabMenuItems = document.querySelectorAll('.tab-item');
const contentSections = document.querySelectorAll('.content-section');

const userPhotoPlaceholderEl = document.getElementById('userPhotoPlaceholder');
const userProfileImageEl = document.getElementById('userProfileImage'); // img 태그
const userInitialTextEl = document.getElementById('userInitialText'); // 이니셜 텍스트
const profileImageUploadEl = document.getElementById('profileImageUpload'); // 파일 인풋
const editProfilePhotoBtnEl = document.getElementById('editProfilePhotoBtn'); // 사진 변경 버튼
const daysSinceJoinEl = document.getElementById('daysSinceJoin');

const userNameDisplayEl = document.getElementById('userNameDisplay');
const userNicknameDisplayEl = document.getElementById('userNicknameDisplay'); // 닉네임 추가
const userEmailDisplayEl = document.getElementById('userEmailDisplay');
const userFullAgeEl = document.getElementById('userFullAge');
const lastLoginDateEl = document.getElementById('lastLoginDate');

const userTypeInfoCardEl = document.getElementById('userTypeInfoCard'); // 가입 구분 카드
const userTypeDisplayEl = document.getElementById('userTypeDisplay'); // 가입 구분 텍스트

const directUserDiagnosisCardEl = document.getElementById('directUserDiagnosisCard');
const userDiagnosesListEl = document.getElementById('userDiagnosesList');
const caregiverPersonalNDCardEl = document.getElementById('caregiverPersonalNDCard');
const caregiverPersonalNeurodiversityListEl = document.getElementById('caregiverPersonalNeurodiversityList');
const childInfoCardEl = document.getElementById('childInfoCard');
const childNameDisplayEl = document.getElementById('childNameDisplay');
const childFullAgeDisplayEl = document.getElementById('childFullAgeDisplay');
const childDiagnosesListEl = document.getElementById('childDiagnosesList');
const addChildBtnEl = document.getElementById('addChildBtn');

const appointmentsListEl = document.getElementById('appointments-list'); // 스몰 토크 등 컨테이너

const emergencyAlertsSectionEl = document.getElementById('emergencyAlertsSection');
const emergencyAlertsListEl = document.getElementById('emergencyAlertsList');

const recentJournalCardListEl = document.getElementById('recentJournalCardList');
const goToJournalListBtnEl = document.getElementById('goToJournalListBtn');

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
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const firstDay = joinDate.toDate(); // Firebase Timestamp를 Date 객체로 변환
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
                const MAX_WIDTH = 200; // 최대 너비
                const MAX_HEIGHT = 200; // 최대 높이
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
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
        return;
    }

    const userRef = doc(db, 'users', loggedInUserId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        userNameDisplayEl.textContent = '사용자 정보를 찾을 수 없습니다.';
        return;
    }

    const userData = userSnap.data();
    const name = userData.name || '사용자';
    const nickname = userData.nickname || name; // 닉네임 필드 추가
    const userType = userData.userType;
    const joinDate = userData.joinDate; // 가입일 필드

    pageTitleEl.textContent = `${nickname}의 마이페이지`;
    userNameDisplayEl.innerHTML = `${name} <button class="edit-button">수정</button>`;
    userNicknameDisplayEl.textContent = nickname; // 닉네임 표시
    userEmailDisplayEl.textContent = userData.email || '이메일 정보 없음';
    userFullAgeEl.textContent = userData.age !== null ? `만 ${userData.age}세` : '정보 없음';
    lastLoginDateEl.textContent = userData.lastLogin?.toDate().toLocaleString('ko-KR') || '기록 없음';

    if (joinDate) {
        daysSinceJoinEl.textContent = calculateDaysSinceJoin(joinDate);
    }

    // 프로필 사진 로드
    if (userData.profilePhotoURL) {
        userProfileImageEl.src = userData.profilePhotoURL;
        userProfileImageEl.style.display = 'block';
        userInitialTextEl.style.display = 'none';
    } else {
        userProfileImageEl.style.display = 'none';
        userInitialTextEl.style.display = 'flex'; // 이니셜 보이도록
        userInitialTextEl.textContent = name.charAt(0).toUpperCase() || '😊';
    }

    // 가입 구분 표시
    userTypeInfoCardEl.style.display = 'block';
    userTypeDisplayEl.textContent = userType === 'directUser' ? '당사자' : '보호자';
    userTypeDisplayEl.parentNode.innerHTML += ` <button class="edit-button">수정</button>`; // 수정 버튼 추가

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
        displayEmergencyAlerts(loggedInUserId, caregiverInfo.childName || '아이');
    }

    displayRecentJournals(loggedInUserId, userType);
    await loadAndRenderAppointments(loggedInUserId); // 로지와의 약속 데이터 로드

    // ⭐ 탭 메뉴 활성화 ⭐
    const initialTab = localStorage.getItem('mypage_active_tab') || 'info';
    activateTab(initialTab);
}

// ⭐ 로지와의 약속 데이터를 로드하고 렌더링하는 함수 (appointments-list 대신 실제 데이터 매핑) ⭐
async function loadAndRenderAppointments(userId) {
    // 실제 데이터는 Firestore에서 가져와야 하지만, 이미지에 맞춰 더미 데이터로 먼저 구성
    const appointmentsData = [
        {
            type: "스몰 토크",
            date: "2025.07.01. 오후 03:15",
            progress: "3 / 20",
            result: "상대방에게 너무 많은 정보를 한번에 쏟아내게 되면, 상대는 대화의 흐름을 파악하기 어려워. 우리 조금 더 연습해보자."
        },
        {
            type: "관계 감정 살펴보기",
            date: "2025.07.05. 오후 03:15",
            progress: "5 / 10",
            result: "지금 너는 엄마의 행동에 대한 패턴이 파악되면 서 엄마를 거부하고 있어. 엄마와 관련된 너의 감정 단어들을 보면 ..."
        },
        {
            type: "인지 왜곡 살펴보기",
            date: "2025.07.06. 오후 09:30",
            progress: "0 / 6",
            result: {
                patterns: [
                    { label: "과장된 오류", text: `"나는 아이를 위해 이토록 노력하는데, 왜 나는 늘 손해를 보며, 사람들은 나를 이해해주지 않지? 결국? 이건 너무 불공평해."` },
                    { label: "흑백논리", text: `"그렇게 애를 키웠는데도 안되니 우리 아이의 사회성은 완전히 망가진 거나 다름 없어. 희망이 없어."` }
                ],
                todo: "우리는 이 생각들을 다른 각도에서 생각해 보는 연습을 할거야."
            }
        }
    ];

    const smallTalkCard = document.querySelector('#rosie-appointments-section .appointment-category-card:nth-child(2)');
    const relationEmotionCard = document.querySelector('#rosie-appointments-section .appointment-category-card:nth-child(3)');
    const cognitiveDistortionCard = document.querySelector('#rosie-appointments-section .cognitive-distortion-card');

    if (appointmentsData[0]) { // 스몰 토크
        smallTalkCard.querySelector('#smallTalkDate').textContent = appointmentsData[0].date;
        smallTalkCard.querySelector('#smallTalkProgress').textContent = appointmentsData[0].progress;
        smallTalkCard.querySelector('#smallTalkResult').textContent = appointmentsData[0].result;
    } else { smallTalkCard.style.display = 'none'; }
    
    if (appointmentsData[1]) { // 관계 감정
        relationEmotionCard.querySelector('#relationEmotionDate').textContent = appointmentsData[1].date;
        relationEmotionCard.querySelector('#relationEmotionProgress').textContent = appointmentsData[1].progress;
        relationEmotionCard.querySelector('#relationEmotionResult').textContent = appointmentsData[1].result;
    } else { relationEmotionCard.style.display = 'none'; }

    if (appointmentsData[2]) { // 인지 왜곡
        if (appointmentsData[2].result.patterns) {
            const patternsHtml = appointmentsData[2].result.patterns.map(p => 
                `<p class="pattern-item"><span class="pattern-label">${p.label}</span> ${p.text}</p>`
            ).join('');
            cognitiveDistortionCard.querySelector('.result-box:nth-of-type(1)').innerHTML = `<span class="label">감지된 패턴</span>${patternsHtml}`;
        }
        cognitiveDistortionCard.querySelector('#cognitiveDistortionTodo').textContent = appointmentsData[2].result.todo;
        cognitiveDistortionCard.querySelector('#cognitiveDistortionDate').textContent = appointmentsData[2].date;
        cognitiveDistortionCard.querySelector('#cognitiveDistortionProgress').textContent = appointmentsData[2].progress;
    } else { cognitiveDistortionCard.style.display = 'none'; }

    // 실제 Firestore 예약 데이터 로드 (필요시 아래 주석 해제 후 구현)
    /*
    try {
        const q = query(
            collection(db, 'users', userId, 'reservations'),
            orderBy('createdAt', 'desc') // 실제 생성일 기준으로 정렬
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            // 예약이 없으면 각 카드 숨기기 또는 "예약 없음" 메시지 표시
        } else {
            snap.docs.forEach(doc => {
                const reservation = doc.data();
                // reservation 데이터에 따라 각 스몰 토크, 관계 감정, 인지 왜곡 카드 업데이트
                // 이는 예약 데이터 구조와 각 섹션의 매핑 로직에 따라 복잡해질 수 있습니다.
            });
        }
    } catch (error) {
        console.error("예약 정보를 불러오는 중 오류 발생:", error);
    }
    */
}


async function displayEmergencyAlerts(parentId, childName) {
    emergencyAlertsSectionEl.style.display = 'block';
    emergencyAlertsListEl.innerHTML = '<li>알림을 불러오는 중입니다...</li>';
    try {
        const q = query(collection(db, "notifications"), where("parentId", "==", parentId), orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            emergencyAlertsListEl.innerHTML = '<li><p>응급상황이 발생하지 않았어요. 😊</p></li>';
        } else {
            emergencyAlertsListEl.innerHTML = '';
            querySnapshot.forEach(docSnap => {
                const alertData = docSnap.data();
                const listItem = document.createElement('li');
                const alertDate = alertData.createdAt?.toDate ? alertData.createdAt.toDate().toLocaleString('ko-KR') : '';
                listItem.innerHTML = `<strong>[${childName}] ${alertData.message}</strong><span class="alert-date">${alertDate}</span>`;
                listItem.onclick = () => { window.location.href = `journal.html?journalId=${alertData.journalId}`; };
                emergencyAlertsListEl.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error("긴급 알림 로드 중 오류:", error);
        emergencyAlertsListEl.innerHTML = '<li><p>알림을 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.</p></li>';
    }
}

async function displayRecentJournals(userId, userType) {
    recentJournalCardListEl.innerHTML = '<p>최근 이야기 목록을 불러오는 중...</p>';
    try {
        let q = query(collection(db, 'journals'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(3));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            recentJournalCardListEl.innerHTML = `<p>아직 로지와 나눈 이야기가 없어요.</p>`;
        } else {
            recentJournalCardListEl.innerHTML = '';
            querySnapshot.forEach(docSnap => {
                const journal = docSnap.data();
                const card = document.createElement('div');
                card.className = 'session-card-wide';
                card.innerHTML = `<h3>${journal.title || '제목 없는 이야기'}</h3><p>${journal.summary?.substring(0, 100) || ''}...</p>`;
                card.onclick = () => { window.location.href = `journal.html?journalId=${docSnap.id}`; };
                recentJournalCardListEl.appendChild(card);
            });
        }
    } catch (error) {
        console.error("최근 저널 로드 중 오류:", error);
        recentJournalCardListEl.innerHTML = '<p>이야기를 불러오는 데 실패했습니다.</p>';
    }
}

// ⭐ 탭 메뉴 기능 ⭐
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

tabMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = e.target.getAttribute('data-tab');
        activateTab(tabId);
    });
});

// ⭐ 프로필 사진 업로드 이벤트 리스너 ⭐
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
            await db.collection('users').doc(loggedInUserId).update({
                profilePhotoURL: photoURL
            });

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


if(goToJournalListBtnEl) goToJournalListBtnEl.onclick = () => { window.location.href = 'journal-list.html'; };

if(addChildBtnEl) addChildBtnEl.onclick = () => { /* 자녀 추가 로직 */ alert('자녀 추가 기능'); }; // 임시

document.addEventListener('DOMContentLoaded', loadPage);