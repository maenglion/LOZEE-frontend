// js/talk.js

import './firebase-config.js'; // 경로 수정
import { db } from './firebase-config.js'; // 경로 수정
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js'; // 경로 수정
import { playTTSFromText, stopCurrentTTS } from './tts.js'; // 경로 수정
import LOZEE_ANALYSIS from './lozee-analysis.js'; // 경로 수정
import {
  saveJournalEntry,
  saveManualJournalEntry,
  updateTopicStats,
  updateUserOverallStats,
  logSessionStart,
  logSessionEnd
} from './firebase-utils.js'; // 경로 수정
import { counselingTopicsByAge } from './counseling_topics.js'; // 경로 수정

// --- 상태 변수 ---
let skipTTS = false,
    hasGreeted = false,
    isProcessing = false;
let chatHistory = [],
    selectedMain = null,
    isPlayingTTS = false;
let conversationStartTime = null;
let analysisNotificationShown = false;
let journalReadyNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000;
let lastAiAnalysisData = null;
let userTurnCountInSession = 0;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let assistantMessageCount = 0,
    gptVerbosityPreference = 'default';
let lastVerbosityPromptTime = 0,
    verbosityPromptCount = 0;
const PREFERENCE_PROMPT_INTERVAL = 10 * 60 * 1000;
let currentFirestoreSessionId = null;
let awaitManualSave = false;
let manualSaveConfirmed = false;
let micButtonCurrentlyProcessing = false;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micButton = document.getElementById('mic-button');
const meterLevel = document.getElementById('volume-level');
// const topicArea = document.getElementById('topic-area'); // HTML에 실제 이 ID를 가진 요소가 없으므로 주석 처리

// --- 사용자 정보 ---
const userName = localStorage.getItem('lozee_username') || '친구';
const userAge = parseInt(localStorage.getItem('lozee_userage') || '0', 10);
const currentUserEmail = localStorage.getItem('cbtUserEmail');
let userType = localStorage.getItem('lozee_userType') || '';
const voc = getKoreanVocativeParticle(userName);

async function fetchPreviousUserCharCount() {
    if (!currentUserEmail) return 0;
    try {
        const userRef = doc(db, 'users', currentUserEmail);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().totalUserCharCount) {
            return parseInt(userSnap.data().totalUserCharCount, 10) || 0;
        }
    } catch (error) { console.error("Firestore 이전 누적 글자 수 로드 오류:", error); }
    return 0;
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('talk.html: DOMContentLoaded 이벤트 발생');
    if (currentUserEmail === 'unbearable_@naver.com') { // 테스트 계정 userType 강제 설정
        userType = 'caregiver';
        localStorage.setItem('lozee_userType', 'caregiver'); // localStorage에도 반영
    }
    if (!currentUserEmail) { alert("사용자 정보(이메일)가 없습니다. 다시 로그인해주세요."); window.location.href = 'index.html'; return; }
    if (!userType) { alert("사용자 유형 정보가 없습니다. 시작 페이지에서 유형을 다시 선택해주세요."); window.location.href = 'index.html'; return; }

    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    console.log("talk.html: 이전 누적 사용자 발화 글자 수:", previousTotalUserCharCountOverall);
    resetSessionTimeout();

    let startedWithInitTopic = false;
    const initTopicDataString = localStorage.getItem('lozee_talk_init_topic');
    if (initTopicDataString) {
        try {
            const initTopic = JSON.parse(initTopicDataString);
            localStorage.removeItem('lozee_talk_init_topic');
            if (initTopic.details) {
                selectedMain = initTopic.details;
                const initialMessageFromLozee = initTopic.prompt || `지난번 '${selectedMain}' 이야기에 이어서 더 나눠볼까?`;
                appendMessage(initialMessageFromLozee, 'assistant');
                console.log(`talk.html: "${selectedMain}" 주제 이어하기 시작.`);
                startChat(initialMessageFromLozee, 'topic_selection_init');
                hasGreeted = true;
                startedWithInitTopic = true;
            } else { console.warn("initTopic.details가 없어 이어하기를 시작할 수 없습니다."); }
        } catch (e) { console.error("이어하기 주제(lozee_talk_init_topic) 파싱 오류:", e); localStorage.removeItem('lozee_talk_init_topic');}
    }

    if (!startedWithInitTopic) {
        const greeting = getInitialGreeting(userName + voc, hasGreeted);
        appendMessage(greeting, 'assistant');
        hasGreeted = true;
        showMainTopics();
    }
});

