// --- 1. 모듈 Import ---
import { db, auth as firebaseAuth } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
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
import { COUNSELING_TOPICS, counselingTopicsByAge, normalizeTags } from './counseling_topics.js';
import * as LOZEE_ANALYSIS from './lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let userProfile = null;
let currentTopic = null;
let currentSessionId = null;
let conversationHistory = [];
let isProcessing = false;
let conversationStartTime = null;
let isDataSaved = false;
let isTtsMode = true;
let isRec = false;
let sessionTimeoutId = null;
let lastAiAnalysisData = null;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let journalReadyNotificationShown = false;
let analysisNotificationShown = false;
let lastTokenRefreshTime = 0;
const SESSION_TIMEOUT_DURATION = 10 * 60 * 1000; // 10분
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55분
const FFT_SIZE = 256;

// STT 및 오디오 관련 변수
let audioContext, analyser, microphone, javascriptNode, audioStream;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;

// --- 3. UI 요소 가져오기 ---
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const topicSelectorContainer = document.getElementById('topic-selector-container');
const endSessionButton = document.getElementById('end-session-btn');
const recordButton = document.getElementById('record-btn');
const radioBarContainer = document.getElementById('radio-bar-container');
const radioBar = document.getElementById('radio-bar');
const plusButton = document.getElementById('plus-button');
const imageUpload = document.getElementById('image-upload');
const startCover = document.getElementById('start-cover');
const startButton = document.getElementById('start-button');
const sessionHeaderTextEl = document.getElementById('session-header');

// --- 4. 헬퍼 함수 ---

// 사용자 역할과 나이에 맞는 주제 가져오기
async function getApplicableTopics(profile) {
    if (!profile || !COUNSELING_TOPICS) return [];

    const userType = profile.userType || [];
    const allTopics = new Set();
    const userAge = profile.age || 30;
    const userAgeGroupKey = (() => {
        if (userAge < 11) return '10세미만';
        if (userAge <= 15) return '11-15세';
        if (userAge <= 29) return '16-29세';
        if (userAge <= 55) return '30-55세';
        return '55세이상';
    })();

    // 공통 주제 추가
    if (COUNSELING_TOPICS.common && Array.isArray(COUNSELING_TOPICS.common)) {
        COUNSELING_TOPICS.common.forEach(topic => allTopics.add(topic));
    }

    // directUser 주제 추가
    if (userType.includes('directUser') && COUNSELING_TOPICS.directUser) {
        const userDiagnoses = profile.diagnoses || [];
        const directUserTopics = counselingTopicsByAge.directUser?.[userAgeGroupKey] || COUNSELING_TOPICS.directUser;
        directUserTopics.forEach(topic => {
            if (!topic.tags || topic.tags.length === 0 || topic.tags.some(tag => userDiagnoses.includes(tag))) {
                allTopics.add(topic);
            }
        });
    }

    // caregiver 주제 추가
    if (userType.includes('caregiver') && COUNSELING_TOPICS.caregiver) {
        const childDiagnoses = profile.caregiverInfo?.childDiagnoses || [];
        const childAge = profile.caregiverInfo?.childAge || 0;
        const childAgeGroupKey = (() => {
            if (childAge < 11) return '10세미만';
            if (childAge <= 15) return '11-15세';
            return 'common';
        })();
        const caregiverTopics = [
            ...(counselingTopicsByAge.caregiver?.[childAgeGroupKey] || []),
            ...(counselingTopicsByAge.caregiver?.common || []),
            ...(COUNSELING_TOPICS.caregiver || [])
        ];
        caregiverTopics.forEach(topic => {
            if (!topic.tags || topic.tags.length === 0 || topic.tags.some(tag => childDiagnoses.includes(tag))) {
                allTopics.add(topic);
            }
        });
    }

    return Array.from(allTopics);
}

