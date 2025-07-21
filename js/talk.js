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
import { counselingTopicsByAge, normalizeTags } from './counseling_topics.js';
import * as LOZEE_ANALYSIS from './lozee-analysis.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const firebaseAuth = getAuth();

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
const SESSION_TIMEOUT_DURATION = 10 * 60 * 1000; // 10분으로 증가
let lastTokenRefreshTime = 0;
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55분

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
const topicsContainer = document.getElementById('topics-container');

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
let targetAge = parseInt(localStorage.getItem('lozee_userAge') || "30", 10); // 기본값 30
const currentUserType = localStorage.getItem('lozee_role') === 'parent' ? 'caregiver' : 'directUser';
const isDirectUser = localStorage.getItem('lozee_isDirectUser') === 'true';
const targetChildId = currentUserType === 'caregiver' ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 함수 정의 ---

/**
 * 사용자 역할과 나이에 맞는 주제 가져오기
 */
async function getTopicsForCurrentUser() {
    if (!targetAge && targetAge !== 0) {
        console.warn('targetAge가 설정되지 않았습니다. 기본값(30) 사용.');
        targetAge = 30;
    }

    const userAgeGroupKey = (() => {
        if (targetAge < 11) return '10세미만';
        if (targetAge <= 15) return '11-15세';
        if (targetAge <= 29) return '16-29세';
        if (targetAge <= 55) return '30-55세';
        return '55세이상';
    })();

    const roles = [];
    if (isDirectUser) roles.push('directUser');
    if (currentUserType === 'caregiver') roles.push('caregiver');

    const topics = {};

    // directUser 토픽
    if (roles.includes('directUser')) {
        const directUserTopicsArray = counselingTopicsByAge.directUser?.[userAgeGroupKey] || [];
        directUserTopicsArray.forEach(mainTopic => {
            topics[mainTopic.name] = mainTopic;
        });
    }

    // caregiver 토픽
    if (roles.includes('caregiver')) {
        const caregiverCommonTopics = counselingTopicsByAge.caregiver?.common || [];
        caregiverCommonTopics.forEach(mainTopic => {
            topics[mainTopic.name] = mainTopic;
        });

        if (targetChildId) {
            const childDoc = await getDoc(doc(db, 'users', targetChildId));
            const childAge = childDoc.exists() ? childDoc.data().age : null;
            if (childAge || childAge === 0) {
                const childAgeGroupKey = (() => {
                    if (childAge < 11) return '10세미만';
                    if (childAge <= 15) return '11-15세';
                    return 'common';
                })();
                const caregiverChildTopics = counselingTopicsByAge.caregiver?.[childAgeGroupKey] || [];
                caregiverChildTopics.forEach(mainTopic => {
                    topics[mainTopic.name] = mainTopic;
                });
            }
        }
    }

    return Object.values(topics);
}

/**
 * 주제 렌더링
 */
function renderUnifiedTopics() {
    if (!topicsContainer) return;

    getTopicsForCurrentUser().then(topics => {
        topicsContainer.innerHTML = '';
        if (!topics || topics.length === 0) {
            console.warn('🚫 주제 없음: 역할/나이 조건에 맞는 주제가 없습니다.');
            topicsContainer.innerHTML = `<p style="color: gray; text-align: center; margin-top: 2rem;">현재 선택 가능한 주제가 없습니다.<br>마이페이지에서 역할과 나이를 확인해 주세요.</p>`;
            appendMessage('주제를 선택할 수 없어요. 자유롭게 이야기해볼까요?', 'assistant');
            startChat({ displayText: '자유롭게 이야기하기', type: 'free_form', tags: ['자유주제'] });
            return;
        }

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options-container';

        topics.forEach(mainTopic => {
            const button = document.createElement('button');
            button.className = 'chat-option-btn';
            button.innerHTML = mainTopic.name;
            button.onclick = () => {
                resetSessionTimeout();
                optionsContainer.querySelectorAll('.chat-option-btn').forEach(btn => btn.disabled = true);
                button.classList.add('selected');
                selectedMain = mainTopic.name;
                appendMessage(`${mainTopic.name}`, 'user');
                topicsContainer.innerHTML = '';
                showSubTopics();
            };
            optionsContainer.appendChild(button);
        });

        topicsContainer.appendChild(optionsContainer);
    }).catch(error => {
        console.error('주제 렌더링 오류:', error);
        appendMessage('주제를 불러오는 중 문제가 발생했어요.', 'assistant_feedback');
    });
}

