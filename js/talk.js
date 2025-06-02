// js/talk.js

import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js'; // collection, addDoc은 firebase-utils.js에서 사용
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './lozee-analysis.js';
import {
  saveJournalEntry,
  // saveManualJournalEntry, // 필요시 주석 해제
  updateTopicStats,
  updateUserOverallStats,
  logSessionStart,
  logSessionEnd,
  getOrCreateUserId // UID 생성/가져오기 함수 import
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';


// --- 상태 변수 ---
let skipTTS = false,
    hasGreeted = false,
    isProcessing = false;
let chatHistory = [],
    selectedMain = null, // 선택된 주 대화 주제 (counseling_topics.js의 카테고리명)
    selectedSubTopicDetails = null; // 선택된 서브 토픽의 전체 객체 ({displayText, tags, icon, type})
let isPlayingTTS = false;
let conversationStartTime = null;
let analysisNotificationShown = false;
let journalReadyNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분
let lastAiAnalysisData = null;
let userTurnCountInSession = 0;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let assistantMessageCount = 0,
    gptVerbosityPreference = 'default';
// let lastVerbosityPromptTime = 0, verbosityPromptCount = 0; // 필요시 사용
// const PREFERENCE_PROMPT_INTERVAL = 10 * 60 * 1000;
let currentFirestoreSessionId = null;
// let awaitManualSave = false; // 현재 사용되지 않는 것으로 보임
// let manualSaveConfirmed = false;
let micButtonCurrentlyProcessing = false;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micButton = document.getElementById('mic-button');
const meterLevel = document.getElementById('volume-level');
// const topicArea = document.getElementById('topic-area'); // 현재 코드에서 직접 사용되지 않음

// --- 사용자 정보 (localStorage 및 getOrCreateUserId 사용) ---
const loggedInUserId = getOrCreateUserId(); // ⭐ UID 생성 또는 가져오기
const userRole = localStorage.getItem('lozee_role') || 'child'; // 'child' 또는 'parent'
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10); // 대화 대상의 나이
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const isParentND = localStorage.getItem('lozee_parentIsND') === 'true';
const targetChildId = localStorage.getItem('lozee_childId'); // 보호자 모드일 때 대상 자녀의 UID
const currentUserType = (userRole === 'parent') ? 'caregiver' : 'directUser';

console.log("Talk.js Loaded - UserID:", loggedInUserId, "Role:", userRole, "TargetAge:", targetAge, "UserType:", currentUserType);