// 주제 선택기 초기화
function initializeTopicSelector(profile) {
    if (!topicSelectorContainer) return;
    topicSelectorContainer.innerHTML = '';
    getApplicableTopics(profile).then(topics => {
        if (topics.length === 0) {
            topicSelectorContainer.innerHTML = `<p style="color: gray; text-align: center; margin-top: 2rem;">현재 선택 가능한 주제가 없습니다.<br>마이페이지에서 역할과 나이를 확인해 주세요.</p>`;
            startSession({ id: 'free_form', title: '자유롭게 이야기하기', tags: ['자유주제'], starter: '자유롭게 이야기해볼까요?' });
            return;
        }

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options-container';
        topics.forEach(topic => {
            const button = document.createElement('button');
            button.className = 'topic-btn chat-option-btn';
            button.textContent = topic.title;
            button.dataset.topicId = topic.id;
            button.onclick = () => {
                optionsContainer.querySelectorAll('.topic-btn').forEach(btn => btn.disabled = true);
                button.classList.add('selected');
                selectTopic(topic);
            };
            optionsContainer.appendChild(button);
        });
        topicSelectorContainer.appendChild(optionsContainer);
    }).catch(error => {
        console.error('주제 렌더링 오류:', error);
        appendMessage('주제를 불러오는 중 문제가 발생했어요.', 'assistant_feedback');
    });
}

// 주제 선택
function selectTopic(topic) {
    if (currentTopic && conversationHistory.length > 0) {
        if (!confirm("대화 주제를 변경하시겠습니까? 이전 대화 일부가 저장되지 않을 수 있습니다.")) {
            return;
        }
    }
    currentTopic = topic;
    console.log(`주제 선택: ${topic.title}`);
    startSession(topic);
}

// 초기 인사 표시
function displayInitialGreeting() {
    const username = userProfile.name || '사용자';
    const voc = getKoreanVocativeParticle(username);
    const greeting = getInitialGreeting(username + voc, false);
    appendMessage('assistant', greeting);
    conversationHistory.push({ role: 'assistant', content: greeting });
    playTTSWithControl(greeting);
}

// 세션 시작
async function startSession(topic) {
    conversationHistory = [];
    isDataSaved = false;
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    currentSessionId = await logSessionStart(userProfile.uid, topic.id);
    
    if (!currentSessionId) {
        appendMessage('system', "오류: 세션을 시작하지 못했습니다.");
        return;
    }

    let starter = topic.starter || `${topic.title}에 대해 이야기 나눠볼까요?`;
    if (userProfile.role === 'parent' && userProfile.caregiverInfo?.childName) {
        starter = starter.replace(/당신/g, `${userProfile.caregiverInfo.childName}님`);
    }

    appendMessage('assistant', starter);
    conversationHistory.push({ role: 'assistant', content: starter });
    playTTSWithControl(starter);
    
    if (endSessionButton) endSessionButton.style.display = 'block';
    if (topicSelectorContainer) topicSelectorContainer.style.display = 'none';
    updateSessionHeader();
    resetSessionTimeout();
}

