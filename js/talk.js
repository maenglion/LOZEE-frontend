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
// LOZEE_ANALYSIS는 현재 talk.js에서 직접 사용되지 않으므로, 필요시 주석을 해제합니다.
// import LOZEE_ANALYSIS from './lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let isProcessing = false;
let chatHistory = [];
let selectedMain = null;
let selectedSubTopicDetails = null;
let conversationStartTime = null;
let lastAiAnalysisData = null; // GPT로부터 받은 JSON 분석 결과를 저장할 변수
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let currentFirestoreSessionId = null;
let isDataSaved = false;
let skipTTS = false;
let journalReadyNotificationShown = false;
let analysisNotificationShown = false;
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000; // 5분


// --- 3. UI 요소 가져오기 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button'); // 마이크/전송 버튼
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const widthToggleBtn = document.getElementById('width-toggle-btn-floating');
const appContainer = document.querySelector('.app-container');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');
const sessionHeaderTextEl = document.getElementById('session-header'); // 세션 헤더 요소
// 'sendBtn'은 'actionButton'과 역할이 겹칠 수 있으므로, 실제 HTML 구조에 맞게 ID 확인 필요
// const sendBtn = document.getElementById('send-btn'); 

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의 ---

/**
 * 채팅창에 새로운 말풍선을 추가하는 함수
 * @param {string} text - 메시지 내용
 * @param {string} role - 메시지 역할 ('user', 'assistant', 'assistant_feedback' 등)
 */
function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * 로지의 답변을 음성으로 재생하는 함수 (TTS)
 * @param {string} txt - 재생할 텍스트
 */
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

/**
 * 여러 선택지를 버튼 형태로 채팅창에 표시하는 함수
 * @param {Array<Object|string>} optionsArray - 선택지 배열
 * @param {Function} onSelectCallback - 선택 시 실행될 콜백 함수
 */
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

/**
 * 현재 사용자에게 맞는 상담 주제 목록을 가져오는 함수
 * @returns {Object} 주제 목록 객체
 */
function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    if (!counselingTopicsByAge) {
        console.error("counseling_topics.js 로드 실패!");
        return {};
    }
    if (currentUserType === 'directUser') {
        return counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    } else if (currentUserType === 'caregiver') {
        return counselingTopicsByAge.caregiver || {};
    }
    return {};
}

/**
 * 세션 헤더(상단 주제 표시줄)를 업데이트하는 함수
 */
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

/**
 * 메인 주제를 버튼으로 표시하는 함수
 */
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

/**
 * 서브 주제를 버튼으로 표시하는 함수
 */
function showSubTopics() {
    const subtopicOptions = getTopicsForCurrentUser()[selectedMain] || [];
    if (subtopicOptions.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain });
        return;
    }
    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
    displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
        selectedSubTopicDetails = fullOptionObject;
        updateSessionHeader(); // 서브 주제 선택 시 헤더 업데이트
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
    });
}

/**
 * 주제 선택 후 실제 대화를 시작하는 함수
 */
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    if (inputArea) inputArea.style.display = 'flex';
    if (initText) {
        sendMessage(initText, inputMethod);
    } else if (chatInput) {
        chatInput.focus();
    }
}

/**
 * 사용자의 이전 누적 대화량을 Firestore에서 가져오는 함수
 */
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

/**
 * 세션을 종료하고 대화 기록을 최종 저장하는 함수
 */
async function endSessionAndSave() {
    if (isDataSaved) return;
    isDataSaved = true;
    appendMessage("대화를 안전하게 마무리하고 있어요...", 'assistant_feedback');
    if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId);

    const finalTopicForJournal = selectedSubTopicDetails?.displayText || selectedMain || "알 수 없는 주제";

    // 대화 내용이 충분할 때만 저널 생성
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
            relatedChildId: targetChildId,
            entryType: entryTypeForSave,
            childName: currentUserType === 'caregiver' ? localStorage.getItem('lozee_childName') : null
        });
        if (journalId) {
            await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
            await updateUserOverallStats(loggedInUserId, currentUserType, previousTotalUserCharCountOverall + userCharCountInSession);
            console.log("최종 저널 및 통계 업데이트 완료.");
        }
    }
}

/**
 * 세션 타임아웃 타이머를 리셋하는 함수
 */
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}


/**
 * 저널이 생성되었음을 알리는 클릭 가능한 알림을 표시하는 함수
 * @param {string} journalId - 생성된 저널 문서의 ID
 */
