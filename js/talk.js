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
let isPlayingTTS = false;
let conversationStartTime = null;
let analysisNotificationShown = false;
let journalReadyNotificationShown = false; // 중간 저장 알림 표시 여부
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분
let lastAiAnalysisData = null;
let userTurnCountInSession = 0;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let currentFirestoreSessionId = null;
let isDataSaved = false; // 최종 저장 여부 (중복 저장 방지)

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
    
    console.log("세션 종료 및 최종 저널 저장 로직 실행...");
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
    if (!currentTopicForSend && inputMethod !== 'topic_selection_init' && text.trim() !== '') {
        appendMessage("이야기를 시작하기 전에 먼저 어떤 주제로 이야기할지 선택해 줄래? 😊", "assistant_feedback");
        showMainTopics();
        return;
    }
    if (!text || String(text).trim() === '' || isProcessing) return;

    isDataSaved = false;
    resetSessionTimeout();
    isProcessing = true;

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
    if (chatWindow) {
        chatWindow.appendChild(thinkingBubble);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    try {
        const elapsedTimeInMinutesForGPT = (Date.now() - conversationStartTime) / (1000 * 60);
        const traitsForGpt = JSON.parse(localStorage.getItem('lozee_diagnoses') || '[]');
        
        const res = await getGptResponse(text, {
            chatHistory,
            elapsedTime: elapsedTimeInMinutesForGPT,
            userTraits: traitsForGpt,
            userId: loggedInUserId
        });

        if (thinkingBubble) thinkingBubble.remove();
        if (!res.ok) {
            const errorText = await res.text();
            console.error("GPT API 응답 오류:", res.status, errorText);
            appendMessage(`이런, 로지가 지금 좀 아픈가 봐요. 잠시 후에 다시 시도해 주세요.`, 'assistant_feedback');
            return;
        }

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        const analysisDataFromGpt = d.analysis || {};
        lastAiAnalysisData = analysisDataFromGpt;

        appendMessage(cleanText, 'assistant');
        if (!skipTTS) await playTTSWithControl(cleanText);
        skipTTS = false;
        chatHistory.push({ role: 'assistant', content: cleanText });
        
        // 중간 저장 및 클릭 가능한 알림 생성
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true; // 중복 실행 방지
            console.log("대화량 충족. 중간 저널 생성을 시도합니다.");
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "대화 요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${currentTopicForSend}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData || {},
                sessionDurationMinutes: elapsedTimeInMinutesForGPT,
                userCharCountForThisSession: userCharCountInSession
            };
            saveJournalEntry(loggedInUserId, currentTopicForSend, detailsToSave, {
                relatedChildId: targetChildId,
                entryType: (currentUserType === 'caregiver' ? 'child' : 'standard'),
                childName: (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childName') || '아이' : null
            }).then(newJournalId => {
                if (newJournalId) {
                    console.log(`중간 저널 생성 성공. ID: ${newJournalId}`);
                    displayJournalCreatedNotification(newJournalId);
                }
            });
        }

        // 최종 분석 조건 확인 및 알림
        const finalUserCharCountForAnalysis = previousTotalUserCharCountOverall + userCharCountInSession;
        if (elapsedTimeInMinutesForGPT >= 10 && userTurnCountInSession >= 20 && finalUserCharCountForAnalysis >= 1500 && !analysisNotificationShown) {
            console.log(`[분석 조건 충족!] 상세 분석 실행 및 localStorage 저장`);
            let detailedAnalysisDataForStorage = { ...(lastAiAnalysisData || {}) };
            if (currentUserType === 'directUser' && targetAge <= 12 && LOZEE_ANALYSIS) {
                const conversationTextForAgeAnalysis = chatHistory.map(item => `${item.role}: ${item.content}`).join('\n');
                const ageAnalysisResult = await LOZEE_ANALYSIS.inferAgeAndLanguage(conversationTextForAgeAnalysis);
                if (ageAnalysisResult && !ageAnalysisResult.error) {
                    detailedAnalysisDataForStorage.ageLanguageAnalysis = ageAnalysisResult;
                }
            }
            if (Object.keys(detailedAnalysisDataForStorage).length > 0) {
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify({ results: detailedAnalysisDataForStorage, accumulatedDurationMinutes: elapsedTimeInMinutesForGPT }));
                showAnalysisNotification();
            }
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
        console.log(`분석 페이지(${redirectUrl})로 이동합니다.`);
        window.location.href = redirectUrl;
    };
    if(chatWindow) chatWindow.appendChild(notification);
    analysisNotificationShown = true;
}

function getTopicsForCurrentUser() { /* ... */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* ... */ }
function showMainTopics() { /* ... */ }
function showSubTopics() { /* ... */ }
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) { /* ... */ }
// (STT/TTS 관련 함수들은 이전 답변의 완성된 코드와 동일하게 유지)

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
    const initTopicDataString = localStorage.getItem('lozee_talk_init_topic');
    if (initTopicDataString) {
        try {
            const initTopic = JSON.parse(initTopicDataString);
            localStorage.removeItem('lozee_talk_init_topic');
            if (initTopic.details) {
                selectedMain = initTopic.details;
                selectedSubTopicDetails = initTopic;
                const initialMessageFromLozee = initTopic.prompt || `지난번 '${selectedMain}' 이야기에 이어서 더 나눠볼까?`;
                appendMessage(initialMessageFromLozee, 'assistant');
                startChat(initialMessageFromLozee, 'topic_selection_init', initTopic);
                hasGreeted = true;
            } else {
                showMainTopics();
            }
        } catch (e) {
            showMainTopics();
        }
    } else {
        const greeting = getInitialGreeting(userNameToDisplay + voc, hasGreeted);
        appendMessage(greeting, 'assistant');
        hasGreeted = true;
        showMainTopics();
    }
});

// --- 이벤트 바인딩 ---
if(sendBtn) sendBtn.addEventListener('click', () => { resetSessionTimeout(); sendMessage(chatInput.value, 'text'); });
if(chatInput) chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        sendMessage(chatInput.value, 'text');
    }
});