// 메시지 전송
async function handleSendMessage(text, inputMethod = 'text', isCharCountExempt = false) {
    const messageText = (typeof text === 'string' ? text : messageInput.value).trim();
    if (!messageText || isProcessing) return;

    isProcessing = true;
    appendMessage('user', messageText);
    if (inputMethod === 'text') messageInput.value = '';

    if (!currentTopic) {
        appendMessage('assistant', "이야기를 시작해주셔서 감사해요. 어떤 주제에 대해 더 깊게 이야기해볼까요?");
        if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
        isProcessing = false;
        return;
    }
    
    conversationHistory.push({ role: 'user', content: messageText, isCharCountExempt });
    resetSessionTimeout();

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

        appendMessage('...', 'assistant thinking');
        const context = {
            chatHistory: [...conversationHistory],
            userId: userProfile.uid,
            elapsedTime: (Date.now() - conversationStartTime) / (1000 * 60),
            systemPrompt: currentTopic?.systemPrompt || null
        };

        const gptResponse = await getGptResponse(messageText, context, idToken);
        chatMessages.querySelector('.thinking')?.remove();

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
                        const fullConversationText = conversationHistory.map(turn => turn.content).join('\n');
                        const entityEmotionTags = await LOZEE_ANALYSIS.extractEntityEmotionPairs(fullConversationText);
                        localStorage.setItem('lozee_entity_emotion_tags', JSON.stringify(entityEmotionTags));
                        console.log('인물-감정 태그 분석 결과:', entityEmotionTags);
                    }
                }
            } catch (e) {
                console.error('❌ GPT 응답 JSON 파싱 실패:', e);
            }
        }

        appendMessage('assistant', cleanText);
        conversationHistory.push({ role: 'assistant', content: cleanText });
        await playTTSWithControl(cleanText);

        userCharCountInSession = conversationHistory
            .filter(m => m.role === 'user' && !m.isCharCountExempt)
            .reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);

        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && currentTopic) {
            journalReadyNotificationShown = true;
            const journalDetails = {
                summary: lastAiAnalysisData?.conversationSummary || '요약 진행 중...',
                title: `${currentTopic.title} > ${lastAiAnalysisData?.summaryTitle || '대화'}`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
                userCharCountForThisSession: userCharCountInSession,
                tags: normalizeTags(lastAiAnalysisData?.keywords || [])
            };
            const entryType = userProfile.role === 'parent' ? 'child' : 'standard';
            const journalId = await saveJournalEntry(userProfile.uid, currentTopic.id, journalDetails, {
                relatedChildId: userProfile.caregiverInfo?.childId || null,
                entryType
            });
            if (journalId) displayJournalCreatedNotification(journalId);
        }

        const userTurnCount = conversationHistory.filter(m => m.role === 'user').length;
        if ((Date.now() - conversationStartTime) / (1000 * 60) >= 10 && userTurnCount >= 10 && !analysisNotificationShown) {
            if (lastAiAnalysisData) {
                const dataToStore = { results: lastAiAnalysisData, accumulatedDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60) };
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));
                showAnalysisNotification();

                if (lastAiAnalysisData?.cognitiveDistortions?.length > 0) {
                    appendMessage('어떤 요일·시간대가 편하신가요? (예: 매주 화요일 오후 3시)', 'assistant');
                    const scheduleBtn = document.createElement('button');
                    scheduleBtn.className = 'chat-option-btn';
                    scheduleBtn.textContent = '🗓️ 상담 예약하기';
                    scheduleBtn.onclick = async () => {
                        try {
                            await saveReservation(userProfile.uid, {
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
                    chatMessages.appendChild(scheduleBtn);
                }
            }
        }
    } catch (error) {
        console.error("GPT 응답 오류:", error);
        chatMessages.querySelector('.thinking')?.remove();
        appendMessage('system', "응답을 생성하는 중 오류가 발생했습니다.");
    } finally {
        isProcessing = false;
        if (recordButton) recordButton.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
}

// 세션 종료 및 저장
async function handleEndSession() {
    if (isDataSaved) return;
    isDataSaved = true;
    clearTimeout(sessionTimeoutId);

    if (!currentSessionId || !currentTopic || conversationHistory.length <= 2) {
        console.log('저장할 대화 내용이 부족하여 세션을 종료합니다.');
        resetSessionState();
        return;
    }

    appendMessage('system', "대화를 분석하고 요약하는 중입니다...");

    try {
        const finalAnalysisResponse = await getGptResponse(
            '지금까지의 대화 전체를 최종적으로 요약하고 분석해줘.', {
                chatHistory: conversationHistory,
                userId: userProfile.uid,
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
                summaryTitle: currentTopic.title || '대화',
                keywords: []
            };
        }

        const summaryText = finalAnalysis.conversationSummary || '요약이 생성되지 않았습니다.';
        const normalizedKeywords = normalizeTags(finalAnalysis.keywords || []);
        finalAnalysis.keywords = normalizedKeywords;

        const journalDetails = {
            summary: summaryText,
            title: `${currentTopic.title} > ${finalAnalysis.summaryTitle || '대화'}`,
            detailedAnalysis: finalAnalysis,
            sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
            userCharCountForThisSession: userCharCountInSession,
            tags: normalizedKeywords
        };

        const entryType = userProfile.role === 'parent' ? 'child' : 'standard';
        const journalId = await saveJournalEntry(userProfile.uid, currentTopic.id, journalDetails, {
            relatedChildId: userProfile.caregiverInfo?.childId || null,
            entryType
        });

        if (journalId) {
            appendMessage('assistant', `오늘의 대화가 "${journalDetails.title}"이라는 제목으로 저장되었습니다.`);
            await updateTopicStats(userProfile.uid, currentTopic.id, entryType);
            const totalChars = previousTotalUserCharCountOverall + userCharCountInSession;
            await updateUserOverallStats(userProfile.uid, userProfile.role === 'parent' ? 'caregiver' : 'directUser', totalChars);

            const highRiskKeywords = ['소진', '카산드라신드롬', 'ASD-감각과부하', 'ADHD-충동성'];
            if (normalizedKeywords.some(k => highRiskKeywords.includes(k))) {
                await saveAlert(userProfile.uid, journalId, {
                    keywords: normalizedKeywords,
                    message: generateAlertMessage(normalizedKeywords),
                    severity: normalizedKeywords.includes('소진') || normalizedKeywords.includes('카산드라신드롬') ? 3 : 2,
                    relatedChildId: userProfile.caregiverInfo?.childId || null
                });
            }
        }
    } catch (error) {
        console.error("세션 종료 및 저장 처리 중 오류:", error);
        appendMessage('system', "대화 저장 중 오류가 발생했습니다.");
    } finally {
        await logSessionEnd(currentSessionId);
        resetSessionState();
    }
}

// 이전 글자 수 조회
async function fetchPreviousUserCharCount() {
    try {
        const userRef = doc(db, 'users', userProfile.uid);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? (userSnap.data().totalUserCharCount || 0) : 0;
    } catch (error) {
        console.error('Firestore 이전 누적 글자 수 로드 오류:', error);
        return 0;
    }
}

// 알림 저장
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

// 알림 메시지 생성
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

// 세션 상태 초기화
function resetSessionState() {
    currentTopic = null;
    currentSessionId = null;
    conversationHistory = [];
    isDataSaved = false;
    journalReadyNotificationShown = false;
    analysisNotificationShown = false;
    userCharCountInSession = 0;
    if (endSessionButton) endSessionButton.style.display = 'none';
    if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
    appendMessage('system', '대화가 종료되었습니다. 새로운 주제로 이야기를 시작할 수 있습니다.');
    updateSessionHeader();
}

// 세션 타임아웃 리셋
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(handleEndSession, SESSION_TIMEOUT_DURATION);
}

