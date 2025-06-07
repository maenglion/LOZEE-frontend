// js/talk.js

// --- 1. 모듈 Import ---
import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './keywordCloud.js';
import LOZEE_ANALYSIS from './emotionData.js';
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
let isPlayingTTS = false, conversationStartTime = null, analysisNotificationShown = false;
let journalReadyNotificationShown = false, sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분
let lastAiAnalysisData = null, userTurnCountInSession = 0, userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0, currentFirestoreSessionId = null, isDataSaved = false;

// --- 3. UI 요소 가져오기 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micButton = document.getElementById('mic-button');

// --- 4. 사용자 정보 (UID 기반으로 통일) ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userRole = localStorage.getItem('lozee_role') || 'child';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const currentUserType = (userRole === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;

// --- 5. 헬퍼 및 핵심 로직 함수 정의 ---

function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
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

function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.style.cursor = 'pointer';
    notification.style.borderLeft = '5px solid #4CAF50';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 지금까지의 내용을 확인해보세요.</strong>`;
    notification.onclick = () => {
        const dataToStore = {
            results: lastAiAnalysisData || {},
            journalId: journalId,
            journalTitle: lastAiAnalysisData?.summaryTitle || "중간 저장된 대화"
        };
        localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));
        window.open(`journal.html?journalId=${journalId}`, '_blank');
    };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

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
            mood: lastAiAnalysisData?.overallSentiment,
            keywords: lastAiAnalysisData?.keywords,
            detailedAnalysis: lastAiAnalysisData || {},
            sessionDurationMinutes: (Date.now() - conversationStartTime) / (60 * 1000),
            userCharCountForThisSession: userCharCountInSession
        };
        const entryTypeForSave = (currentUserType === 'caregiver') ? 'child' : 'standard';
        const journalId = await saveJournalEntry(loggedInUserId, finalTopicForJournal, journalDetailsToSave, { 
            relatedChildId: targetChildId, 
            entryType: entryTypeForSave,
            childName: (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childName') || '아이' : null
        });
        if (journalId) {
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
            const finalUserCharCountOverall = previousTotalUserCharCountOverall + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, finalUserCharCountOverall);
        }
    }
}

function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}

function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : '16-29세');
    if (!counselingTopicsByAge) { console.error("counseling_topics.js를 찾을 수 없습니다!"); return {}; }
    let topics = {};
    if (currentUserType === 'directUser' && counselingTopicsByAge.directUser) {
        topics = counselingTopicsByAge.directUser[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    } else if (currentUserType === 'caregiver' && counselingTopicsByAge.caregiver) {
        topics = counselingTopicsByAge.caregiver;
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
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    let topicsWithOptions = Object.keys(currentUserTopics).map(categoryName => ({
        icon: currentUserTopics[categoryName]?.[0]?.icon || '💬',
        displayText: categoryName
    }));
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제' });
    displayOptionsInChat(topicsWithOptions, (selectedText) => {
        selectedMain = selectedText;
        if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제', tags: ['자유대화'] };
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
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain, tags: [selectedMain] });
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
    isDataSaved = false; resetSessionTimeout(); isProcessing = true;
    
    if (inputMethod !== 'topic_selection_init') {
        appendMessage(text, 'user');
        userTurnCountInSession++;
        userCharCountInSession += text.length;
    }
    chatHistory.push({ role: 'user', content: text });
    if (chatInput) chatInput.value = '';
    
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'bubble assistant thinking';
    thinkingBubble.textContent = '생각중이야...';
    if (chatWindow) { chatWindow.appendChild(thinkingBubble); chatWindow.scrollTop = chatWindow.scrollHeight; }

    try {
        const res = await getGptResponse(text, {
            chatHistory, userId: loggedInUserId, userTraits: JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]')
        });

        if (thinkingBubble) thinkingBubble.remove();
        if (!res.ok) { throw new Error(`GPT API 응답 오류: ${res.status}`); }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        lastAiAnalysisData = d.analysis || {};
        
        appendMessage(cleanText, 'assistant');
        await playTTSFromText(cleanText, localStorage.getItem('lozee_voice'));
        chatHistory.push({ role: 'assistant', content: cleanText });
        
        // 중간 저장 및 분석 알림 로직은 여기에 위치합니다.
        
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
    }
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('talk.js: DOMContentLoaded');
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }
    window.addEventListener('beforeunload', endSessionAndSave);
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    resetSessionTimeout();
    showMainTopics(); // 페이지 로드 후 바로 주제 선택 시작
});

// --- 이벤트 바인딩 ---
if(sendBtn) sendBtn.addEventListener('click', () => sendMessage(chatInput.value, 'text'));
if(chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendMessage(chatInput.value, 'text'); }});