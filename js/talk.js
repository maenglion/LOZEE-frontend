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
    saveReservation,
    // getIdToken // ⭐ 여기서 직접 getIdToken 가져오기
} from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';
import * as LOZEE_ANALYSIS from './lozee-analysis.js';

import { uploadImageAndGetUrl, getImageAnalysisFromGptVision } from './gpt-vision-api.js';

// ⭐ Firebase Auth 모듈도 import하여 currentUser 객체 접근
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
const firebaseAuth = getAuth(); // Firebase Auth 인스턴스


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
const micButton = document.getElementById('mic-button');
const sendButton = document.getElementById('send-button');
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

    if (micButton) micButton.disabled = false;
    if (sendButton) sendButton.disabled = false;
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
const isDirectUser = localStorage.getItem('lozee_isDirectUser') === 'true';

const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의 ---

/**
 * 채팅창에 새로운 말풍선을 추가하는 함수
 */
function appendMessage(text, role, options = {}) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
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
        appendMessage(newText, 'user', { isImageAnalysisResult: true });
    }
}


/**
 * 액션 버튼의 아이콘을 TTS 모드에 따라 업데이트하는 함수
 */
function updateActionButtonIcon() {
    if (!micButton) return;
    if (isTtsMode) {
        micButton.classList.remove('text-mode');
    } else {
        micButton.classList.add('text-mode');
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
    const userAgeGroupKey = (() => {
        if (targetAge < 11) return '10세미만';
        if (targetAge <= 15) return '11-15세';
        if (targetAge <= 29) return '16-29세';
        return '30-55세';
    })();

    let topics = {};

    if (currentUserType === 'directUser' || isDirectUser) {
        const directUserTopicsArray = counselingTopicsByAge.directUser?.[userAgeGroupKey];
        if (directUserTopicsArray && Array.isArray(directUserTopicsArray)) {
            directUserTopicsArray.forEach(mainTopic => {
                topics[mainTopic.name] = mainTopic;
            });
        } else {
             console.warn(`directUser의 ${userAgeGroupKey} 주제를 찾을 수 없습니다. 기본값 '16-29세' 사용.`);
             const defaultTopics = counselingTopicsByAge.directUser?.['16-29세'];
             if(defaultTopics && Array.isArray(defaultTopics)) {
                 defaultTopics.forEach(mainTopic => {
                     topics[mainTopic.name] = mainTopic;
                 });
             }
        }
    }

    if (currentUserType === 'caregiver') {
        const caregiverTopicsArray = counselingTopicsByAge.caregiver?.common;
        if (caregiverTopicsArray && Array.isArray(caregiverTopicsArray)) {
            caregiverTopicsArray.forEach(mainTopic => {
                topics[mainTopic.name] = mainTopic;
            });
        }
    }
    
    return Object.values(topics);
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
        Object.keys(counselingTopicsByAge).forEach(userTypeKey => {
            const userTypeData = counselingTopicsByAge[userTypeKey];
            Object.keys(userTypeData).forEach(ageGroupKey => {
                const mainTopics = userTypeData[ageGroupKey];
                if (Array.isArray(mainTopics)) {
                    mainTopics.forEach(mainTopic => {
                        const alreadyExists = mainTopic.subTopics.some(sub => sub.type === 'free_form');
                        if (!alreadyExists) {
                            mainTopic.subTopics.push(freeTopicOption);
                        }
                    });
                }
            });
        });
    };

    addFreeTopicOption();

    const container = document.getElementById('topic-selection-container');
    if (!container) return;
    container.innerHTML = '';

    const topicsData = getTopicsForCurrentUser();

    if (!topicsData || topicsData.length === 0) {
        appendMessage('선택할 수 있는 주제가 없습니다. 자유롭게 이야기해주세요.', 'assistant');
        return;
    }

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
    const topicsData = getTopicsForCurrentUser();
    const selectedMainTopic = topicsData.find(topic => topic.name === selectedMain);

    if (!selectedMainTopic || !selectedMainTopic.subTopics || selectedMainTopic.subTopics.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain });
    } else {
        appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
        displayOptionsInChat(selectedMainTopic.subTopics, (selectedSubtopicText, fullOptionObject) => {
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
        console.log("대화 내용이 부족하여 저장을 건너뜥니다.");
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
        }).then(id => {
            if (id) displayJournalCreatedNotification(id);
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
async function sendMessage(text, inputMethod, isCharCountExempt = false) {
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
    if (micButton) micButton.disabled = true;
    if (sendButton) sendButton.disabled = true;
    resetSessionTimeout();

    // ⭐⭐ LOZEE가 주제를 던질 때 말풍선 나오도록 수정 ⭐⭐
    if (inputMethod !== 'topic_selection_init') {
        if (inputMethod === 'image_analysis') {
            appendMessage('이미지 분석 결과를 처리 중입니다...', 'assistant thinking');
        } else {
            appendMessage(text, 'user');
        }
    } else { // topic_selection_init 일 때, LOZEE가 보낸 메시지를 봇 말풍선으로 추가
        appendMessage(text, 'assistant');
    }


    if (chatInput) chatInput.value = '';
    if (inputMethod !== 'image_analysis') {
        appendMessage('...', 'assistant thinking');
    }

    try {
        // ⭐ 토큰 강제 리프레시 로직 추가 ⭐
        const currentUser = firebaseAuth.currentUser; // Firebase Auth currentUser 객체 가져오기
        let idToken = null;
        if (currentUser) {
            idToken = await currentUser.getIdToken(true); // ⭐ true: 강제 갱신
            console.log("🔐 새 토큰:", idToken);
        } else {
            console.warn("🚫 사용자 로그인 정보가 없습니다. 토큰 없이 GPT 요청을 시도합니다.");
        }


        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const context = {
            chatHistory: [...chatHistory],
            userId: loggedInUserId,
            elapsedTime: elapsedTimeInMinutes,
            systemPrompt: selectedSubTopicDetails?.systemPrompt || null
        };

        console.log("✅ GPT 요청 text:", text);
        console.log("✅ GPT 요청 context:", context);

        // ⭐ getGptResponse 호출 시 Authorization 헤더 추가 ⭐
        const gptResponsePromise = getGptResponse(text, context, idToken); // idToken 전달
        const res = await gptResponsePromise; // 실제 응답은 getGptResponse 내부에서 fetch 호출 결과를 반환하므로 res는 이미 json 파싱된 데이터

        chatWindow.querySelector('.thinking')?.remove();

        // getGptResponse가 이미 오류 처리 및 throw를 하므로 여기서는 res가 null일 경우만 처리
        if (!res) { // getGptResponse에서 오류 발생하여 null이 반환된 경우
            throw new Error("GPT 응답을 받지 못했습니다.");
        }

        const rawResponseText = res.text || "미안하지만, 지금은 답변을 드리기 어렵네."; // res는 이미 파싱된 JSON 객체


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
        if (micButton) micButton.disabled = false;
        if (sendButton) sendButton.disabled = false;
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
    recog.onstart = () => { isRec = true; if (micButton) micButton.classList.add('recording'); micButtonCurrentlyProcessing = false; };
    recog.onend = () => { isRec = false; if (micButton) micButton.classList.remove('recording'); stopAudio(); micButtonCurrentlyProcessing = false; };
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
    if (sessionHeaderTextEl)
        sessionHeaderTextEl.style.backgroundColor = `hsl(228,50%,${90 - (norm / 5)}%)`;
}

function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
    if (sessionHeaderTextEl) {
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


    plusButton.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        appendMessage("이미지 분석 중입니다...", 'assistant_feedback');

        try {
            const imageUrl = await uploadImageAndGetUrl(file);
            console.log("Uploaded image URL:", imageUrl);

            const analysisResultText = await getImageAnalysisFromGptVision(imageUrl);
            console.log("GPT Vision Analysis Result:", analysisResultText);

            const thinkingBubble = chatWindow.querySelector('.bubble.assistant_feedback:last-child');
            if (thinkingBubble && thinkingBubble.textContent === "이미지 분석 중입니다...") {
                thinkingBubble.textContent = `🖼️ 이미지 분석이 완료되었어요. 내용을 바탕으로 대화를 시작할게요: ${analysisResultText}`;
                thinkingBubble.classList.remove('assistant_feedback');
                thinkingBubble.classList.add('assistant');
            } else {
                appendMessage(`🖼️ 이미지 분석이 완료되었어요. 내용을 바탕으로 대화를 시작할게요: ${analysisResultText}`, 'assistant');
            }
            chatWindow.scrollTop = chatWindow.scrollHeight;

            sendMessage(analysisResultText, 'image_analysis', true);

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

    function saveMessageToFirestore(role, content, type = "text", isCharCountExempt = false) {
        const db = firebase.firestore();
        const sessionId = localStorage.getItem("sessionId") || currentFirestoreSessionId || "default-session";
        const userId = localStorage.getItem("lozee_userId") || "anonymous";

        db.collection("conversationSessions")
            .doc(sessionId)
            .collection("messages")
            .add({
                userId,
                role,
                content,
                type,
                isCharCountExempt,
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
                if (micButton) micButton.addEventListener('click', handleMicButtonClick);
                if (sendButton) {
                    sendButton.addEventListener('click', () => {
                        if (chatInput.value.trim() !== '') {
                            sendMessage(chatInput.value.trim(), 'text');
                        }
                    });
                }

                if (chatInput) {
                    chatInput.addEventListener('keydown', e => {
                        if (e.key === 'Enter' && !e.isComposing) {
                            e.preventDefault();
                            if (!isTtsMode && chatInput.value.trim() !== '') {
                                sendMessage(chatInput.value.trim(), 'text');
                            } else if (isTtsMode) {
                                handleMicButtonClick();
                            }
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
                const voiceForGreeting = localStorage.getItem('lozee_voice') || "Leda";

                sendMessage(greetingText, 'topic_selection_init');
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