// --- Firestore 유틸리티 함수 ---
async function fetchPreviousUserCharCount() {
    if (!loggedInUserId) {
        console.warn("fetchPreviousUserCharCount: loggedInUserId가 없습니다.");
        return 0;
    }
    try {
        const userRef = doc(db, 'users', loggedInUserId); // ⭐ UID 사용
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().totalUserCharCount) {
            return parseInt(userSnap.data().totalUserCharCount, 10) || 0;
        }
    } catch (error) {
        console.error("Firestore 이전 누적 글자 수 로드 오류 (fetchPreviousUserCharCount):", error.message);
        // Firestore 보안 규칙 위반 시 'Missing or insufficient permissions.' 오류 발생 가능
        // 이 경우, 규칙을 확인하거나, 사용자가 자신의 데이터에 접근 권한이 있는지 확인 필요.
    }
    return 0;
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('talk.js: DOMContentLoaded 이벤트 발생. UserID:', loggedInUserId);

    let startedWithInitTopic = false; // ⭐ 사용 전에 미리 선언 및 초기화

    if (!loggedInUserId) {
        alert("사용자 정보를 인식할 수 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html'; // 또는 로그인 페이지
        return;
    }
    // currentUserType (이전 코드의 userType) 유효성 검사
    if (!currentUserType) {
        alert("사용자 유형 정보가 없습니다. 시작 페이지에서 유형을 다시 선택해주세요.");
        window.location.href = 'index.html';
        return;
    }
    // 테스트 계정 강제 설정 (필요시 사용, 배포 시 제거)
    // if (loggedInUserId === '특정테스트계정UID') {
    //     currentUserType = 'caregiver'; // localStorage.setItem 불필요, 이 변수 직접 사용
    //     userRole = 'parent'; // localStorage.setItem 불필요, 이 변수 직접 사용
    // }

    conversationStartTime = Date.now();
    try {
        previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
        console.log("talk.js: 이전 누적 사용자 발화 글자 수:", previousTotalUserCharCountOverall);
    } catch (error) {
        console.error("fetchPreviousUserCharCount 함수 실행 중 에러 발생:", error);
        previousTotalUserCharCountOverall = 0;
    }
    resetSessionTimeout();

    // 이어하기 주제 처리
    const initTopicDataString = localStorage.getItem('lozee_talk_init_topic');
    if (initTopicDataString) {
        try {
            const initTopic = JSON.parse(initTopicDataString);
            localStorage.removeItem('lozee_talk_init_topic'); // 사용 후 즉시 제거
            if (initTopic.details) { // initTopic.details는 주제명(displayText) 또는 약속 상세 내용
                selectedMain = initTopic.type === 'continue_specific_topic' ? findMainCategoryOfTopic(initTopic.details, counselingTopicsByAge) || initTopic.details : initTopic.details;
                selectedSubTopicDetails = initTopic.planType ? initTopic : findSubTopicDetails(initTopic.details, counselingTopicsByAge); // 약속인 경우 initTopic 전체, 아니면 검색

                const initialMessageFromLozee = initTopic.prompt || `지난번 '${selectedMain || initTopic.details}' 이야기에 이어서 더 나눠볼까?`;
                appendMessage(initialMessageFromLozee, 'assistant');
                console.log(`talk.js: "${selectedMain || initTopic.details}" 주제 이어하기 시작.`);
                startChat(initialMessageFromLozee, 'topic_selection_init', selectedSubTopicDetails || {displayText: selectedMain});
                hasGreeted = true;
                startedWithInitTopic = true;
            } else {
                console.warn("initTopic.details가 없어 이어하기를 시작할 수 없습니다.");
            }
        } catch (e) {
            console.error("이어하기 주제(lozee_talk_init_topic) 파싱 오류:", e);
            localStorage.removeItem('lozee_talk_init_topic');
        }
    }

    // 일반 시작 처리
    if (!startedWithInitTopic) { // ⭐ 여기서 startedWithInitTopic 사용
        const greeting = getInitialGreeting(userNameToDisplay + voc, hasGreeted);
        appendMessage(greeting, 'assistant');
        hasGreeted = true;
        showMainTopics();
    }
});