/**
 * 서브 주제 표시
 */
function showSubTopics() {
    getTopicsForCurrentUser().then(topics => {
        const selectedMainTopic = topics.find(topic => topic.name === selectedMain);
        if (!selectedMainTopic || !selectedMainTopic.subTopics || selectedMainTopic.subTopics.length === 0) {
            startChat({ displayText: selectedMain, tags: [selectedMain] });
        } else {
            appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
            displayOptionsInChat(selectedMainTopic.subTopics, (selectedText, fullOption) => {
                selectedSubTopicDetails = fullOption;
                updateSessionHeader();
                startChat(fullOption);
            });
        }
    });
}

/**
 * 채팅창에 말풍선 추가
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
 * 마지막 사용자 메시지 업데이트
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
 * 액션 버튼 아이콘 업데이트
 */
function updateActionButtonIcon() {
    if (!micButton) return;
    if (isTtsMode) {
        micButton.classList.remove('text-mode');
    } else {
        micButton.classList.add('text-mode');
    }
}

/**
 * TTS 재생
 */
async function playTTSWithControl(text) {
    if (!isTtsMode) return;
    stopCurrentTTS();
    try {
        const voiceId = localStorage.getItem('lozee_voice') || 'Leda';
        await playTTSFromText(text, voiceId);
    } catch (error) {
        console.error('TTS 재생 오류:', error);
    }
}

/**
 * 옵션 버튼 표시
 */
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
            onSelectCallback(optionObject.displayText, optionObject);
        };
        optionsContainer.appendChild(button);
    });
    chatWindow.appendChild(optionsContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * 세션 헤더 업데이트
 */
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = selectedMain || '대화';
    const sub = selectedSubTopicDetails?.displayText || '';
    const summaryTitle = lastAiAnalysisData?.summaryTitle || '진행 중';
    sessionHeaderTextEl.textContent = `${main} > ${sub} > ${summaryTitle}`;
}

/**
 * 이전 글자 수 조회
 */
async function fetchPreviousUserCharCount() {
    if (!loggedInUserId) return 0;
    try {
        const userRef = doc(db, 'users', loggedInUserId);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? (userSnap.data().totalUserCharCount || 0) : 0;
    } catch (error) {
        console.error('Firestore 이전 누적 글자 수 로드 오류:', error);
        return 0;
    }
}

/**
 * 세션 종료 및 저장
 */
