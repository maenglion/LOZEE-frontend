// js/talk.js

// --- 1. 모듈 Import (오류 수정 및 정리) ---
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
import LOZEE_ANALYSIS from './lozee-analysis.js';

// --- 2. 상태 변수 선언 ---
let isProcessing = false;
let chatHistory = [], selectedMain = null, selectedSubTopicDetails = null;
let conversationStartTime = null;
let lastAiAnalysisData = null;
let userCharCountInSession = 0;
let previousTotalUserCharCountOverall = 0;
let currentFirestoreSessionId = null;
let isDataSaved = false;
let skipTTS = false;
let journalReadyNotificationShown = false; // ⭐ 중간 저장 알림 표시 여부
let analysisNotificationShown = false; // ⭐ 분석 완료 알림 표시 여부
let sessionTimeoutId = null;
const SESSION_TIMEOUT_DURATION = 5 * 60 * 1000;


// --- 3. UI 요소 가져오기 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const widthToggleBtn = document.getElementById('width-toggle-btn-floating');
const appContainer = document.querySelector('.app-container');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');
const sessionHeaderTextEl = document.getElementById('journalId'); // 우리 db 구조상 여기서 id는 뭐라고 해야해?

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의
/**
 * 저널이 실제로 생성된 후, 클릭 가능한 알림을 화면에 표시하는 함수
 * @param {string} journalId - Firestore에 생성된 저널 문서의 ID
 */

// 5-1. 채팅창에 새로운 말풍선을 추가하는 가장 기본적인 함수
function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

//5-2. 로지의 답변을 음성으로 읽어주는 기능(TTS, Text-to-Speech)을 제어
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

//5-3. 상담 주제와 같이 여러 선택지를 버튼 형태로 채팅창에 표시
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

//5-4.현재 로그인한 사용자에게 맞는 상담주제 목록
function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    if (!counselingTopicsByAge) { console.error("counseling_topics.js 로드 실패!"); return {}; }
    let topics = {};
    if (currentUserType === 'directUser') {
        topics = counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    } else if (currentUserType === 'caregiver') {
        topics = counselingTopicsByAge.caregiver || {};
    }
    return topics;
}


// 5-5. 대화흐름 제어, 대화 시작시 가장 큰 주제 카테고리 사용자에게 보여줌 


/** 세션 헤더(주제 표시줄)를 업데이트하는 함수 */
function updateSessionHeader() {
    if (!sessionHeaderTextEl) return;
    
    const main = selectedMain || '';
    const sub = selectedSubTopicDetails?.displayText || '';
    // 저널이 생성되면 lastAiAnalysisData에서 제목을 가져옴
    const journalTitle = lastAiAnalysisData?.summaryTitle || '';

    let displayText = main;
    if (sub) displayText += ` > ${sub}`;
    // 설명해주신 로직에 따라, 요약 제목이 있을 경우에만 추가합니다.
    if (journalTitle) displayText += ` > ${journalTitle}`; 
    
    sessionHeaderTextEl.textContent = displayText;
}


function getTopicsForCurrentUser() { /* ... */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* ... */ }



function showMainTopics() {
    appendMessage('어떤 이야기를 나눠볼까?', 'assistant');
    const currentUserTopics = getTopicsForCurrentUser();
    let topicsWithOptions = Object.keys(currentUserTopics).map(categoryName => ({
        icon: currentUserTopics[categoryName]?.[0]?.icon || '💬', displayText: categoryName
    }));
    topicsWithOptions.push({ icon: '🗣️', displayText: '자유주제' });

    displayOptionsInChat(topicsWithOptions, (selectedText) => {
        selectedMain = selectedText;
        updateSessionHeader(); // ⭐ 주 주제 선택 시 헤더 업데이트
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

// 5-6. 대화흐름 제어, 서브 카테고리 사용자에게 보여줌 
function showSubTopics() {
    const subtopicOptions = getTopicsForCurrentUser()[selectedMain] || [];
    if (subtopicOptions.length === 0) {
        startChat(`'${selectedMain}'에 대해 자유롭게 이야기해줘.`, 'topic_selection_init', { displayText: selectedMain });
        return;
    }
    appendMessage('조금 더 구체적으로 이야기해 줄래?', 'assistant');
     displayOptionsInChat(subtopicOptions, (selectedSubtopicText, fullOptionObject) => {
        selectedSubTopicDetails = fullOptionObject;
        updateSessionHeader(); // ⭐ GPT 제목 없이 main > sub 까지만 표시됨
        startChat(selectedSubtopicText, 'topic_selection_init', fullOptionObject);
    });
}


// 5-7. 사용자가 특정 주제를 선택했을 때 실제 대화를 시작하는 역할 
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) {
    if (inputArea) inputArea.style.display = 'flex';
    if (initText) sendMessage(initText, inputMethod);
    else if (chatInput) chatInput.focus();
}


//5-8. 사용자의 이전 대화 기록 firebase 내 현재 사용자의 "총 누적 대화량"
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


// 5-9. 대화를 최종적으로 종료하고 기록을 저장. 사용자가 나가거나 5분이상 아무런 입력이 없을 때 saveJournalEntry 함수를 통해 Firestore 데이터베이스에 영구적으로 저장합니다.
async function endSessionAndSave() {
    if (isDataSaved) return;
    isDataSaved = true;
    appendMessage("대화를 안전하게 마무리하고 있어요...", 'assistant_feedback');
    if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId);

    const finalTopicForJournal = selectedSubTopicDetails?.displayText || selectedMain || "알 수 없는 주제";
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
        }
    }
}


