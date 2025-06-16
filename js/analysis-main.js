// js/analysis-main.js

// --- 모듈 Import ---
import { getJournalsForUser } from './firebase-utils.js';
import { renderEmotionChart, renderTagCloud, renderCumulativeEmotionChart } from './lozee-analysis-charts.js';

// --- DOM 요소 ---
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const basicContentEl = document.getElementById('basic-analysis-content');
const cumulativeContentEl = document.getElementById('cumulative-analysis-content');
const deepContentEl = document.getElementById('deep-analysis-content');

// --- 렌더링 호출 함수 ---

function renderBasicAnalysis(journal, userType) {
    const langSection = basicContentEl.querySelector('#languageAgeSection');
    
    // [핵심 분기 로직] 사용자 유형(아이/성인)에 따라 언어 모듈 표시 여부 결정
    if (userType === 'child' && langSection) {
        langSection.style.display = 'block';
    } else if (langSection) {
        langSection.style.display = 'none';
    }

    renderEmotionChart('emotionChart', journal.detailedAnalysis.emotionToneData);
    renderTagCloud('tagCloud', journal.detailedAnalysis.keywords);
}

function renderCumulativeAnalysis(journals) {
    cumulativeContentEl.innerHTML = `
        <div class="section">
            <h2>📈 최근 5회 누적 분석</h2>
            <p class="module-explanation">최근 5번의 대화를 통해 발견된 변화의 흐름을 보여줄게!</p>
            <h3>감정 변화 추이</h3>
            <canvas id="cumulativeEmotionChart" style="max-height: 300px;"></canvas>
            <h3>자주 나타난 키워드</h3>
            <div id="cumulativeTagCloud"></div>
        </div>
    `;
    renderCumulativeEmotionChart('cumulativeEmotionChart', journals);
    const cumulativeKeywords = journals.flatMap(j => j.detailedAnalysis.keywords);
    // TODO: 중복 키워드 개수 세서 상위 5개만 렌더링 하는 로직 추가
    renderTagCloud('cumulativeTagCloud', [...new Set(cumulativeKeywords)]);
}

function renderDeepAnalysis(journals) {
    // 이전 답변에서 제안한 심층 분석 내용
    deepContentEl.innerHTML = `...`; 
}

// --- 페이지 초기화 및 이벤트 설정 ---

async function initializeAnalysisPage() {
    const userAge = parseInt(localStorage.getItem('lozee_userAge'), 10);
    const userId = localStorage.getItem('lozee_userId');
    const userType = (userAge && userAge < 15) ? 'child' : 'adult';
    
    if (!userId) {
        document.querySelector('.container').innerHTML = '<h1>사용자 정보를 찾을 수 없어요. 다시 로그인해주세요.</h1>';
        return;
    }

    const journals = await getJournalsForUser(userId);
    const journalCount = journals.length;

    if (journalCount === 0) {
        document.querySelector('.container').innerHTML = '<h1>아직 분석할 이야기가 없어요 텅 텅...</h1><p style="text-align:center;">로지와 첫 대화를 시작하고 다시 와주세요! 😊</p>';
        return;
    }

    // 데이터 개수에 따라 탭 활성화
    tabs.forEach(tab => {
        const tabName = tab.dataset.tab;
        if (tabName === 'basic') tab.disabled = false;
        if (tabName === 'cumulative' && journalCount >= 5) tab.disabled = false;
        if (tabName === 'deep' && journalCount >= 10) tab.disabled = false;
    });

    // 각 탭에 필요한 데이터 렌더링
    renderBasicAnalysis(journals[journalCount - 1], userType);
    if (journalCount >= 5) renderCumulativeAnalysis(journals.slice(-5));
    if (journalCount >= 10) renderDeepAnalysis(journals.slice(-10));

    setupTabEvents();
    
    document.querySelector('.tab-btn:not(:disabled)')?.click();
}

function setupTabEvents() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.disabled) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const targetId = `${tab.dataset.tab}-analysis-content`;
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === targetId);
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeAnalysisPage);