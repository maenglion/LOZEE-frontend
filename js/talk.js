// js/talk.js

// Firebase SDK 및 유틸리티 함수 import
import './firebase-config.js'; // Firebase 앱 초기화 (db, auth export 확인)
import { db } from './firebase-config.js';
import { doc, getDoc, serverTimestamp, updateDoc, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './lozee-analysis.js'; // inferAgeAndLanguage 함수 등을 포함한 객체
import {
  saveJournalEntry,
  updateTopicStats,
  updateUserOverallStats,
  logSessionStart,
  logSessionEnd,

} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 상태 변수 ---
let skipTTS = false,
    hasGreeted = false,
    isProcessing = false;
let chatHistory = [],
    selectedMain = null, // 선택된 주 주제 카테고리명
    selectedSubTopicDetails = null; // 선택된 서브토픽 객체 {displayText, tags, ...}
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
let currentFirestoreSessionId = null;
let micButtonCurrentlyProcessing = false;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micButton = document.getElementById('mic-button');
const meterLevel = document.getElementById('volume-level');

// --- 사용자 정보 (localStorage에서 가져옴) ---
const loggedInUserId = localStorage.getItem('lozee_userId'); // ⭐ index.html에서 설정된 UID 사용const loggedInUserId = localStorage.getItem('lozee_userId'); // index.html에서 Firebase Auth UID로 설정됨
const userRole = localStorage.getItem('lozee_role') || 'child';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10); // 대화 맥락 나이
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const isParentND = localStorage.getItem('lozee_parentIsND') === 'true';
const targetChildId = localStorage.getItem('lozee_childId'); // 보호자 모드 시 자녀 UID
const currentUserType = (userRole === 'parent') ? 'caregiver' : 'directUser';

console.log("Talk.js Loaded - UserID:", loggedInUserId, "Role:", userRole, "TargetAge:", targetAge, "UserType:", currentUserType);

// --- Firestore 유틸리티 ---
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
        // Firestore 보안 규칙 확인 필요
    }
    return 0;
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('talk.js: DOMContentLoaded 이벤트 발생. UserID:', loggedInUserId);

    let startedWithInitTopic = false; // ⭐ 사용 전에 선언 및 초기화

    if (!loggedInUserId) {
        alert("사용자 정보를 인식할 수 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }
    if (!currentUserType) {
        alert("사용자 유형 정보가 없습니다. 시작 페이지에서 유형을 다시 선택해주세요.");
        window.location.href = 'index.html';
        return;
    }

    conversationStartTime = Date.now();
    try {
        previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
        console.log("talk.js: 이전 누적 사용자 발화 글자 수:", previousTotalUserCharCountOverall);
    } catch (error) {
        console.error("fetchPreviousUserCharCount 함수 실행 중 에러 발생:", error);
        previousTotalUserCharCountOverall = 0;
    }
    resetSessionTimeout();

    const initTopicDataString = localStorage.getItem('lozee_talk_init_topic');
    if (initTopicDataString) {
        try {
            const initTopic = JSON.parse(initTopicDataString);
            localStorage.removeItem('lozee_talk_init_topic');
            if (initTopic.details) {
                selectedMain = initTopic.type === 'continue_specific_topic' ? findMainCategoryOfTopic(initTopic.details, counselingTopicsByAge) || initTopic.details : initTopic.details;
                selectedSubTopicDetails = initTopic.planType ? initTopic : findSubTopicDetails(initTopic.details, counselingTopicsByAge);

                const initialMessageFromLozee = initTopic.prompt || `지난번 '${selectedMain || initTopic.details}' 이야기에 이어서 더 나눠볼까?`;
                appendMessage(initialMessageFromLozee, 'assistant');
                console.log(`talk.js: "${selectedMain || initTopic.details}" 주제 이어하기 시작.`);
                startChat(initialMessageFromLozee, 'topic_selection_init', selectedSubTopicDetails || {displayText: selectedMain});
                hasGreeted = true;
                startedWithInitTopic = true;
            } else {
                console.warn("initTopic.details가 없어 이어하기를 시작할 수 없습니다.");
                // 이어하기 정보가 유효하지 않으면 일반 시작 흐름으로
                startedWithInitTopic = false;
            }
        } catch (e) {
            console.error("이어하기 주제(lozee_talk_init_topic) 파싱 오류:", e);
            localStorage.removeItem('lozee_talk_init_topic');
            startedWithInitTopic = false; // 오류 시 일반 시작
        }
    }

    if (!startedWithInitTopic) {
        const greeting = getInitialGreeting(userNameToDisplay + voc, hasGreeted);
        appendMessage(greeting, 'assistant');
        hasGreeted = true;
        showMainTopics();
    }
});

