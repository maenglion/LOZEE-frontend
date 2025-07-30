// --- 1. 모듈 Import ---
import { db, auth as firebaseAuth } from '/js/firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from '/js/gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from '/js/tts.js';
import { startSTT, stopSTT, getSTTFromAudio } from '/js/stt.js';
import { saveJournalEntry, updateTopicStats, updateUserOverallStats, logSessionStart, logSessionEnd } from '/js/firebase-utils.js';
import * as LOZEE_ANALYSIS from '/js/lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let userProfile = null;
let currentTopic = null;
let currentSessionId = null;
let conversationHistory = [];
let isProcessing = false;
let isListening = false;
let conversationStartTime = null;
let isDataSaved = false;
let isTtsMode = true;
let sessionTimeoutId = null;
let lastAiAnalysisData = null;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let lastTokenRefreshTime = 0;
let journalReadyNotificationShown = false;
let analysisNotificationShown = false;
const SESSION_TIMEOUT_DURATION = 10 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000;
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
const topicSelectorContainer = document.getElementById('topic-selection-container');
const endSessionButton = document.getElementById('end-session-btn');
const radioBarContainer = document.getElementById('meter-container');
const radioBar = document.getElementById('volume-level');

// --- 4. 헬퍼 및 핵심 기능 함수 ---

/**
 * 사용자 역할, 나이, 진단명에 맞는 주제 목록을 반환
 * @param {object} profile - 사용자 프로필 데이터
 * @returns {Promise<Array<object>>} 필터링된 주제 목록
 */
async function getApplicableTopics(profile) {
    if (!profile) {
        console.error('Profile is undefined');
        showToast('주제를 불러올 수 없습니다.', 3000);
        return [{ id: 'free_talk', title: '자유 대화', starter: '자유롭게 이야기해보볼까?' }];
    }

    const finalTopics = new Map();
    const userType = Array.isArray(profile.userType) ? profile.userType : [profile.userType];

    try {
        const ageGroupKey = getAgeGroupKey(profile.age || 30, profile.caregiverInfo?.childAge || 0);
        const topicsDoc = await getDoc(doc(db, 'topics', ageGroupKey));
        if (!topicsDoc.exists()) {
            console.error('Topics document not found for age group:', ageGroupKey);
            return [{ id: 'free_talk', title: '자유 대화', starter: '자유롭게 이야기해보볼까?' }];
        }

        const topicsData = topicsDoc.data();
        const directUserTopics = topicsData.directUser || [];
        const caregiverTopics = topicsData.caregiver || [];

        if (userType.includes('directUser')) {
            const userDiagnoses = profile.diagnoses || [];
            directUserTopics.forEach(topic => addSubTopics(topic.subTopics, userDiagnoses, finalTopics));
        }

        if (userType.includes('caregiver')) {
            const childDiagnoses = profile.caregiverInfo?.childDiagnoses || [];
            caregiverTopics.forEach(topic => addSubTopics(topic.subTopics, childDiagnoses, finalTopics));
        }

    } catch (error) {
        console.error('Firestore topics load error:', error);
        showToast('주제 로드 실패', 3000);
    }

    return Array.from(finalTopics.values());
}

function getAgeGroupKey(userAge, childAge = 0) {
    const age = childAge || userAge;
    if (age < 11) return '10세미만';
    if (age <= 15) return '11-15세';
    if (age <= 29) return '16-29세';
    if (age <= 55) return '30-55세';
    return '55세이상';
}

function addSubTopics(subTopics, diagnoses, finalTopics) {
    if (!Array.isArray(subTopics)) return;
    subTopics.forEach(subTopic => {
        const hasMatchingTag = !subTopic.tags || subTopic.tags.length === 0 || subTopic.tags.some(tag => diagnoses.includes(tag));
        if (hasMatchingTag && !finalTopics.has(subTopic.displayText)) {
            finalTopics.set(subTopic.displayText, {
                id: subTopic.type || subTopic.displayText.replace(/\s/g, '_'),
                title: subTopic.displayText,
                starter: `그래, ${subTopic.displayText}에 대해 이야기해보볼까?`,
                ...subTopic
            });
        }
    });
}

/**
 * 주제 선택 UI 생성
 * @param {object} profile - 사용자 프로필 데이터
 */
