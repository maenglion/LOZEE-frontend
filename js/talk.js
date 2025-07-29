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
import { counselingTopicsByAge, normalizeTags } from './counseling_topics.js';
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
const topicSelectorContainer = document.getElementById('topic-selection-container');
const endSessionButton = document.getElementById('end-session-btn');
const recordButton = document.getElementById('mic-button'); // ID 변경
const radioBarContainer = document.getElementById('meter-container');
const radioBar = document.getElementById('volume-level'); // ID 변경
const plusButton = document.getElementById('plus-button');
const imageUpload = document.getElementById('image-upload');
const startCover = document.getElementById('start-cover');
const startButton = document.getElementById('start-button');
const sessionHeaderTextEl = document.getElementById('session-header-text');
const chatWindow = document.getElementById('chat-window');

// --- 4. 헬퍼 및 핵심 기능 함수 ---

/**
 * 사용자 역할, 나이, 진단명에 맞는 주제 목록을 비동기적으로 반환합니다.
 * @param {object} profile - 사용자 프로필 데이터
 * @returns {Promise<Array<object>>} 필터링 및 병합된 주제 목록
 */
async function getApplicableTopics(profile) {
    if (!profile || !counselingTopicsByAge) return [];

    const finalTopics = new Map();
    const userType = profile.userType || [];
    
    const addSubTopics = (subTopics, diagnoses = []) => {
        if (!Array.isArray(subTopics)) return;
        subTopics.forEach(subTopic => {
            const hasMatchingTag = !subTopic.tags || subTopic.tags.length === 0 || subTopic.tags.some(tag => diagnoses.includes(tag));
            if (hasMatchingTag && !finalTopics.has(subTopic.displayText)) {
                finalTopics.set(subTopic.displayText, {
                    id: subTopic.type || subTopic.displayText.replace(/\s/g, '_'),
                    title: subTopic.displayText,
                    starter: `그래, ${subTopic.displayText}에 대해 이야기해볼까?`,
                    ...subTopic
                });
            }
        });
    };

    if (userType.includes('directUser')) {
        const userAge = profile.age || 30;
        const userDiagnoses = profile.diagnoses || [];
        const ageGroupKey = userAge < 11 ? '10세미만' : userAge <= 15 ? '11-15세' : userAge <= 29 ? '16-29세' : userAge <= 55 ? '30-55세' : '55세이상';
        const mainTopics = counselingTopicsByAge.directUser?.[ageGroupKey] || [];
        mainTopics.forEach(topic => addSubTopics(topic.subTopics, userDiagnoses));
    }

    if (userType.includes('caregiver')) {
        const childDiagnoses = profile.caregiverInfo?.childDiagnoses || [];
        const childAge = profile.caregiverInfo?.childAge || 0;
        const ageGroupKey = childAge < 11 ? '10세미만' : childAge <= 15 ? '11-15세' : 'common';
        
        (counselingTopicsByAge.caregiver?.common || []).forEach(topic => addSubTopics(topic.subTopics, childDiagnoses));
        (counselingTopicsByAge.caregiver?.[ageGroupKey] || []).forEach(topic => addSubTopics(topic.subTopics, childDiagnoses));
    }

    return Array.from(finalTopics.values());
}

/**
 * 필터링된 주제로 주제 선택 UI를 생성합니다.
 * @param {object} profile - 사용자 프로필 데이터
 */
async function initializeTopicSelector(profile) {
    if (!topicSelectorContainer) return;
    topicSelectorContainer.innerHTML = '';

    try {
        const topics = await getApplicableTopics(profile);
        if (topics.length === 0) {
            appendMessage('system', '현재 추천드릴 수 있는 주제가 없네요. 자유롭게 이야기를 시작해주세요.');
            selectTopic({ id: 'free_talk', title: '자유 대화', starter: '자유롭게 이야기해볼까?' });
            return;
        }

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options-container';

        topics.forEach(topic => {
            const button = document.createElement('button');
            button.className = 'topic-btn chat-option-btn';
            button.innerHTML = `${topic.icon || '💬'} ${topic.title}`;
            button.dataset.topicId = topic.id;
            button.onclick = () => {
                optionsContainer.querySelectorAll('.topic-btn').forEach(btn => btn.disabled = true);
                button.classList.add('selected');
                selectTopic(topic);
            };
            optionsContainer.appendChild(button);
        });
        topicSelectorContainer.appendChild(optionsContainer);
    } catch (error) {
        console.error('주제 렌더링 오류:', error);
        appendMessage('system', '주제를 불러오는 중 문제가 발생했습니다.');
    }
}

