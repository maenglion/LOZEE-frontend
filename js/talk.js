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
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const meterContainer = document.getElementById('meter-container');
const meterLevel = document.getElementById('volume-level');
const sessionHeaderTextEl = document.getElementById('session-header');


// 이 변수가 아래 내용과 정확히 일치하는지 확인해주세요.
const micIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>`;



/**
 * 대화 세션을 공식적으로 시작하고 관련 UI를 활성화하며, 첫 메시지를 전송하는 함수
 * @param {object} subTopic - 선택된 서브 주제의 상세 정보
 */
function startChat(subTopic) {
    console.log("▶️ startChat이 호출되었습니다.", subTopic);

    // 대화 시작 시간이 설정되지 않았다면 현재 시간으로 설정
    if (!conversationStartTime) {
        conversationStartTime = Date.now();
    }
    
    selectedSubTopicDetails = subTopic;
    updateSessionHeader(); // 세션 헤더 업데이트

    // 비활성화된 UI 요소들을 활성화시킵니다.
    const actionButton = document.getElementById('action-button');
    const chatInput = document.getElementById('chat-input');
    if (actionButton) actionButton.disabled = false;
    if (chatInput) chatInput.disabled = false;
    
    // '자유주제'일 경우 텍스트 입력창을 바로 보여줍니다.
    if (subTopic && subTopic.type === 'free') {
        if (inputArea) inputArea.style.display = 'flex';
        isTtsMode = false; // 텍스트 입력 모드로 전환
        updateActionButtonIcon();
        chatInput.focus();
    } else {
        // [핵심 수정] 주제 선택 후, 해당 주제로 AI와의 대화를 시작합니다.
        // sendMessage 함수를 호출하여 첫 번째 메시지를 보냅니다.
        const initialMessage = `'${subTopic.displayText}'(이)라는 주제로 이야기하고 싶어요.`;
        
        // 'topic_selection_init'은 시스템이 보낸 메시지임을 구분하기 위함입니다.
        // 이 메시지는 사용자 말풍선으로 보이지 않게 처리됩니다.
        sendMessage(initialMessage, 'topic_selection_init');
    }
}

// --- 4. 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);

// [수정] 사용자의 나이에 맞는 상담 주제 키를 미리 계산합니다.
const currentUserAgeGroup = (() => {
    if (targetAge < 11) return '10세미만';
    if (targetAge <= 15) return '11-15세';
    if (targetAge <= 29) return '16-29세';
    return '30-55세'; // 기본값
})();

const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';
const targetChildId = (currentUserType === 'caregiver') ? localStorage.getItem('lozee_childId') : null;
const voc = getKoreanVocativeParticle(userNameToDisplay);

// --- 5. 모든 함수 정의 ---

/**
 * 채팅창에 새로운 말풍선을 추가하는 함수
 */
function appendMessage(text, role) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
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

/**
 * 로지의 답변을 음성으로 재생하는 함수 (TTS)
 */

async function playTTSWithControl(txt) {
  if (!isTtsMode) return;

  if (typeof stopCurrentTTS === 'function') stopCurrentTTS();

  try {
    // ✅ OpenAI가 지원하는 목소리 이름 중 하나인 'alloy'로 변경 (또는 nova, shimmer 등 다른 이름 사용 가능)
    const voiceId = localStorage.getItem('lozee_voice') || "shimmer"; 
    if (typeof playTTSFromText === 'function') {
      await playTTSFromText(txt, voiceId);
    }
  } catch (error) {
    console.error("TTS 재생 오류:", error); // CORS 메시지는 혼동을 줄 수 있어 제거
  }
}


function handleGptReply(replyText) {
  appendAssistantBubble(replyText);          // 화면에 말풍선 표시
  playTTSWithControl(replyText);             // ✅ 음성 출력: 제어는 위임
}


/**
 * 여러 선택지를 버튼 형태로 채팅창에 표시하는 함수
 */
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

// ⭐ 복원된 함수: 현재 사용자에게 맞는 상담 주제 목록을 가져옵니다.
function getTopicsForCurrentUser() {
    const ageGroupKey = targetAge < 11 ? '10세미만' : (targetAge <= 15 ? '11-15세' : (targetAge <= 29 ? '16-29세' : '30-55세'));
    if (!counselingTopicsByAge || typeof counselingTopicsByAge !== 'object') {
        console.error("counseling_topics.js 로드 실패!");
        return {};
    }
    if (currentUserType === 'directUser') return counselingTopicsByAge.directUser?.[ageGroupKey] || counselingTopicsByAge.directUser['11-15세'] || {};
    if (currentUserType === 'caregiver') return counselingTopicsByAge.caregiver || {};
    return {};
}


// ⭐ 복원된 함수: 세션 헤더(상단 주제 표시줄)를 업데이트합니다.
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


/**
 * 신규 주제와 이전 대화 주제를 함께 표시하는 통합 함수
 * 규칙 1: 이전 대화까지 합친 주제 제시
 * 규칙 2: 이전 대화 주제 선택 시, 서브 토픽 없이 바로 대화 시작
 * 규칙 3: 신규 주제 선택 시, 서브 토픽 목록 표시
 */


/**
 * 신규 주제와 이전 대화 주제를 함께 표시하는 통합 함수 (UI 수정 버전)
 */
// 기존 renderUnifiedTopics 함수를 찾아서 아래 코드로 교체하세요.

// renderUnifiedTopics 함수를 찾아 아래 코드로 전체를 교체해주세요.

function renderUnifiedTopics() {

  const addFreeTopicOption = () => {
        const freeTopicOption = {
            icon: "💬",
            displayText: "기타 (자유롭게 이야기하기)",
            tags: ["자유주제", "기타"],
            type: "free_form" // 자유주제 구분을 위한 타입
        };

        // '10세 미만'을 제외한 모든 연령대 그룹
        const targetAgeGroups = ['청소년', '청년', '중장년', '노년'];

        targetAgeGroups.forEach(ageGroup => {
            if (counselingTopicsByAge[ageGroup]) {
                // 각 연령대의 모든 메인 주제에 '기타' 옵션을 추가
                counselingTopicsByAge[ageGroup].forEach(mainTopic => {
                    // 이미 '기타' 항목이 있는지 확인하여 중복 추가 방지
                    const alreadyExists = mainTopic.subTopics.some(sub => sub.type === 'free_form');
                    if (!alreadyExists) {
                        mainTopic.subTopics.push(freeTopicOption);
                    }
                });
            }
        });
    };

    // 함수 실행
    addFreeTopicOption();

    const container = document.getElementById('topic-selection-container');
    if (!container) return;
    container.innerHTML = ''; // 이전 내용 초기화

    // --- [수정된 로직] ---
    const topicsForUserType = counselingTopicsByAge[currentUserType];
    if (!topicsForUserType) return;

    // 양육자(caregiver)는 나이 구분이 없으므로 'common' 키를 사용합니다.
    const topicsData = (currentUserType === 'caregiver') 
        ? topicsForUserType['common']
        : (topicsForUserType[currentUserAgeGroup] || topicsForUserType['16-29세']);
    
    if (!topicsData) return;

    // 선택지들을 담을 컨테이너를 만듭니다.
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'chat-options-container';

    // 각 주제(mainTopic)를 버튼으로 생성합니다.
    topicsData.forEach(mainTopic => {
        const button = document.createElement('button');
        button.className = 'chat-option-btn'; // ✅ 버튼 스타일을 적용하기 위한 클래스
        button.innerHTML = mainTopic.name;     // ✅ 버튼에 주제 이름 표시
        
        button.onclick = () => {
            // 1. 모든 버튼을 비활성화하여 중복 클릭 방지
            optionsContainer.querySelectorAll('.chat-option-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
            button.classList.add('selected'); // 선택된 버튼에 표시

            // 2. 사용자가 선택한 주제를 채팅창에 표시
            selectedMain = mainTopic.name;
            appendMessage(`${mainTopic.name}`, 'user'); // `(을)를 선택했구나.` 부분을 제거하여 간단하게 만듦
            
            // 3. 기존 주제 선택 버튼들 제거
            container.innerHTML = ''; 
            
            // 4. 세부 주제가 있으면 표시, 없으면 바로 대화 시작
            if (mainTopic.subTopics && mainTopic.subTopics.length > 0) {
                appendMessage('더 자세한 이야기를 들려줄래?', 'assistant');
                displayOptionsInChat(mainTopic.subTopics, (selectedText, fullOption) => {
                    selectedSubTopicDetails = fullOption;
                    updateSessionHeader();
                    startChat(fullOption); // startChat 함수 호출
                });
            } else {
                // 세부 주제가 없는 경우 (예: 자유주제)
                startChat({ displayText: mainTopic.name, tags: [mainTopic.name] });
            }
        };
        optionsContainer.appendChild(button);
    });

    container.appendChild(optionsContainer);
}

// ⭐ 복원된 함수: 서브 주제를 버튼으로 표시합니다.
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

// ⭐ 복원된 함수: 사용자의 이전 누적 대화량을 Firestore에서 가져옵니다.
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

// ⭐ 복원된 함수: 세션을 종료하고 대화 기록을 최종 저장합니다.
// ⭐ 복원된 함수: 세션을 종료하고 대화 기록을 최종 저장합니다. (수정된 버전)
async function endSessionAndSave() {
  if (isDataSaved) return;
  isDataSaved = true;
  
  appendMessage("대화를 안전하게 마무리하고 있어요. 잠시만 기다려 주세요...", 'assistant_feedback');
  if (currentFirestoreSessionId) await logSessionEnd(currentFirestoreSessionId); // 세션 종료 로그

  // 대화 내용이 충분하지 않으면 저장을 건너뜁니다.
  if (chatHistory.length <= 2) {
    console.log("대화 내용이 부족하여 저장을 건너뜁니다.");
    return;
  }

  try {
    // [1단계] AI에게 최종 요약을 요청합니다. 
    // 기존에는 마지막 분석(lastAiAnalysisData)을 재사용했지만, 
    // 더 정확한 최종 요약을 위해 대화 전체를 기반으로 다시 요청하는 것이 좋습니다.
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
        // JSON이 없는 경우를 대비한 최소한의 데이터
        finalAnalysis = {
            conversationSummary: finalGptData.text,
            summaryTitle: selectedSubTopicDetails?.displayText || selectedMain || "대화",
            keywords: [],
        };
    }
    
    const summaryText = finalAnalysis.conversationSummary || "요약이 생성되지 않았습니다.";
    
    // [2단계] 생성된 최종 요약문으로 의미 기반 키워드를 추출합니다. (신규 단계)
    console.log("의미 기반 키워드 추출 시작...");
    const semanticKeywords = await extractSemanticKeywords(summaryText);
    
    // 기존 분석 키워드와 합치거나, 새로운 키워드로 대체할 수 있습니다.
    // 여기서는 새로운 의미 기반 키워드를 최종본으로 사용합니다.
    finalAnalysis.keywords = semanticKeywords;


    // [3단계] Firestore에 저장할 최종 데이터 객체를 구성합니다.
    const finalTopicForJournal = selectedSubTopicDetails?.displayText || selectedMain || "알 수 없는 주제";
    const journalDetailsToSave = {
        summary: summaryText,
        title: finalAnalysis.summaryTitle || finalTopicForJournal,
        detailedAnalysis: finalAnalysis, // 키워드가 업데이트된 최종 분석 결과
        sessionDurationMinutes: (Date.now() - conversationStartTime) / (1000 * 60),
        userCharCountForThisSession: userCharCountInSession
    };

    // [4단계] Firestore에 최종 데이터를 저장합니다.
    const entryTypeForSave = (currentUserType === 'caregiver') ? 'child' : 'standard';
    const journalId = await saveJournalEntry(loggedInUserId, finalTopicForJournal, journalDetailsToSave, {
        relatedChildId: targetChildId, 
        entryType: entryTypeForSave,
        childName: currentUserType === 'caregiver' ? localStorage.getItem('lozee_childName') : null
    });

    if (journalId) {
        await updateTopicStats(loggedInUserId, finalTopicForJournal, entryTypeForSave);
        const totalChars = (await fetchPreviousUserCharCount()) + userCharCountInSession;
        await updateUserOverallStats(loggedInUserId, currentUserType, totalChars);
        console.log("모든 데이터가 성공적으로 저장되었습니다. Journal ID:", journalId);
        displayJournalCreatedNotification(journalId); // 저장 완료 후 사용자에게 알림
    }

  } catch (error) {
    console.error("endSessionAndSave 과정에서 오류 발생:", error);
    appendMessage("대화 내용을 저장하는 중 문제가 발생했어요. 😥", 'assistant_feedback');
  }
}


// ⭐ 복원된 함수: 세션 타임아웃 타이머를 리셋합니다.
function resetSessionTimeout() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSessionAndSave, SESSION_TIMEOUT_DURATION);
}


// ⭐ 복원된 함수: 저널 생성 알림을 표시합니다.
function displayJournalCreatedNotification(journalId) {
    if (!journalId || !chatWindow) return;
    const notification = document.createElement('div');
    notification.className = 'journal-save-notification actionable';
    notification.innerHTML = `📝 이야기가 기록되었어요! <br><strong>클릭해서 확인해보세요.</strong>`;
    notification.onclick = () => { window.open(`journal.html?journalId=${journalId}`, '_blank'); };
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ⭐ 복원된 함수: 분석 완료 알림을 표시합니다.
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


// ⭐ 사용자의 메시지를 GPT 서버로 보내고 응답을 처리하는 함수 (오류 수정 버전)
/**
 * ⭐ 사용자의 메시지를 GPT 서버로 보내고 응답을 처리하는 함수 (최종 수정 버전)
 * @param {string} text - 사용자 또는 시스템이 입력한 메시지 텍스트
 * @param {string} inputMethod - 메시지 입력 방식 (e.g., 'user_input', 'topic_selection_init')
 */
async function sendMessage(text, inputMethod) {

     // 메시지가 비어있거나, 이미 다른 요청이 처리 중인 경우 함수 종료
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
    isProcessing = true; // 처리 중 상태로 설정
    if (actionButton) actionButton.disabled = true; // 액션 버튼 비활성화
    resetSessionTimeout(); // 세션 타임아웃 리셋


    // UI에 사용자 메시지 표시 (초기 주제 선택이 아닌 경우)
    if (inputMethod !== 'topic_selection_init') {
        appendMessage(text, 'user');
    }

    if (chatInput) chatInput.value = ''; // 입력창 비우기
    appendMessage('...', 'assistant thinking'); // '생각 중...' 메시지 표시

    // 메인 try 블록: API 요청 및 응답 처리
    try {
        // 1. API 요청에 필요한 context 객체를 생성합니다.
        // 이 블록 안에서 실제 사용하는 변수들로 구성해야 합니다.
        const elapsedTimeInMinutes = (Date.now() - conversationStartTime) / (1000 * 60);
        const context = {
            chatHistory: [...chatHistory],
            userId: loggedInUserId,
            elapsedTime: elapsedTimeInMinutes,
            // ▼▼▼ systemPrompt - 카운셀링 토픽별 대응 프롬프트를 context에 추가 ▼▼▼
            systemPrompt: selectedSubTopicDetails?.systemPrompt || null 
        };

        // 2. ✅ 디버깅: 실제로 서버에 전송될 데이터를 콘솔에서 확인합니다.
        console.log("✅ GPT 요청 text:", text);
        console.log("✅ GPT 요청 context:", context);

        // 3. API를 단 한 번만 호출하고, 응답(res)을 기다립니다.
        const res = await getGptResponse(text, context);
        
        // '생각 중...' 메시지 삭제
        chatWindow.querySelector('.thinking')?.remove();

        // API 응답이 실패한 경우 에러를 발생시켜 catch 블록으로 넘깁니다.
        if (!res.ok) {
            throw new Error(`GPT API 응답 오류: ${res.status}`);
        }

        // 사용자 메시지를 채팅 기록(chatHistory)에 추가
        chatHistory.push({ role: 'user', content: text });

        const gptResponse = await res.json();
        const rawResponseText = gptResponse.text || "미안하지만, 지금은 답변을 드리기 어렵네.";
        
        let cleanText = rawResponseText;
        let jsonString = null;
        const jsonStartIndex = rawResponseText.indexOf('{"');

        // 응답 텍스트에 JSON 데이터가 포함되어 있는지 확인하고 분리
        if (jsonStartIndex !== -1) {
            cleanText = rawResponseText.substring(0, jsonStartIndex).trim();
            jsonString = rawResponseText.substring(jsonStartIndex);
        
            // JSON 파싱 시도
            try {
                lastAiAnalysisData = JSON.parse(jsonString);
                updateSessionHeader(); // 세션 헤더 정보 업데이트

                // 분석 결과를 LocalStorage에 저장
                localStorage.setItem('lozee_last_summary', lastAiAnalysisData.conversationSummary);
                localStorage.setItem('lozee_last_keywords', JSON.stringify(lastAiAnalysisData.keywords || []));

                // 실시간 클라이언트 분석 모듈(LOZEE_ANALYSIS)이 활성화된 경우 데이터 전달
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

        // UI에 GPT의 답변(순수 텍스트)을 표시하고 TTS로 재생
        appendMessage(cleanText, 'assistant');
        await playTTSWithControl(cleanText);

        // GPT 답변을 채팅 기록(chatHistory)에 추가
        chatHistory.push({ role: 'assistant', content: cleanText });

        // 세션 동안 사용자가 입력한 총 글자 수 계산
        userCharCountInSession = chatHistory.filter(m => m.role === 'user').reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);
        
        // 특정 조건 충족 시 '마음일지' 저장 로직 실행
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

        // 특정 조건 충족 시 분석 결과 알림 및 상담 예약 제안
        const userTurnCount = chatHistory.filter(m => m.role === 'user').length;
        if (elapsedTimeInMinutes >= 10 && userTurnCount >= 10 && !analysisNotificationShown) {
            if (lastAiAnalysisData) {
                const dataToStore = { results: lastAiAnalysisData, accumulatedDurationMinutes: elapsedTimeInMinutes };
                localStorage.setItem('lozee_conversation_analysis', JSON.stringify(dataToStore));
                showAnalysisNotification();
            
                // 인지 왜곡이 발견된 경우, 상담 예약 버튼 표시
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
                            
                            // 구글 캘린더 이벤트 생성 링크 열기
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
    
    // catch 블록: try 블록 내에서 발생한 모든 에러 처리
    } catch (error) {
        console.error("sendMessage 내 예외 발생:", error);
        chatWindow.querySelector('.thinking')?.remove(); // '생각 중...' 메시지 제거
        appendMessage("오류가 발생했어요. 잠시 후 다시 시도해 주세요.", "assistant_feedback"); // 사용자에게 오류 알림
    
    // finally 블록: try/catch 결과와 상관없이 항상 실행
    } finally {
        isProcessing = false; // 처리 중 상태 해제
        if (actionButton) actionButton.disabled = false; // 액션 버튼 활성화
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

// audio analysis 시각화
function draw() {
    if (!analyser || !dataArray) return;
    animId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    let avg = dataArray.reduce((a, v) => a + v, 0) / dataArray.length;
    let norm = Math.min(100, Math.max(0, (avg / 140) * 100));
    if (meterLevel) meterLevel.style.width = norm + '%';
    if (sessionHeaderEl)   
        sessionHeaderEl.style.backgroundColor = `hsl(228,50%,${90 - (norm/5)}%)`;
}

function stopAudio() {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (meterContainer) meterContainer.classList.remove('active');
    if (sessionHeaderEl) {
        sessionHeaderEl.style.transition = 'background-color 0.3s';
        sessionHeaderEl.style.backgroundColor = ''; 
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
    
    // UI 요소 가져오기
    const startCover = document.getElementById('start-cover');
    const appContainer = document.querySelector('.app-container');
      // [수정] 아래 한 줄을 추가하여 startButton 변수를 선언합니다.
    const startButton = document.getElementById('start-button');

    // talk.html에만 적용될 스타일 동적 추가
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


    /// ✅ 시작 버튼에 클릭 이벤트 할당
    if (startButton) { // << 이제 startButton이 무엇인지 알 수 있습니다.
        startButton.onclick = async () => {
            // 오디오 컨텍스트 잠금 해제 (TTS 안정적 재생을 위해)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            // 시작 화면 숨기기
            if (startCover) startCover.style.display = 'none';

            // --- 모든 실제 초기화 로직은 버튼 클릭 이후에 실행 ---
            try {
                if (inputArea) inputArea.style.display = 'none';

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
                currentFirestoreSessionId = await logSessionStart(loggedInUserId, "대화 시작"); // ✅ 로그 기록 정상 확인됨
                resetSessionTimeout();

                const greeting = getInitialGreeting(userNameToDisplay + voc, false);
        appendMessage(greeting, 'assistant');
        playTTSWithControl(greeting);
        
        // ▼▼▼ 여기에 이 코드를 추가하거나, 기존 위치에서 이곳으로 옮기세요. ▼▼▼
        renderUnifiedTopics(); 
        
        window.addEventListener('beforeunload', () => { if (chatHistory.length > 2 && !isDataSaved) endSessionAndSave(); });

            } catch (error) {
                console.error("페이지 초기화 중 심각한 오류가 발생했습니다:", error);
                appendMessage("페이지를 불러오는 중 문제가 발생했어요.", "assistant_feedback");
            }
        };
    }
});