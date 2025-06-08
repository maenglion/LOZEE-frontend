// js/talk.js

// --- 1. 모듈 Import ---
import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import {
    saveJournalEntry,
    updateTopicStats,
    updateUserOverallStats,
    logSessionStart,
    logSessionEnd
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';
import LOZEE_ANALYSIS from './lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let isProcessing = false;
let chatHistory = [];
let selectedMain = null;
let selectedSubTopicDetails = null;
let conversationStartTime = null;
let lastAiAnalysisData = null;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let currentFirestoreSessionId = null;
let isDataSaved = false;
let isTtsMode = true;
let journalReadyNotificationShown = false;
let analysisNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000;

// --- 3. UI 요소 가져오기 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');
const sessionHeaderTextEl = document.getElementById('session-header');

const micIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>`;

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의 ---

function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateActionButtonIcon() {
    if (!actionButton) return;
    if (isTtsMode) {
        actionButton.innerHTML = micIconSVG;
    } else {
        actionButton.innerHTML = 'T';
        actionButton.style.fontSize = '20px';
        actionButton.style.fontWeight = 'bold';
    }
}

async function playTTSWithControl(txt) {
    if (!isTtsMode) return;
    if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
    try {
        if (typeof playTTSFromText === 'function') await playTTSFromText(txt, localStorage.getItem('lozee_voice'));
    } catch (error) {
        console.error("TTS 재생 오류 (서버 CORS 설정을 확인하세요):", error);
    }
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

function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    if (!counselingTopicsByAge || typeof counselingTopicsByAge !== 'object') {
        console.error("counseling_topics.js 로드 실패!");
        return {};
    }
    if (currentUserType === 'directUser') return counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    if (currentUserType === 'caregiver') return counselingTopicsByAge.caregiver || {};
    return {};
}

function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = selectedMain || '';
    const sub = selectedSubTopicDetails?.displayText || '';
    const journalTitle = lastAiAnalysisData?.summaryTitle || '';
    let displayText = main;
    if (sub) displayText += ` > ${sub}`;
    if (journalTitle) displayText += ` > ${journalTitle}`;
    sessionHeaderTextEl.textContent = displayText;
}

function showMainTopics() {
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    if (!currentUserTopics || Object.keys(currentUserTopics).length === 0) {
        appendMessage("상담 주제를 불러오는 데 실패했습니다. 페이지를 새로고침 하시거나 관리자에게 문의해주세요.", "assistant_feedback");
        return;
    }
    let topicsWithOptions = Object.keys(currentUserTopics).map(categoryName => ({
        icon: currentUserTopics[categoryName]?.[0]?.icon || '💬',
        displayText: categoryName
    }));
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제' });
    displayOptionsInChat(topicsWithOptions, (selectedText) => {
        selectedMain = selectedText;
        updateSessionHeader();
        if (selectedMain === '자유주제') {
            selectedSubTopicDetails = { displayText: '자유주제' };
            appendMessage('자유주제 이야기를 선택했구나! 어떤 이야기가 하고 싶어?', 'assistant');
            startChat('', 'topic_selection_init', selectedSubTopicDetails);
        } else {
            appendMessage(selectedMain + ' 이야기를 선택했구나!', 'assistant');
            setTimeout(showSubTopics, 200);
        }
    });
}

function showSubTopics() {
    const subtopicOptions = getTopicsForCurrentUser()[selectedMain] || [];
    if (subtopicOptions.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain });
    } else {
        appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
        displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
            selectedSubTopicDetails = fullOptionObject;
            updateSessionHeader();
            startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
        });
    }
}

function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    if (inputArea) inputArea.style.display = 'flex';
    if (initText) sendMessage(initText, inputMethod);
    else if (chatInput) chatInput.focus();
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
            detailedAnalysis: lastAiAnalysisData || {},
            sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
            userCharCountForThisSession: userCharCountInSession
        };
        const entryTypeForSave = (currentUserType === 'caregiver') ? 'child' : 'standard';
        const journalId = await saveJournalEntry(loggedInUserId, finalTopicForJournal, journalDetailsToSave, {
            relatedChildId: targetChildId, entryType: entryTypeForSave,
            childName: currentUserType === 'caregiver' ? localStorage.getItem('lozee_childName') : null
        });
        if (journalId) {
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
            const totalChars = (await fetchPreviousUserCharCount()) + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, totalChars);
        }
    }
}

function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}

function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showAnalysisNotification() {
    if (analysisNotificationShown || !chatWindow) return;
    analysisNotificationShown = true;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.innerHTML = '📊 분석 완료! <strong>클릭해서 확인</strong>';
    notification.onclick = () => {
        const redirectUrl = (targetAge >= 15 && currentUserType === 'directUser') ? 'analysis_adult.html' : 'analysis.html';
        window.location.href = redirectUrl;
    };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage(text, inputMethod) {
    if (!text || String(text).trim() === '' || isProcessing) return;
    isProcessing = true;
    if (actionButton) actionButton.disabled = true;
    resetSessionTimeout();

    if (inputMethod !== 'topic_selection_init') appendMessage(text, 'user');
    if (chatInput) chatInput.value = '';
    appendMessage('...', 'assistant thinking');

    try {
        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        
        const res = await getGptResponse(text, { chatHistory: [...chatHistory], userId: loggedInUserId, elapsedTime: elapsedTimeInMinutes });
        
        chatWindow.querySelector('.thinking')?.remove();
        if (!res.ok) throw new Error(`GPT API 응답 오류: ${res.status}`);

        chatHistory.push({ role: 'user', content: text });

        const gptResponse = await res.json();
        const rawResponseText = gptResponse.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        let cleanText = rawResponseText;
        let jsonString = null;
        const jsonStartIndex = rawResponseText.indexOf('{"');

        if (jsonStartIndex !== -1) {
            cleanText = rawResponseText.substring(0, jsonStartIndex).trim();
            jsonString = rawResponseText.substring(jsonStartIndex);
            try {
                lastAiAnalysisData = JSON.parse(jsonString);
                updateSessionHeader();

                // ⭐ ADDED: Call analysis functions from LOZEE_ANALYSIS module
                if (LOZEE_ANALYSIS) {
                    if (LOZEE_ANALYSIS.trackEmotionTone) {
                        LOZEE_ANALYSIS.trackEmotionTone(lastAiAnalysisData);
                    }
                    if (LOZEE_ANALYSIS.trackSituation) {
                        LOZEE_ANALYSIS.trackSituation(lastAiAnalysisData);
                    }
                }

            } catch (e) {
                console.error("❌ GPT 응답 JSON 파싱 실패:", e);
            }
        }

        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);
        chatHistory.push({ role: 'assistant', content: cleanText });

        userCharCountInSession = chatHistory.filter(m => m.role === 'user').reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);
        
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true;
            const topicForJournal = selectedSubTopicDetails?.displayText || selectedMain;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${topicForJournal}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: elapsedTimeInMinutes,
                userCharCountForThisSession: userCharCountInSession
            };
            saveJournalEntry(loggedInUserId, topicForJournal, detailsToSave, {
                relatedChildId: (currentUserType === 'caregiver' ? localStorage.getItem('lozee_childId') : null),
                entryType: (currentUserType === 'caregiver' ? 'child' : 'standard')
            }).then(id => {
                if (id) displayJournalCreatedNotification(id);
            });
        }
        const userTurnCount = chatHistory.filter(m => m.role === 'user').length;
        if (elapsedTimeInMinutes >= 10 && userTurnCount >= 10 && !analysisNotificationShown) {
            if (lastAiAnalysisData) {
                const dataToStore = { results: lastAiAnalysisData, accumulatedDurationMinutes: elapsedTimeInMinutes };
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));
                showAnalysisNotification();
            }
        }

    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        chatWindow.querySelector('.thinking')?.remove();
        appendMessage("오류가 발생했어요. 잠시 후 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
        if (actionButton) actionButton.disabled = false;
    }
}

// --- 6. STT and other functions... (rest of the code is unchanged) ---
let isRec = false;
let micButtonCurrentlyProcessing = false;
let audioContext, analyser, source, dataArray, animId, streamRef;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;

if (SpeechRecognitionAPI) {
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';
    recog.onstart = () => { isRec = true; if (actionButton) actionButton.classList.add('recording'); micButtonCurrentlyProcessing = false; };
    recog.onend = () => { isRec = false; if (actionButton) actionButton.classList.remove('recording'); stopAudio(); micButtonCurrentlyProcessing = false; };
    recog.onresult = event => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript; }
        if (final_transcript) sendMessage(final_transcript.trim(), 'stt');
    };
    recog.onerror = event => { console.error('Speech recognition error:', event.error); if (isRec) recog.stop(); };
} else {
    console.warn('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
}

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

function draw() {
    if (!analyser || !dataArray) return;
    animId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    let avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    let norm = Math.min(100, Math.max(0, (avg / 140) * 100));
    if (meterLevel) meterLevel.style.width = norm + '%';
}

function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
}

function handleMicButtonClick() {
    if (chatInput && chatInput.value.trim() !== '') {
        sendMessage(chatInput.value.trim(), 'text');
        return;
    }
    if (!SpeechRecognitionAPI) return;
    if (isProcessing || micButtonCurrentlyProcessing) return;
    micButtonCurrentlyProcessing = true;
    if (isRec) {
        if (recog) recog.stop();
        micButtonCurrentlyProcessing = false;
        return;
    }
    if (isTtsMode) {
        if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => { setupAudioAnalysis(stream); if (recog) recog.start(); })
            .catch(e => {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            });
    } else {
        isTtsMode = true;
        updateActionButtonIcon();
        appendMessage("음성 모드가 다시 켜졌어요. 이제 로지의 답변을 음성으로 들을 수 있습니다.", "assistant_feedback");
        micButtonCurrentlyProcessing = false;
    }
}


// --- 7. 페이지 로드 후 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const style = document.createElement('style');
        style.textContent = `
            body.talk-page-body { overflow: hidden; }
            @media (min-width: 641px) {
                .app-container.talk-page { max-width: 640px; height: 90vh; margin: auto; }
            }
        `;
        document.head.appendChild(style);
        document.body.classList.add('talk-page-body');
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.classList.add('talk-page');

        const ttsToggleBtn = document.getElementById('tts-toggle-btn');
        if (ttsToggleBtn) ttsToggleBtn.style.display = 'none';
        const widthToggleBtn = document.getElementById('width-toggle-btn-floating');
        if (widthToggleBtn) widthToggleBtn.style.display = 'none';
        
        if (inputArea) inputArea.style.display = 'none';

        if (!loggedInUserId) {
            console.error("사용자 정보(userId)가 없습니다. 시작 페이지로 이동합니다.");
            window.location.href = 'index.html';
            return;
        }

        updateActionButtonIcon();
        if (actionButton) actionButton.addEventListener('click', handleMicButtonClick);
        if (chatInput) {
            chatInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    handleMicButtonClick();
                }
            });
            chatInput.addEventListener('input', () => {
                if (isTtsMode && chatInput.value.length > 0) {
                    isTtsMode = false;
                    updateActionButtonIcon();
                }
            });
        }

        conversationStartTime = Date.now();
        previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
        currentFirestoreSessionId = await logSessionStart(loggedInUserId, "대화 시작");
        resetSessionTimeout();

        const greeting = getInitialGreeting(userNameToDisplay + voc, false);
        appendMessage(greeting, 'assistant');
        await playTTSWithControl(greeting);
        showMainTopics();
        window.addEventListener('beforeunload', () => { if (chatHistory.length > 2 && !isDataSaved) endSessionAndSave(); });

    } catch (error) {
        console.error("페이지 초기화 중 심각한 오류가 발생했습니다:", error);
        appendMessage("페이지를 불러오는 중 문제가 발생했어요.", "assistant_feedback");
    }
});
