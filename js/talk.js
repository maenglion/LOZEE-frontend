// js/talk.js

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

// --- 상태 변수 ---
let skipTTS = false, hasGreeted = false, isProcessing = false;
let chatHistory = [], selectedMain = null, selectedSubTopicDetails = null;
let isPlayingTTS = false, conversationStartTime = null, analysisNotificationShown = false;
let journalReadyNotificationShown = false, sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분
let lastAiAnalysisData = null, userTurnCountInSession = 0, userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0, currentFirestoreSessionId = null, isDataSaved = false;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// --- 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userRole = localStorage.getItem('lozee_role') || 'child';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const currentUserType = (userRole === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;

// --- 함수 정의 ---
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

async function sendMessage(text, inputMethod = 'text') {
    const currentTopicForSend = selectedSubTopicDetails?.displayText || selectedMain;
    if (!currentTopicForSend && inputMethod !== 'topic_selection_init') {
        appendMessage("이야기를 시작하기 전에 먼저 어떤 주제로 이야기할지 선택해 줄래? 😊", "assistant_feedback");
        showMainTopics();
        return;
    }
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
            chatHistory,
            userId: loggedInUserId,
            userTraits: JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]')
        });

        if (thinkingBubble) thinkingBubble.remove();
        if (!res.ok) { throw new Error(`GPT API 응답 오류: ${res.status}`); }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        lastAiAnalysisData = d.analysis || {};
        appendMessage(cleanText, 'assistant');
        if (!skipTTS) await playTTSWithControl(cleanText);
        skipTTS = false;
        chatHistory.push({ role: 'assistant', content: cleanText });
        
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "대화 요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${currentTopicForSend}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
                userCharCountForThisSession: userCharCountInSession
            };
            saveJournalEntry(loggedInUserId, currentTopicForSend, detailsToSave, {
                relatedChildId: targetChildId,
                entryType: (currentUserType === 'caregiver' ? 'child' : 'standard'),
                childName: (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childName') || '아이' : null
            }).then(id => { if (id) displayJournalCreatedNotification(id); });
        }
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
    }
}

function showAnalysisNotification() {
    if (analysisNotificationShown) return;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    notification.onclick = () => {
        const redirectUrl = (targetAge >= 15 && currentUserType === 'directUser') ? 'analysis_adult.html' : 'analysis.html';
        window.location.href = redirectUrl;
    };
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}

function appendMessage(text, role) { const bubble = document.createElement('div'); bubble.className = 'bubble ' + role; bubble.textContent = text; if (chatWindow) { chatWindow.appendChild(bubble); chatWindow.scrollTop = chatWindow.scrollHeight; } }
function getTopicsForCurrentUser() { /* 이전과 동일 */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* 이전과 동일 */ }
function showMainTopics() { /* 이전과 동일 */ }
function showSubTopics() { /* 이전과 동일 */ }
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) { /* 이전과 동일 (loggedInUserId 사용) */ }

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
    // ... 이어하기 또는 일반 시작 로직 ...
});

// --- 이벤트 바인딩 ---
if(sendBtn) sendBtn.addEventListener('click', () => sendMessage(chatInput.value, 'text'));
if(chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendMessage(chatInput.value, 'text'); } });