// --- 메시지 및 UI 관련 함수 ---
function appendMessage(text, role) {
    // ... (이전 제공 코드와 동일)
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
    // ... (이전 제공 코드와 동일)
    if (journalReadyNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification';
    notification.textContent = '📝 이야기가 충분히 쌓였네요! 이 대화는 종료 시 자동으로 저장됩니다.';
    if(chatWindow) chatWindow.appendChild(notification);
    journalReadyNotificationShown = true;
}

function showAnalysisNotification() {
    // ... (이전 제공 코드와 동일, 분석 페이지 분기 로직 포함)
    if (analysisNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    notification.onclick = () => {
        const ageForAnalysisRedirect = targetAge; // 대화 맥락 나이 사용
        if (ageForAnalysisRedirect >= 15 && currentUserType === 'directUser') {
             console.log("showAnalysisNotification: 성인 분석 페이지(analysis_adult.html)로 이동");
             window.location.href = 'analysis_adult.html';
        } else {
             console.log("showAnalysisNotification: 일반 분석 페이지(analysis.html)로 이동");
             window.location.href = 'analysis.html';
        }
    };
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}


// --- TTS 및 STT 관련 함수 ---
async function playTTSWithControl(txt) {
    // ... (이전 제공 코드와 동일, 단 /api/tts 호출 주소는 tts.js에서 수정되어야 함) ...
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
   } catch (error) {
        console.error("playTTSWithControl 내 TTS 재생 오류:", error.message, error); // 에러 메시지 포함하여 로깅
        // TTS 실패 시 사용자에게 알리지 않고 콘솔에만 기록 (대화 흐름 유지)
   }
   finally { isPlayingTTS = false; }
}
// ... (interp, setupAudioAnalysis, draw, stopAudio, STT 관련 변수 및 로직은 이전과 동일) ...
let audioContext, analyser, source, dataArray, animId, streamRef;
const LOW_COLOR = { r:0, g:200, b:0 }; const MID_COLOR = { r:255, g:200, b:0 }; const HIGH_COLOR = { r:255, g:69, b:0 };
function interp(c1, c2, f) {
    const r = Math.round(c1.r + f * (c2.r - c1.r));
    const g = Math.round(c1.g + f * (c2.g - c1.g));
    const b = Math.round(c1.b + f * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}
function setupAudioAnalysis(stream) { if (audioContext && audioContext.state !== 'closed') {audioContext.close().catch(e=>console.warn("이전 AudioContext 닫기 오류:", e));} audioContext = new AudioContext(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; source = audioContext.createMediaStreamSource(stream); source.connect(analyser); dataArray = new Uint8Array(analyser.frequencyBinCount); streamRef = stream; draw(); }
function draw() { animId = requestAnimationFrame(draw); if (!analyser || !dataArray) return; analyser.getByteFrequencyData(dataArray); let sum = dataArray.reduce((a, v) => a + v, 0); let avg = dataArray.length > 0 ? sum / dataArray.length : 0; let norm = Math.min(100, Math.max(0, (avg / 140) * 100)); if(meterLevel) {meterLevel.style.width = norm + '%'; meterLevel.style.background = `linear-gradient(to right, var(--background-color), ${norm <= 50 ? interp(LOW_COLOR, MID_COLOR, norm / 50) : interp(MID_COLOR, HIGH_COLOR, (norm - 50) / 50)})`;} if (norm > 10 && isRec && isPlayingTTS && !skipTTS) { console.log("사용자 음성 감지, TTS 중단 시도"); if (typeof stopCurrentTTS === 'function') stopCurrentTTS(); skipTTS = true; } }
function stopAudio() { if (animId) cancelAnimationFrame(animId); if (source) source.disconnect(); if (streamRef) streamRef.getTracks().forEach(track => track.stop()); if (audioContext && audioContext.state !== 'closed') { audioContext.close().catch(e=>console.warn("AudioContext 닫기 오류:", e)); } audioContext = null; if(meterLevel) { meterLevel.style.width = '0%'; meterLevel.style.background = getComputedStyle(document.documentElement).getPropertyValue('--volume-meter-container-bg'); } }
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog, isRec = false;
if (SpeechRecognitionAPI) {
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
function getTopicsForCurrentUser() { /* ... 이전과 동일 (currentUserType, targetAge 사용) ... */
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    console.log(`getTopicsForCurrentUser - currentUserType: ${currentUserType}, targetAge: ${targetAge}, ageGroupKey: ${ageGroupKey}`);
    if (!counselingTopicsByAge) { console.error("counselingTopicsByAge 객체가 없습니다!"); return {}; }
    let topicsForUserGroup;
    if (currentUserType === 'directUser' && counselingTopicsByAge.directUser) {
        topicsForUserGroup = counselingTopicsByAge.directUser[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    } else if (currentUserType === 'caregiver' && counselingTopicsByAge.caregiver) {
        topicsForUserGroup = counselingTopicsByAge.caregiver || {};
    } else {
        console.warn(`알 수 없는 사용자 유형(${currentUserType}). 기본 주제 사용.`);
        topicsForUserGroup = counselingTopicsByAge.directUser ? (counselingTopicsByAge.directUser['11-15세'] || {}) : {};
    }
    console.log("getTopicsForCurrentUser - 반환될 topicsForUserGroup (첫 200자):", JSON.stringify(topicsForUserGroup).substring(0, 200) + "...");
    if (!topicsForUserGroup || Object.keys(topicsForUserGroup).length === 0) {
        console.warn(`getTopicsForCurrentUser: 주제 카테고리가 없거나 비어있습니다.`);
        return {};
    }
    return topicsForUserGroup;
}
function displayOptionsInChat(optionsArray, onSelectCallback) { /* ... 이전과 동일 ... */
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
        button.onclick = () => { buttons.forEach(btn => { btn.disabled = true; if (btn === button) { btn.classList.add('selected'); } }); onSelectCallback(valueToCallback, optionObject); };
        optionsContainer.appendChild(button); buttons.push(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
function showMainTopics() { /* ... 이전과 동일 (selectedSubTopicDetails 초기화 포함) ... */
    console.log("showMainTopics 함수 실행됨");
    selectedSubTopicDetails = null;
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    let topicsWithOptions = [];
    const continueTopicDataFromPlans = localStorage.getItem('lozee_continue_topic');
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
            let icon = '💬';
            if (currentUserTopics[categoryName] && Array.isArray(currentUserTopics[categoryName]) && currentUserTopics[categoryName].length > 0 && currentUserTopics[categoryName][0].icon) {
                icon = currentUserTopics[categoryName][0].icon;
            }
            return { icon: icon, displayText: categoryName, isContinuation: false };
        });
        topicsWithOptions.push(...categoryOptions);
    } else { console.warn(`showMainTopics: counseling_topics.js에서 주제를 가져오지 못했거나 비어있습니다.`); }
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제', isContinuation: false });
    console.log("showMainTopics - 최종 주제 선택 옵션 (첫 300자):", JSON.stringify(topicsWithOptions).substring(0, 300) + "...");
    displayOptionsInChat(topicsWithOptions, (selectedCategoryText, fullOptionObject) => {
        selectedMain = selectedCategoryText;
        if (fullOptionObject && fullOptionObject.isContinuation) {
            localStorage.removeItem('lozee_continue_topic');
            selectedMain = fullOptionObject.continueDetails.details || selectedCategoryText;
            selectedSubTopicDetails = fullOptionObject.continueDetails;
            appendMessage(selectedMain + ' 이야기를 이어갈게!', 'assistant');
            const continueMessage = fullOptionObject.continueDetails.prompt || `저번에 이야기했던 '${selectedMain}'에 대해 계속 이야기해보자.`;
            startChat(continueMessage, 'topic_selection_init', selectedSubTopicDetails);
        } else if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제', tags: ['자유대화'] };
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            const message = '네가 정하면 돼. 어떤 이야기가 하고 싶어?';
            appendMessage(message, 'assistant');
            if(inputArea) inputArea.style.display = 'flex';
            if(chatInput) chatInput.focus();
        } else {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 300);
        }
    });
}
function showSubTopics() { /* ... 이전과 동일 (selectedSubTopicDetails 설정 포함) ... */
    if (!selectedMain || selectedMain === '자유주제') return;
    const currentUserTopicCategories = getTopicsForCurrentUser();
    let subtopicOptions = [];
    if (currentUserTopicCategories && currentUserTopicCategories[selectedMain] && Array.isArray(currentUserTopicCategories[selectedMain])) {
        subtopicOptions = currentUserTopicCategories[selectedMain];
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
        selectedSubTopicDetails = fullOptionObject;
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
    });
}
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) { /* ... 이전과 동일 (logSessionStart에 loggedInUserId 전달) ... */
    console.log("startChat 함수 시작됨, 초기 메시지:", initText, "입력방식:", inputMethod, "선택된 주 주제:", selectedMain, "선택된 서브토픽 상세:", topicDetails);
    if (inputArea) inputArea.style.display = 'flex';
    const topicForLogging = topicDetails ? topicDetails.displayText : (selectedMain || "알 수 없는 주제");
    if (loggedInUserId && topicForLogging && topicForLogging !== "알 수 없는 주제" && !currentFirestoreSessionId && typeof logSessionStart === 'function') {
        logSessionStart(loggedInUserId, topicForLogging).then(id => { // ⭐ UID 사용
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
function resetSessionTimeout() { /* ... 이전과 동일 (모든 Firestore 함수 호출 시 loggedInUserId, currentUserType 전달) ... */
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
                detailedAnalysis: lastAiAnalysisData || {},
                sessionDurationMinutes: (Date.now() - conversationStartTime) / (60 * 1000),
                userCharCountForThisSession: userCharCountInSession
            };
            let entryTypeForSave = (userRole === 'parent') ? 'child' : 'standard';
            let childIdForSave = (userRole === 'parent') ? targetChildId : null; // targetChildId는 UID
            let childNameForSave = (userRole === 'parent') ? (localStorage.getItem('lozee_childName') || '아이') : null;
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

async function sendMessage(text, inputMethod = 'text') { /* ... 이전과 동일 (getGptResponse에 loggedInUserId 전달, 분석 조건에 currentUserType, targetAge 사용) ... */
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
        let traitsForGpt = [];
        if (userRole === 'parent') {
            traitsForGpt = JSON.parse(localStorage.getItem('lozee_childDiagnoses_for_talk') || localStorage.getItem('lozee_diagnoses') || '[]'); // 보호자 모드 시 자녀 특성 우선
        } else {
            traitsForGpt = JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]');
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
            const errorText = await res.text();
            console.error("GPT API 응답 오류:", res.status, errorText);
            appendMessage(`이런, 로지가 지금 좀 아픈가 봐요 (서버 응답: ${res.status}). 잠시 후에 다시 시도해 주세요. 😥`, 'assistant');
            return;
        }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        const analysisDataFromGpt = d.analysis || {};

        lastAiAnalysisData = analysisDataFromGpt;
        appendMessage(cleanText, 'assistant');

        if (!skipTTS) {
            try {
                 await playTTSWithControl(cleanText);
            } catch (ttsError) {
                console.error("playTTSWithControl 내부에서 TTS 오류 발생 (sendMessage에서 catch):", ttsError.message, ttsError);
            }
        }
        skipTTS = false;

        chatHistory.push({ role: 'assistant', content: cleanText });
        assistantMessageCount++;

        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && currentTopicForSend) {
            showJournalReadyNotification();
        }

        const currentSessionElapsedTime = (Date.now() - conversationStartTime) / (1000 * 60);
        const finalUserCharCountForAnalysis = previousTotalUserCharCountOverall + userCharCountInSession;
        console.log(
            `[분석 조건 체크] 시간: ${currentSessionElapsedTime.toFixed(1)}분 (기준:10), 사용자 턴: ${userTurnCountInSession} (기준:20), 총 글자수: ${finalUserCharCountForAnalysis} (기준:1500)`
        );

        if (currentSessionElapsedTime >= 10 && userTurnCountInSession >= 20 && finalUserCharCountForAnalysis >= 1500 && !analysisNotificationShown) {
            console.log(`[분석 조건 충족!] 상세 분석 실행 및 localStorage 저장`);
            let detailedAnalysisDataForStorage = { ...(lastAiAnalysisData || {}) };

            // 언어 연령 분석은 당사자(directUser) 역할이고, 대화 맥락 나이(targetAge)가 12세 이하일 때만 실행
            if (currentUserType === 'directUser' && targetAge <= 12 && LOZEE_ANALYSIS && typeof LOZEE_ANALYSIS.inferAgeAndLanguage === 'function') {
                try {
                    const conversationTextForAgeAnalysis = chatHistory.map(item => `${item.role}: ${item.content}`).join('\n');
                    // ⭐ API 호출 경로 확인: LOZEE_ANALYSIS.inferAgeAndLanguage 내부에서 사용하는 URL이 올바른지 확인
                    const ageAnalysisResult = await LOZEE_ANALYSIS.inferAgeAndLanguage(conversationTextForAgeAnalysis);
                    if (ageAnalysisResult && !ageAnalysisResult.error) {
                        detailedAnalysisDataForStorage.ageLanguageAnalysis = {
                            predictedAge: ageAnalysisResult.predicted_age_group || "분석 중...",
                            feedback: ageAnalysisResult.feedback_message || "결과를 바탕으로 피드백을 생성합니다."
                            // 실제 백엔드 응답에 따라 stage1PredictedAge 등도 포함 가능
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
                accumulatedDurationMinutes: currentSessionElapsedTime
            };

            const gptProvidedAnalysisExists = Object.keys(lastAiAnalysisData || {}).length > 0;
            if (gptProvidedAnalysisExists || detailedAnalysisDataForStorage.ageLanguageAnalysis) {
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStoreInLocalStorage));
                console.log("localStorage에 'lozee_conversation_analysis' 저장 완료:", dataToStoreInLocalStorage);
                showAnalysisNotification();
                // analysisNotificationShown = true; // showAnalysisNotification 함수 내부에서 처리
            } else {
                console.log("생성된 유의미한 분석 데이터가 없어 알림 표시 및 localStorage 저장 안 함.");
            }
        } else if (!analysisNotificationShown) {
            console.log("[분석 조건 미충족 또는 이미 알림 표시됨]");
        }
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error.message, error);
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
    for (const userTypeKey in topicsData) {
        const ageGroups = topicsData[userTypeKey];
        if (!ageGroups) continue;
        for (const ageGroupKey in ageGroups) {
            const mainTopicCategories = ageGroups[ageGroupKey];
            if (!mainTopicCategories) continue;
            for (const mainTopicName in mainTopicCategories) {
                const subTopicsArray = mainTopicCategories[mainTopicName];
                if (Array.isArray(subTopicsArray)) {
                     const found = subTopicsArray.find(st => st.displayText === subTopicDisplayText);
                     if (found) return mainTopicName;
                }
            }
        }
    }
    return '';
}
function findSubTopicDetails(subTopicDisplayText, topicsData) {
    if (!subTopicDisplayText || !topicsData) return null;
     for (const userTypeKey in topicsData) {
        const ageGroups = topicsData[userTypeKey];
        if (!ageGroups) continue;
        for (const ageGroupKey in ageGroups) {
            const mainTopicCategories = ageGroups[ageGroupKey];
            if (!mainTopicCategories) continue;
            for (const mainTopicName in mainTopicCategories) {
                const subTopicsArray = mainTopicCategories[mainTopicName];
                if (Array.isArray(subTopicsArray)) {
                    const found = subTopicsArray.find(st => st.displayText === subTopicDisplayText);
                    if (found) return { ...found, mainCategory: mainTopicName };
                }
            }
        }
    }
    return null;
}