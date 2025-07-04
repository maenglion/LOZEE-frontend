// js/lozee-analysis.js
// Chart.js ESM 빌드 경로 및 등록 (이전 코드)
// import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.esm.js';
// Chart.register(...registerables);

// **새로운 Chart.js 임포트 (UMD 버전 사용 권장)**
// 이 파일에서는 Chart 객체를 직접 사용하지 않고, 전역으로 로드된 Chart 객체를 사용한다고 가정합니다.
// 만약 lozee-analysis.js 내에서 Chart 객체를 직접 import하여 사용해야 한다면,
// 아래 CDN 대신 'https://cdn.jsdelivr.net/npm/chart.js'를 import하고 registerables를 등록해야 합니다.
// 하지만 현재 analysis.html에서 이미 CDN을 통해 Chart.js를 불러오고 있으므로,
// lozee-analysis.js에서는 Chart 객체가 전역에 있다고 가정하고 별도 import를 제거합니다.
// (만약 analysis.html에서 Chart.js CDN을 제거했다면, lozee-analysis.js에서 다시 import 해야 합니다.)

// **일단은 lozee-analysis.js에서 Chart.js 관련 import 라인을 제거합니다.**
// **Chart.js는 analysis.html에서 <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>로 불러오는 것이 더 안정적입니다.**
// **따라서 lozee-analysis.js에서는 Chart 객체를 전역 변수로 사용하도록 가정합니다.**


// 통합 분석 모듈: 언어·나이 유추, 시간 추적, 감정 어조, 상황 분석, 문해력 렌더러
const LOZEE_ANALYSIS_BACKEND_URL = 'https://google-tts-new-server-production.up.railway.app/gpt-analysis';

/// --- 1. 분석 조건 및 유틸리티 함수 ---

/**
 * 특정 분석 모듈을 실행할 조건이 되는지 확인합니다.
 */
export function shouldRunModule(module, { userAge, totalMinutes, sessions }) {
  const totalKeywords = sessions.flatMap(s => s.keywords || []).length;
  switch (module) {
    case 'emotionTone':
    case 'entityEmotion': return true;
    case 'cognitiveDistortion':
    case 'repetitivePattern': return totalMinutes >= 120;
    case 'literacy':
    case 'inferLangAge': return userAge <= 12 && totalMinutes >= 30;
    case 'emotionChart':
    case 'keywordCloud': return sessions.length >= 3 || totalKeywords >= 5;
    default: return false;
  }
}


// --- 1) 대화 시간별 언어·나이 분석 ---
const timeTracking = { 
  start: null,
  wordCount: 0,
  intervalId: null
};

export function trackTime() { 
  const state = timeTracking; 
  if (state.intervalId) return;
  state.start = Date.now();
  state.wordCount = 0;
  state.intervalId = setInterval(() => {
    const elapsed = (Date.now() - state.start) / 1000;
    const userEls = document.querySelectorAll('#chat-window .bubble.user');
    state.wordCount = Array.from(userEls).reduce((sum, el) => sum + (el.textContent||"").split(/\s+/).filter(Boolean).length, 0);
    if (elapsed >= 30*60 && elapsed < 2*60*60) {
      console.log('[LOZEE_ANALYSIS] 30분 분석:', state.wordCount, '단어');
    } else if (elapsed >= 2*60*60 && elapsed < 6*60*60) {
      console.log('[LOZEE_ANALYSIS] 2시간 분석: 감정 표현/논리 구조');
    } else if (elapsed >= 6*60*60) {
      console.log('[LOZEE_ANALYSIS] 6시간 분석: 주제별 표현 편차');
      clearInterval(state.intervalId);
    }
  }, 5*60*1000);
}

export function stopTrackTime() { 
  const state = timeTracking; 
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

// --- 2) 감정 어조 분석 트래킹 ---
export function trackEmotionTone(analysisData) {
  console.log('[LOZEE_ANALYSIS] 감정 어조 분석:', analysisData);
  const toneMap = analysisData?.emotionTone || {};
  const container = document.getElementById("emotion-chart");
  if (!container || !Object.keys(toneMap).length) return;

  const ctx = container.getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(toneMap),
      datasets: [{
        label: "감정 어조 점수",
        data: Object.values(toneMap),
        backgroundColor: "rgba(255, 159, 64, 0.6)"
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// --- 3. 렌더링(Rendering) 함수 ---
/**
 * [신규 추가]
 * AI를 사용하여 텍스트의 의미를 분석하고, 핵심 키워드를 추출하는 함수
 * @param {string} journalText - AI가 생성한 5문단 분량의 저널 요약문
 * @param {object} emotionData - { "기쁨": 0.6, "슬픔": 0.2, ... }
 * @returns {Promise<string[]>} - 추출된 핵심 키워드 배열 (예: ["성취감", "도전", "즐거움"])
 */
export async function extractSemanticKeywords(journalText) {
  if (!journalText) {
    console.warn("키워드 추출을 위한 텍스트가 없습니다.");
    return [];
  }

  try {
    const response = await fetch(LOZEE_ANALYSIS_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 백엔드 API에 새로운 분석 타입을 정의하여 요청
        analysisType: 'semanticKeywords', 
        text: journalText,
        prompt: "다음 글의 내용과 감정선을 분석하여, 이 글 전체를 대표할 수 있는 핵심 키워드를 5개 추출해 줘. 비슷한 의미의 감정들은 '성취감', '유대감', '자신감' 등과 같이 대표적인 개념의 키워드로 묶어서 표현해 줘. 결과는 JSON 배열 형태로만 반환해 줘."
      }),
    });

    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();
    
    // 백엔드에서 { keywords: ["성취감", "도전", ...] } 형태로 반환한다고 가정
    return result.keywords || [];

  } catch (error) {
    console.error('의미 기반 키워드 추출 중 오류:', error);
    // 오류가 발생하면 빈 배열을 반환하여 다른 기능에 영향을 주지 않도록 함
    return [];
  }
}

export function renderEmotionChart(canvasId, emotionData) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const emotionColors = { '기쁨': 'rgba(255, 205, 86, 0.8)','슬픔': 'rgba(54, 162, 235, 0.8)','분노': 'rgba(255, 99, 132, 0.8)','불안': 'rgba(153, 102, 255, 0.8)','중립': 'rgba(201, 203, 207, 0.8)'};
    const labels = Object.keys(emotionData);
    const dataValues = Object.values(emotionData);
    const backgroundColors = labels.map(label => emotionColors[label] || 'rgba(100, 100, 100, 0.8)');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ label: '감정 비율', data: dataValues, backgroundColor: backgroundColors }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

/**
 * [신규 통합] 태그 클라우드를 렌더링합니다.
 * @param {string} elementId - 태그 클라우드를 표시할 div의 ID
 * @param {string[]} keywords - 키워드 문자열 배열
 */
export function renderTagCloud(elementId, keywords) {
    const cloudEl = document.getElementById(elementId);
    if (!cloudEl) return;

    if (keywords && keywords.length > 0) {
        cloudEl.innerHTML = keywords.map(kw => `<span class="badge">${kw}</span>`).join('');
    } else {
        cloudEl.innerHTML = '<p style="text-align:center; color:#888;">표시할 키워드가 없어요.</p>';
    }
}



// --- 3) 상황 분석 (인지왜곡 패턴 탐지) ---
export function trackSituation(analysisData) {
  console.log('[LOZEE_ANALYSIS] 상황 분석:', analysisData);
  const container = document.getElementById("situation-container");
  if (!container) return;

  const distortions = analysisData?.distortions || [];
  const repetitions = analysisData?.patterns || [];

  let html = "<div class='analysis-section'><h4>🧠 인지 왜곡/반복 패턴</h4>";

  if (distortions.length) {
    html += "<p><strong>인지 왜곡 감지됨:</strong></p><ul>";
    distortions.forEach(d => html += `<li>${d}</li>`);
    html += "</ul>";
  }

  if (repetitions.length) {
    html += "<p><strong>반복 주제:</strong></p><ul>";
    repetitions.forEach(p => html += `<li>${p}</li>`);
    html += "</ul>";
  }

  if (!distortions.length && !repetitions.length) {
    html += "<p style='color:#888;'>특별한 반복 패턴이나 왜곡 감지 없음.</p>";
  }

  html += "</div>";
  container.innerHTML = html;
}