// --- 메시지 및 UI 관련 함수 ---
function appendMessage(text, role) { /* ... 기존과 동일 ... */
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + role;
    bubble.textContent = text;
    if (chatWindow) {
        chatWindow.appendChild(bubble);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } else {
        console.error("appendMessage: chatWindow 요소를 찾을 수 없습니다.");
    }
}
function showJournalReadyNotification() { /* ... 기존과 동일 ... */
    if (journalReadyNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification';
    notification.textContent = '📝 이야기가 충분히 쌓였네요! 이 대화는 종료 시 자동으로 저장됩니다.';
    if(chatWindow) chatWindow.appendChild(notification);
    journalReadyNotificationShown = true;
}
function showAnalysisNotification() { /* ... 기존과 동일 ... */
    if (analysisNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    notification.onclick = () => {
        // 나이에 따라 다른 분석 페이지로 이동
        if (targetAge >= 15 && currentUserType === 'directUser') { // 성인 당사자
             window.location.href = 'analysis_adult.html';
        } else { // 아동/청소년 당사자 또는 보호자 모드 (자녀 분석)
             window.location.href = 'analysis.html';
        }
    };
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}

// --- TTS 및 STT 관련 함수 ---
async function playTTSWithControl(txt) { /* ... 기존과 동일 ... */
    if (isRec && recog && typeof recog.stop === 'function') {
         console.log("TTS 재생 전 STT 명시적 중지"); recog.stop();
    }
    if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
    else console.warn("stopCurrentTTS 함수를 찾을 수 없습니다.");
    if (skipTTS) { skipTTS = false; return Promise.resolve(); }
    isPlayingTTS = true;
    try {
        if (typeof playTTSFromText === 'function') {
            await playTTSFromText(txt, localStorage.getItem('lozee_voice'));
        } else { console.warn("playTTSFromText 함수를 찾을 수 없습니다.");}
    } catch (error) { console.error("playTTSWithControl 내 TTS 재생 오류:", error); }
    finally { isPlayingTTS = false; }
}
let audioContext, analyser, source, dataArray, animId, streamRef; // setupAudioAnalysis, draw, stopAudio, STT 관련 변수
const LOW_COLOR = { r:0, g:200, b:0 }; const MID_COLOR = { r:255, g:200, b:0 }; const HIGH_COLOR = { r:255, g:69, b:0 };
function interp(c1, c2, f) { /* ... 이전과 동일 (HTML 태그 제거된 버전) ... */
    const r = Math.round(c1.r + f * (c2.r - c1.r));
    const g = Math.round(c1.g + f * (c2.g - c1.g));
    const b = Math.round(c1.b + f * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}
function setupAudioAnalysis(stream) { /* ... 이전과 동일 ... */ if (audioContext && audioContext.state !== 'closed') {audioContext.close().catch(e=>console.warn("이전 AudioContext 닫기 오류:", e));} audioContext = new AudioContext(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; source = audioContext.createMediaStreamSource(stream); source.connect(analyser); dataArray = new Uint8Array(analyser.frequencyBinCount); streamRef = stream; draw(); }
function draw() { /* ... 이전과 동일 ... */ animId = requestAnimationFrame(draw); if (!analyser || !dataArray) return; analyser.getByteFrequencyData(dataArray); let sum = dataArray.reduce((a, v) => a + v, 0); let avg = dataArray.length > 0 ? sum / dataArray.length : 0; let norm = Math.min(100, Math.max(0, (avg / 140) * 100)); if(meterLevel) {meterLevel.style.width = norm + '%'; meterLevel.style.background = `linear-gradient(to right, var(--background-color), ${norm <= 50 ? interp(LOW_COLOR, MID_COLOR, norm / 50) : interp(MID_COLOR, HIGH_COLOR, (norm - 50) / 50)})`;} if (norm > 10 && isRec && isPlayingTTS && !skipTTS) { console.log("사용자 음성 감지, TTS 중단 시도"); if (typeof stopCurrentTTS === 'function') stopCurrentTTS(); skipTTS = true; } }
function stopAudio() { /* ... 이전과 동일 ... */ if (animId) cancelAnimationFrame(animId); if (source) source.disconnect(); if (streamRef) streamRef.getTracks().forEach(track => track.stop()); if (audioContext && audioContext.state !== 'closed') { audioContext.close().catch(e=>console.warn("AudioContext 닫기 오류:", e)); } audioContext = null; if(meterLevel) { meterLevel.style.width = '0%'; meterLevel.style.background = getComputedStyle(document.documentElement).getPropertyValue('--volume-meter-container-bg'); } }
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog, isRec = false;
if (SpeechRecognitionAPI) { /* ... 이전 STT 로직과 동일 ... */
    recog = new SpeechRecognitionAPI();
    recog.continuous = true; recog.interimResults = true; recog.lang = 'ko-KR';
    recog.onstart = () => { isRec = true; if(micButton) micButton.classList.add('recording'); micButtonCurrentlyProcessing = false; };
    recog.onend = () => { isRec = false; if(micButton) micButton.classList.remove('recording'); stopAudio(); micButtonCurrentlyProcessing = false; };
    recog.onresult = event => {
        resetSessionTimeout();
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) { final_transcript += event.results[i][0].transcript; } }
        if (final_transcript) { console.log("STT 최종 결과:", final_transcript); if(chatInput) chatInput.value = ''; sendMessage(final_transcript.trim(), 'stt'); }
    };
    recog.onerror = event => { console.error('Speech recognition error:', event.error); appendMessage('음성 인식 오류: ' + event.error, 'assistant_feedback'); if(isRec && recog){ try{recog.stop();}catch(e){console.warn("recog.stop() 오류:",e)}} isRec = false; if(micButton) micButton.classList.remove('recording'); stopAudio(); micButtonCurrentlyProcessing = false; };
} else { if(micButton) micButton.disabled = true; appendMessage('이 브라우저에서는 음성 인식을 지원하지 않습니다.', 'assistant_feedback'); }
if(micButton) { /* ... 이전 micButton.onclick 로직과 동일 ... */
    micButton.onclick = async () => {
        if (isProcessing || micButtonCurrentlyProcessing) {
            appendMessage("잠시만요, 로지가 응답을 준비 중이거나 음성 인식이 시작/종료 중이에요. 😊", "assistant_feedback");
            return;
        }
        micButtonCurrentlyProcessing = true;
        if (isRec) {
            if(recog && typeof recog.stop === 'function') recog.stop();
        } else {
            if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
            skipTTS = true;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setupAudioAnalysis(stream);
                if(recog && typeof recog.start === 'function') recog.start();
            } catch (e) {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            }
        }
    };
}

// --- 주제 선택 관련 함수 ---
function getTopicsForCurrentUser() {
    // currentUserType과 targetAge를 사용하여 counselingTopicsByAge에서 주제를 가져옴
    // targetAge는 본인 나이 또는 (보호자 모드 시) 자녀 나이를 의미
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세')); // '30-55세'는 예시, 실제 키 확인 필요

    console.log(`getTopicsForCurrentUser - currentUserType: ${currentUserType}, targetAge: ${targetAge}, ageGroupKey: ${ageGroupKey}`);

    if (!counselingTopicsByAge) {
        console.error("counseling_topics.js를 찾을 수 없거나, counselingTopicsByAge 객체가 export 되지 않았습니다!");
        return {};
    }

    let topicsForUserGroup;
    if (currentUserType === 'directUser' && counselingTopicsByAge.directUser) {
        topicsForUserGroup = counselingTopicsByAge.directUser[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {}; // 기본값 추가
    } else if (currentUserType === 'caregiver' && counselingTopicsByAge.caregiver) {
        // 보호자 유형의 경우, counselingTopicsByAge.caregiver 내에 신경다양성 부모/일반 부모 구분이 있다면 isParentND를 사용
        // 예: if (isParentND && counselingTopicsByAge.caregiver.ND_Parent_Topics) { ... }
        // 현재는 통합된 caregiver 주제를 사용
        topicsForUserGroup = counselingTopicsByAge.caregiver || {};
    } else {
        console.warn(`알 수 없거나 지원하지 않는 사용자 유형(${currentUserType})입니다. 기본 주제를 사용합니다.`);
        topicsForUserGroup = counselingTopicsByAge.directUser ? (counselingTopicsByAge.directUser['11-15세'] || {}) : {};
    }

    console.log("getTopicsForCurrentUser - 반환될 topicsForUserGroup (첫 200자):", JSON.stringify(topicsForUserGroup).substring(0, 200) + "...");
    if (!topicsForUserGroup || Object.keys(topicsForUserGroup).length === 0) {
        console.warn(`getTopicsForCurrentUser: 최종적으로 사용자/나이에 맞는 주제 카테고리가 없거나 비어있습니다. counseling_topics.js 내용을 확인하세요.`);
        return {};
    }
    return topicsForUserGroup;
}

function displayOptionsInChat(optionsArray, onSelectCallback) { /* ... 기존과 동일 (fullOptionObject 전달) ... */
    if (!chatWindow) { console.error("displayOptionsInChat: chatWindow 요소를 찾을 수 없습니다."); return; }
    const optionsContainer = document.createElement('div'); optionsContainer.className = 'chat-options-container';
    const buttons = [];
    if (!optionsArray || !Array.isArray(optionsArray)) { console.error("displayOptionsInChat: optionsArray가 유효한 배열이 아닙니다."); return; }
    optionsArray.forEach(optionObject => {
        let buttonText; let valueToCallback;
        if (typeof optionObject === 'string') { buttonText = optionObject; valueToCallback = optionObject;}
        else if (optionObject && typeof optionObject.displayText !== 'undefined') { buttonText = optionObject.icon ? `${optionObject.icon} ${optionObject.displayText}` : optionObject.displayText; valueToCallback = optionObject.displayText; }
        else { console.warn("displayOptionsInChat: 잘못된 형식의 옵션:", optionObject); return; }
        const button = document.createElement('button'); button.className = 'chat-option-btn'; button.textContent = buttonText;
        if (optionObject && optionObject.isContinuation) { button.classList.add('continue-topic-btn'); }
        // if (optionObject && optionObject.isManualSave) { button.classList.add('manual-save-btn');} // 수동 저장 기능 미사용시 제거
        button.onclick = () => { buttons.forEach(btn => { btn.disabled = true; if (btn === button) { btn.classList.add('selected'); } }); onSelectCallback(valueToCallback, optionObject); };
        optionsContainer.appendChild(button); buttons.push(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 이전에 삭제했던 showMainTopics 함수 (getTopicsForCurrentUser 와 displayOptionsInChat 사용 버전)
function showMainTopics() {
    console.log("showMainTopics 함수 실행됨");
    selectedSubTopicDetails = null; // 주 주제 선택 시 서브토픽 정보 초기화
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser(); // 현재 사용자에 맞는 주제 카테고리 객체 (예: {"감정 이야기": [...], "친구 이야기": [...]})
    let topicsWithOptions = []; // 화면에 버튼으로 표시할 옵션 배열

    // 1. "로지와의 약속" (mypage에서 이어하기) 추가
    const continueTopicDataFromPlans = localStorage.getItem('lozee_continue_topic');
    if (continueTopicDataFromPlans) {
        try {
            const topicToContinue = JSON.parse(continueTopicDataFromPlans);
            topicsWithOptions.push({
                icon: '↪️',
                displayText: `[약속] ${topicToContinue.details || '이전 생각 이어가기'}`,
                isContinuation: true, // 이어하기 버튼임을 표시
                continueDetails: topicToContinue, // 이어하기에 필요한 전체 정보
                type: 'mypage_plan' // 이어하기 출처 구분
            });
        } catch (e) {
            console.error("로지와의 약속 파싱 오류:", e);
            localStorage.removeItem('lozee_continue_topic'); // 오류 시 해당 항목 제거
        }
    }

    // 2. counseling_topics.js에서 가져온 주제 카테고리들 추가
    if (currentUserTopics && typeof currentUserTopics === 'object' && Object.keys(currentUserTopics).length > 0) {
        const categoryNames = Object.keys(currentUserTopics); // 예: ["감정 이야기", "친구 이야기", ...]
        console.log("showMainTopics - 생성할 주제 카테고리명:", categoryNames);
        const categoryOptions = categoryNames.map(categoryName => {
            let icon = '💬'; // 기본 아이콘
            // 해당 카테고리의 첫 번째 서브토픽 아이콘을 대표 아이콘으로 사용 (선택적)
            if (currentUserTopics[categoryName] && Array.isArray(currentUserTopics[categoryName]) && currentUserTopics[categoryName].length > 0 && currentUserTopics[categoryName][0].icon) {
                icon = currentUserTopics[categoryName][0].icon;
            }
            return { icon: icon, displayText: categoryName, isContinuation: false };
        });
        topicsWithOptions.push(...categoryOptions);
    } else {
        console.warn(`showMainTopics: counseling_topics.js에서 주제를 가져오지 못했거나 비어있습니다.`);
    }

    // 3. "자유주제" 옵션 추가
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제', isContinuation: false });

    console.log("showMainTopics - 최종 주제 선택 옵션:", JSON.stringify(topicsWithOptions).substring(0, 300) + "...");

    // 화면에 옵션 버튼들 표시
    displayOptionsInChat(topicsWithOptions, (selectedCategoryText, fullOptionObject) => {
        selectedMain = selectedCategoryText; // 선택된 주 주제 카테고리명 (예: "감정 이야기", "자유주제")

        if (fullOptionObject && fullOptionObject.isContinuation) { // "로지와의 약속" 이어하기 선택 시
            localStorage.removeItem('lozee_continue_topic');
            selectedMain = fullOptionObject.continueDetails.details || selectedCategoryText; // 실제 이어갈 주제명
            selectedSubTopicDetails = fullOptionObject.continueDetails; // 이어하기 상세 정보 저장
            appendMessage(selectedMain + ' 이야기를 이어갈게!', 'assistant');
            const continueMessage = fullOptionObject.continueDetails.prompt || `저번에 이야기했던 '${selectedMain}'에 대해 계속 이야기해보자.`;
            startChat(continueMessage, 'topic_selection_init', selectedSubTopicDetails); // fullOptionObject.continueDetails를 topicDetails로 전달
        } else if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제', tags: ['자유대화'] }; // 자유주제도 객체 형태로 저장
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            const message = '네가 정하면 돼. 어떤 이야기가 하고 싶어?';
            appendMessage(message, 'assistant');
            if(inputArea) inputArea.style.display = 'flex';
            if(chatInput) chatInput.focus();
        } else { // 일반 주제 카테고리 선택 시 (예: "감정 이야기")
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 300); // 하위 주제 표시 함수 호출
        }
    });
}

function showSubTopics() {
    if (!selectedMain || selectedMain === '자유주제') return;

    const currentUserTopicCategories = getTopicsForCurrentUser();
    let subtopicOptions = [];

    if (currentUserTopicCategories && currentUserTopicCategories[selectedMain] && Array.isArray(currentUserTopicCategories[selectedMain])) {
        subtopicOptions = currentUserTopicCategories[selectedMain]; // [{icon, displayText, tags, type}, ...]
    } else {
        console.warn(`showSubTopics: '${selectedMain}' 카테고리에 해당하는 서브토픽 배열이 없습니다. 자유 이야기로 진행합니다.`);
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain, tags: [selectedMain] });
        return;
    }

    if (!subtopicOptions || subtopicOptions.length === 0) {
        console.warn(`showSubTopics: '${selectedMain}' 카테고리의 서브토픽이 비어있습니다. 자유 이야기로 진행합니다.`);
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain, tags: [selectedMain] });
        return;
    }

    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
    displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
        selectedSubTopicDetails = fullOptionObject; // ⭐ 선택된 서브토픽의 전체 객체 저장
        // selectedMain은 여전히 주 카테고리명, selectedSubtopicText는 서브토픽의 displayText
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject); // fullOptionObject를 topicDetails로 전달
    });
}