// 5-10. 5분 타이머 리셋 함수로 사용자가 활동을 하면 5분간 응답이 없어 종료되는 것을 막아줌 
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}



// 5-11. STT 관련 상태 변수
let isRec = false;
let micButtonCurrentlyProcessing = false;
let audioContext, analyser, source, dataArray, animId, streamRef;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;

// 5-12. STT 초기 설정
if (SpeechRecognitionAPI) {
    recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';
    
    recog.onstart = () => {
        isRec = true;
        if(actionButton) actionButton.classList.add('recording');
        micButtonCurrentlyProcessing = false;
    };
    recog.onend = () => {
        isRec = false;
        if(actionButton) actionButton.classList.remove('recording');
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
    }; //음성 인식이 최종 완료되면 인식된 텍스트와 함게 inputmethod를 stt로 지정하여 sendmessage 함수를 호출
    recog.onerror = event => {
        console.error('Speech recognition error:', event.error);
        if (isRec) recog.stop();
    };
} else {
    if(actionButton) actionButton.innerHTML = '➤'; // STT 미지원 시 전송 기능만 제공
    console.warn('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
}

// 5-13. 오디오 분석 설정 함수
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

 // 5-14.음량바 시각화 함수
    function draw() {
    if (!analyser || !dataArray) return;
    animId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    let avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    let norm = Math.min(100, Math.max(0, (avg / 140) * 100));
    if (meterLevel) meterLevel.style.width = norm + '%';
}
    

// 5-15. 오디오 스트림 및 시각화 중지 함수
function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
}

// 5-16.마이크 버튼 클릭 로직
function handleMicButtonClick() {
    if (isProcessing || micButtonCurrentlyProcessing) return;
    micButtonCurrentlyProcessing = true;
    
    if (isRec) {
        if(recog) recog.stop();
    } else {
        if (typeof stopCurrentTTS === 'function') stopCurrentTTS();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setupAudioAnalysis(stream);
                if(recog) recog.start();
            })
            .catch(e => {
                console.error('마이크 접근 오류:', e);
                appendMessage('마이크 사용 권한이 필요합니다.', 'assistant_feedback');
                micButtonCurrentlyProcessing = false;
            });
    }
}

//5-17 저널, 분석 완료 알림 