function appendMessage(text, role) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + role;
    bubble.textContent = text;
    if(chatWindow) { chatWindow.appendChild(bubble); chatWindow.scrollTop = chatWindow.scrollHeight; }
    else { console.error("appendMessage: chatWindow 요소를 찾을 수 없습니다."); }
}

function showJournalReadyNotification() {
    if (journalReadyNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification';
    notification.textContent = '📝 이야기가 충분히 쌓였네요! 이 대화는 종료 시 자동으로 저장됩니다.';
    if(chatWindow) chatWindow.appendChild(notification);
    journalReadyNotificationShown = true;
}

function showAnalysisNotification() {
    if (analysisNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    notification.onclick = () => { location.href = 'analysis.html'; };
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}

async function playTTSWithControl(txt) {
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
function interp(c1, c2, f) { return `rgb(<span class="math-inline">\{Math\.round\(c1\.r \+ f \* \(c2\.r \- c1\.r\)\)\},</span>{Math.round(c1.g + f * (c2.g - c1.g))},${Math.round(c1.b + f * (c2.b - c1.b))})`;}
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

function getTopicsForCurrentUser() {
    const ageForTopicLookup = userAge;
    console.log(`getTopicsForCurrentUser - userType: ${userType}, ageForTopicLookup (본인나이): ${ageForTopicLookup}`);
    if (!counselingTopicsByAge) { console.error("counseling_topics.js를 찾을 수 없거나, counselingTopicsByAge 객체가 export 되지 않았습니다!"); return {}; }
    let topicsForUserGroup;
    if (userType === 'directUser' && counselingTopicsByAge.directUser) {
        if (ageForTopicLookup < 11) topicsForUserGroup = counselingTopicsByAge.directUser['10세미만'] || counselingTopicsByAge.directUser['7-10'] || {};
        else if (ageForTopicLookup >= 11 && ageForTopicLookup <= 15) topicsForUserGroup = counselingTopicsByAge.directUser['11-15세'] || {};
        else if (ageForTopicLookup >= 16 && ageForTopicLookup <= 29) topicsForUserGroup = counselingTopicsByAge.directUser['16-29세'] || {};
        else topicsForUserGroup = counselingTopicsByAge.directUser['30-55세'] || counselingTopicsByAge.directUser['16-29세'] || {}; // 30-55세 또는 기본값
    } else if (userType === 'caregiver' && counselingTopicsByAge.caregiver) {
        topicsForUserGroup = counselingTopicsByAge.caregiver || {};
    } else {
        console.warn(`알 수 없거나 지원하지 않는 사용자 유형(${userType})입니다. 기본 주제를 사용합니다.`);
        topicsForUserGroup = counselingTopicsByAge.directUser ? (counselingTopicsByAge.directUser['11-15세'] || {}) : {};
    }
    console.log("getTopicsForCurrentUser - 반환될 topicsForUserGroup:", JSON.stringify(topicsForUserGroup, null, 2));
    if (!topicsForUserGroup || Object.keys(topicsForUserGroup).length === 0) {
        console.warn(`getTopicsForCurrentUser: 최종적으로 사용자/나이에 맞는 주제 카테고리가 없거나 비어있습니다. counseling_topics.js 내용을 확인하세요.`);
        return {};
    }
    return topicsForUserGroup;
}

function displayOptionsInChat(optionsArray, onSelectCallback) {
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
        if (optionObject && optionObject.isManualSave) { button.classList.add('manual-save-btn');}
        button.onclick = () => { buttons.forEach(btn => { btn.disabled = true; if (btn === button) { btn.classList.add('selected'); } }); onSelectCallback(valueToCallback, optionObject); }; // ⭐ fullOptionObject 전달
        optionsContainer.appendChild(button); buttons.push(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showMainTopics() {
    console.log("showMainTopics 함수 실행됨");
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
    console.log("showMainTopics - 최종 주제 선택 옵션:", JSON.stringify(topicsWithOptions, null, 2));
    displayOptionsInChat(topicsWithOptions, (selectedText, fullOptionObject) => {
        selectedMain = selectedText;
        if (fullOptionObject && fullOptionObject.isContinuation) {
            localStorage.removeItem('lozee_continue_topic');
            selectedMain = fullOptionObject.continueDetails.details || selectedText;
            appendMessage(selectedMain + ' 이야기를 이어갈게!', 'assistant');
            const continueMessage = fullOptionObject.continueDetails.prompt || `저번에 이야기했던 '${selectedMain}'에 대해 계속 이야기해보자.`;
            startChat(continueMessage, 'topic_selection_init');
        } else if (selectedMain === '자유주제') {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            const message = '네가 정하면 돼. 어떤 이야기가 하고 싶어?';
            appendMessage(message, 'assistant');
            if(inputArea) inputArea.style.display = 'flex'; if(chatInput) chatInput.focus();
        } else {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 300);
        }
    });
}

function showSubTopics() {
    if (!selectedMain || selectedMain === '자유주제') {
        if(selectedMain === '자유주제') startChat('', 'topic_selection_init');
        return;
    }
    const currentUserTopicCategories = getTopicsForCurrentUser(); let subtopicOptions = [];
    if (currentUserTopicCategories && currentUserTopicCategories[selectedMain] && Array.isArray(currentUserTopicCategories[selectedMain])) {
        subtopicOptions = currentUserTopicCategories[selectedMain];
    } else {
        subtopicOptions = [{ icon: '💬', displayText: '이 주제에 대해 자유롭게 이야기해 줄래?' }];
    }
    if (!subtopicOptions || subtopicOptions.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init'); return;
    }
    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
    displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => { // fullOptionObject 추가
        startChat(selectedSubtopicText, 'topic_selection_init');
    });
}

function startChat(initText, inputMethod = 'topic_selection_init') {
    console.log("startChat 함수 시작됨, 초기 메시지:", initText, "입력방식:", inputMethod, "현재 selectedMain:", selectedMain);
    if (inputArea) inputArea.style.display = 'flex';
    if(currentUserEmail && selectedMain && !currentFirestoreSessionId && typeof logSessionStart === 'function'){
        logSessionStart(currentUserEmail, selectedMain).then(id => {
            if (id) currentFirestoreSessionId = id;
        });
    }
    if (initText && String(initText).trim() !== '') { sendMessage(initText, inputMethod); }
    else { if (chatInput) chatInput.focus(); }
}

function askForVerbosityPreference() {
    // 함수 내용은 이전과 동일하게 유지하거나 필요에 따라 구현
    console.log("askForVerbosityPreference 호출됨 (구현은 생략)");
}

function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(async () => {
        appendMessage("오랫동안 응답이 없어서 대화를 종료할게. 다음에 또 이야기하자! 😊", 'assistant_feedback');
        if (currentFirestoreSessionId && typeof logSessionEnd === 'function') {
            await logSessionEnd(currentFirestoreSessionId);
        }
        if (selectedMain && chatHistory.length > 2 && typeof saveJournalEntry === 'function') { // 최소한 사용자/봇 1턴 이상 대화
            const gptAnalysisForSave = {
                 ...(lastAiAnalysisData || {}), // GPT가 제공한 분석이 있다면 포함
                 sessionDurationMinutes: SESSION_TIMEOUT_DURATION / (60 * 1000), // 실제 경과 시간 대신 타임아웃 시간으로
                 userCharCountForThisSession: userCharCountInSession, // 현재 세션 글자 수
            };
            await saveJournalEntry(currentUserEmail, selectedMain, chatHistory, gptAnalysisForSave);
            await updateTopicStats(currentUserEmail, selectedMain);
            const finalUserCharCountOverall = previousTotalUserCharCountOverall + userCharCountInSession;
            await updateUserOverallStats(currentUserEmail, userType, finalUserCharCountOverall);
        }
        if(inputArea) inputArea.style.display = 'none'; // 입력창 숨기기
    }, SESSION_TIMEOUT_DURATION);
}


async function sendMessage(text, inputMethod = 'text') {
    if (
        !selectedMain &&
        inputMethod !== 'topic_selection_init' &&
        text.trim() !== ''
    ) {
        appendMessage(
            "이야기를 시작하기 전에 먼저 어떤 주제로 이야기할지 선택해 줄래? 😊",
            "assistant_feedback"
        );
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
        const elapsedTimeInMinutesForGPT =
            (Date.now() - conversationStartTime) / (1000 * 60);
        const userDiagnoses = JSON.parse(
            localStorage.getItem('lozee_diagnoses') || '[]'
        );
        const res = await getGptResponse(text, {
            chatHistory,
            verbosity: gptVerbosityPreference,
            elapsedTime: elapsedTimeInMinutesForGPT,
            userTraits: userDiagnoses
        });

        if (thinkingBubble) thinkingBubble.remove(); // thinkingBubble 제거는 res.ok 확인 전에 수행

        if (!res.ok) {
            // GPT API 오류 처리 (예: 500 응답 등)
            appendMessage(
                '이런, 로지가 지금 좀 아픈가 봐. 잠시 후에 다시 시도해 줄래? 😥',
                'assistant'
            );
            // isProcessing, micButtonCurrentlyProcessing, sendBtn.classList.remove('loading') 등은 finally 블록에서 처리
            return;
        }

        const d = await res.json(); // 서버는 { text: "...", analysis: { ... } } 형태로 응답

        // 서버가 이미 텍스트와 분석 데이터를 분리해서 전달한다고 가정
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        const analysisDataFromGpt = d.analysis || {}; // 서버에서 파싱된 analysis 객체 사용

        lastAiAnalysisData = analysisDataFromGpt;
        appendMessage(cleanText, 'assistant');

        if (!skipTTS) {
            await playTTSWithControl(cleanText);
        }
        skipTTS = false;

        chatHistory.push({ role: 'assistant', content: cleanText }); // 대화 기록에는 순수 텍스트만 저장
        assistantMessageCount++;

        if (
            userCharCountInSession >= 800 &&
            !journalReadyNotificationShown &&
            selectedMain
        ) {
            showJournalReadyNotification();
        }

        const currentSessionElapsedTime =
            (Date.now() - conversationStartTime) / (1000 * 60);
        const finalUserCharCountForAnalysis =
            previousTotalUserCharCountOverall +
            userCharCountInSession;
        console.log(
            `[분석 조건 체크] 시간: ${currentSessionElapsedTime.toFixed(
                1
            )}분 (기준:10), 사용자 턴: ${userTurnCountInSession} (기준:20), 총 글자수: ${finalUserCharCountForAnalysis} (기준:1500)`
        );

        if (
            currentSessionElapsedTime >= 10 &&
            userTurnCountInSession >= 20 &&
            finalUserCharCountForAnalysis >= 1500 &&
            !analysisNotificationShown
        ) {
            console.log(`[분석 조건 충족!] 상세 분석 실행 및 localStorage 저장`);
            let detailedAnalysisDataForStorage = {
                ...(lastAiAnalysisData || {}) // GPT가 제공한 기본 분석 데이터 (서버에서 파싱된 analysis 객체)
            };

            if (
                LOZEE_ANALYSIS &&
                typeof LOZEE_ANALYSIS.inferAgeAndLanguage === 'function'
            ) {
                try {
                    const conversationTextForAgeAnalysis = chatHistory
                        .map(item => `${item.role}: ${item.content}`)
                        .join('\n');
                    const ageAnalysisResult =
                        await LOZEE_ANALYSIS.inferAgeAndLanguage(
                            conversationTextForAgeAnalysis
                        );

                    if (
                        ageAnalysisResult &&
                        !ageAnalysisResult.error
                    ) {
                        detailedAnalysisDataForStorage.ageLanguageAnalysis = {
                            predictedAge:
                                ageAnalysisResult.predicted_age_group ||
                                "분석 중...",
                            feedback:
                                ageAnalysisResult.feedback_message ||
                                "결과를 바탕으로 피드백을 생성합니다."
                        };
                        console.log(
                            "언어 연령 분석 결과 추가됨:",
                            detailedAnalysisDataForStorage.ageLanguageAnalysis
                        );
                    } else {
                        console.warn(
                            "언어 연령 분석 실패 또는 오류:",
                            ageAnalysisResult?.error
                        );
                    }
                } catch (langAnalysisError) {
                    console.error(
                        "inferAgeAndLanguage 함수 실행 중 오류:",
                        langAnalysisError
                    );
                }
            }

            const dataToStoreInLocalStorage = {
                results