// js/lozee-analysis.js
// 통합 분석 모듈: 언어·나이 유추, 시간 추적, 감정 어조, 상황 분석, 문해력 렌더러


// 분석 백엔드 url 정의
const LOZEE_ANALYSIS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/gpt-analysis'; 

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
  // TODO: 차트/클라우드 렌더링 구현
}

// --- 3) 상황 분석 (인지왜곡 패턴 탐지) ---
export function trackSituation(analysisData) { 
  console.log('[LOZEE_ANALYSIS] 상황 분석:', analysisData);
  // TODO: 상황 패턴 추출 및 매칭 구현
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

// talk.html에서 import LOZEE_ANALYSIS from ... 로 사용하기 위해
// 필요한 함수들을 모아 객체로 만들고 default export 합니다.
const LOZEE_ANALYSIS = {
  timeTracking, // timeTracking 객체도 내보낼 수 있습니다.
  trackTime,
  stopTrackTime,
  trackEmotionTone,
  trackSituation,
  renderLiteracyAnalysis,
  inferAgeAndLanguage
};

export default LOZEE_ANALYSIS;

