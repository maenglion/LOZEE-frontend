// js/talk.js

import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js'; // Firestore import 정리
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './lozee-analysis.js';
import {
  saveJournalEntry,
  // saveManualJournalEntry, // 필요시 주석 해제
  updateTopicStats,
  updateUserOverallStats,
  logSessionStart,
  logSessionEnd
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 상태 변수 ---
let skipTTS = false,
    hasGreeted = false,
    isProcessing = false;
let chatHistory = [],
    selectedMain = null, // 선택된 주 대화 주제 (counseling_topics.js의 카테고리명 또는 서브토픽 displayText)
    selectedSubTopicDetails = null; // 선택된 서브 토픽의 전체 객체 (displayText, tags 등 포함)
let isPlayingTTS = false;
let conversationStartTime = null;
let analysisNotificationShown = false;
let journalReadyNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분
let lastAiAnalysisData = null; // GPT로부터 받은 가장 최신의 분석 객체 ({ summaryTitle, keywords, ... })
let userTurnCountInSession = 0;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0; // Firestore에서 가져온 이전까지의 총 발화 글자 수
let assistantMessageCount = 0,
    gptVerbosityPreference = 'default'; // GPT 답변 길이 선호도
// let lastVerbosityPromptTime = 0, verbosityPromptCount = 0; // 필요시 사용
// const PREFERENCE_PROMPT_INTERVAL = 10 * 60 * 1000;
let currentFirestoreSessionId = null; // Firestore 'sessions' 컬렉션에 기록된 현재 세션 ID
// let awaitManualSave = false; // 수동 저장 관련 기능은 현재 명확하지 않아 주석 처리
// let manualSaveConfirmed = false;
let micButtonCurrentlyProcessing = false;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micButton = document.getElementById('mic-button');
const meterLevel = document.getElementById('volume-level');

// --- 사용자 정보 (localStorage에서 가져와 일관되게 사용) ---
const loggedInUserId = localStorage.getItem('lozee_userId'); // 현재 로그인한 사용자의 UID
const userRole = localStorage.getItem('lozee_role') || 'child'; // 'child' 또는 'parent'
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10); // 대화 대상의 나이 (본인 또는 자녀)
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const isParentND = localStorage.getItem('lozee_parentIsND') === 'true'; // 보호자 본인의 신경다양성 여부
const targetChildId = localStorage.getItem('lozee_childId'); // 보호자 모드일 때 선택된 자녀의 UID

// userType을 role 기반으로 결정 (directUser / caregiver)
// talk.html에서 userType은 주제 선택(getTopicsForCurrentUser)과 통계 업데이트(updateUserOverallStats)에 사용됨
const currentUserType = (userRole === 'parent') ? 'caregiver' : 'directUser';

