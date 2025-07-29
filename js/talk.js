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
import { counselingTopicsByAge, normalizeTags } from './counseling_topics.js'; // 변수명 일관성 확인
import * as LOZEE_ANALYSIS from './lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let userProfile = null;
let currentTopic = null;
let currentSessionId = null;
let conversationHistory = [];
let isProcessing = false;
let isListening = false; // STT 상태
let isSpeaking = false;  // TTS 상태
let conversationStartTime = null;
let isDataSaved = false;
let isTtsMode = true;
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
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const sttBtn = document.getElementById('stt-btn');
const sttIcon = document.getElementById('stt-icon');
const sttSpinner = document.getElementById('stt-spinner');
const ttsBtn = document.getElementById('tts-btn');
const ttsIcon = document.getElementById('tts-icon');
const ttsSpinner = document.getElementById('tts-spinner');
const topicSelectorContainer = document.getElementById('topic-selection-container');
const endSessionButton = document.getElementById('end-session-btn');
const radioBarContainer = document.getElementById('meter-container');
const radioBar = document.getElementById('volume-level');
const startCover = document.getElementById('start-cover');
const startButton = document.getElementById('start-button');
const sessionHeaderTextEl = document.getElementById('session-header-text');

// --- 4. 헬퍼 및 핵심 기능 함수 ---

/**
 * 사용자 역할, 나이, 진단명에 맞는 주제 목록을 반환
 * @param {object} profile - 사용자 프로필 데이터
 * @returns {Promise<Array<object>>} 필터링된 주제 목록
 */
async function getApplicableTopics(profile) {
    if (!profile || !counselingTopicsByAge) {
        console.error('Profile or counselingTopicsByAge is undefined');
        return [];
    }

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
 * 주제 선택 UI 생성
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
            button.setAttribute('aria-label', `${topic.title} 주제 선택`);
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
        showToast('주제 로딩 실패', 3000);
    }
}

/**
 * 주제 선택 및 세션 시작
 * @param {object} topic - 선택된 주제 객체
 */
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

/**
 * 초기 인사 메시지 표시
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
 * 새로운 대화 세션 시작
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
        showToast('세션 시작 실패', 3000);
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
 * 사용자 메시지 처리 및 AI 응답 요청
 * @param {string} text - 사용자 입력 텍스트
 * @param {string} inputMethod - 입력 방식 ('text' 또는 'stt')
 */