async function initializeTopicSelector(profile) {
    // 동적으로 topic-selection-container 생성
    let topicSelectorContainer = document.getElementById('topic-selection-container');
    if (!topicSelectorContainer) {
        topicSelectorContainer = document.createElement('div');
        topicSelectorContainer.id = 'topic-selection-container';
        document.getElementById('chat-window').prepend(topicSelectorContainer);
    }
    topicSelectorContainer.innerHTML = '';

    try {
        const topics = await getApplicableTopics(profile);
        if (topics.length === 0) {
            appendMessage('system', '현재 추천드릴 수 있는 주제가 없네요. 자유롭게 이야기를 시작해주세요.');
            selectTopic({ id: 'free_talk', title: '자유 대화', starter: '자유롭게 이야기해보볼까?' });
            return;
        }

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options-container';

        topics.forEach(topic => {
            const button = document.createElement('button');
            button.className = 'chat-option-btn';
            button.innerHTML = `${topic.icon || '💬'} ${topic.title}`;
            button.dataset.topicId = topic.id;
            button.setAttribute('aria-label', `${topic.title} 주제 선택`);
            button.onclick = () => {
                optionsContainer.querySelectorAll('.chat-option-btn').forEach(btn => {
                    btn.disabled = true;
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');
                selectTopic(topic);
            };
            optionsContainer.appendChild(button);
        });
        topicSelectorContainer.appendChild(optionsContainer);
        topicSelectorContainer.style.display = 'flex';
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
// displayInitialGreeting 함수 수정
async function displayInitialGreeting() {
    addMessageToChat("라이언아, 안녕! 나는 너의 마음친구 로지야. 오늘 어떤 이야기를 나누고 싶니?", false);
    document.body.addEventListener('click', async () => {
        await playTTSFromText("라이언아, 안녕! 나는 너의 마음친구 로지야. 오늘 어떤 이야기를 나누고 싶니?");
    }, { once: true });
    showToast('환영합니다! 클릭해서 대화를 시작하세요.', 3000);
}

/**
 * 새로운 대화 세션 시작
 * @param {object} topic - 시작할 주제 객체
 */
async function startSession(topic) {
    conversationHistory = [];
    isDataSaved = false;
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount(); // lozee-analysis.js 연계
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


    appendMessage('user', messageText);
    if (inputMethod === 'text') chatInput.value = '';
    chatInput.style.height = 'auto';

    if (!currentTopic) {
        appendMessage('assistant', "이야기를 시작해주셔서 감사해요. 어떤 주제에 대해 더 깊게 이야기해볼까요?");
        if (topicSelectorContainer) topicSelectorContainer.style.display = 'flex';
        isProcessing = false;
        sendBtn.disabled = false;
        sttBtn.disabled = false;

        return;
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
    }
}

/**
 * 사용자 상호작용 후 호출되도록 
 */
async function playTTSWithControl(text) {
    if (!isTtsMode || !text) return;
    try {
        const voiceId = localStorage.getItem('lozee_voice') || 'Leda';
        await playTTSFromText(text, voiceId);
    } catch (error) {
        console.error('TTS 재생 오류:', error);
        if (error.message.includes('not allowed to play')) {
            showToast('음성 재생을 위해 페이지를 다시 로드하거나 상호작용 후 시도하세요.', 3000);
        } else {
            showToast('음성 재생 오류', 3000);
        }
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
    await updateUserOverallStats(userProfile.uid, userCharCountInSession + previousTotalUserCharCountOverall); // lozee-analysis.js 연계
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
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        showToast('음성 인식을 지원하지 않는 브라우저입니다.', 3000);
        return;
    }
    recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onstart = () => {
        isListening = true;
        sttIcon.classList.add('hidden');
        sttSpinner.classList.remove('hidden');
        sttBtn.classList.add('active');
        showToast('녹음 중입니다...', 2000);
    };
    recog.onend = () => {
        isListening = false;
        sttIcon.classList.remove('hidden');
        sttSpinner.classList.add('hidden');
        sttBtn.classList.remove('active');
        stopAudioVisualization();
        showToast('녹음이 완료되었습니다.', 2000);
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
async function handleMicButtonClick() {
    if (isProcessing) {
        showToast('처리 중입니다. 잠시 기다려주세요.', 2000);
        return;
    }
    if (isListening) {
        try {
            const transcript = await stopSTT();
            if (transcript) {
                chatInput.value = transcript;
                chatInput.style.height = 'auto';
                chatInput.style.height = chatInput.scrollHeight + 'px';
                handleSendMessage(transcript, 'stt');
            }
        } catch (error) {
            console.error('STT stop error:', error);
            showToast('음성 인식 오류', 3000);
        }
        isListening = false;
        sttIcon.classList.remove('hidden');
        sttSpinner.classList.add('hidden');
        sttBtn.classList.remove('active');
        stopAudioVisualization();
        radioBarContainer.classList.remove('active');
        showToast('녹음이 완료되었습니다.', 2000);
    } else {
        stopCurrentTTS();
        try {
            await startSTT();
            isListening = true;
            sttIcon.classList.add('hidden');
            sttSpinner.classList.remove('hidden');
            sttBtn.classList.add('active');
            radioBarContainer.classList.add('active');
            showToast('녹음 중입니다...', 2000);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream = stream;
            setupAudioVisualization(stream);
        } catch (error) {
            console.error('STT start error:', error);
            showToast('마이크 사용 권한이 필요합니다.', 3000);
        }
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
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper', sender);
    const messageElement = document.createElement('div');
    messageElement.classList.add('bubble', sender);
    messageElement.innerText = text;
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.innerText = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    messageWrapper.appendChild(messageElement);
    messageWrapper.appendChild(timestamp);
    chatMessages.appendChild(messageWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
/**
 * 초기화 함수
 */
// talk.js의 initialize 함수 내 프로필 로드 부분
function initialize() {
    initializeSTT();
    sendBtn.addEventListener('click', () => handleSendMessage());
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    sttBtn.addEventListener('click', handleMicButtonClick);
    endSessionButton?.addEventListener('click', handleEndSession);

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

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });
}

initialize();

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