// --- Firestore 유틸리티 함수 ---
async function fetchPreviousUserCharCount() {
    if (!loggedInUserId) {
        console.warn("fetchPreviousUserCharCount: loggedInUserId가 없습니다.");
        return 0;
    }
    try {
        const userRef = doc(db, 'users', loggedInUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().totalUserCharCount) {
            return parseInt(userSnap.data().totalUserCharCount, 10) || 0;
        }
    } catch (error) {
        console.error("Firestore 이전 누적 글자 수 로드 오류 (fetchPreviousUserCharCount):", error.message);
        // 보안 규칙 위반 시 여기서 'Missing or insufficient permissions.' 오류 발생 가능
    }
    return 0;
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('talk.js: DOMContentLoaded 이벤트 발생');

    let startedWithInitTopic = false; // ⭐ 사용 전에 미리 선언 및 초기화

    // 사용자 정보 유효성 검사
    if (!loggedInUserId) {
        alert("사용자 정보(UID)가 없습니다. 다시 로그인해주세요.");
        window.location.href = 'index.html';
        return;
    }
    // userType (directUser/caregiver)은 currentUserType 변수로 이미 설정됨

    // 테스트 계정 강제 설정 (필요시 사용, 배포 시 제거)
    // if (loggedInUserId === '특정테스트계정UID') {
    //     currentUserType = 'caregiver';
    //     localStorage.setItem('lozee_userType', 'caregiver'); // 이 줄은 불필요, currentUserType 사용
    //     userRole = 'parent';
    //     localStorage.setItem('lozee_role', 'parent');
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
            localStorage.removeItem('lozee_talk_init_topic');
            if (initTopic.details) {
                selectedMain = initTopic.details; // 주제명 또는 서브토픽 displayText
                // initTopic이 counseling_topics.js의 전체 객체를 포함하도록 개선하면 더 좋음
                // selectedSubTopicDetails = initTopic; // 이렇게 하면 태그 등 모든 정보 사용 가능
                const initialMessageFromLozee = initTopic.prompt || `지난번 '${selectedMain}' 이야기에 이어서 더 나눠볼까?`;
                appendMessage(initialMessageFromLozee, 'assistant');
                console.log(`talk.js: "${selectedMain}" 주제 이어하기 시작.`);
                startChat(initialMessageFromLozee, 'topic_selection_init', initTopic); // fullOptionObject 전달
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
    if (!startedWithInitTopic) {
        const greeting = getInitialGreeting(userNameToDisplay + voc, hasGreeted);
        appendMessage(greeting, 'assistant');
        hasGreeted = true;
        showMainTopics();
    }
});