function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => {
        window.open(`journal.html?journalId=${journalId}`, '_blank');
    };
    if (chatWindow) {
        chatWindow.appendChild(notification);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

/**
 * 분석이 완료되었음을 알리는 클릭 가능한 알림을 표시하는 함수
 */
function showAnalysisNotification() {
    if (analysisNotificationShown || !chatWindow) return;
    analysisNotificationShown = true; // 중복 방지

    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.innerHTML = '📊 분석 완료! <strong>클릭해서 확인</strong>';

    notification.onclick = () => {
        // 나이에 따라 다른 분석 페이지로 이동
        const redirectUrl = (targetAge >= 15 && currentUserType === 'directUser') ?
            'analysis_adult.html' :
            'analysis.html';
        window.location.href = redirectUrl;
    };

    if (chatWindow) {
        chatWindow.appendChild(notification);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

/**
 * 사용자의 메시지를 GPT 서버로 보내고 응답을 처리하는 핵심 함수
 * @param {string} text - 사용자 입력 텍스트
 * @param {string} inputMethod - 입력 방식 ('text', 'stt', 'topic_selection_init')
 */
async function sendMessage(text, inputMethod) {
    if (!text || String(text).trim() === '' || isProcessing) return;

    isProcessing = true;
    if (actionButton) actionButton.disabled = true;
    resetSessionTimeout(); // 사용자 활동 감지, 타임아웃 리셋

    if (inputMethod !== 'topic_selection_init') {
        appendMessage(text, 'user');
    }
    chatHistory.push({ role: 'user', content: text });
    if (chatInput) chatInput.value = '';

    const thinkingBubble = appendMessage('...', 'assistant thinking');

    try {
        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const res = await getGptResponse(text, {
            chatHistory,
            userId: loggedInUserId,
            elapsedTime: elapsedTimeInMinutes
        });
        
        // '생각 중...' 말풍선 제거
        chatWindow.querySelector('.thinking')?.remove();

        if (!res.ok) {
            throw new Error(`GPT API 응답 오류: ${res.status}`);
        }

        const gptResponse = await res.json();
        const rawResponseText = gptResponse.text || "미안하지만, 지금은 답변을 드리기 어렵네.";

        // --- GPT 응답에서 텍스트와 JSON 분리 (핵심 로직) ---
        let cleanText = rawResponseText;
        let jsonString = null;
        
        const jsonStartIndex = rawResponseText.indexOf('{"');
        if (jsonStartIndex !== -1) {
            cleanText = rawResponseText.substring(0, jsonStartIndex).trim();
            jsonString = rawResponseText.substring(jsonStartIndex);
        }

        if (jsonString) {
            try {
                lastAiAnalysisData = JSON.parse(jsonString);
                console.log("✅ GPT 분석 결과 파싱 성공:", lastAiAnalysisData);
                updateSessionHeader(); // 요약 제목이 생겼으므로 헤더 업데이트
            } catch (e) {
                console.error("❌ GPT 응답 JSON 파싱 실패:", e, "JSON 문자열:", jsonString);
                // 파싱 실패해도 대화는 이어가도록 lastAiAnalysisData는 초기화하지 않음
            }
        }
        
        // 화면에 답변 표시 및 TTS 재생
        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);
        chatHistory.push({ role: 'assistant', content: cleanText });

        // --- 대화량 기반 중간 저널 생성 로직 ---
        userCharCountInSession = chatHistory.filter(m => m.role === 'user')
            .reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);

        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true;
            console.log("대화량 800자 충족. 중간 저널 생성을 시도합니다.");

            const topicForJournal = selectedSubTopicDetails?.displayText || selectedMain;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${topicForJournal}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: elapsedTimeInMinutes,
                userCharCountForThisSession: userCharCountInSession
            };
            // 비동기로 저널 생성 및 알림 표시
            saveJournalEntry(loggedInUserId, topicForJournal, detailsToSave, {
                relatedChildId: (currentUserType === 'caregiver' ? localStorage.getItem('lozee_childId') : null),
                entryType: (currentUserType === 'caregiver' ? 'child' : 'standard')
            }).then(id => {
                if (id) displayJournalCreatedNotification(id);
            });
        }

        // --- 분석 페이지용 데이터 저장 및 알림 표시 로직 ---
        const userTurnCount = chatHistory.filter(m => m.role === 'user').length;
        
        if (elapsedTimeInMinutes >= 10 && userTurnCount >= 10 && !analysisNotificationShown) {
             if (lastAiAnalysisData) {
                console.log(`[분석 조건 충족!] localStorage에 분석 결과 저장`);
                
                const dataToStore = {
                    results: lastAiAnalysisData,
                    accumulatedDurationMinutes: elapsedTimeInMinutes,
                };
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));
                
                showAnalysisNotification();
             } else {
                console.log("[분석 조건 충족] 했으나, 유효한 분석 데이터(lastAiAnalysisData)가 없어 저장을 건너뜁니다.");
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


// --- 6. STT (음성 인식) 관련 기능들 ---
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

    recog.onstart = () => {
        isRec = true;
        if (actionButton) actionButton.classList.add('recording');
        micButtonCurrentlyProcessing = false;
    };
    recog.onend = () => {
        isRec = false;
        if (actionButton) actionButton.classList.remove('recording');
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
    if (actionButton) actionButton.innerHTML = '➤';
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
    // 텍스트 입력이 있으면 전송 기능으로 동작
    if (chatInput && chatInput.value.trim() !== '') {
        sendMessage(chatInput.value.trim(), 'text');
        return;
    }

    // 텍스트 입력이 없으면 STT 기능으로 동작
    if (isProcessing || micButtonCurrentlyProcessing || !SpeechRecognitionAPI) return;
    micButtonCurrentlyProcessing = true;

    if (isRec) {
        if (recog) recog.stop();
    } else {
        if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setupAudioAnalysis(stream);
                if (recog) recog.start();
            })
            .catch(e => {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            });
    }
}


// --- 7. 페이지 로드 후 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!loggedInUserId) {
        // alert() 대신 커스텀 모달이나 화면 메시지를 사용하는 것을 권장합니다.
        console.error("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }

    // 전송 버튼과 엔터키 이벤트 핸들러
    if (actionButton) {
        actionButton.addEventListener('click', handleMicButtonClick);
    }
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                handleMicButtonClick(); // 전송/STT 로직 통합
            }
        });
    }

    // 필요한 변수 초기화
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    currentFirestoreSessionId = await logSessionStart(loggedInUserId, "대화 시작");
    resetSessionTimeout();

    // 대화 시작
    const greeting = getInitialGreeting(userNameToDisplay + voc, false);
    appendMessage(greeting, 'assistant');
    await playTTSWithControl(greeting);
    showMainTopics();
    
    // 페이지를 떠나기 전에 데이터 저장 시도
    window.addEventListener('beforeunload', (event) => {
        if (chatHistory.length > 2 && !isDataSaved) {
            endSessionAndSave();
        }
    });
});
