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
const chatWindow = document.getElementById('chat-window');

// --- 4. 헬퍼 및 핵심 기능 함수 ---

/**
 * 사용자 역할, 나이, 진단명에 맞는 주제 목록을 비동기적으로 반환합니다.
 * @param {object} profile - 사용자 프로필 데이터
 * @returns {Promise<Array<object>>} 필터링 및 병합된 주제 목록
 */
async function getApplicableTopics(profile) {
    if (!profile) return [];

    const userType = profile.userType || [];
    const allTopics = new Map(); // 중복 제거를 위해 Map 사용 (id를 key로)

    const addTopic = (topic) => {
        if (topic && topic.id && !allTopics.has(topic.id)) {
            allTopics.set(topic.id, topic);
        }
    };
    
    const addTopicsFromArray = (topicArray) => {
        if (topicArray && Array.isArray(topicArray)) {
            topicArray.forEach(addTopic);
        }
    };

    // 1. 공통 주제 추가
    addTopicsFromArray(COUNSELING_TOPICS.common);

    // 2. DirectUser(당사자) 주제 추가
    if (userType.includes('directUser')) {
        const userDiagnoses = profile.diagnoses || [];
        (COUNSELING_TOPICS.directUser || []).forEach(topic => {
            if (!topic.tags || topic.tags.length === 0 || topic.tags.some(tag => userDiagnoses.includes(tag))) {
                addTopic(topic);
            }
        });
    }

    // 3. Caregiver(보호자) 주제 추가
    if (userType.includes('caregiver')) {
        const childDiagnoses = profile.caregiverInfo?.childDiagnoses || [];
        (COUNSELING_TOPICS.caregiver || []).forEach(topic => {
            if (!topic.tags || topic.tags.length === 0 || topic.tags.some(tag => childDiagnoses.includes(tag))) {
                addTopic(topic);
            }
        });
    }

    return Array.from(allTopics.values());
}


/**
 * 필터링된 주제로 주제 선택 UI를 생성합니다.
 * @param {object} profile - 사용자 프로필 데이터
 */
async function initializeTopicSelector(profile) {
    if (!topicSelectorContainer) return;
    topicSelectorContainer.innerHTML = ''; // 초기화

    try {
        const topics = await getApplicableTopics(profile);
        if (topics.length === 0) {
            topicSelectorContainer.innerHTML = `<p class="system-message">선택 가능한 주제가 없습니다.</p>`;
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
            idToken = await currentUser.getIdToken(true); // 토큰 갱신
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
        
        // (기존 코드의 JSON 분석 로직 등 추가 가능)

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
    
    // (기존 코드의 상세한 저장 및 분석 로직을 여기에 통합)
    appendMessage('system', "대화를 안전하게 마무리하고 있어요...");
    
    await logSessionEnd(currentSessionId);
    // 예시: 간단한 저장 알림
    appendMessage('assistant', `오늘 ${currentTopic.title}에 대한 대화가 종료되었습니다.`);

    resetSessionState();
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

// (기존 코드의 나머지 헬퍼 함수들: resetSessionTimeout, appendMessage, updateSessionHeader 등...)
// ...

// --- STT/TTS & Audio Visualization ---
function initializeSTT() {
    if (!SpeechRecognitionAPI) return;
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

function handleMicButtonClick() {
    if (messageInput.value.trim() !== '') {
        handleSendMessage();
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
            appendMessage('system', '마이크 사용 권한이 필요합니다.');
        });
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
}

function stopAudioVisualization() {
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e => console.error(e));
    clearWaveform();
}

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