// --- 메시지 및 UI 관련 함수 ---
function appendMessage(text, role) {
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

function showJournalReadyNotification() {
    // ... (기존 코드와 동일)
    if (journalReadyNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification';
    notification.textContent = '📝 이야기가 충분히 쌓였네요! 이 대화는 종료 시 자동으로 저장됩니다.';
    if(chatWindow) chatWindow.appendChild(notification);
    journalReadyNotificationShown = true;
}

function showAnalysisNotification() {
    // ... (기존 코드와 동일)
    if (analysisNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    notification.onclick = () => { location.href = 'analysis.html'; }; // 또는 성인/아동 분기
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}

// --- TTS 및 STT 관련 함수 ---
async function playTTSWithControl(txt) {
    // ... (기존 코드와 동일) ...
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

let audioContext, analyser, source, dataArray, animId, streamRef;
const LOW_COLOR = { r:0, g:200, b:0 }; const MID_COLOR = { r:255, g:200, b:0 }; const HIGH_COLOR = { r:255, g:69, b:0 };
function interp(c1, c2, f) { /* ... 기존 코드 ... */ 
    const r = Math.round(c1.r + f * (c2.r - c1.r));
    const g = Math.round(c1.g + f * (c2.g - c1.g));
    const b = Math.round(c1.b + f * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}
function setupAudioAnalysis(stream) { /* ... 기존 코드 ... */ if (audioContext && audioContext.state !== 'closed') {audioContext.close().catch(e=>console.warn("이전 AudioContext 닫기 오류:", e));} audioContext = new AudioContext(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; source = audioContext.createMediaStreamSource(stream); source.connect(analyser); dataArray = new Uint8Array(analyser.frequencyBinCount); streamRef = stream; draw(); }
function draw() { /* ... 기존 코드 ... */ animId = requestAnimationFrame(draw); if (!analyser || !dataArray) return; analyser.getByteFrequencyData(dataArray); let sum = dataArray.reduce((a, v) => a + v, 0); let avg = dataArray.length > 0 ? sum / dataArray.length : 0; let norm = Math.min(100, Math.max(0, (avg / 140) * 100)); if(meterLevel) {meterLevel.style.width = norm + '%'; meterLevel.style.background = `linear-gradient(to right, var(--background-color), ${norm <= 50 ? interp(LOW_COLOR, MID_COLOR, norm / 50) : interp(MID_COLOR, HIGH_COLOR, (norm - 50) / 50)})`;} if (norm > 10 && isRec && isPlayingTTS && !skipTTS) { console.log("사용자 음성 감지, TTS 중단 시도"); if (typeof stopCurrentTTS === 'function') stopCurrentTTS(); skipTTS = true; } }
function stopAudio() { /* ... 기존 코드 ... */ if (animId) cancelAnimationFrame(animId); if (source) source.disconnect(); if (streamRef) streamRef.getTracks().forEach(track => track.stop()); if (audioContext && audioContext.state !== 'closed') { audioContext.close().catch(e=>console.warn("AudioContext 닫기 오류:", e)); } audioContext = null; if(meterLevel) { meterLevel.style.width = '0%'; meterLevel.style.background = getComputedStyle(document.documentElement).getPropertyValue('--volume-meter-container-bg'); } }

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog, isRec = false;
if (SpeechRecognitionAPI) {
    // ... (기존 STT 설정 및 핸들러 코드와 동일) ...
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

if(micButton) {
    // ... (기존 micButton.onclick 로직과 동일) ...
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
        // 보호자 유형의 경우, 신경다양성 부모/일반 부모에 따라 다른 주제 세트를 제공할 수 있음
        // 여기서는 모든 보호자에게 동일한 'caregiver' 주제를 제공한다고 가정
        // 만약 isParentND를 사용하려면:
        // topicsForUserGroup = isParentND ? counselingTopicsByAge.caregiver.ND_Parent_Topics : counselingTopicsByAge.caregiver.Typical_Parent_Topics;
        // 위와 같이 counselingTopicsByAge.caregiver 내부 구조가 세분화되어 있어야 함.
        // 현재는 통합된 caregiver 주제를 사용:
        topicsForUserGroup = counselingTopicsByAge.caregiver || {};
    } else {
        console.warn(`알 수 없거나 지원하지 않는 사용자 유형(${currentUserType})입니다. 기본 주제를 사용합니다.`);
        topicsForUserGroup = counselingTopicsByAge.directUser ? (counselingTopicsByAge.directUser['11-15세'] || {}) : {};
    }

    console.log("getTopicsForCurrentUser - 반환될 topicsForUserGroup:", JSON.stringify(topicsForUserGroup).substring(0, 200) + "...");
    if (!topicsForUserGroup || Object.keys(topicsForUserGroup).length === 0) {
        console.warn(`getTopicsForCurrentUser: 최종적으로 사용자/나이에 맞는 주제 카테고리가 없거나 비어있습니다. counseling_topics.js 내용을 확인하세요.`);
        return {};
    }
    return topicsForUserGroup;
}

function displayOptionsInChat(optionsArray, onSelectCallback) {
    // ... (기존 코드와 동일) ...
    if (!chatWindow) { console.error("displayOptionsInChat: chatWindow 요소를 찾을 수 없습니다."); return; }
    const optionsContainer = document.createElement('div'); optionsContainer.className = 'chat-options-container';
    const buttons = [];
    if (!optionsArray || !Array.isArray(optionsArray)) { console.error("displayOptionsInChat: optionsArray가 유효한 배열이 아닙니다."); return; }
    optionsArray.forEach(optionObject => {
        let buttonText; let valueToCallback;
        if (typeof optionObject === 'string') { buttonText = optionObject; valueToCallback = optionObject;}
        else if (optionObject && typeof optionObject.displayText !== 'undefined') { buttonText = optionObject.icon ? `${optionObject.icon} ${optionObject.displayText}` : optionObject.displayText; valueToCallback = optionObject.displayText; } // valueToCallback은 displayText로 통일
        else { console.warn("displayOptionsInChat: 잘못된 형식의 옵션:", optionObject); return; }
        const button = document.createElement('button'); button.className = 'chat-option-btn'; button.textContent = buttonText;
        if (optionObject && optionObject.isContinuation) { button.classList.add('continue-topic-btn'); }
        if (optionObject && optionObject.isManualSave) { button.classList.add('manual-save-btn');}
        button.onclick = () => { buttons.forEach(btn => { btn.disabled = true; if (btn === button) { btn.classList.add('selected'); } }); onSelectCallback(valueToCallback, optionObject); }; // ⭐ fullOptionObject 전달
        optionsContainer.appendChild(button); buttons.push(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showMainTopics() {
    // ... (기존 코드와 유사, selectedSubTopicDetails 초기화 추가) ...
    console.log("showMainTopics 함수 실행됨");
    selectedSubTopicDetails = null; // 주 주제 선택 시 서브토픽 정보 초기화
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    let topicsWithOptions = [];
    const continueTopicDataFromPlans = localStorage.getItem('lozee_continue_topic'); // mypage의 약속 이어하기
    if (continueTopicDataFromPlans) {
        try {
            const topicToContinue = JSON.parse(continueTopicDataFromPlans);
            topicsWithOptions.push({ icon: '↪️', displayText: `[약속] ${topicToContinue.details || '이전 생각 이어가기'}`, isContinuation: true, continueDetails: topicToContinue, type: 'mypage_plan' });
        } catch (e) { console.error("로지와의 약속 파싱 오류:", e); localStorage.removeItem('lozee_continue_topic');}
    }
    if (currentUserTopics && typeof currentUserTopics === 'object' && Object.keys(currentUserTopics).length > 0) {
        const categoryNames = Object.keys(currentUserTopics);
        console.log("showMainTopics - 생성할 주제 카테고리명:", categoryNames);
        const categoryOptions = categoryNames.map(categoryName => {
            // 카테고리 대표 아이콘 (해당 카테고리 첫 번째 서브토픽의 아이콘 사용 또는 기본값)
            let icon = '💬';
            if (currentUserTopics[categoryName] && Array.isArray(currentUserTopics[categoryName]) && currentUserTopics[categoryName].length > 0 && currentUserTopics[categoryName][0].icon) {
                icon = currentUserTopics[categoryName][0].icon;
            }
            return { icon: icon, displayText: categoryName, isContinuation: false };
        });
        topicsWithOptions.push(...categoryOptions);
    } else { console.warn(`showMainTopics: counseling_topics.js에서 주제를 가져오지 못했거나 비어있습니다.`); }
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제', isContinuation: false });
    console.log("showMainTopics - 최종 주제 선택 옵션:", JSON.stringify(topicsWithOptions).substring(0, 300) + "...");
    displayOptionsInChat(topicsWithOptions, (selectedCategoryText, fullOptionObject) => {
        selectedMain = selectedCategoryText; // 주 주제 카테고리명 저장
        if (fullOptionObject && fullOptionObject.isContinuation) {
            localStorage.removeItem('lozee_continue_topic');
            selectedMain = fullOptionObject.continueDetails.details || selectedCategoryText; // 실제 이어갈 주제
            // selectedSubTopicDetails = fullOptionObject.continueDetails; // 이어하기 시, 상세 정보도 selectedSubTopicDetails로 간주
            appendMessage(selectedMain + ' 이야기를 이어갈게!', 'assistant');
            const continueMessage = fullOptionObject.continueDetails.prompt || `저번에 이야기했던 '${selectedMain}'에 대해 계속 이야기해보자.`;
            startChat(continueMessage, 'topic_selection_init', fullOptionObject.continueDetails); // fullOptionObject.continueDetails를 넘겨줌
        } else if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제', tags: ['자유대화'] }; // 자유주제도 객체로
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            const message = '네가 정하면 돼. 어떤 이야기가 하고 싶어?';
            appendMessage(message, 'assistant');
            if(inputArea) inputArea.style.display = 'flex'; if(chatInput) chatInput.focus();
        } else {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 300); // selectedMain은 카테고리명이 됨
        }
    });
}

function showSubTopics() {
    // selectedMain은 주 주제 카테고리명 ("감정 이야기", "친구 이야기" 등)
    if (!selectedMain || selectedMain === '자유주제') {
        // startChat('', 'topic_selection_init'); // 자유주제는 showMainTopics에서 처리
        return;
    }
    const currentUserTopicCategories = getTopicsForCurrentUser();
    let subtopicOptions = [];
    if (currentUserTopicCategories && currentUserTopicCategories[selectedMain] && Array.isArray(currentUserTopicCategories[selectedMain])) {
        subtopicOptions = currentUserTopicCategories[selectedMain]; // [{icon, displayText, tags}, ...]
    } else { // 주 주제 카테고리에 해당하는 서브토픽 배열이 없는 경우 (counseling_topics.js 구조 오류 등)
        console.warn(`showSubTopics: '${selectedMain}' 카테고리에 해당하는 서브토픽 배열이 없습니다. 자유 이야기로 진행합니다.`);
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain, tags: [selectedMain] });
        return;
    }

    if (!subtopicOptions || subtopicOptions.length === 0) { // 서브토픽 배열은 있으나 비어있는 경우
        console.warn(`showSubTopics: '${selectedMain}' 카테고리의 서브토픽이 비어있습니다. 자유 이야기로 진행합니다.`);
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain, tags: [selectedMain] });
        return;
    }

    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
    displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
        selectedSubTopicDetails = fullOptionObject; // ⭐ 선택된 서브토픽의 전체 객체 저장
        // selectedMain은 여전히 주 카테고리명, selectedSubtopicText는 서브토픽의 displayText
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
    });
}

function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    console.log("startChat 함수 시작됨, 초기 메시지:", initText, "입력방식:", inputMethod, "선택된 주 주제:", selectedMain, "선택된 서브토픽 상세:", topicDetails);
    if (inputArea) inputArea.style.display = 'flex';

    // 세션 로그 시작 (주제 선택이 완료되었을 때)
    // selectedMain: 주 카테고리 이름, topicDetails.displayText: 실제 선택된 서브토픽의 화면 표시 이름
    const topicForLogging = topicDetails ? topicDetails.displayText : selectedMain;
    if (loggedInUserId && topicForLogging && !currentFirestoreSessionId && typeof logSessionStart === 'function') {
        logSessionStart(loggedInUserId, topicForLogging).then(id => { // topicForLogging 사용
            if (id) currentFirestoreSessionId = id;
        });
    }

    if (initText && String(initText).trim() !== '') {
        sendMessage(initText, inputMethod);
    } else { // 자유 주제 선택 시 initText 없이 호출될 수 있음
        if (chatInput) chatInput.focus();
    }
}

// --- 세션 관리 및 메시지 전송 ---
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(async () => {
        appendMessage("오랫동안 응답이 없어서 대화를 종료할게. 다음에 또 이야기하자! 😊", 'assistant_feedback');
        if (currentFirestoreSessionId && typeof logSessionEnd === 'function') {
            await logSessionEnd(currentFirestoreSessionId);
        }

        // selectedMain은 주 카테고리명, selectedSubTopicDetails.displayText가 실제 선택된 세부 주제명
        const finalTopicForJournal = selectedSubTopicDetails ? selectedSubTopicDetails.displayText : (selectedMain || "알 수 없는 주제");

        if (finalTopicForJournal && finalTopicForJournal !== "알 수 없는 주제" && chatHistory.length > 2 && typeof saveJournalEntry === 'function') {
            const journalDetailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || chatHistory.map(m=>m.content).join('\n').substring(0,500) + "...",
                title: lastAiAnalysisData?.summaryTitle || finalTopicForJournal.substring(0,30),
                mood: lastAiAnalysisData?.overallSentiment,
                keywords: lastAiAnalysisData?.keywords,
                detailedAnalysis: lastAiAnalysisData || {},
                sessionDurationMinutes: SESSION_TIMEOUT_DURATION / (60 * 1000), // 타임아웃 시간
                userCharCountForThisSession: userCharCountInSession
            };

            let entryTypeForSave = (userRole === 'parent') ? 'child' : 'standard';
            let childIdForSave = (userRole === 'parent') ? targetChildId : null;
            let childNameForSave = (userRole === 'parent') ? (localStorage.getItem('lozee_childName_for_mypage') || '아이') : null;

            await saveJournalEntry(
                loggedInUserId,
                finalTopicForJournal,
                journalDetailsToSave,
                {
                    relatedChildId: childIdForSave,
                    entryType: entryTypeForSave,
                    childName: childNameForSave
                }
            );
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
            const finalUserCharCountOverall = previousTotalUserCharCountOverall + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, finalUserCharCountOverall);
        }
        if(inputArea) inputArea.style.display = 'none';
    }, SESSION_TIMEOUT_DURATION);
}

