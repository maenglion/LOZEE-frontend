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
    logSessionEnd,
    saveReservation
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';
import * as LOZEE_ANALYSIS from './lozee-analysis.js';

// ✅ (새로 추가) 이미지 업로드 및 GPT Vision API 호출 관련 유틸리티 모듈
import { uploadImageAndGetUrl, getImageAnalysisFromGptVision } from './gpt-vision-api.js';


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
const chatInputContainer = document.getElementById('chat-input-container');
const chatInput = document.getElementById('chat-input');
const plusButton = document.getElementById('plus-button');
const imageUpload = document.getElementById('image-upload');
const actionButton = document.getElementById('action-button');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');
const sessionHeaderTextEl = document.getElementById('session-header');


/**
 * 대화 세션을 공식적으로 시작하고 관련 UI를 활성화하며, 첫 메시지를 전송하는 함수
 * @param {object} subTopic - 선택된 서브 주제의 상세 정보
 */
function startChat(subTopic) {
    console.log("▶️ startChat이 호출되었습니다.", subTopic);

    if (!conversationStartTime) {
        conversationStartTime = Date.now();
    }

    selectedSubTopicDetails = subTopic;
    updateSessionHeader();

    const actionButton = document.getElementById('action-button');
    const chatInput = document.getElementById('chat-input');
    if (actionButton) actionButton.disabled = false;
    if (chatInput) chatInput.disabled = false;

    if (chatInputContainer) chatInputContainer.style.display = 'flex';

    if (subTopic && subTopic.type === 'free_form') {
        isTtsMode = false;
        updateActionButtonIcon();
        chatInput.focus();
    } else {
        const initialMessage = `'${subTopic.displayText}'(이)라는 주제로 이야기하고 싶어요.`;
        sendMessage(initialMessage, 'topic_selection_init');
    }
}

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);

const currentUserAgeGroup = (() => {
    if (targetAge < 11) return '10세미만';
    if (targetAge <= 15) return '11-15세';
    if (targetAge <= 29) return '16-29세';
    return '30-55세';
})();

const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의 ---

/**
 * 채팅창에 새로운 말풍선을 추가하는 함수
 */