function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    // topicDetails는 선택된 서브토픽의 전체 객체 ({displayText, tags, icon, type}) 또는 이어하기 객체
    console.log("startChat 함수 시작됨, 초기 메시지:", initText, "입력방식:", inputMethod, "선택된 주 주제:", selectedMain, "선택된 서브토픽 상세:", topicDetails);
    if (inputArea) inputArea.style.display = 'flex';

    const topicForLogging = topicDetails ? topicDetails.displayText : (selectedMain || "알 수 없는 주제");
    if (loggedInUserId && topicForLogging && topicForLogging !== "알 수 없는 주제" && !currentFirestoreSessionId && typeof logSessionStart === 'function') {
        logSessionStart(loggedInUserId, topicForLogging).then(id => {
            if (id) currentFirestoreSessionId = id;
        });
    }

    if (initText && String(initText).trim() !== '') {
        sendMessage(initText, inputMethod);
    } else {
        if (chatInput) chatInput.focus();
    }
}

// --- 세션 관리 및 메시지 전송 ---
function resetSessionTimeout() { /* ... 기존과 동일 (UID 사용하도록 내부 수정 필요) ... */
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(async () => {
        appendMessage("오랫동안 응답이 없어서 대화를 종료할게. 다음에 또 이야기하자! 😊", 'assistant_feedback');
        if (currentFirestoreSessionId && typeof logSessionEnd === 'function') {
            await logSessionEnd(currentFirestoreSessionId);
        }

        const finalTopicForJournal = selectedSubTopicDetails ? selectedSubTopicDetails.displayText : (selectedMain || "알 수 없는 주제");

        if (finalTopicForJournal && finalTopicForJournal !== "알 수 없는 주제" && chatHistory.length > 2 && typeof saveJournalEntry === 'function') {
            const journalDetailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || chatHistory.map(m=>m.content).join('\n').substring(0,1000) + "...",
                title: lastAiAnalysisData?.summaryTitle || finalTopicForJournal.substring(0,30),
                mood: lastAiAnalysisData?.overallSentiment,
                keywords: lastAiAnalysisData?.keywords,
                detailedAnalysis: lastAiAnalysisData || {}, // GPT가 제공한 전체 분석 결과 저장
                sessionDurationMinutes: (Date.now() - conversationStartTime) / (60 * 1000), // 실제 경과 시간
                userCharCountForThisSession: userCharCountInSession
            };

            let entryTypeForSave = (userRole === 'parent') ? 'child' : 'standard';
            let childIdForSave = (userRole === 'parent') ? targetChildId : null;
            let childNameForSave = (userRole === 'parent') ? (localStorage.getItem('lozee_childName') || '아이') : null; // index.html에서 저장한 자녀 이름

            await saveJournalEntry(
                loggedInUserId, // ⭐ UID 사용
                finalTopicForJournal,
                journalDetailsToSave,
                {
                    relatedChildId: childIdForSave,
                    entryType: entryTypeForSave,
                    childName: childNameForSave
                }
            );
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave); // ⭐ UID 사용
            const finalUserCharCountOverall = previousTotalUserCharCountOverall + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, finalUserCharCountOverall); // ⭐ UID 사용
        }
        if(inputArea) inputArea.style.display = 'none';
    }, SESSION_TIMEOUT_DURATION);
}

