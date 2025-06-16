// js/analysis-main.js

// --- 모듈 Import ---
import { getJournalsForUser } from './firebase-utils.js';
import { renderEmotionChart, renderTagCloud, renderCumulativeEmotionChart } from './lozee-analysis-charts.js';
import { 
    analyzeRelationalEmotions,
    analyzeCommunicationGrowth,
    analyzeHabitTracking,
    renderRelationRadarChart,
    renderGrowthReport,
    renderHabitTrackingChart} from './lozee-analysis.js';

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


/** 3. 심층 분석 탭 렌더링 */
function renderDeepAnalysis(journals) {
    // 1. 심층 분석 탭의 기본 HTML 구조를 먼저 삽입
    deepContentEl.innerHTML = `
        <div class="section">
            <h2>🔬 10회+ 심층 분석 리포트</h2>
            <p class="module-explanation">10번 이상의 깊은 대화를 통해 발견한 너만의 특별한 점들을 알려줄게!</p>
            
            <div class="deep-analysis-module" style="margin-top: 20px;">
                <h4>📊 관계별 감정 분석</h4>
                <p>'엄마', '친구' 등 특정 인물과 이야기할 때 어떤 감정을 주로 느끼는지 분석해봤어. 관계의 힌트를 얻을 수 있을 거야.</p>
                <div style="position: relative; max-width: 500px; margin: auto;">
                    <canvas id="relationRadarChart"></canvas>
                </div>
            </div>

            <div class="deep-analysis-module" style="margin-top: 30px;">
                <h4>🌱 성장 리포트: 의사소통 스타일 변화</h4>
                <p>처음과 지금, 너의 감정 표현이 얼마나 더 풍부해지고 다양해졌는지 알려줄게. 함께한 시간이 너를 어떻게 성장시켰는지 볼 수 있어!</p>
                <div id="growthReportContainer"></div>
            </div>

            <div class="deep-analysis-module" style="margin-top: 30px;">
                <h4>🧠 생각 습관 변화 추적</h4>
                <p>혹시 반복되던 생각 습관이 있었다면, 최근에는 어떻게 변화하고 있는지 그 흐름을 추적해봤어.</p>
                <div style="position: relative; max-width: 600px; margin: auto;">
                     <canvas id="habitTrackingChart"></canvas>
                </div>
            </div>
        </div>
    `;

    // 2. 데이터 분석 함수 호출
    const relationalData = analyzeRelationalEmotions(journals);
    const growthData = analyzeCommunicationGrowth(journals);
    const habitData = analyzeHabitTracking(journals);

    // 3. 분석된 데이터를 바탕으로 렌더링 함수 호출
    renderRelationRadarChart('relationRadarChart', relationalData);
    renderGrowthReport('growthReportContainer', growthData);
    renderHabitTrackingChart('habitTrackingChart', habitData);
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

