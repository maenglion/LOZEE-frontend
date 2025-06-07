// js/talk.js

import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import { saveJournalEntry, updateTopicStats, updateUserOverallStats, logSessionStart, logSessionEnd } from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 상태 변수 ---
let skipTTS = false, isProcessing = false;
let chatHistory = [], selectedMain = null, selectedSubTopicDetails = null;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const widthToggleBtn = document.getElementById('width-toggle-btn');
const appContainer = document.querySelector('.app-container');

// --- 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const targetAge = parseInt(localStorage.getItem('lozee_userAge') || "0", 10);
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
const voc = getKoreanVocativeParticle(userNameToDisplay);
const currentUserType = (localStorage.getItem('lozee_role') === 'parent') ? 'caregiver' : 'directUser';

// --- 함수 정의 ---
function appendMessage(text, role) { /* 이전과 동일 */ }
async function playTTSWithControl(txt) { /* 이전과 동일 */ }
function getTopicsForCurrentUser() { /* 이전과 동일 */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* 이전과 동일 */ }
function showMainTopics() { /* 이전과 동일 */ }
function showSubTopics() { /* 이전과 동일 */ }
function startChat(initText, inputMethod = 'topic_selection_init', topicDetails = null) { /* 이전과 동일 */ }
async function sendMessage(text, inputMethod = 'text') { /* 이전과 동일 */ }
// ... (STT/타임아웃 관련 함수들도 이전 답변과 동일하게 유지)

// --- 초기화 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', () => {
    if (!loggedInUserId) {
        alert("사용자 정보가 없습니다. 시작 페이지로 이동합니다.");
        window.location.href = 'index.html';
        return;
    }

    // ⭐ 레이아웃 토글 버튼 로직
    if (widthToggleBtn && appContainer) {
        let isWideMode = localStorage.getItem('lozee_wide_mode') === 'true';
        const applyMode = () => {
            appContainer.classList.toggle('wide-mode', isWideMode);
            widthToggleBtn.title = isWideMode ? '모바일 너비로 보기' : '전체 화면 보기';
        };
        applyMode(); // 초기 상태 적용
        widthToggleBtn.onclick = () => {
            isWideMode = !isWideMode;
            localStorage.setItem('lozee_wide_mode', isWideMode);
            applyMode();
        };
    }

    // ⭐ TTS 토글 버튼 로직
    if (ttsToggleBtn) {
        let isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
        const updateTtsState = () => {
            ttsToggleBtn.classList.toggle('off', !isTtsEnabled);
            ttsToggleBtn.innerHTML = isTtsEnabled ? '🔊' : '🔇';
            ttsToggleBtn.title = isTtsEnabled ? '음성 듣기 ON' : '음성 듣기 OFF';
        };
        updateTtsState();
        ttsToggleBtn.onclick = () => {
            isTtsEnabled = !isTtsEnabled;
            localStorage.setItem('lozee_tts_enabled', isTtsEnabled);
            updateTtsState();
            if (!isTtsEnabled) stopCurrentTTS();
        };
    }

    // ⭐ 마이크/전송 버튼 전환 로직
    if (chatInput && actionButton) {
        const updateActionButton = () => {
            if (chatInput.value.trim().length > 0) {
                actionButton.innerHTML = '➤'; // 전송 아이콘
                actionButton.onclick = () => sendMessage(chatInput.value, 'text');
            } else {
                actionButton.innerHTML = '🎤'; // 마이크 아이콘
                actionButton.onclick = () => { /* STT 시작 로직 */ };
            }
        };
        chatInput.addEventListener('input', updateActionButton);
        updateActionButton(); // 초기 상태 설정
        
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                if (chatInput.value.trim().length > 0) sendMessage(chatInput.value, 'text');
            }
        });
    }

    // 대화 시작
    appendMessage(getInitialGreeting(userNameToDisplay + voc, false), 'assistant');
    showMainTopics();
});