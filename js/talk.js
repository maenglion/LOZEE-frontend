// js/talk.js

// --- 1. 모듈 Import ---
import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import { saveJournalEntry, updateTopicStats, updateUserOverallStats, logSessionStart, logSessionEnd } from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 2. 상태 변수 선언 ---
let skipTTS = false, isProcessing = false;
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
const micButton = document.getElementById('mic-button'); // 이전 코드와의 호환성을 위해 유지
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 함수 정의 (누락된 함수 모두 포함) ---

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
        await playTTSFromText(txt, localStorage.getItem('lozee_voice'));
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

function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : '16-29세');
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
    
    if (inputMethod !== 'topic_selection_init') appendMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });
    if (inputMethod !== 'topic_selection_init') userCharCountInSession += text.length;
    if (chatInput) chatInput.value = '';
    
    appendMessage('...', 'assistant thinking');

    try {
        const res = await getGptResponse(text, { chatHistory, userId: loggedInUserId });
        chatWindow.querySelector('.thinking')?.remove();
        if (!res.ok) throw new Error(`GPT API 응답 오류: ${res.status}`);

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        lastAiAnalysisData = d.analysis || {};
        
        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);
        chatHistory.push({ role: 'assistant', content: cleanText });
        
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        chatWindow.querySelector('.thinking')?.remove();
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
    }
}


// --- 6. 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }
    
    // TTS 토글 버튼 초기화 및 이벤트 핸들러
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
    
    // 마이크/전송 버튼 통합 로직
    if (chatInput && actionButton) {
        const updateActionButton = () => {
            if (chatInput.value.trim().length > 0) {
                actionButton.innerHTML = '➤';
                actionButton.onclick = () => sendMessage(chatInput.value, 'text');
            } else {
                actionButton.innerHTML = '🎤';
                actionButton.onclick = () => { /* STT 시작 로직 */ };
            }
        };
        chatInput.addEventListener('input', updateActionButton);
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                if (chatInput.value.trim().length > 0) sendMessage(chatInput.value, 'text');
            }
        });
        updateActionButton();
    }
    
    // 대화 시작
    appendMessage(getInitialGreeting(userNameToDisplay + voc, false), 'assistant');
    showMainTopics();
});