// 메시지 추가
function appendMessage(sender, text, options = {}) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    if (options.isImageAnalysisResult) {
        messageElement.classList.add('image-analysis-result');
    }
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 세션 헤더 업데이트
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = currentTopic?.title || '대화';
    const summaryTitle = lastAiAnalysisData?.summaryTitle || '진행 중';
    sessionHeaderTextEl.textContent = `${main} > ${summaryTitle}`;
}

// 저널 생성 알림 표시
function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatMessages) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    chatMessages.appendChild(notification);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 분석 알림 표시
function showAnalysisNotification() {
    if (analysisNotificationShown || !chatMessages) return;
    analysisNotificationShown = true;
    const notification = document.createElement('div');
    notification.className = 'analysis-notification';
    notification.innerHTML = '📊 분석 완료! <strong>클릭해서 확인</strong>';
    notification.onclick = () => {
        const redirectUrl = (userProfile.age >= 15 && userProfile.role !== 'parent') ? 'analysis_adult.html' : 'analysis.html';
        window.location.href = redirectUrl;
    };
    chatMessages.appendChild(notification);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// STT 초기화
function initializeSTT() {
    if (!SpeechRecognitionAPI) {
        console.warn('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
        return;
    }
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onstart = () => {
        isRec = true;
        if (recordButton) recordButton.classList.add('recording');
    };

    recog.onend = () => {
        isRec = false;
        if (recordButton) recordButton.classList.remove('recording');
        stopAudioVisualization();
    };

    recog.onresult = event => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            }
        }
        if (final_transcript) {
            handleSendMessage(final_transcript.trim(), 'stt');
        }
    };

    recog.onerror = event => {
        console.error('Speech recognition error:', event.error);
        if (isRec) recog.stop();
    };
}

// 마이크 버튼 클릭 처리
function handleMicButtonClick() {
    if (messageInput.value.trim() !== '') {
        handleSendMessage(messageInput.value.trim(), 'text');
        return;
    }
    if (isProcessing) return;
    if (isRec) {
        if (recog) recog.stop();
        return;
    }
    stopCurrentTTS();
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            audioStream = stream;
            setupAudioVisualization(stream);
            if (recog) recog.start();
        })
        .catch(err => {
            console.error("마이크 접근 오류:", err);
            appendMessage('system', '마이크 사용 권한이 필요합니다. 브라우저 설정을 확인해주세요.');
        });
}

// TTS 재생
async function playTTSWithControl(text) {
    if (!isTtsMode) return;
    try {
        const voiceId = localStorage.getItem('lozee_voice') || 'Leda';
        await playTTSFromText(text, voiceId);
    } catch (error) {
        console.error('TTS 재생 오류:', error);
    }
}

