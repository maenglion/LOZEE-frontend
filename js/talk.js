// js/talk.js

// --- 1. 모듈 Import ---
import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './lozee-analysis.js';
import {
  saveJournalEntry,
  updateTopicStats,
  updateUserOverallStats,
  logSessionStart,
  logSessionEnd
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 2. 상태 변수 선언 ---
let skipTTS = false, hasGreeted = false, isProcessing = false;
let chatHistory = [], selectedMain = null, selectedSubTopicDetails = null;
let conversationStartTime = null, lastAiAnalysisData = null;
let userCharCountInSession = 0, previousTotalUserCharCountOverall = 0;
let currentFirestoreSessionId = null, isDataSaved = false, journalReadyNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000;

// --- 3. UI 요소 가져오기 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const widthToggleBtn = document.getElementById('width-toggle-btn-floating');
const appContainer = document.querySelector('.app-container');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 함수 정의 (누락된 모든 함수 포함) ---

function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function playTTSWithControl(txt) {
    const isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
    if (!isTtsEnabled || skipTTS) {
        skipTTS = false;
        return;
    }
    if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
    try {
        if (typeof playTTSFromText === 'function') await playTTSFromText(txt, localStorage.getItem('lozee_voice'));
    } catch (error) {
        console.error("TTS 재생 오류:", error);
    }
}

async function fetchPreviousUserCharCount() {
    if (!loggedInUserId) return 0;
    try {
        const userRef = doc(db, 'users', loggedInUserId);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? (userSnap.data().totalUserCharCount || 0) : 0;
    } catch (error) {
        console.error("Firestore 이전 누적 글자 수 로드 오류:", error);
        return 0;
    }
}


// ⭐⭐⭐ 1. 이 함수를 추가해주세요. ⭐⭐⭐
async function endSessionAndSave() {
    if (isDataSaved) return;
    isDataSaved = true;
    appendMessage("대화를 안전하게 마무리하고 있어요...", 'assistant_feedback');
    if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId);

    const finalTopicForJournal = selectedSubTopicDetails?.displayText || selectedMain || "알 수 없는 주제";
    if (finalTopicForJournal !== "알 수 없는 주제" && chatHistory.length > 2) {
        const journalDetailsToSave = {
            summary: lastAiAnalysisData?.conversationSummary || "대화 요약이 생성되지 않았습니다.",
            title: lastAiAnalysisData?.summaryTitle || finalTopicForJournal,
            detailedAnalysis: lastAiAnalysisData || {},
        };
        const entryTypeForSave = (currentUserType === 'caregiver') ? 'child' : 'standard';
        const journalId = await saveJournalEntry(loggedInUserId, finalTopicForJournal, journalDetailsToSave, { 
            relatedChildId: targetChildId, 
            entryType: entryTypeForSave,
            childName: currentUserType === 'caregiver' ? localStorage.getItem('lozee_childName') : null
        });
        if (journalId) {
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
            await updateUserOverallStats(loggedInUserId, currentUserType, previousTotalUserCharCountOverall + userCharCountInSession);
        }
    }
}

// ⭐⭐⭐ 2. 이 함수도 추가해주세요. ⭐⭐⭐
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}

function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    if (!counselingTopicsByAge) { console.error("counseling_topics.js 로드 실패!"); return {}; }
    let topics = {};
    if (currentUserType === 'directUser') {
        topics = counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    } else if (currentUserType === 'caregiver') {
        topics = counselingTopicsByAge.caregiver || {};
    }
    return topics;
}

function displayOptionsInChat(optionsArray, onSelectCallback) {
    if (!chatWindow) return;
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'chat-options-container';
    optionsArray.forEach(optionObject => {
        let buttonText = optionObject?.displayText || optionObject;
        if (optionObject?.icon) buttonText = `${optionObject.icon} ${buttonText}`;
        const button = document.createElement('button');
        button.className = 'chat-option-btn';
        button.innerHTML = buttonText;
        button.onclick = () => {
            optionsContainer.querySelectorAll('.chat-option-btn').forEach(btn => btn.disabled = true);
            button.classList.add('selected');
            onSelectCallback(optionObject.displayText || optionObject, optionObject);
        };
        optionsContainer.appendChild(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showMainTopics() {
    selectedSubTopicDetails = null;
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    let topicsWithOptions = Object.keys(currentUserTopics).map(categoryName => ({
        icon: currentUserTopics[categoryName]?.[0]?.icon || '💬', displayText: categoryName
    }));
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제' });
    displayOptionsInChat(topicsWithOptions, (selectedText) => {
        selectedMain = selectedText;
        if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제' };
            appendMessage('자유주제 이야기를 선택했구나! 어떤 이야기가 하고 싶어?', 'assistant');
            if (inputArea) inputArea.style.display = 'flex';
            if (chatInput) chatInput.focus();
        } else {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 300);
        }
    });
}

function showSubTopics() {
    const subtopicOptions = getTopicsForCurrentUser()[selectedMain] || [];
    if (subtopicOptions.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain });
        return;
    }
    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
    displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
        selectedSubTopicDetails = fullOptionObject;
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
    });
}

