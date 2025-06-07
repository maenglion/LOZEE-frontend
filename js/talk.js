// js/talk.js

import './firebase-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getInitialGreeting, getGptResponse, getKoreanVocativeParticle } from './gpt-dialog.js';
import { playTTSFromText, stopCurrentTTS } from './tts.js';
import { saveJournalEntry, logSessionStart, logSessionEnd } from './firebase-utils.js';
import { counselingTopicsByAge } from './counseling_topics.js';

// --- 상태 변수 ---
let isProcessing = false;
let chatHistory = [], selectedMain = null, selectedSubTopicDetails = null;

// --- UI 요소 ---
const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const chatInput = document.getElementById('chat-input');
const actionButton = document.getElementById('action-button');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const widthToggleBtn = document.getElementById('width-toggle-btn-floating');
const appContainer = document.querySelector('.app-container');

// --- 사용자 정보 ---
const loggedInUserId = localStorage.getItem('lozee_userId');
const userNameToDisplay = localStorage.getItem('lozee_username') || '친구';
// ... (기타 사용자 정보)

// --- 함수 정의 ---
function appendMessage(text, role) { /* ... */ }
async function playTTSWithControl(txt) { /* ... */ }
function getTopicsForCurrentUser() { /* ... */ }
function displayOptionsInChat(optionsArray, onSelectCallback) { /* ... */ }
function showMainTopics() { /* ... */ }
function showSubTopics() { /* ... */ }
function startChat(initText, inputMethod, topicDetails) { /* ... */ }
async function sendMessage(text, inputMethod) { /* ... */ }
// ... (STT 관련 함수 및 변수 정의 포함)

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
            appContainer.style.maxWidth = isWideMode ? '95%' : '640px';
            widthToggleBtn.title = isWideMode ? '고정 너비로 보기' : '전체 화면 보기';
        };
        applyMode();
        widthToggleBtn.onclick = () => {
            isWideMode = !isWideMode;
            localStorage.setItem('lozee_wide_mode', isWideMode);
            applyMode();
        };
    }

    // ⭐ TTS 토글 버튼 로직
    if (ttsToggleBtn) {
        let isTtsEnabled = localStorage.getItem('lozee_tts_enabled') !== 'false';
        const updateTtsButtonState = () => {
            ttsToggleBtn.classList.toggle('off', !isTtsEnabled);
            ttsToggleBtn.innerHTML = isTtsEnabled ? '🔊' : '🔇';
        };
        updateTtsButtonState();
        ttsToggleBtn.onclick = () => {
            isTtsEnabled = !isTtsEnabled;
            localStorage.setItem('lozee_tts_enabled', isTtsEnabled);
            updateTtsButtonState();
            if (!isTtsEnabled) stopCurrentTTS();
        };
    }

    // ⭐ 마이크/전송 버튼 통합 로직
    if (chatInput && actionButton) {
        const updateActionButton = () => {
            if (chatInput.value.trim().length > 0) {
                actionButton.innerHTML = '➤';
                actionButton.onclick = () => sendMessage(chatInput.value, 'text');
            } else {
                actionButton.innerHTML = '🎤';
                actionButton.onclick = () => { /* STT 시작 로직 */ };
            }
        };
        chatInput.addEventListener('input', updateActionButton);
        updateActionButton();
        
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                if (chatInput.value.trim().length > 0) sendMessage(chatInput.value, 'text');
            }
        });
    }

    // 대화 시작
    appendMessage(getInitialGreeting(userNameToDisplay + getKoreanVocativeParticle(userNameToDisplay), false), 'assistant');
    showMainTopics();
});