// 오디오 시각화 설정
function setupAudioVisualization(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.fftSize = FFT_SIZE;
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
        if (!isRec) return;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        drawWaveform(array);
    };

    if (radioBarContainer) radioBarContainer.classList.add('active');
}

// 오디오 시각화 중지
function stopAudioVisualization() {
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    clearWaveform();
    if (radioBarContainer) radioBarContainer.classList.remove('active');
}

// 파형 그리기
function drawWaveform(dataArray) {
    if (!radioBar) return;
    radioBar.innerHTML = '';
    const barCount = 16;
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'radio-bar-item';
        const dataIndex = Math.floor(dataArray.length / barCount * i);
        const barHeight = Math.max(1, (dataArray[dataIndex] / 255) * 100);
        bar.style.height = `${barHeight}%`;
        radioBar.appendChild(bar);
    }
    if (sessionHeaderTextEl) {
        const avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
        const norm = Math.min(100, Math.max(0, (avg / 140) * 100));
        sessionHeaderTextEl.style.backgroundColor = `hsl(228,50%,${90 - (norm / 5)}%)`;
    }
}

// 파형 초기화
function clearWaveform() {
    if (!radioBar) return;
    radioBar.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const bar = document.createElement('div');
        bar.className = 'radio-bar-item';
        bar.style.height = '1%';
        radioBar.appendChild(bar);
    }
    if (sessionHeaderTextEl) {
        sessionHeaderTextEl.style.transition = 'background-color 0.3s';
        sessionHeaderTextEl.style.backgroundColor = '';
    }
}

// 토스트 메시지 표시
function showToast(message, duration = 3000) {
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
    setTimeout(() => toast.remove(), duration);
}

// --- 5. 페이지 로드 및 초기화 ---
document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.querySelector('.app-container');
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

    if (topicSelectorContainer) topicSelectorContainer.style.display = 'none';
    if (radioBarContainer) radioBarContainer.style.display = 'flex';
    if (endSessionButton) endSessionButton.style.display = 'none';

    const currentUserId = localStorage.getItem('lozee_userId');
    if (!currentUserId) {
        console.error("사용자 ID를 찾을 수 없습니다. 로그인 페이지로 리디렉션합니다.");
        window.location.href = 'index.html';
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        if (userDoc.exists()) {
            userProfile = userDoc.data();
            userProfile.uid = currentUserId; // UID 추가
        } else {
            console.error("사용자 프로필을 찾을 수 없습니다.");
            window.location.href = 'index.html';
            return;
        }
    } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
        appendMessage('system', '프로필을 불러오는 중 문제가 발생했습니다.');
        window.location.href = 'index.html';
        return;
    }

    if (startButton) {
        startButton.onclick = async () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (startCover) startCover.style.display = 'none';

            try {
                initializeTopicSelector(userProfile);
                displayInitialGreeting();
                initializeSTT();

                // 이벤트 리스너 설정
                sendButton.addEventListener('click', () => handleSendMessage());
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                });
                if (endSessionButton) endSessionButton.addEventListener('click', handleEndSession);
                if (recordButton) recordButton.addEventListener('click', handleMicButtonClick);

                // 이미지 업로드 이벤트 (미완성 기능)
                if (plusButton) {
                    plusButton.replaceWith(plusButton.cloneNode(true));
                    const newPlus = document.getElementById('plus-button');
                    newPlus.addEventListener('click', e => {
                        e.preventDefault();
                        showToast('🚧 해당 기능은 곧 제공될 예정입니다!');
                    });
                }
                if (imageUpload) {
                    imageUpload.replaceWith(imageUpload.cloneNode(true));
                    const newUpload = document.getElementById('image-upload');
                    newUpload.addEventListener('change', e => {
                        e.preventDefault();
                        showToast('🚧 이미지 분석 기능은 곧 추가됩니다.');
                    });
                }

                // 세션 종료 시 저장
                window.addEventListener('beforeunload', () => {
                    if (conversationHistory.length > 2 && !isDataSaved) handleEndSession();
                });
            } catch (error) {
                console.error('페이지 초기화 중 심각한 오류가 발생했습니다:', error);
                appendMessage('system', '페이지를 불러오는 중 문제가 발생했어요.');
            }
        };
    } else {
        console.error("startButton을 찾을 수 없습니다.");
        appendMessage('system', '페이지를 초기화할 수 없습니다.');
    }
});