async function endSessionAndSave() {
    if (isDataSaved) return;
    isDataSaved = true;

    appendMessage('대화를 안전하게 마무리하고 있어요. 잠시만 기다려 주세요...', 'assistant_feedback');
    if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId);

    if (chatHistory.length <= 2) {
        console.log('대화 내용이 부족하여 저장을 건너뜁니다.');
        return;
    }

    try {
        console.log('최종 저장을 위한 AI 분석 시작...');
        const finalAnalysisResponse = await getGptResponse(
            '지금까지의 대화 전체를 최종적으로 요약하고 분석해줘.', {
                chatHistory: chatHistory,
                userId: loggedInUserId,
                elapsedTime: (Date.now() - conversationStartTime) / (1000 * 60)
            }
        );

        if (!finalAnalysisResponse.ok) throw new Error('최종 AI 분석 실패');

        const finalGptData = await finalAnalysisResponse.json();
        let finalAnalysis = {};
        const jsonStartIndex = finalGptData.text.indexOf('{"');
        if (jsonStartIndex !== -1) {
            finalAnalysis = JSON.parse(finalGptData.text.substring(jsonStartIndex));
        } else {
            finalAnalysis = {
                conversationSummary: finalGptData.text,
                summaryTitle: selectedSubTopicDetails?.displayText || selectedMain || '대화',
                keywords: []
            };
        }

        const summaryText = finalAnalysis.conversationSummary || '요약이 생성되지 않았습니다.';
        const normalizedKeywords = normalizeTags(finalAnalysis.keywords || []);
        finalAnalysis.keywords = normalizedKeywords;

        const journalDetailsToSave = {
            summary: summaryText,
            title: `${selectedMain || '대화'} > ${selectedSubTopicDetails?.displayText || ''} > ${finalAnalysis.summaryTitle || '대화'}`,
            detailedAnalysis: finalAnalysis,
            sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
            userCharCountForThisSession: userCharCountInSession,
            tags: normalizedKeywords
        };

        const entryTypeForSave = currentUserType === 'caregiver' ? 'child' : 'standard';
        const journalId = await saveJournalEntry(loggedInUserId, selectedMain || '대화', journalDetailsToSave, {
            relatedChildId: targetChildId,
            entryType: entryTypeForSave
        });

        if (journalId) {
            await updateTopicStats(loggedInUserId, selectedSubTopicDetails?.displayText || selectedMain || '대화', entryTypeForSave);
            const totalChars = (await fetchPreviousUserCharCount()) + userCharCountInSession;
            await updateUserOverallStats(loggedInUserId, currentUserType, totalChars);

            // 고위험 키워드 기반 알림 생성
            const highRiskKeywords = ['소진', '카산드라신드롬', 'ASD-감각과부하', 'ADHD-충동성'];
            if (normalizedKeywords.some(k => highRiskKeywords.includes(k))) {
                await saveAlert(loggedInUserId, journalId, {
                    keywords: normalizedKeywords,
                    message: generateAlertMessage(normalizedKeywords),
                    severity: normalizedKeywords.includes('소진') || normalizedKeywords.includes('카산드라신드롬') ? 3 : 2,
                    relatedChildId: targetChildId
                });
            }

            console.log('모든 데이터가 성공적으로 저장되었습니다. Journal ID:', journalId);
            displayJournalCreatedNotification(journalId);
        }
    } catch (error) {
        console.error('endSessionAndSave 과정에서 오류 발생:', error);
        appendMessage('대화 내용을 저장하는 중 문제가 발생했어요. 😥', 'assistant_feedback');
    }
}

/**
 * 알림 저장
 */
async function saveAlert(userId, journalId, alertData) {
    const alertRef = doc(db, 'users', userId, 'alerts', journalId);
    await setDoc(alertRef, {
        journalId,
        keywords: alertData.keywords,
        message: alertData.message,
        severity: alertData.severity || 1,
        createdAt: Date.now(),
        relatedChildId: alertData.relatedChildId || null
    });
}

/**
 * 알림 메시지 생성
 */
function generateAlertMessage(keywords) {
    if (keywords.includes('ASD-감각과부하')) {
        return '감각 과부하가 감지되었습니다. 조용한 환경을 제공하거나 감각 놀이를 시도해보세요.';
    }
    if (keywords.includes('ADHD-충동성')) {
        return '충동적 행동이 감지되었습니다. 명확한 루틴과 긍정적 강화로 지원해보세요.';
    }
    if (keywords.includes('소진') || keywords.includes('카산드라신드롬')) {
        return '양육 스트레스나 소진 위험이 감지되었습니다. 전문가 상담을 고려하세요.';
    }
    return '대화에서 주의할 점이 발견되었습니다.';
}

/**
 * 세션 타임아웃 리셋
 */
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}

/**
 * 저널 생성 알림 표시
 */
function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * 분석 알림 표시
 */
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
 * 메시지 전송
 */