// --- 4) 문해력/표현력 분석 렌더러 ---
export function renderLiteracyAnalysis(result, containerId) { 
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!result || (!result.literacyFlags && !result.recommendations)) {
    el.innerHTML = '<p style="color:#888;text-align:center;">문해력 분석 결과가 없습니다.</p>';
    return;
  }
  let html = '<div class="analysis-section"><h4>📘 문해력/표현력 분석</h4>';
  if (result.literacyFlags?.length) {
    html += '<ul>' + result.literacyFlags.map(f=>`<li>${f}</li>`).join('') + '</ul>';
  }
  if (result.recommendations?.length) {
    html += '<p>추천:</p><ul>' + result.recommendations.map(r=>`<li>${r}</li>`).join('') + '</ul>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// --- 5) 언어·연령 유추 기능 ---
export async function inferAgeAndLanguage(conversationText) {
  try {
    const payload = {
      conversation: conversationText
    };
    const response = await fetch(LOZEE_ANALYSIS_BACKEND_URL, { // 이전에 수정한 백엔드 호출 방식
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${localStorage.getItem('authToken')}` // 필요시 인증 헤더
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error('언어·연령 유추 API 오류:', response.status, errorData);
      return { error: `API 요청 실패: ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    console.error('언어·연령 유추 중 네트워크 또는 기타 오류:', error);
    return { error: `클라이언트 오류: ${error.message}` };
  }
}

/**
 * conversationText(전체 대화 로그 문자열)에서
 * “인물(사람)”과 “감정” 페어 태그를 추출하는 예시 함수.
 * (실제 프로젝트에 맞춰서 형태소 분석기나 GPT 호출로 대체 가능)
 */
export function extractEntityEmotionPairs(conversationText) {
  // ① “인물 키워드” 목록 예시 (필요에 따라 더 늘려 주세요)
  const personKeywords = ["엄마", "아빠", "형", "동생", "친구", "선생님", "아스퍼거", "형아"];
  // ② “감정 키워드” 목록 예시
  const emotionKeywords = ["기쁨", "슬픔", "속상", "화남", "불안", "우울", "당황", "신남", "후회"];
  
  const tags = [];
  
  // (1) 단순히 “문장 단위로” split
  const sentences = conversationText.split(/[\n\.!?]+/);
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    // 1) 이 문장 안에 어떤 인물이 있는지 체크
    const foundPersons = personKeywords.filter(p => trimmed.includes(p));
    // 2) 이 문장 안에 어떤 감정 단어가 있는지 체크
    const foundEmotions = emotionKeywords.filter(e => trimmed.includes(e));
    
    // 3) 인물과 감정이 둘 다 발견되면, 모든 조합을 태그로 추가
    if (foundPersons.length > 0 && foundEmotions.length > 0) {
      for (const person of foundPersons) {
        for (const emo of foundEmotions) {
          tags.push({ entity: person, emotion: emo });
        }
      }
    }
  }
  
  // 중복 제거: 동일한 {entity,emotion} 쌍이 여러 문장에서 반복될 수 있으므로
  const unique = [];
  const seen = new Set();
  for (const t of tags) {
    const key = `${t.entity}___${t.emotion}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  
  return unique;
}

// --- 심층 분석 (10회+)을 위한 데이터 처리 함수들 ---

/**
 * [심층] 관계별 감정 데이터를 분석하고 가공합니다.
 * @param {object[]} journals - 10개 이상의 저널 데이터 배열
 * @returns {object} - 레이더 차트에 필요한 데이터 형식
 */
export function analyzeRelationalEmotions(journals) {
    const relationKeywords = ['엄마', '아빠', '친구', '선생님'];
    const emotionTypes = ['기쁨', '슬픔', '불안', '분노']; // 분석할 주요 감정
    const relationStats = {}; // { 엄마: { 기쁨: [0.6, 0.5], 슬픔: [0.1], ... }, 친구: { ... } }

    journals.forEach(journal => {
        const text = (journal.summary || '') + (journal.detailedAnalysis.keywords || []).join(' ');
        const emotions = journal.detailedAnalysis.emotionToneData;

        relationKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                if (!relationStats[keyword]) {
                    relationStats[keyword] = {};
                }
                emotionTypes.forEach(emotion => {
                    if (!relationStats[keyword][emotion]) {
                        relationStats[keyword][emotion] = [];
                    }
                    if (emotions[emotion]) {
                        relationStats[keyword][emotion].push(emotions[emotion]);
                    }
                });
            }
        });
    });

    // 평균 계산하여 Chart.js 데이터셋 형태로 변환
    const datasets = Object.keys(relationStats).map(keyword => {
        const data = emotionTypes.map(emotion => {
            const scores = relationStats[keyword][emotion] || [];
            if (scores.length === 0) return 0;
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return avg.toFixed(2); // 소수점 2자리까지
        });
        return { label: keyword, data: data, fill: true, tension: 0.1 };
    });

    return { labels: emotionTypes, datasets: datasets };
}

/**
 * [심층] 의사소통 성장 데이터를 분석합니다.
 * @param {object[]} journals - 10개 이상의 저널 데이터 배열
 * @returns {object} - 성장 분석 결과 객체
 */
export function analyzeCommunicationGrowth(journals) {
    const initialJournals = journals.slice(0, 3);
    const recentJournals = journals.slice(-3);

    const getVocabDiversity = (arr) => {
        const keywords = arr.flatMap(j => j.detailedAnalysis.keywords || []);
        return new Set(keywords).size; // 고유한 키워드의 개수
    };

    const getAvgSummaryLength = (arr) => {
        if(arr.length === 0) return 0;
        const totalLength = arr.reduce((sum, j) => sum + (j.summary || '').length, 0);
        return Math.round(totalLength / arr.length);
    };

    return {
        initialDiversity: getVocabDiversity(initialJournals),
        recentDiversity: getVocabDiversity(recentJournals),
        initialLength: getAvgSummaryLength(initialJournals),
        recentLength: getAvgSummaryLength(recentJournals),
    };
}

/**
 * [심층] 생각 습관(인지왜곡) 변화를 추적합니다.
 * @param {object[]} journals - 10개 이상의 저널 데이터 배열
 * @returns {object} - 인지왜곡별 초기/최근 빈도수
 */
export function analyzeHabitTracking(journals) {
    const initialJournals = journals.slice(0, 5);
    const recentJournals = journals.slice(-5);

    const getDistortionCounts = (arr) => {
        const distortions = arr.flatMap(j => j.detailedAnalysis.cognitiveDistortions || []);
        const counts = {};
        distortions.forEach(d => {
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    };

    const initialCounts = getDistortionCounts(initialJournals);
    const recentCounts = getDistortionCounts(recentJournals);
    const allKeys = [...new Set([...Object.keys(initialCounts), ...Object.keys(recentCounts)])];

    const result = {};
    allKeys.forEach(key => {
        result[key] = {
            initial: initialCounts[key] || 0,
            recent: recentCounts[key] || 0
        };
    });

    return result;
}


// --- 차트 렌더링 함수들 ---

/**
 * [심층] 관계별 감정 레이더 차트를 렌더링합니다.
 */
export function renderRelationRadarChart(canvasId, analysisData) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, { type: 'radar', data: analysisData });
}

/**
 * [심층] 성장 리포트를 텍스트로 렌더링합니다.
 */
export function renderGrowthReport(elementId, growthData) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const diversityChange = growthData.recentDiversity - growthData.initialDiversity;
    const lengthChange = growthData.recentLength - growthData.initialLength;

    let html = `
        <p><strong>감정 어휘 다양성:</strong> 처음(${growthData.initialDiversity}개) → 최근(${growthData.recentDiversity}개)
           <span style="color: ${diversityChange >= 0 ? 'blue' : 'red'}; font-weight: bold;">(${diversityChange >= 0 ? '+' : ''}${diversityChange}개)</span>
        </p>
        <p><strong>평균 대화 길이:</strong> 처음(${growthData.initialLength}자) → 최근(${growthData.recentLength}자)
           <span style="color: ${lengthChange >= 0 ? 'blue' : 'red'}; font-weight: bold;">(${lengthChange >= 0 ? '+' : ''}${lengthChange}자)</span>
        </p>
        <p class="feedback positive" style="margin-top:10px;">
            ${diversityChange > 0 ? '다양한 감정 단어를 사용하기 시작했어!' : ''}
            ${lengthChange > 50 ? '이야기를 더 길고 풍부하게 표현하고 있구나! 정말 멋진 성장이야!' : ''}
            ${diversityChange <= 0 && lengthChange <= 50 ? '꾸준히 이야기하는 것만으로도 대단한 일이야!' : ''}
        </p>
    `;
    el.innerHTML = html;
}

/**
 * [심층] 생각 습관 변화 막대 차트를 렌더링합니다.
 */
export function renderHabitTrackingChart(canvasId, habitData) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || Object.keys(habitData).length === 0) {
        if(ctx) {
            const container = document.getElementById(canvasId).parentElement;
            container.innerHTML = `<p class="feedback neutral">최근 10번의 대화에서 특별히 반복되는 생각 습관은 발견되지 않았어. 아주 좋아!</p>`;
        }
        return;
    }

    const labels = Object.keys(habitData);
    const initialData = labels.map(key => habitData[key].initial);
    const recentData = labels.map(key => habitData[key].recent);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: '처음 5회', data: initialData, backgroundColor: 'rgba(255, 159, 64, 0.5)' },
                { label: '최근 5회', data: recentData, backgroundColor: 'rgba(75, 192, 192, 0.5)' }
            ]
        },
        options: { indexAxis: 'y' } // 가로 막대 그래프
    });
}