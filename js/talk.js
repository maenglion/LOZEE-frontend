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
const messageInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const topicSelectorContainer = document.getElementById('topic-selection-container');
const endSessionButton = document.getElementById('end-session-btn');
const recordButton = document.getElementById('mic-button');
const radioBarContainer = document.getElementById('meter-container');
const radioBar = document.getElementById('volume-meter');
const plusButton = document.getElementById('plus-button');
const imageUpload = document.getElementById('image-upload');
const startCover = document.getElementById('start-cover');
const startButton = document.getElementById('start-button');
const sessionHeaderTextEl = document.getElementById('session-header-text');
const chatWindow = document.getElementById('chat-window');

// --- 4. 헬퍼 함수 ---

// 메시지 추가
function appendMessage(sender, text, options = {}) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('bubble', `${sender}`);
    if (options.isImageAnalysisResult) {
        messageElement.classList.add('image-analysis-result');
    }
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 사용자 역할과 나이에 맞는 주제 가져오기
async function getApplicableTopics(profile) {
    if (!profile || !COUNSELING_TOPICS) {
        console.error('COUNSELING_TOPICS is undefined or profile is missing');
        return [];
    }

    const userType = profile.userType || [];
    const allTopics = new Set();

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
async function initializeTopicSelector(profile) {
    if (!topicSelectorContainer) {
        console.error('topicSelectorContainer is not found');
        appendMessage('system', '주제 선택 UI를 로드할 수 없습니다.');
        return;
    }
    topicSelectorContainer.innerHTML = '';
    try {
        const topics = await getApplicableTopics(profile);
        console.log('Available topics:', topics); // 디버깅 로그
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
        topicSelectorContainer.style.display = 'flex'; // 명시적 표시
    } catch (error) {
        console.error('주제 렌더링 오류:', error);
        appendMessage('system', '주제를 불러오는 중 문제가 발생했어요.');
    }
}

// 주제 선택
function selectTopic(topic) {
    if (currentTopic && conversationHistory.length > 0) {
        if (!confirm("대화 주제를 변경하시겠습니까? 이전 대화 일부가 저장되지 않을 수 있습니다.")) {
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

    appendMessage('system', "대화를 안전하게 마무리하고 있어요...");
    await logSessionEnd(currentSessionId);
    appendMessage('assistant', `오늘 ${currentTopic.title}에 대한 대화가 종료되었습니다.`);
    resetSessionState();
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

// 세션 상태 초기화
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

// 세션 타임아웃 리셋
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(handleEndSession, SESSION_TIMEOUT_DURATION);
}

// 세션 헤더 업데이트
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = currentTopic?.title || '대화';
    const summaryTitle = lastAiAnalysisData?.summaryTitle || '진행 중';
    sessionHeaderTextEl.textContent = `${main} > ${summaryTitle}`;
}

// STT 초기화
function initializeSTT() {
    if (!SpeechRecognitionAPI) {
        console.warn('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
        appendMessage('system', '음성 인식은 이 브라우저에서 지원되지 않습니다.');
        return;
    }
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onstart = () => {
        isRec = true;
        if (recordButton) recordButton.classList.add('active');
        console.log('STT started');
    };
    recog.onend = () => {
        isRec = false;
        if (recordButton) recordButton.classList.remove('active');
        stopAudioVisualization();
        console.log('STT stopped');
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
        appendMessage('system', '음성 인식 중 오류가 발생했습니다.');
    };
}

// 마이크 버튼 클릭 처리
function handleMicButtonClick() {
    console.log('Mic button clicked');
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

// 파형 그리기
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

// 파형 초기화
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

// 오디오 시각화 중지
function stopAudioVisualization() {
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e => console.error(e));
    clearWaveform();
    if (radioBarContainer) radioBarContainer.classList.remove('active');
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
    console.log('DOMContentLoaded triggered');
    const appContainer = document.querySelector('.app-container');
    const style = document.createElement('style');
    style.textContent = `
        body.talk-page-body { overflow: hidden; }
        .app-container.talk-page { width: 100%; height: 100vh; margin: 0; padding: 10px; box-sizing: border-box; }
        @media (min-width: 641px) {
            .app-container.talk-page { max-width: 640px; height: 90vh; margin: auto; }
        }
        #start-cover {
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            z-index: 1000;
        }
        #start-button {
            padding: 15px 30px;
            font-size: 1.2em;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
        }
        #start-button:hover {
            background-color: var(--secondary-color);
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add('talk-page-body');
    if (appContainer) appContainer.classList.add('talk-page');

    if (!startButton) {
        console.error('startButton을 찾을 수 없습니다.');
        appendMessage('system', '페이지를 초기화할 수 없습니다.');
        return;
    }

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
            userProfile.uid = currentUserId;
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

    startButton.onclick = async () => {
        console.log('Start button clicked');
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        if (startCover) startCover.style.display = 'none';

        try {
            console.log('Initializing topic selector...');
            await initializeTopicSelector(userProfile);
            displayInitialGreeting();
            initializeSTT();

            // 이벤트 리스너 설정
            if (sendButton) {
                sendButton.addEventListener('click', () => {
                    console.log('Send button clicked');
                    handleSendMessage();
                });
            } else {
                console.error('sendButton not found');
            }

            if (messageInput) {
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        console.log('Enter key pressed');
                        handleSendMessage();
                    }
                });
            } else {
                console.error('messageInput not found');
            }

            if (endSessionButton) {
                endSessionButton.addEventListener('click', () => {
                    console.log('End session button clicked');
                    handleEndSession();
                });
            } else {
                console.error('endSessionButton not found');
            }

            if (recordButton) {
                recordButton.addEventListener('click', handleMicButtonClick);
            } else {
                console.error('recordButton not found');
            }

            if (plusButton) {
                plusButton.replaceWith(plusButton.cloneNode(true));
                const newPlus = document.getElementById('plus-button');
                newPlus.addEventListener('click', e => {
                    e.preventDefault();
                    console.log('Plus button clicked');
                    showToast('🚧 해당 기능은 곧 제공될 예정입니다!');
                });
            } else {
                console.error('plusButton not found');
            }

            if (imageUpload) {
                imageUpload.replaceWith(imageUpload.cloneNode(true));
                const newUpload = document.getElementById('image-upload');
                newUpload.addEventListener('change', e => {
                    e.preventDefault();
                    console.log('Image upload triggered');
                    showToast('🚧 이미지 분석 기능은 곧 추가됩니다.');
                });
            } else {
                console.error('imageUpload not found');
            }

            window.addEventListener('beforeunload', () => {
                if (conversationHistory.length > 2 && !isDataSaved) handleEndSession();
            });
        } catch (error) {
            console.error('페이지 초기화 중 심각한 오류가 발생했습니다:', error);
            appendMessage('system', '페이지를 불러오는 중 문제가 발생했어요.');
        }
    };
});