async function sendMessage(text, inputMethod, isCharCountExempt = false) {
    if (!text || String(text).trim() === '') {
        console.warn('빈 텍스트로 sendMessage 호출됨');
        return;
    }

    if (!loggedInUserId) {
        console.error('필수 정보(userId) 누락!');
        appendMessage('사용자 정보가 없어 대화를 시작할 수 없어요. 페이지를 새로고침 해주세요.', 'assistant_feedback');
        return;
    }

    if (isProcessing) return;
    isProcessing = true;
    if (micButton) micButton.disabled = true;
    if (sendButton) sendButton.disabled = true;
    resetSessionTimeout();

    if (inputMethod !== 'topic_selection_init') {
        if (inputMethod === 'image_analysis') {
            appendMessage('이미지 분석 결과를 처리 중입니다...', 'assistant thinking');
        } else {
            appendMessage(text, 'user');
        }
    } else {
        appendMessage(text, 'assistant');
    }

    if (chatInput) chatInput.value = '';
    if (inputMethod !== 'image_analysis') {
        appendMessage('...', 'assistant thinking');
    }

    try {
        const currentUser = firebaseAuth.currentUser;
        let idToken = null;
        if (currentUser && (Date.now() - lastTokenRefreshTime > TOKEN_REFRESH_INTERVAL)) {
            idToken = await currentUser.getIdToken(true);
            lastTokenRefreshTime = Date.now();
            console.log('🔐 새 토큰:', idToken);
        } else {
            idToken = await currentUser?.getIdToken() || localStorage.getItem('authToken');
        }

        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const context = {
            chatHistory: [...chatHistory],
            userId: loggedInUserId,
            elapsedTime: elapsedTimeInMinutes,
            systemPrompt: selectedSubTopicDetails?.systemPrompt || null
        };

        console.log('✅ GPT 요청 text:', text);
        console.log('✅ GPT 요청 context:', context);

        const gptResponse = await getGptResponse(text, context, idToken);
        chatWindow.querySelector('.thinking')?.remove();

        if (!gptResponse) {
            throw new Error('GPT 응답을 받지 못했습니다.');
        }

        const rawResponseText = gptResponse.text || '미안하지만, 지금은 답변을 드리기 어렵네.';
        let cleanText = rawResponseText;
        let jsonString = null;
        const jsonStartIndex = rawResponseText.indexOf('{"');

        if (jsonStartIndex !== -1) {
            cleanText = rawResponseText.substring(0, jsonStartIndex).trim();
            jsonString = rawResponseText.substring(jsonStartIndex);

            try {
                lastAiAnalysisData = JSON.parse(jsonString);
                lastAiAnalysisData.keywords = normalizeTags(lastAiAnalysisData.keywords || []);
                updateSessionHeader();

                localStorage.setItem('lozee_last_summary', lastAiAnalysisData.conversationSummary);
                localStorage.setItem('lozee_last_keywords', JSON.stringify(lastAiAnalysisData.keywords));

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
                        const entityEmotionTags = await LOZEE_ANALYSIS.extractEntityEmotionPairs(fullConversationText);
                        localStorage.setItem('lozee_entity_emotion_tags', JSON.stringify(entityEmotionTags));
                        console.log('인물-감정 태그 분석 결과:', entityEmotionTags);
                    }
                }
            } catch (e) {
                console.error('❌ GPT 응답 JSON 파싱 실패:', e);
            }
        }

        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);

        chatHistory.push({ role: 'user', content: text, isCharCountExempt });
        chatHistory.push({ role: 'assistant', content: cleanText });

        userCharCountInSession = chatHistory
            .filter(m => m.role === 'user' && !m.isCharCountExempt)
            .reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);

        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true;
            const topicForJournal = selectedSubTopicDetails?.displayText || selectedMain;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || '요약 진행 중...',
                title: `${selectedMain || '대화'} > ${selectedSubTopicDetails?.displayText || ''} > ${lastAiAnalysisData?.summaryTitle || '대화'}`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: elapsedTimeInMinutes,
                userCharCountForThisSession: userCharCountInSession,
                tags: normalizeTags(lastAiAnalysisData?.keywords || [])
            };
            const journalId = await saveJournalEntry(loggedInUserId, topicForJournal, detailsToSave, {
                relatedChildId: targetChildId,
                entryType: currentUserType === 'caregiver' ? 'child' : 'standard'
            });
            if (journalId) displayJournalCreatedNotification(journalId);
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
                            console.error('예약 저장 중 오류 발생:', error);
                        }
                    };
                    chatWindow.appendChild(scheduleBtn);
                }
            }
        }
    } catch (error) {
        console.error('sendMessage 내 예외 발생:', error);
        chatWindow.querySelector('.thinking')?.remove();
        appendMessage('오류가 발생했어요. 잠시 후 다시 시도해 주세요.', 'assistant_feedback');
    } finally {
        isProcessing = false;
        if (micButton) micButton.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
}