function appendMessage(text, role, options = {}) { // ✅ options 인자 추가
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    // ✅ 이미지 분석 결과 메시지에는 특정 클래스를 추가하여 글자수 계산에서 제외 가능하도록
    if (options.isImageAnalysisResult) {
        bubble.classList.add('image-analysis-result');
    }
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * 마지막 사용자 메시지를 업데이트하는 함수 (이미지 분석 결과 반영용)
 * @param {string} newText - 업데이트할 텍스트
 */
function updateLastUserMessageBubble(newText) {
    const userBubbles = chatWindow.querySelectorAll('.bubble.user');
    if (userBubbles.length > 0) {
        const lastUserBubble = userBubbles[userBubbles.length - 1];
        lastUserBubble.textContent = newText;
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } else {
        // 만약 사용자 버블이 없다면 새로 추가 (예: 초기 이미지 업로드 시)
        appendMessage(newText, 'user', { isImageAnalysisResult: true });
    }
}


/**
 * 액션 버튼의 아이콘을 TTS 모드에 따라 업데이트하는 함수
 */
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

//** 로지의 답변을 음성으로 재생하는 함수 (TTS)
async function playTTSWithControl(text) {
    if (!isTtsMode) return;

    stopCurrentTTS();

    try {
        const voiceId = localStorage.getItem('lozee_voice') || "Leda";
        await playTTSFromText(text, voiceId);

    } catch (error) {
        console.error("TTS 재생 오류:", error);
    }
}

function displayOptionsInChat(optionsArray, onSelectCallback) {
    if (!chatWindow) return;
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'chat-options-container';
    optionsArray.forEach(optionObject => {
        let buttonText = optionObject?.displayText || optionObject;
        if (optionObject?.icon) buttonText = `${optionObject.icon} ${optionObject.displayText}`;
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
    if (currentUserType === 'directUser') {
        return counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    }
    if (currentUserType === 'caregiver') {
        console.log("➡️ talk.js: caregiver용 주제 로드 시도 (getTopicsForCurrentUser):", counselingTopicsByAge.caregiver.common);
        return counselingTopicsByAge.caregiver?.common || {};
    }
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

function renderUnifiedTopics() {
    const addFreeTopicOption = () => {
        const freeTopicOption = {
            icon: "💬",
            displayText: "기타 (자유롭게 이야기하기)",
            tags: ["자유주제", "기타"],
            type: "free_form"
        };
        const targetAgeGroups = ['청소년', '청년', '중장년', '노년'];
        targetAgeGroups.forEach(ageGroup => {
            if (counselingTopicsByAge[ageGroup]) {
                const mainTopics = Array.isArray(counselingTopicsByAge[ageGroup]) ? counselingTopicsByAge[ageGroup] : Object.values(counselingTopicsByAge[ageGroup]);
                mainTopics.forEach(mainTopic => {
                    const alreadyExists = mainTopic.subTopics.some(sub => sub.type === 'free_form');
                    if (!alreadyExists) {
                        mainTopic.subTopics.push(freeTopicOption);
                    }
                });
            }
        });
    };

    addFreeTopicOption();

    const container = document.getElementById('topic-selection-container');
    if (!container) return;
    container.innerHTML = '';

    const topicsForUserType = counselingTopicsByAge[currentUserType];
    if (!topicsForUserType) return;

    const topicsData = (currentUserType === 'caregiver')
        ? topicsForUserType['common']
        : (topicsForUserType[currentUserAgeGroup] || topicsForUserType['16-29세']);

    if (!topicsData) return;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'chat-options-container';

    topicsData.forEach(mainTopic => {
        const button = document.createElement('button');
        button.className = 'chat-option-btn';
        button.innerHTML = mainTopic.name;

        button.onclick = () => {
            optionsContainer.querySelectorAll('.chat-option-btn').forEach(btn => btn.disabled = true);
            button.classList.add('selected');

            selectedMain = mainTopic.name;
            appendMessage(`${mainTopic.name}`, 'user');

            container.innerHTML = '';

            if (mainTopic.subTopics && mainTopic.subTopics.length > 0) {
                appendMessage('더 자세한 이야기를 들려줄래?', 'assistant');
                displayOptionsInChat(mainTopic.subTopics, (selectedText, fullOption) => {
                    selectedSubTopicDetails = fullOption;
                    updateSessionHeader();
                    startChat(fullOption);
                });
            } else {
                startChat({ displayText: mainTopic.name, tags: [mainTopic.name] });
            }
        };
        optionsContainer.appendChild(button);
    });

    container.appendChild(optionsContainer);
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

async function endSessionAndSave() {
    if (isDataSaved) return;
    isDataSaved = true;

    appendMessage("대화를 안전하게 마무리하고 있어요. 잠시만 기다려 주세요...", 'assistant_feedback');
    if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId);

    if (chatHistory.length <= 2) {
        console.log("대화 내용이 부족하여 저장을 건너뜁니다.");
        return;
    }

    try {
        console.log("최종 저장을 위한 AI 분석 시작...");
        const finalAnalysisResponse = await getGptResponse(
            "지금까지의 대화 전체를 최종적으로 요약하고 분석해줘.", {
                chatHistory: chatHistory,
                userId: loggedInUserId,
                elapsedTime: (Date.now() - conversationStartTime) / (1000 * 60)
            }
        );

        if (!finalAnalysisResponse.ok) throw new Error("최종 AI 분석 실패");

        const finalGptData = await finalAnalysisResponse.json();
        let finalAnalysis = {};
        const jsonStartIndex = finalGptData.text.indexOf('{"');
        if (jsonStartIndex !== -1) {
            finalAnalysis = JSON.parse(finalGptData.text.substring(jsonStartIndex));
        } else {
            finalAnalysis = {
                conversationSummary: finalGptData.text,
                summaryTitle: selectedSubTopicDetails?.displayText || selectedMain || "대화",
                keywords: [],
            };
        }

        const summaryText = finalAnalysis.conversationSummary || "요약이 생성되지 않았습니다.";

        console.log("의미 기반 키워드 추출 시작...");
        const semanticKeywords = await LOZEE_ANALYSIS.extractSemanticKeywords(summaryText);

        finalAnalysis.keywords = semanticKeywords;

        const journalDetailsToSave = {
            summary: summaryText,
            title: finalAnalysis.summaryTitle || selectedSubTopicDetails?.displayText || selectedMain || "대화",
            detailedAnalysis: finalAnalysis,
            sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
            userCharCountForThisSession: userCharCountInSession
        };

        const entryTypeForSave = (currentUserType === 'caregiver') ? 'child' : 'standard';
        const journalId = await saveJournalEntry(loggedInUserId, selectedSubTopicDetails?.displayText || selectedMain || "대화", journalDetailsToSave, {
            relatedChildId: (currentUserType === 'caregiver' ? localStorage.getItem('lozee_childId') : null),
            entryType: (currentUserType === 'caregiver' ? 'child' : 'standard')
        });

        if (journalId) {
            await updateTopicStats(loggedInUserId, selectedSubTopicDetails?.displayText || selectedMain || "대화", entryTypeForSave);
            const totalChars = (await fetchPreviousUserCharCount()) + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, totalChars);
            console.log("모든 데이터가 성공적으로 저장되었습니다. Journal ID:", journalId);
            displayJournalCreatedNotification(journalId);
        }

    } catch (error) {
        console.error("endSessionAndSave 과정에서 오류 발생:", error);
        appendMessage("대화 내용을 저장하는 중 문제가 발생했어요. 😥", 'assistant_feedback');
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

/**
 * ⭐ 사용자의 메시지를 GPT 서버로 보내고 응답을 처리하는 함수 (최종 수정 버전)
 * @param {string} text - 사용자 또는 시스템이 입력한 메시지 텍스트
 * @param {string} inputMethod - 메시지 입력 방식 (e.g., 'user_input', 'topic_selection_init', 'image_analysis')
 * @param {boolean} isCharCountExempt - 이 메시지의 텍스트가 글자수 계산에서 제외되는지 여부 (기본값: false)
 */
async function sendMessage(text, inputMethod, isCharCountExempt = false) { // ✅ isCharCountExempt 인자 추가

    if (!text || String(text).trim() === '') {
        console.warn("빈 텍스트로 sendMessage 호출됨");
        return;
    }

    if (!loggedInUserId) {
        console.error("필수 정보(userId) 누락!");
        appendMessage("사용자 정보가 없어 대화를 시작할 수 없어요. 페이지를 새로고침 해주세요.", "assistant_feedback");
        return;
    }

    if (isProcessing) return;
    isProcessing = true;
    if (actionButton) actionButton.disabled = true;
    resetSessionTimeout();

    if (inputMethod !== 'topic_selection_init') {
        // 이미지 분석 결과는 다른 스타일로 표시하거나, 기존 메시지를 업데이트할 수 있습니다.
        if (inputMethod === 'image_analysis') {
            // 이미지 분석 결과는 chatHistory에 추가만 하고, UI에는 '분석 중...' 메시지 이후에 업데이트되도록 함
            // appendMessage 로직에서 isImageAnalysisResult 플래그를 사용하여 스타일링할 수 있습니다.
            // 여기서는 사용자에게 바로 보이지 않는 'thinking' 버블 대신 '분석 중' 버블을 사용
            appendMessage('이미지 분석 결과를 처리 중입니다...', 'assistant thinking');
        } else {
            appendMessage(text, 'user');
        }
    }

    if (chatInput) chatInput.value = '';
    // 이미지 분석 중 메시지는 위에서 처리했으므로, 일반 메시지 처리 시에만 표시
    if (inputMethod !== 'image_analysis') {
        appendMessage('...', 'assistant thinking');
    }

    try {
        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const context = {
            chatHistory: [...chatHistory],
            userId: loggedInUserId,
            elapsedTime: elapsedTimeInMinutes,
            systemPrompt: selectedSubTopicDetails?.systemPrompt || null
        };

        console.log("✅ GPT 요청 text:", text);
        console.log("✅ GPT 요청 context:", context);

        const res = await getGptResponse(text, context);

        chatWindow.querySelector('.thinking')?.remove();

        if (!res.ok) {
            throw new Error(`GPT API 응답 오류: ${res.status}`);
        }

        // ✅ isCharCountExempt 플래그를 사용하여 chatHistory에 추가 시 구분
        chatHistory.push({ role: 'user', content: text, isCharCountExempt: isCharCountExempt });

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

                localStorage.setItem('lozee_last_summary', lastAiAnalysisData.conversationSummary);
                localStorage.setItem('lozee_last_keywords', JSON.stringify(lastAiAnalysisData.keywords || []));

                if (LOZEE_ANALYSIS) {
                    if (LOZEE_ANALYSIS.trackTime && !LOZEE_ANALYSIS.isTimeTracking) {
                        LOZEE_ANALYSIS.trackTime();
                        LOZEE_ANALYSIS.isTimeTracking = true;
                    }
                    if (LOZEE_ANALYSIS.trackEmotionTone) {
                        LOZEE_ANALYSIS.trackEmotionTone(lastAiAnalysisData);
                    }
                    if (LOZEE_ANALYSIS.trackSituation) {
                        LOZEE_ANALYSIS.trackSituation(lastAiAnalysisData);
                    }
                    if (LOZEE_ANALYSIS.extractEntityEmotionPairs) {
                        const fullConversationText = chatHistory.map(turn => turn.content).join('\n');
                        const entityEmotionTags = LOZEE_ANALYSIS.extractEntityEmotionPairs(fullConversationText);
                        localStorage.setItem('lozee_entity_emotion_tags', JSON.stringify(entityEmotionTags));
                        console.log("인물-감정 태그 분석 결과:", entityEmotionTags);
                    }
                }
            } catch (e) {
                console.error("❌ GPT 응답 JSON 파싱 실패:", e);
            }
        }

        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);

        chatHistory.push({ role: 'assistant', content: cleanText });

        // ✅ userCharCountInSession 계산 시 isCharCountExempt 메시지 제외
        userCharCountInSession = chatHistory
            .filter(m => m.role === 'user' && !m.isCharCountExempt)
            .reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);


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

                if (lastAiAnalysisData?.cognitiveDistortions?.length > 0) {
                    appendMessage('어떤 요일·시간대가 편하신가요? (예: 매주 화요일 오후 3시)', 'assistant');
                    const scheduleBtn = document.createElement('button');
                    scheduleBtn.className = 'chat-option-btn';
                    scheduleBtn.textContent = '🗓️ 상담 예약하기';
                    scheduleBtn.onclick = async () => {
                        try {
                            await saveReservation(loggedInUserId, {
                                type: 'conversation',
                                dateExpression: '매주 화요일 오후 3시',
                                createdAt: Date.now()
                            });

                            const baseUrl = 'https://calendar.google.com/calendar/r/eventedit';
                            const params = new URLSearchParams({
                                text: '로지와의 대화 예약',
                                details: '이전 대화에서 엿보인 주제에 대하여 추가로 대화가 필요해요.',
                                ctz: Intl.DateTimeFormat().resolvedOptions().timeZone
                            });
                            window.open(`${baseUrl}?${params.toString()}`, '_blank');
                        } catch (error) {
                            console.error("예약 저장 중 오류 발생:", error);
                        }
                    };
                    chatWindow.appendChild(scheduleBtn);
                }
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

// --- 6. STT and other functions... ---
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
    if (sessionHeaderTextEl) // sessionHeaderEl -> sessionHeaderTextEl 변수명 수정
        sessionHeaderTextEl.style.backgroundColor = `hsl(228,50%,${90 - (norm / 5)}%)`;
}

function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
    if (sessionHeaderTextEl) { // sessionHeaderEl -> sessionHeaderTextEl 변수명 수정
        sessionHeaderTextEl.style.transition = 'background-color 0.3s';
        sessionHeaderTextEl.style.backgroundColor = '';
    }
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


// --- 7. 페이지 로드 후 초기화 및 이벤트 바인딩 (최종 수정본) ---
document.addEventListener('DOMContentLoaded', async () => {

    const startCover = document.getElementById('start-cover');
    const appContainer = document.querySelector('.app-container');
    const startButton = document.getElementById('start-button');

    const style = document.createElement('style');
    style.textContent = `
        body.talk-page-body { overflow: hidden; }
        @media (min-width: 641px) {
            .app-container.talk-page { max-width: 640px; height: 90vh; margin: auto; }
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add('talk-page-body');
    if (appContainer) appContainer.classList.add('talk-page');


    // ✅ 이미지 파싱 버튼 이벤트 리스너 수정
    plusButton.addEventListener('click', () => {
        imageUpload.click(); // 파일 선택창 띄우기
    });

    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // "이미지 분석 중입니다..." 메시지 바로 표시 (사용자 피드백)
        appendMessage("이미지 분석 중입니다...", 'assistant_feedback');

        try {
            // 1. 이미지 업로드 및 URL 획득 (gpt-vision-api.js 에서 처리)
            const imageUrl = await uploadImageAndGetUrl(file);
            console.log("Uploaded image URL:", imageUrl);

            // 2. GPT Vision API 호출 (gpt-vision-api.js 에서 처리)
            const analysisResultText = await getImageAnalysisFromGptVision(imageUrl);
            console.log("GPT Vision Analysis Result:", analysisResultText);

            // 3. 채팅창에 분석 결과 업데이트 및 GPT 응답 요청
            // '이미지 분석 중...' 메시지를 찾아서 업데이트
            const thinkingBubble = chatWindow.querySelector('.bubble.assistant_feedback:last-child');
            if (thinkingBubble && thinkingBubble.textContent === "이미지 분석 중입니다...") {
                thinkingBubble.textContent = `🖼️ 이미지 분석이 완료되었어요. 내용을 바탕으로 대화를 시작할게요: ${analysisResultText}`;
                thinkingBubble.classList.remove('assistant_feedback');
                thinkingBubble.classList.add('assistant');
            } else {
                appendMessage(`🖼️ 이미지 분석이 완료되었어요. 내용을 바탕으로 대화를 시작할게요: ${analysisResultText}`, 'assistant');
            }
            chatWindow.scrollTop = chatWindow.scrollHeight;


            // chatHistory에 이미지 분석 결과를 추가하고, GPT에게 응답 요청 (글자수 계산 제외)
            // GPT에게는 이 메시지가 마치 사용자 입력처럼 보이지만, 실제 글자수 계산에서는 제외
            sendMessage(analysisResultText, 'image_analysis', true); // ✅ isCharCountExempt = true

        } catch (error) {
            console.error("이미지 업로드 또는 분석 중 오류 발생:", error);
            const thinkingBubble = chatWindow.querySelector('.bubble.assistant_feedback:last-child');
            if (thinkingBubble && thinkingBubble.textContent === "이미지 분석 중입니다...") {
                thinkingBubble.textContent = "이미지 분석에 실패했어요. 다시 시도해 주세요. 😢";
            } else {
                appendMessage("이미지 분석에 실패했어요. 다시 시도해 주세요. 😢", 'assistant_feedback');
            }
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    });

    // ✅ Firestore 저장 함수 (여기서는 직접 호출하지 않고 sendMessage 내부에서 관리)
    function saveMessageToFirestore(role, content, type = "text", isCharCountExempt = false) { // ✅ isCharCountExempt 인자 추가
        const db = firebase.firestore();
        const sessionId = localStorage.getItem("sessionId") || currentFirestoreSessionId || "default-session"; // 현재 세션 ID 사용
        const userId = localStorage.getItem("lozee_userId") || "anonymous";

        db.collection("conversationSessions")
            .doc(sessionId)
            .collection("messages")
            .add({
                userId,
                role,
                content,
                type,
                isCharCountExempt, // ✅ 글자수 계산 제외 여부 저장
                timestamp: new Date()
            })
            .then(() => {
                console.log("✅ 메시지 저장됨:", role, content);
            })
            .catch((error) => {
                console.error("❌ Firestore 저장 실패:", error);
            });
    }

    /// ✅ 시작 버튼에 클릭 이벤트 할당
    if (startButton) {
        startButton.onclick = async () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (startCover) startCover.style.display = 'none';

            try {
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

                const greetingText = getInitialGreeting(userNameToDisplay + voc, false);
                const voiceForGreeting = localStorage.getItem('lozee_voice') || 'Leda';

                appendMessage(greetingText, 'assistant');
                await playTTSWithControl(greetingText, voiceForGreeting);

                renderUnifiedTopics();

                window.addEventListener('beforeunload', () => { if (chatHistory.length > 2 && !isDataSaved) endSessionAndSave(); });

            } catch (error) {
                console.error("페이지 초기화 중 심각한 오류가 발생했습니다:", error);
                appendMessage("페이지를 불러오는 중 문제가 발생했어요.", "assistant_feedback");
            }
        };
    }
});