// js/lozee-analysis.js
// 통합 분석 모듈: 언어·나이 유추, 시간 추적, 감정 어조, 상황 분석, 문해력 렌더러

import OpenAI from 'openai';
const openai = new OpenAI();

// 전역 분석 객체
window.LOZEE_ANALYSIS = window.LOZEE_ANALYSIS || {};

// --- 1) 대화 시간별 언어·나이 분석 ---
window.LOZEE_ANALYSIS.timeTracking = {
  start: null,
  wordCount: 0,
  intervalId: null
};
window.LOZEE_ANALYSIS.trackTime = function() {
  const state = window.LOZEE_ANALYSIS.timeTracking;
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
};
window.LOZEE_ANALYSIS.stopTrackTime = function() {
  const state = window.LOZEE_ANALYSIS.timeTracking;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
};

// --- 2) 감정 어조 분석 트래킹 ---
window.LOZEE_ANALYSIS.trackEmotionTone = function(analysisData) {
  console.log('[LOZEE_ANALYSIS] 감정 어조 분석:', analysisData);
  // TODO: 차트/클라우드 렌더링 구현
};

// --- 3) 상황 분석 (인지왜곡 패턴 탐지) ---
window.LOZEE_ANALYSIS.trackSituation = function(analysisData) {
  console.log('[LOZEE_ANALYSIS] 상황 분석:', analysisData);
  // TODO: 상황 패턴 추출 및 매칭 구현
};

// --- 4) 문해력/표현력 분석 렌더러 ---
window.LOZEE_ANALYSIS.renderLiteracyAnalysis = function(result, containerId) {
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
};

// --- 5) 언어·연령 유추 기능 ---
window.LOZEE_ANALYSIS.inferAgeAndLanguage = async function(conversationText) {
  const messages = [
    { role: 'system', content: 
      `아래 대화 내용을 분석하여
` +
      `1) 예상 나이대 (예: "8-10세")
` +
      `2) 어휘 다양성 (vocabularyDiversity: 0.0~1.0)
` +
      `3) 문장 복잡도 (sentenceComplexity: 0.0~1.0)
` +
      `를 JSON 형식으로 반환하세요.`
    },
    { role: 'user', content: conversationText }
  ];
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 120,
    temperature: 0.0
  });
  return JSON.parse(res.choices[0].message.content);
};

export default window.LOZEE_ANALYSIS;