// --- 6. STT 및 오디오 처리 ---
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
        if (micButton) micButton.classList.add('recording');
        micButtonCurrentlyProcessing = false;
    };
    recog.onend = () => {
        isRec = false;
        if (micButton) micButton.classList.remove('recording');
        stopAudio();
        micButtonCurrentlyProcessing = false;
    };
    recog.onresult = event => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
        }
        if (final_transcript) sendMessage(final_transcript.trim(), 'stt');
    };
    recog.onerror = event => {
        console.error('Speech recognition error:', event.error);
        if (isRec) recog.stop();
    };
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
    if (!analyser || !dataArray || !isRec) return; // STT일 때만 실행
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
            .then(stream => {
                setupAudioAnalysis(stream);
                if (recog) recog.start();
            })
            .catch(e => {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            });
    } else {
        isTtsMode = true;
        updateActionButtonIcon();
        appendMessage('음성 모드가 다시 켜졌어요. 이제 로지의 답변을 음성으로 들을 수 있습니다.', 'assistant_feedback');
        micButtonCurrentlyProcessing = false;
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        padding: '12px 18px',
        borderRadius: '8px',
        zIndex: '9999',
        fontSize: '14px',
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- 7. 페이지 로드 및 초기화 ---
document.addEventListener('DOMContentLoaded', async () => {
    const startCover = document.getElementById('start-cover');
    const appContainer = document.querySelector('.app-container');
    const startButton = document.getElementById('start-button');

    const style = document.createElement('style');
    style.textContent = `
        body.talk-page-body { overflow: hidden; }
        .app-container.talk-page { width: 100%; height: 100vh; margin: 0; padding: 10px; box-sizing: border-box; }
        @media (min-width: 641px) {
            .app-container.talk-page { max-width: 640px; height: 90vh; margin: auto; }
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add('talk-page-body');
    if (appContainer) appContainer.classList.add('talk-page');

    plusButton.replaceWith(plusButton.cloneNode(true));
    const newPlus = document.getElementById('plus-button');
    newPlus.addEventListener('click', e => {
        e.preventDefault();
        showToast('🚧 해당 기능은 곧 제공될 예정입니다!');
    });

    imageUpload.replaceWith(imageUpload.cloneNode(true));
    const newUpload = document.getElementById('image-upload');
    newUpload.addEventListener('change', e => {
        e.preventDefault();
        showToast('🚧 이미지 분석 기능은 곧 추가됩니다.');
    });

    if (startButton) {
        startButton.onclick = async () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (startCover) startCover.style.display = 'none';

            try {
                if (!loggedInUserId) {
                    console.error('사용자 정보(userId)가 없습니다. 시작 페이지로 이동합니다.');
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
                currentFirestoreSessionId = await logSessionStart(loggedInUserId, '대화 시작');
                resetSessionTimeout();

                const greetingText = getInitialGreeting(userNameToDisplay + voc, false);
                const voiceForGreeting = localStorage.getItem('lozee_voice') || 'Leda';

                sendMessage(greetingText, 'topic_selection_init');
                await playTTSWithControl(greetingText, voiceForGreeting);

                renderUnifiedTopics();

                window.addEventListener('beforeunload', () => {
                    if (chatHistory.length > 2 && !isDataSaved) endSessionAndSave();
                });
            } catch (error) {
                console.error('페이지 초기화 중 심각한 오류가 발생했습니다:', error);
                appendMessage('페이지를 불러오는 중 문제가 발생했어요.', 'assistant_feedback');
            }
        };
    }
});