/**
 * 주제를 선택하고 세션을 시작합니다.
 * @param {object} topic - 선택된 주제 객체
 */
function selectTopic(topic) {
    if (currentTopic && conversationHistory.length > 0) {
        if (!confirm("대화 주제를 변경하시겠습니까? 이전 대화 일부가 저장되지 않을 수 있습니다.")) {
            // 선택 취소 시 버튼 활성화 복원
            topicSelectorContainer.querySelectorAll('.topic-btn').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('selected');
            });
            return;
        }
    }
    currentTopic = topic;
    console.log(`주제 선택: ${topic.title}`);
    startSession(topic);
}

/**
 * 초기 인사 메시지를 표시합니다.
 */
function displayInitialGreeting() {
    const username = userProfile.name || '사용자';
    const voc = getKoreanVocativeParticle(username);
    const greeting = getInitialGreeting(username + voc, false);
    appendMessage('assistant', greeting);
    conversationHistory.push({ role: 'assistant', content: greeting });
    playTTSWithControl(greeting);
}

/**
 * 새로운 대화 세션을 시작합니다.
 * @param {object} topic - 시작할 주제 객체
 */
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

/**
 * 사용자의 메시지를 처리하고 AI 응답을 요청합니다.
 * @param {string} text - 사용자 입력 텍스트
 * @param {string} inputMethod - 입력 방식 ('text' 또는 'stt')
 */
async function handleSendMessage(text, inputMethod = 'text') {
    const messageText = (typeof text === 'string' ? text : messageInput.value).trim();
    if (!messageText || isProcessing) return;

    isProcessing = true;
    if (recordButton) recordButton.disabled = true;
    if (sendButton) sendButton.disabled = true;

    appendMessage('user', messageText);
    if (inputMethod === 'text') messageInput.value = '';

    if (!currentTopic) {
        appendMessage('assistant', "이야기를 시작해주셔서 감사해요. 어떤 주제에 대해 더 깊게 이야기해볼까요?");
        if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
        isProcessing = false;
        if (recordButton) recordButton.disabled = false;
        if (sendButton) sendButton.disabled = false;
        return;
    }
    
    conversationHistory.push({ role: 'user', content: messageText });
    resetSessionTimeout();

    try {
        appendMessage('assistant thinking', '...');
        const currentUser = firebaseAuth.currentUser;
        let idToken = null;
        if (currentUser) {
            idToken = await currentUser.getIdToken(true);
        }

        const context = {
            chatHistory: [...conversationHistory],
            userId: userProfile.uid,
            elapsedTime: (Date.now() - conversationStartTime) / (1000 * 60),
            systemPrompt: currentTopic?.systemPrompt || null
        };

        const gptResponse = await getGptResponse(messageText, context, idToken);
        chatMessages.querySelector('.thinking')?.remove();

        if (!gptResponse || !gptResponse.text) {
            throw new Error('GPT로부터 유효한 응답을 받지 못했습니다.');
        }

        const rawResponseText = gptResponse.text;
        let cleanText = rawResponseText;

        appendMessage('assistant', cleanText);
        conversationHistory.push({ role: 'assistant', content: cleanText });
        await playTTSWithControl(cleanText);

    } catch (error) {
        console.error("GPT 응답 처리 중 오류:", error);
        chatMessages.querySelector('.thinking')?.remove();
        appendMessage('system', "응답을 생성하는 중 오류가 발생했습니다.");
    } finally {
        isProcessing = false;
        if (recordButton) recordButton.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
}

/**
 * 세션을 종료하고 대화 내용을 저장합니다.
 */
async function handleEndSession() {
    if (isDataSaved) return;
    isDataSaved = true;
    clearTimeout(sessionTimeoutId);

    if (!currentSessionId || !currentTopic || conversationHistory.length <= 2) {
        console.log('저장할 대화 내용이 부족하여 세션을 종료합니다.');
        resetSessionState();
        return;
    }
    
    appendMessage('system', "대화를 안전하게 마무리하고 있어요...");
    await logSessionEnd(currentSessionId);
    appendMessage('assistant', `오늘 ${currentTopic.title}에 대한 대화가 종료되었습니다.`);
    resetSessionState();
}

/**
 * 이전 글자 수를 조회합니다.
 */
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

/**
 * 세션 상태를 초기화합니다.
 */
function resetSessionState() {
    currentTopic = null;
    currentSessionId = null;
    conversationHistory = [];
    isDataSaved = false;
    if (endSessionButton) endSessionButton.style.display = 'none';
    if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
    appendMessage('system', '대화가 종료되었습니다. 새로운 주제로 이야기를 시작할 수 있습니다.');
    updateSessionHeader();
}

/**
 * 세션 타임아웃을 리셋합니다.
 */
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(handleEndSession, SESSION_TIMEOUT_DURATION);
}