function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    if (chatWindow) {
        chatWindow.appendChild(notification);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

function showAnalysisNotification() {
    if (analysisNotificationShown || !chatWindow) return;
    analysisNotificationShown = true; // 중복 방지 플래그
    
    const notification = document.createElement('div');
    notification.className = 'analysis-notification'; // CSS 스타일링을 위한 클래스
    notification.textContent = '📊 분석 완료! (클릭해서 확인)';
    
    notification.onclick = () => {
        // 15세 이상 당사자인지 여부에 따라 다른 분석 페이지로 이동
        const redirectUrl = (targetAge >= 15 && currentUserType === 'directUser') 
            ? 'analysis_adult.html' 
            : 'analysis.html';
        window.location.href = redirectUrl;
    };
    
    if(chatWindow) chatWindow.appendChild(notification);
}

//5-18. 사용자의 메시지를 gpt서버로 보내고 응답을 처리하는 가장 핵심적인 함수
async function sendMessage(text, inputMethod) {
if (!text || String(text).trim() === '' || isProcessing) return;
    isProcessing = true;
    actionButton.disabled = true;

    if (inputMethod !== 'topic_selection_init') appendMessage(text, 'user');
    if (chatInput) chatInput.value = '';
    
    appendMessage('...', 'assistant thinking');

    try {
        const res = await getGptResponse(text, { chatHistory, userId: loggedInUserId });
        chatWindow.querySelector('.thinking')?.remove();
        if (!res.ok) throw new Error(`GPT API 응답 오류: ${res.status}`);

        const d = await res.json();
        const cleanText = d.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        lastAiAnalysisData = d.analysis || {};
        updateSessionHeader(); // ⭐ GPT 요약 제목까지 포함하여 헤더 업데이트
        
        appendMessage(cleanText, 'assistant');
        // ⭐ 첫 응답에도 TTS가 재생되도록 playTTSWithControl 호출 위치 변경
        await playTTSWithControl(cleanText);
        chatHistory.push({ role: 'assistant', content: cleanText });

           } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        chatWindow.querySelector('.thinking')?.remove();
        appendMessage("오류가 발생했어요. 다시 시도해 주세요.", "assistant_feedback");
    } finally {
        isProcessing = false;
        actionButton.disabled = false;
    }
}

       
 // 6. 저널 생성 

    userCharCountInSession = chatHistory.filter(m => m.role === 'user')
    .reduce((sum, m) => sum + m.content.length, 0);
    chatHistory.push({ role: 'user', content: text }); 
        if (userCharCountInSession >= 800 && !journalReadyNotificationShown && selectedMain) {
            journalReadyNotificationShown = true; // 중복 실행 방지
            console.log("대화량 800자 충족. 중간 저널 생성을 시도합니다.");

            const topicForJournal = selectedSubTopicDetails?.displayText || selectedMain;
            const detailsToSave = {
                summary: lastAiAnalysisData?.conversationSummary || "요약 진행 중...",
                title: lastAiAnalysisData?.summaryTitle || `${topicForJournal}에 대한 대화`,
                detailedAnalysis: lastAiAnalysisData,
                sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
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

 // 7. 분석 데이터 저장 및 페이지 이동
    lastAiAnalysisData = d.analysis || {};
    const entireConversation = chatHistory.map(m => m.content).join(' ');
    localStorage.setItem(
      'lozee_conversation_analysis',
      JSON.stringify({
        analysis: lastAiAnalysisData,
        fullConversation: entireConversation,
        sessionDurationMinutes: d.analysis?.sessionDurationMinutes || 0
      })
    );
    
        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const userTurnCount = chatHistory.filter(m => m.role === 'user').length;
        const finalUserCharCountForAnalysis = previousTotalUserCharCountOverall + userCharCountInSession;
        
        // 조건: 대화 시간 10분 이상, 사용자 발화 10회 이상 등
        if (elapsedTimeInMinutes >= 10 && userTurnCount >= 10 && !analysisNotificationShown) {
            console.log(`[분석 조건 충족!] localStorage에 분석 결과 저장`);
            
        // 최종 분석 데이터를 localStorage에 저장
            const dataToStore = {
                results: lastAiAnalysisData || {}, // GPT가 제공한 분석 결과
                accumulatedDurationMinutes: elapsedTimeInMinutes,
            };
            localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));

        // showAnalysisNotification 함수를 호출하여 화면에 알림 표시
            showAnalysisNotification(); 
        }
          await endSessionAndSave(); // <--- 페이지 이동 전에 세션 종료 및 저장 함수 호출
    
        const analysisPage = (targetAge <= 15) ? 'analysis.html' : 'analysis_adult.html';
    window.location.href = analysisPage;


// 6. ⭐ 페이지 로드 후 실행될 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }


 // 대분류 > 중분류 > 요약 타이틀을 상단에 표시
const header = document.getElementById('session-header');
function updateSessionHeader() {
  const main = selectedMain || '';
  const sub = selectedSubTopicDetails?.displayText || '';
  const title = lastAiAnalysisData?.summaryTitle || '';
  header.textContent = `${main} > ${sub} > ${title}`;
}


  // 음성인식 UI 복원 및 바인딩 ---

if (actionButton) {
  actionButton.addEventListener('click', handleMicButtonClick);
}

// --- 볼륨바 UI 요소 존재 확인 ---
if (!meterContainer || !meterLevel) {
  console.warn('meter-container 또는 volume-level 요소를 찾을 수 없습니다. 오디오는 동작하지만 UI 시각화가 표시되지 않을 수 있습니다.');
}

    
 // 7. 이전에 누락되었던 로직을 모두 여기에 포함합니다.
    conversationStartTime = Date.now();
    previousTotalUserCharCountOverall = await fetchPreviousUserCharCount();
    resetSessionTimeout(); // resetSessionTimeout 정의는 아래에 있어야 함
    
 
 // ⭐ 전송 버튼과 엔터키 이벤트 핸들러 복원
    if(sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => sendMessage(chatInput.value, 'text'));
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                sendMessage(chatInput.value, 'text');
            }
        });
    }

    // ⭐ 마이크 버튼 로직 복원
    if (micButton && SpeechRecognitionAPI) {
        micButton.onclick = handleMicButtonClick;
    } else if (micButton) {
        micButton.disabled = true;
    }
    
    // ⭐ 대화 시작
    const greeting = getInitialGreeting(userNameToDisplay + voc, false);
    appendMessage(greeting, 'assistant');
    await playTTSWithControl(greeting); // ⭐ 첫 인사말 TTS 재생
    showMainTopics();
});