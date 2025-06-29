// js/analysis-main.js

// --- 모듈 Import ---
import { getJournalsForUser } from './firebase-utils.js';

// 기존: import { renderEmotionChart, renderTagCloud, renderCumulativeEmotionChart } from './lozee-analysis-charts.js';
// 수정: lozee-analysis.js에서 필요한 모든 렌더링 및 분석 함수를 임포트
import { 
    analyzeRelationalEmotions,
    analyzeCommunicationGrowth,
    analyzeHabitTracking,
    renderRelationRadarChart,
    renderGrowthReport,
    renderHabitTrackingChart,
    renderEmotionChart, // 이 함수는 lozee-analysis.js에 있습니다.
    renderTagCloud // 이 함수도 lozee-analysis.js에 있습니다.
    // renderCumulativeEmotionChart는 현재 lozee-analysis.js에 없으므로 임포트하지 않습니다.
    // 만약 renderCumulativeEmotionChart가 필요하다면 lozee-analysis.js에 구현 후 export 해야 합니다.
} from './lozee-analysis.js'; // <- lozee-analysis.js에서 불러옵니다.

// --- DOM 요소 ---
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const basicContentEl = document.getElementById('basic-analysis-content');
const cumulativeContentEl = document.getElementById('cumulative-analysis-content');
const deepContentEl = document.getElementById('deep-analysis-content');

// --- 렌더링 호출 함수 ---

/** 1. 기본 분석 탭 렌더링 (연령 분기 로직 강화) */
function renderBasicAnalysis(journal, userType) {
    const container = document.getElementById('basic-analysis-content');
    
    if (userType === 'child') {
        // 아이용 레이아웃 렌더링
        container.innerHTML = `
            <div class="section" id="languageAgeSection">
                 <h2>🗣️ 내 말솜씨 나이는 몇 살일까?</h2>
                 </div>
            <div class="section" id="emotionToneSection">
                <h2>🌈 내 마음 색깔은 뭘까?</h2>
                <div id="emotionChartContainer" style="max-width: 400px; margin: auto;"><canvas id="emotionChart"></canvas></div>
                <h3 style="margin-top: 30px; font-size: 1.2em;">주요 키워드</h3>
                <div id="tagCloud"></div>
            </div>
        `;
        // 차트 및 태그 렌더링 함수 호출
        renderEmotionChart('emotionChart', journal.detailedAnalysis.emotionToneData);
        renderTagCloud('tagCloud', journal.detailedAnalysis.keywords);

    } else { // userType === 'adult'
        // 성인용 레이아웃 렌더링 (analysis_adult.html의 구조를 가져옴)
        container.innerHTML = `
            <div class="section" id="conversationSummarySection">
                <h2>📝 로지와의 대화 요약</h2>
                <p class="module-explanation">최근 대화 내용을 한눈에 볼 수 있도록 요약했어요.</p>
                <div id="summaryContent" style="white-space: pre-wrap;"></div>
            </div>
            <div class="section">
                <h2>🌊 감정 흐름 살펴보기</h2>
                <div id="emotionChartContainer" style="max-width: 400px; margin: auto;"><canvas id="emotionChart"></canvas></div>
            </div>
            <div class="section">
                <h2>🔑 나의 대화 키워드</h2>
                <div id="tagCloud"></div>
            </div>
            <div class="section">
                <h2>💡 함께 생각해 볼 점</h2>
                <div id="situationAlerts"></div>
            </div>
        `;
        // 각 영역에 데이터 채우기 및 렌더링 함수 호출
        container.querySelector('#summaryContent').textContent = journal.summary;
        renderEmotionChart('emotionChart', journal.detailedAnalysis.emotionToneData);
        renderTagCloud('tagCloud', journal.detailedAnalysis.keywords);
        // ... situationAlerts 렌더링 로직
    }
}

function renderCumulativeAnalysis(journals) {
    cumulativeContentEl.innerHTML = `
        <div class="section">
            <h2>📈 최근 5회 누적 분석</h2>
            <p class="module-explanation">최근 5번의 대화를 통해 발견된 변화의 흐름을 보여줄게!</p>
            <h3>감정 변화 추이</h3>
            <div id="cumulativeEmotionChartContainer" style="position: relative; max-width: 400px; margin: auto;">
                <canvas id="cumulativeEmotionChart"></canvas>
            </div>
            <h3>자주 나타난 키워드</h3>
            <div id="cumulativeTagCloud"></div>
        </div>
    `;

    // 1. 누적 감정 데이터를 계산합니다.
    // 각 저널의 detailedAnalysis.emotionToneData를 합산하여 누적 감정 비율을 계산합니다.
    const cumulativeEmotionData = journals.reduce((acc, journal) => {
        if (journal.detailedAnalysis && journal.detailedAnalysis.emotionToneData) {
            for (const emotion in journal.detailedAnalysis.emotionToneData) {
                acc[emotion] = (acc[emotion] || 0) + journal.detailedAnalysis.emotionToneData[emotion];
            }
        }
        return acc;
    }, {});

    // 2. renderEmotionChart 함수를 사용하여 누적 감정 차트를 렌더링합니다.
    // renderEmotionChart는 이미 도넛 차트를 그리도록 되어 있습니다.
    renderEmotionChart('cumulativeEmotionChart', cumulativeEmotionData);

    // 3. 누적 키워드를 처리하고 렌더링합니다.
    const allKeywords = journals.flatMap(j => j.detailedAnalysis?.keywords || []);

    // TODO: 중복 키워드 개수를 세서 상위 N개 (예: 5개)만 렌더링 하는 로직 추가
    // 여기서는 일단 모든 고유 키워드를 보여주되, 빈도수 계산 로직을 포함합니다.
    const keywordCounts = {};
    allKeywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
    });

    // 빈도수를 기준으로 내림차순 정렬하고 상위 5개만 선택
    const topKeywords = Object.entries(keywordCounts)
        .sort(([,countA], [,countB]) => countB - countA)
        .slice(0, 5) // 상위 5개만 선택
        .map(([keyword]) => keyword); // 키워드 이름만 추출

    renderTagCloud('cumulativeTagCloud', topKeywords);
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