async function handleSendMessage(text, inputMethod = 'text') {
    const messageText = (typeof text === 'string' ? text : chatInput.value).trim();
    if (!messageText || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;
    sttBtn.disabled = true;
    ttsBtn.disabled = true;

    appendMessage('user', messageText);
    if (inputMethod === 'text') chatInput.value = '';
    chatInput.style.height = 'auto';

    if (!currentTopic) {
        appendMessage('assistant', "이야기를 시작해주셔서 감사해요. 어떤 주제에 대해 더 깊게 이야기해볼까요?");
        if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
        isProcessing = false;
        sendBtn.disabled = false;
        sttBtn.disabled = false;
        ttsBtn.disabled = false;
        return;
    }

    if (Date.now() - lastTokenRefreshTime > TOKEN_REFRESH_INTERVAL) {
        idToken = await currentUser.getIdToken(true); // 토큰 갱신
        lastTokenRefreshTime = Date.now(); // 업데이트
    }

    conversationHistory.push({ role: 'user', content: messageText });
    userCharCountInSession += messageText.length;
    resetSessionTimeout();

   try {
        appendMessage('assistant thinking', '...');
        const currentUser = firebaseAuth.currentUser;
        let idToken = null;
        if (currentUser) {
            if (Date.now() - lastTokenRefreshTime > TOKEN_REFRESH_INTERVAL) {
                idToken = await currentUser.getIdToken(true);
                lastTokenRefreshTime = Date.now();
            } else {
                idToken = await currentUser.getIdToken();
            }
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

        const cleanText = gptResponse.text;
        appendMessage('assistant', cleanText);
        conversationHistory.push({ role: 'assistant', content: cleanText });
        await playTTSWithControl(cleanText);

        if (conversationHistory.length >= 4 && !journalReadyNotificationShown) {
            showToast('대화 기록이 저장되었습니다. 이야기 모음집에서 확인하세요.', 3000);
            journalReadyNotificationShown = true;
            await saveJournalEntry(userProfile.uid, currentSessionId, conversationHistory, currentTopic);
        }
        if (conversationHistory.length >= 8 && !analysisNotificationShown) {
            showToast('대화 분석이 준비되었습니다. 분석 탭에서 확인하세요.', 3000);
            analysisNotificationShown = true;
            await LOZEE_ANALYSIS.analyzeSession(userProfile.uid, currentSessionId, conversationHistory);
        }
    } catch (error) {
        console.error("GPT 응답 처리 중 오류:", error);
        chatMessages.querySelector('.thinking')?.remove();
        appendMessage('system', "응답을 생성하는 중 오류가 발생했습니다.");
        showToast('응답 생성 실패', 3000);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        sttBtn.disabled = false;
        ttsBtn.disabled = false;
    }
}

/**
 * 세션 종료 및 대화 내용 저장
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
    showToast('대화 종료 중...', 2000);
    await logSessionEnd(currentSessionId);
    await updateTopicStats(userProfile.uid, currentTopic.id, conversationHistory);
    await updateUserOverallStats(userProfile.uid, userCharCountInSession);
    appendMessage('assistant', `오늘 ${currentTopic.title}에 대한 대화가 종료되었습니다.`);
    showToast('대화가 종료되었습니다.', 3000);
    resetSessionState();
}

/**
 * 이전 글자 수 조회
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
 * 세션 상태 초기화
 */
function resetSessionState() {
    currentTopic = null;
    currentSessionId = null;
    conversationHistory = [];
    isDataSaved = false;
    isListening = false;
    isSpeaking = false;
    journalReadyNotificationShown = false;
    analysisNotificationShown = false;
    userCharCountInSession = 0;
    if (endSessionButton) endSessionButton.style.display = 'none';
    if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
    appendMessage('system', '대화가 종료되었습니다. 새로운 주제로 이야기를 시작할 수 있습니다.');
    updateSessionHeader();
}

/**
 * 세션 타임아웃 리셋
 */
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(handleEndSession, SESSION_TIMEOUT_DURATION);
}

/**
 * 세션 헤더 업데이트
 */
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    const main = currentTopic?.title || '대화';
    const summaryTitle = lastAiAnalysisData?.summaryTitle || '진행 중';
    sessionHeaderTextEl.textContent = `${main} > ${summaryTitle}`;
}

/**
 * STT 초기화
 */
function initializeSTT() {
    if (!SpeechRecognitionAPI) {
        showToast('음성 인식을 지원하지 않는 브라우저입니다.', 3000);
        return;
    }
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onstart = () => {
        isListening = true;
        sttIcon.classList.add('hidden');
        sttSpinner.classList.remove('hidden');
        showToast('녹음 시작', 2000);
    };
    recog.onend = () => {
        isListening = false;
        sttIcon.classList.remove('hidden');
        sttSpinner.classList.add('hidden');
        stopAudioVisualization();
        showToast('녹음 종료', 2000);
    };
    recog.onresult = event => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            }
        }
        if (final_transcript) {
            chatInput.value = final_transcript;
            chatInput.style.height = 'auto';
            chatInput.style.height = chatInput.scrollHeight + 'px';
            handleSendMessage(final_transcript, 'stt');
        }
    };
    recog.onerror = event => {
        console.error('STT Error:', event.error);
        showToast(`음성 인식 오류: ${event.error}`, 3000);
        if (isListening) recog.stop();
    };
}

/**
 * STT 버튼 클릭 핸들러
 */
function handleMicButtonClick() {
    if (isProcessing) {
        showToast('처리 중입니다. 잠시 기다려주세요.', 2000);
        return;
    }
    if (isListening) {
        recog.stop();
    } else {
        stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                audioStream = stream;
                setupAudioVisualization(stream);
                recog.start();
            })
            .catch(err => {
                console.error("마이크 접근 오류:", err);
                showToast('마이크 사용 권한이 필요합니다.', 3000);
            });
    }
}

/**
 * TTS 버튼 클릭 핸들러
 */
function handleTtsButtonClick() {
    if (isProcessing) {
        showToast('처리 중입니다. 잠시 기다려주세요.', 2000);
        return;
    }
    isSpeaking = !isSpeaking;
    ttsIcon.classList.toggle('hidden', isSpeaking);
    ttsSpinner.classList.toggle('hidden', !isSpeaking);

    if (isSpeaking) {
        const lastMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop()?.content;
        if (lastMessage) {
            showToast('음성 재생 시작', 2000);
            playTTSWithControl(lastMessage);
        } else {
            showToast('재생할 메시지가 없습니다.', 2000);
            isSpeaking = false;
            ttsIcon.classList.remove('hidden');
            ttsSpinner.classList.add('hidden');
        }
    } else {
        showToast('음성 재생 중지', 2000);
        stopCurrentTTS();
    }
}

