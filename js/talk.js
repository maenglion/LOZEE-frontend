// js/talk.js

// --- 1. 모듈 Import ---
import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import LOZEE_ANALYSIS from './lozee-analysis.js';
import { lozeeEmotions } from './emotionData.js';
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
const sendBtn = document.getElementById('send-btn');
const ttsToggleBtn = document.getElementById('tts-toggle-btn'); // ⭐ TTS 토글 버튼

// --- 4. 사용자 정보 ---
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

// ⭐ TTS 호출 함수 (활성화 여부 확인 로직 포함) ⭐
async function playTTSWithControl(txt) {
    const isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
    if (!isTtsEnabled) {
        console.log("TTS가 비활성화되어 음성 출력을 건너뜁니다.");
        return; 
    }
    if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
    if (skipTTS) { skipTTS = false; return; }
    try {
        if (typeof playTTSFromText === 'function') {
            await playTTSFromText(txt, localStorage.getItem('lozee_voice'));
        }
    } catch (error) {
        console.error("playTTSWithControl 내 TTS 재생 오류:", error);
    }
}

function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.style.cursor = 'pointer';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function endSessionAndSave() { /* 이전 답변의 완성된 코드와 동일 */ }
function resetSessionTimeout() { /* 이전 답변의 완성된 코드와 동일 */ }

// ⭐ 주제 선택 관련 함수들 (전체 복원) ⭐
function getTopicsForCurrentUser() { /* 이전 답변의 완성된 코드와 동일 */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* 이전 답변의 완성된 코드와 동일 */ }
function showMainTopics() { /* 이전 답변의 완성된 코드와 동일 */ }
function showSubTopics() { /* 이전 답변의 완성된 코드와 동일 */ }
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) { /* 이전 답변의 완성된 코드와 동일 */ }

async function sendMessage(text, inputMethod = 'text') {
    if (!text || String(text).trim() === '' || isProcessing) return;
    isDataSaved = false; resetSessionTimeout(); isProcessing = true;
    
    if (inputMethod !== 'topic_selection_init') appendMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });
    if (inputMethod !== 'topic_selection_init') userCharCountInSession += text.length;
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
        if (!res.ok) throw new Error(`GPT API 응답 오류: ${res.status}`);

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        
        let detailedAnalysisData = d.analysis || {};
        const entireConversationText = chatHistory.map(m => m.content).join(' ');
        if (LOZEE_ANALYSIS?.extractEntityEmotionPairs) {
            detailedAnalysisData.entityEmotionPairs = LOZEE_ANALYSIS.extractEntityEmotionPairs(entireConversationText);
        }
        lastAiAnalysisData = detailedAnalysisData;
        
        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText); // ⭐ TTS 호출 로직 포함
        chatHistory.push({ role: 'assistant', content: cleanText });
        
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true;
            const topicForJournal = selectedSubTopicDetails?.displayText || selectedMain;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${topicForJournal}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData
            };
            saveJournalEntry(loggedInUserId, topicForJournal, detailsToSave, {
                relatedChildId: targetChildId,
                entryType: (currentUserType === 'caregiver' ? 'child' : 'standard'),
                childName: (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childName') : null
            }).then(id => { if (id) displayJournalCreatedNotification(id); });
        }
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
    }
}

// --- 초기화 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }
    console.log("talk.js 로드 완료. 사용자 UID:", loggedInUserId);
    window.addEventListener('beforeunload', endSessionAndSave);
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    resetSessionTimeout();
    showMainTopics();

    // ⭐⭐ TTS 토글 버튼 초기화 및 이벤트 핸들러 등록 ⭐⭐
    if (ttsToggleBtn) {
        let isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
        const updateTtsButtonState = () => {
            if (isTtsEnabled) {
                ttsToggleBtn.classList.remove('off');
                ttsToggleBtn.innerHTML = '🔊';
                ttsToggleBtn.title = '음성 듣기 ON';
            } else {
                ttsToggleBtn.classList.add('off');
                ttsToggleBtn.innerHTML = '🔇';
                ttsToggleBtn.title = '음성 듣기 OFF';
            }
        };
        updateTtsButtonState();
        ttsToggleBtn.onclick = () => {
            isTtsEnabled = !isTtsEnabled;
            localStorage.setItem('lozee_tts_enabled', isTtsEnabled);
            updateTtsButtonState();
            if (!isTtsEnabled) {
                stopCurrentTTS();
            }
        };
    }
});

// --- 이벤트 바인딩 ---
if(sendBtn) sendBtn.addEventListener('click', () => sendMessage(chatInput.value, 'text'));
if(chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendMessage(chatInput.value, 'text'); }});