async function sendMessage(text, inputMethod = 'text') { /* ... 기존과 동일 (내부 loggedInUserId 사용) ... */
    // 현재 선택된 주제 (서브토픽의 displayText 또는 주 주제 카테고리명)
    const currentTopicForSend = selectedSubTopicDetails ? selectedSubTopicDetails.displayText : (selectedMain || null);

    if (!currentTopicForSend && inputMethod !== 'topic_selection_init' && text.trim() !== '') {
        appendMessage("이야기를 시작하기 전에 먼저 어떤 주제로 이야기할지 선택해 줄래? 😊", "assistant_feedback");
        showMainTopics();
        isProcessing = false;
        if (sendBtn) sendBtn.classList.remove('loading');
        return;
    }

    if (!text || String(text).trim() === '' || isProcessing) return;
    resetSessionTimeout();
    isProcessing = true;
    micButtonCurrentlyProcessing = true;
    if (sendBtn) sendBtn.classList.add('loading');
    if (!conversationStartTime) conversationStartTime = Date.now();

    if (inputMethod !== 'topic_selection_init') {
        appendMessage(text, 'user');
        userTurnCountInSession++;
    }
    chatHistory.push({ role: 'user', content: text });
    if (inputMethod !== 'topic_selection_init') {
        userCharCountInSession += text.length;
    }

    if (chatInput) chatInput.value = '';
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'bubble assistant thinking';
    thinkingBubble.textContent = '생각중이야...';
    if (chatWindow) {
        chatWindow.appendChild(thinkingBubble);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    try {
        const elapsedTimeInMinutesForGPT = (Date.now() - conversationStartTime) / (1000 * 60);
        // 사용자 특성(진단명) 가져오기: 본인 또는 (보호자 모드 시) 자녀의 특성
        let traitsForGpt = [];
        if (userRole === 'parent') {
            traitsForGpt = JSON.parse(localStorage.getItem('lozee_childDiagnoses_for_talk') || '[]'); // talk 시작 시점에 부모가 자녀 정보 입력/선택 후 저장된 값
        } else { // 'child' (당사자)
            traitsForGpt = JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]'); // 당사자 본인의 특성
        }

        const res = await getGptResponse(text, {
            chatHistory,
            verbosity: gptVerbosityPreference,
            elapsedTime: elapsedTimeInMinutesForGPT,
            userTraits: traitsForGpt,
            userId: loggedInUserId // ⭐ 서버로 UID 전달
        });

        if (thinkingBubble) thinkingBubble.remove();

        if (!res.ok) {
            appendMessage('이런, 로지가 지금 좀 아픈가 봐. 잠시 후에 다시 시도해 줄래? 😥', 'assistant');
            return; // finally 블록으로 이동하여 isProcessing 등 상태 복원
        }

        const d = await res.json(); // 서버는 { text: "표시용텍스트", analysis: {분석객체} } 형태로 응답
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        const analysisDataFromGpt = d.analysis || {}; // 서버에서 파싱된 analysis 객체 사용

        lastAiAnalysisData = analysisDataFromGpt; // GPT 응답에 포함된 분석 데이터 저장
        appendMessage(cleanText, 'assistant');

        if (!skipTTS) {
            await playTTSWithControl(cleanText);
        }
        skipTTS = false;

        chatHistory.push({ role: 'assistant', content: cleanText }); // 대화 기록에는 순수 텍스트만 저장
        assistantMessageCount++;

        // 저널 저장 준비 알림
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && currentTopicForSend) {
            showJournalReadyNotification();
        }

        // 상세 분석 및 localStorage 저장 조건 확인
        const currentSessionElapsedTime = (Date.now() - conversationStartTime) / (1000 * 60);
        const finalUserCharCountForAnalysis = previousTotalUserCharCountOverall + userCharCountInSession;
        console.log(
            `[분석 조건 체크] 시간: ${currentSessionElapsedTime.toFixed(1)}분 (기준:10), 사용자 턴: ${userTurnCountInSession} (기준:20), 총 글자수: ${finalUserCharCountForAnalysis} (기준:1500)`
        );

        if (currentSessionElapsedTime >= 10 && userTurnCountInSession >= 20 && finalUserCharCountForAnalysis >= 1500 && !analysisNotificationShown) {
            console.log(`[분석 조건 충족!] 상세 분석 실행 및 localStorage 저장`);
            let detailedAnalysisDataForStorage = { ...(lastAiAnalysisData || {}) };

            // 언어 연령 분석은 'child' (당사자) 역할이고, 12세 이하일 때만 실행 (예시 조건)
            if (userRole === 'child' && targetAge <= 12 && LOZEE_ANALYSIS && typeof LOZEE_ANALYSIS.inferAgeAndLanguage === 'function') {
                try {
                    const conversationTextForAgeAnalysis = chatHistory.map(item => `${item.role}: ${item.content}`).join('\n');
                    const ageAnalysisResult = await LOZEE_ANALYSIS.inferAgeAndLanguage(conversationTextForAgeAnalysis);
                    if (ageAnalysisResult && !ageAnalysisResult.error) {
                        detailedAnalysisDataForStorage.ageLanguageAnalysis = {
                            predictedAge: ageAnalysisResult.predicted_age_group || "분석 중...", // 실제 백엔드 응답 키로 변경
                            feedback: ageAnalysisResult.feedback_message || "결과를 바탕으로 피드백을 생성합니다.", // 실제 백엔드 응답 키로 변경
                            // 필요시 추가 필드: stage1PredictedAge, stage1Feedback 등 단계별 결과
                        };
                        console.log("언어 연령 분석 결과 추가됨:", detailedAnalysisDataForStorage.ageLanguageAnalysis);
                    } else {
                        console.warn("언어 연령 분석 실패 또는 오류:", ageAnalysisResult?.error);
                    }
                } catch (langAnalysisError) {
                    console.error("inferAgeAndLanguage 함수 실행 중 오류:", langAnalysisError);
                }
            }

            const dataToStoreInLocalStorage = {
                results: detailedAnalysisDataForStorage,
                accumulatedDurationMinutes: currentSessionElapsedTime,
                // 필요한 경우 추가 정보 저장:
                // currentTopic: currentTopicForSend,
                // journalId: currentFirestoreSessionId (또는 실제 저널 ID)
            };

            const gptProvidedAnalysisExists = Object.keys(lastAiAnalysisData || {}).length > 0;
            if (gptProvidedAnalysisExists || detailedAnalysisDataForStorage.ageLanguageAnalysis) {
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStoreInLocalStorage));
                console.log("localStorage에 'lozee_conversation_analysis' 저장 완료:", dataToStoreInLocalStorage);
                showAnalysisNotification();
                analysisNotificationShown = true;
            } else {
                console.log("생성된 유의미한 분석 데이터가 없어 알림 표시 및 localStorage 저장 안 함.");
            }
        } else if (!analysisNotificationShown) {
            console.log("[분석 조건 미충족 또는 이미 알림 표시됨]");
        }

    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
        micButtonCurrentlyProcessing = false;
        if (sendBtn) sendBtn.classList.remove('loading');
    }
}