/**
 * TTS 재생 제어
 */
async function playTTSWithControl(text) {
    if (!isTtsMode || !text) return;
    try {
        const voiceId = localStorage.getItem('lozee_voice') || 'Leda';
        await playTTSFromText(text, voiceId);
        isSpeaking = false;
        ttsIcon.classList.remove('hidden');
        ttsSpinner.classList.add('hidden');
    } catch (error) {
        console.error('TTS 재생 오류:', error);
        showToast('음성 재생 오류', 3000);
        isSpeaking = false;
        ttsIcon.classList.remove('hidden');
        ttsSpinner.classList.add('hidden');
    }
}

/**
 * 오디오 시각화 설정
 */
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
        if (!isListening) return;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        drawWaveform(array);
    };
    if (radioBarContainer) radioBarContainer.classList.add('active');
}

/**
 * 오디오 파형 그리기
 */
function drawWaveform(dataArray) {
    if (!radioBar) return;
    const avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    const norm = Math.min(100, Math.max(0, (avg / 255) * 100));
    radioBar.style.width = `${norm}%`;
    if (sessionHeaderTextEl) {
        sessionHeaderTextEl.style.backgroundColor = `hsl(228,50%,${90 - (norm / 5)}%)`;
    }
}

/**
 * 오디오 시각화 종료
 */
function stopAudioVisualization() {
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e => console.error(e));
    if (radioBar) radioBar.style.width = '0%';
    if (sessionHeaderTextEl) {
        sessionHeaderTextEl.style.transition = 'background-color 0.3s';
        sessionHeaderTextEl.style.backgroundColor = '';
    }
    if (radioBarContainer) radioBarContainer.classList.remove('active');
}

/**
 * 토스트 메시지 표시
 */
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

/**
 * 메시지 추가
 */
function appendMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('bubble', sender);
    messageElement.innerText = text;
    messageElement.setAttribute('aria-label', `${sender === 'user' ? '사용자' : '어시스턴트'} 메시지: ${text}`);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * 초기화 함수
 */
// talk.js의 initialize 함수 내 프로필 로드 부분
function initialize() {
    initializeSTT();

    // 이벤트 리스너
    sendBtn.addEventListener('click', () => handleSendMessage());
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    sttBtn.addEventListener('click', handleMicButtonClick);
    ttsBtn.addEventListener('click', handleTtsButtonClick);
    startButton?.addEventListener('click', () => {
        startCover.style.display = 'none';
        initializeTopicSelector(userProfile);
    });
    endSessionButton?.addEventListener('click', handleEndSession);

    // 사용자 프로필 로드
    firebaseAuth.onAuthStateChanged(async user => {
        if (user) {
            userProfile = await validateProfileConsistency(user.uid);
            if (userProfile) {
                displayInitialGreeting();
                initializeTopicSelector(userProfile);
            } else {
                showToast('프로필을 로드할 수 없습니다. 다시 로그인해주세요.', 3000);
                window.location.href = 'index.html';
            }
        } else {
            showToast('로그인이 필요합니다.', 3000);
            window.location.href = 'index.html';
        }
    });

    // Textarea 자동 높이 조절
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });
}

async function validateProfileConsistency(uid) {
    const localProfile = JSON.parse(localStorage.getItem('lozee_profile') || '{}');
    const firestoreProfile = await loadUserProfile(uid);
    if (firestoreProfile && JSON.stringify(localProfile) !== JSON.stringify(firestoreProfile)) {
        console.warn('localStorage와 Firestore 프로필 불일치');
        localStorage.setItem('lozee_profile', JSON.stringify(firestoreProfile));
    }
    return firestoreProfile;
}

async function loadUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return { ...userDoc.data(), uid };
        } else {
            console.error('사용자 프로필이 존재하지 않습니다.');
            showToast('프로필을 찾을 수 없습니다. 다시 로그인해주세요.', 3000);
            return null;
        }
    } catch (error) {
        console.error('프로필 로드 오류:', error);
        showToast('프로필 로드 실패', 3000);
        return null;
    }
}