/**
 * 세션 헤더를 업데이트합니다.
 */
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = currentTopic?.title || '대화';
    const summaryTitle = lastAiAnalysisData?.summaryTitle || '진행 중';
    sessionHeaderTextEl.textContent = `${main} > ${summaryTitle}`;
}


// --- STT/TTS & Audio Visualization ---
function initializeSTT() {
    if (!SpeechRecognitionAPI) return;
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onstart = () => {
        isRec = true;
        sttIcon.classList.add('hidden');
        sttSpinner.classList.remove('hidden');
    };
    recog.onend = () => {
        isRec = false;
        sttIcon.classList.remove('hidden');
        sttSpinner.classList.add('hidden');
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
            messageInput.value = final_transcript; // 입력창에 텍스트 채우기
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        }
    };
    recog.onerror = event => {
        console.error('STT Error:', event.error);
        if (isRec) recog.stop();
    };
}

function handleMicButtonClick() {
    if (isRec) {
        recog.stop();
    } else {
        stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                audioStream = stream;
                setupAudioVisualization(stream);
                recog.start();
            })
            .catch(err => {
                console.error("마이크 접근 오류:", err);
                appendMessage('system', '마이크 사용 권한이 필요합니다.');
            });
    }
}

async function playTTSWithControl(text) {
    if (!isTtsMode) return;
    try {
        const voiceId = localStorage.getItem('lozee_voice') || 'Leda';
        await playTTSFromText(text, voiceId);
    } catch (error) {
        console.error('TTS 재생 오류:', error);
    }
}

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

function drawWaveform(dataArray) {
    const volumeLevel = document.getElementById('volume-level');
    if (!volumeLevel) return;
    const avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    const norm = Math.min(100, Math.max(0, (avg / 255) * 100));
    volumeLevel.style.width = `${norm}%`;
    console.log('Waveform average:', avg, 'Normalized:', norm); // 디버깅 로그
    if (sessionHeaderTextEl) {
        sessionHeaderTextEl.style.backgroundColor = `hsl(228,50%,${90 - (norm / 5)}%)`;
    }
}

function clearWaveform() {
    const volumeLevel = document.getElementById('volume-level');
    if (volumeLevel) {
        volumeLevel.style.width = '0%';
    }
    if (sessionHeaderTextEl) {
        sessionHeaderTextEl.style.transition = 'background-color 0.3s';
        sessionHeaderTextEl.style.backgroundColor = '';
    }
}

function stopAudioVisualization() {
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e => console.error(e));
    clearWaveform();
    if (radioBarContainer) radioBarContainer.classList.remove('active');
}

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

// --- 기타 헬퍼 함수 ---
function appendMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('bubble', sender);
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