async function sendMessage(text, inputMethod = 'text') {
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
        const userDiagnoses = JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]'); // 보호자 모드일 경우 자녀의 특성 사용 필요
        
        let traitsForGpt = userDiagnoses;
        if (userRole === 'parent') {
            // 보호자 모드일 경우, talk.html 로드 시점에 localStorage에 'lozee_childDiagnoses' 등을 저장해두고 사용
            traitsForGpt = JSON.parse(localStorage.getItem('lozee_childDiagnoses_for_talk') || '[]');
        }

        const res = await getGptResponse(text, {
            chatHistory,
            verbosity: gptVerbosityPreference,
            elapsedTime: elapsedTimeInMinutesForGPT,
            userTraits: traitsForGpt, // 수정된 userTraits 전달
            userId: loggedInUserId // 서버로 userId 전달
        });

        if (thinkingBubble) thinkingBubble.remove();

        if (!res.ok) {
            appendMessage('이런, 로지가 지금 좀 아픈가 봐. 잠시 후에 다시 시도해 줄래? 😥', 'assistant');
            return;
        }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        const analysisDataFromGpt = d.analysis || {};

        lastAiAnalysisData = analysisDataFromGpt;
        appendMessage(cleanText, 'assistant');

        if (!skipTTS) {
            await playTTSWithControl(cleanText);
        }
        skipTTS = false;

        chatHistory.push({ role: 'assistant', content: cleanText });
        assistantMessageCount++;

        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && currentTopicForSend) {
            showJournalReadyNotification();
        }

        const currentSessionElapsedTime = (Date.now() - conversationStartTime) / (1000 * 60);
        const finalUserCharCountForAnalysis = previousTotalUserCharCountOverall + userCharCountInSession;

        if (currentSessionElapsedTime >= 10 && userTurnCountInSession >= 20 && finalUserCharCountForAnalysis >= 1500 && !analysisNotificationShown) {
            console.log(`[분석 조건 충족!] 상세 분석 실행 및 localStorage 저장`);
            let detailedAnalysisDataForStorage = { ...(lastAiAnalysisData || {}) };

            if (userRole === 'child' && LOZEE_ANALYSIS && typeof LOZEE_ANALYSIS.inferAgeAndLanguage === 'function') {
                try {
                    const conversationTextForAgeAnalysis = chatHistory.map(item => `${item.role}: ${item.content}`).join('\n');
                    const ageAnalysisResult = await LOZEE_ANALYSIS.inferAgeAndLanguage(conversationTextForAgeAnalysis);
                    if (ageAnalysisResult && !ageAnalysisResult.error) {
                        detailedAnalysisDataForStorage.ageLanguageAnalysis = {
                            predictedAge: ageAnalysisResult.predicted_age_group || "분석 중...",
                            feedback: ageAnalysisResult.feedback_message || "결과를 바탕으로 피드백을 생성합니다."
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
                // userCharCount: userCharCountInSession, // 이건 sessionDurationMinutes와 함께 저장되므로 불필요할 수 있음
                // timestamp: Date.now() // 이미 createdAt이 있음
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