function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    if (inputArea) inputArea.style.display = 'flex';
    const topicForLogging = topicDetails?.displayText || selectedMain;
    if (loggedInUserId && topicForLogging && !currentFirestoreSessionId) {
        logSessionStart(loggedInUserId, topicForLogging).then(id => { if (id) currentFirestoreSessionId = id; });
    }
    if (initText) sendMessage(initText, inputMethod);
    else if (chatInput) chatInput.focus();
}

async function sendMessage(text, inputMethod = 'text') {
    if (!text || String(text).trim() === '' || isProcessing) return;
    isProcessing = true;
    if (actionButton) actionButton.disabled = true;

    if (inputMethod !== 'topic_selection_init') {
        appendMessage(text, 'user');
        userCharCountInSession += text.length;
    }
    chatHistory.push({ role: 'user', content: text });
    if (chatInput) chatInput.value = '';
    
    appendMessage('...', 'assistant thinking');

    try {
        const res = await getGptResponse(text, { 
            chatHistory, 
            userId: loggedInUserId,
            userTraits: JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]')
        });

        chatWindow.querySelector('.thinking')?.remove();
        if (!res.ok) {
            throw new Error(`GPT API 응답 오류: ${res.status}`);
        }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        lastAiAnalysisData = d.analysis || {};
        
        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText); // TTS 호출 로직
        chatHistory.push({ role: 'assistant', content: cleanText });
        
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        chatWindow.querySelector('.thinking')?.remove();
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
        if (actionButton) actionButton.disabled = false;
    }
}

// --- 6. 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }
    console.log("talk.js 로드 완료. 사용자 UID:", loggedInUserId);
    
    // 이전에 누락되었던 로직을 모두 여기에 포함합니다.
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    resetSessionTimeout(); // resetSessionTimeout 정의는 아래에 있어야 함
    
    // TTS 토글 버튼 로직
    if (ttsToggleBtn) {
        let isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
        const updateTtsButtonState = () => {
            ttsToggleBtn.classList.toggle('off', !isTtsEnabled);
            ttsToggleBtn.innerHTML = isTtsEnabled ? '🔊' : '🔇';
        };
        updateTtsButtonState();
        ttsToggleBtn.onclick = () => {
            isTtsEnabled = !isTtsEnabled;
            localStorage.setItem('lozee_tts_enabled', isTtsEnabled ? 'true' : 'false');
            updateTtsButtonState();
            if (!isTtsEnabled && typeof stopCurrentTTS === 'function') stopCurrentTTS();
        };
    }
    
    // STT 관련 상태 변수
let isRec = false;
let micButtonCurrentlyProcessing = false;
let audioContext, analyser, source, dataArray, animId, streamRef;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;

// 음량바 시각화 함수
function draw() {
    if (!analyser || !dataArray) return;
    animId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    let avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    let norm = Math.min(100, Math.max(0, (avg / 140) * 100));
    if (meterLevel) meterLevel.style.width = norm + '%';
}

// 오디오 분석 설정 함수
function setupAudioAnalysis(stream) {
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    streamRef = stream;
    if (meterContainer) meterContainer.classList.add('active');
    draw();
}

// 오디오 스트림 및 시각화 중지 함수
function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
}

// 마이크 버튼 클릭 로직
function handleMicButtonClick() {
    if (isProcessing || micButtonCurrentlyProcessing) return;
    micButtonCurrentlyProcessing = true;
    
    if (isRec) {
        if(recog) recog.stop();
    } else {
        if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setupAudioAnalysis(stream);
                if(recog) recog.start();
            })
            .catch(e => {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            });
    }
}

// STT 초기 설정
if (SpeechRecognitionAPI) {
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';
    
    recog.onstart = () => {
        isRec = true;
        if(actionButton) actionButton.classList.add('recording');
        micButtonCurrentlyProcessing = false;
    };
    recog.onend = () => {
        isRec = false;
        if(actionButton) actionButton.classList.remove('recording');
        stopAudio();
        micButtonCurrentlyProcessing = false;
    };
    recog.onresult = event => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            }
        }
        if (final_transcript) {
            sendMessage(final_transcript.trim(), 'stt');
        }
    };
    recog.onerror = event => {
        console.error('Speech recognition error:', event.error);
        if (isRec) recog.stop();
    };
} else {
    if(actionButton) actionButton.innerHTML = '➤'; // STT 미지원 시 전송 기능만 제공
    console.warn('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
}

// ⭐ 마이크/전송 버튼 통합 로직 (초기화 및 이벤트 핸들러)
if (chatInput && actionButton) {
    const updateActionButton = () => {
        if (chatInput.value.trim().length > 0) {
            actionButton.innerHTML = '➤';
            actionButton.onclick = () => sendMessage(chatInput.value, 'text');
        } else {
            actionButton.innerHTML = '🎤';
            if (SpeechRecognitionAPI) {
                actionButton.onclick = handleMicButtonClick;
            } else {
                actionButton.disabled = true; // STT 미지원 시 비활성화
            }
        }
    };
    chatInput.addEventListener('input', updateActionButton);
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            if (chatInput.value.trim().length > 0) {
                sendMessage(chatInput.value, 'text');
            }
        }
    });
    updateActionButton(); // 페이지 로드 시 초기 상태 설정
}
    
    // 대화 시작
    appendMessage(getInitialGreeting(userNameToDisplay + voc, false), 'assistant');
    showMainTopics();
});