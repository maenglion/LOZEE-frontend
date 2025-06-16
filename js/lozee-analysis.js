// js/lozee-analysis.js
// 통합 분석 모듈: 언어·나이 유추, 시간 추적, 감정 어조, 상황 분석, 문해력 렌더러

const LOZEE_ANALYSIS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/gpt-analysis';

// --- 분석 조건 ---
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


/**
 * [신규 추가]
 * AI를 사용하여 텍스트의 의미를 분석하고, 핵심 키워드를 추출하는 함수
 * @param {string} journalText - AI가 생성한 5문단 분량의 저널 요약문
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


/**
 * conversationText(전체 대화 로그 문자열)에서
 * “인물(사람)”과 “감정” 페어 태그를 추출하는 예시 함수.
 * (이 함수는 그대로 두거나 필요에 따라 다른 용도로 사용할 수 있습니다.)
 */
export function extractEntityEmotionPairs(conversationText) {
  // ... (기존 코드)
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