// --- 이벤트 바인딩 ---
if(sendBtn) sendBtn.addEventListener('click', () => { resetSessionTimeout(); sendMessage(chatInput.value, 'text'); });
if(chatInput) chatInput.addEventListener('keydown', e => {
    resetSessionTimeout();
    if (isPlayingTTS) { if (typeof stopCurrentTTS === 'function') stopCurrentTTS(); skipTTS = true; }
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendMessage(chatInput.value, 'text'); }
});


// --- 추가된 헬퍼 함수 ---
function findMainCategoryOfTopic(subTopicDisplayText, topicsData) {
    if (!subTopicDisplayText || !topicsData) return '';
    for (const userType in topicsData) {
        const ageGroups = topicsData[userType];
        for (const ageGroup in ageGroups) {
            const mainTopicCategories = ageGroups[ageGroup];
            for (const mainTopicName in mainTopicCategories) {
                const subTopicsArray = mainTopicCategories[mainTopicName];
                if (Array.isArray(subTopicsArray)) {
                    const found = subTopicsArray.find(st => st.displayText === subTopicDisplayText);
                    if (found) return mainTopicName;
                }
            }
        }
    }
    return ''; // 못 찾으면 빈 문자열 또는 기본값
}

function findSubTopicDetails(subTopicDisplayText, topicsData) {
    if (!subTopicDisplayText || !topicsData) return null;
     for (const userType in topicsData) {
        const ageGroups = topicsData[userType];
        for (const ageGroup in ageGroups) {
            const mainTopicCategories = ageGroups[ageGroup];
            for (const mainTopicName in mainTopicCategories) {
                const subTopicsArray = mainTopicCategories[mainTopicName];
                if (Array.isArray(subTopicsArray)) {
                    const found = subTopicsArray.find(st => st.displayText === subTopicDisplayText);
                    if (found) return { ...found, mainCategory: mainTopicName }; // 주 카테고리 정보도 추가해서 반환
                }
            }
        }
    }
    return null;
}