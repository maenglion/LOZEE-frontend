// js/gpt-dialog.js
// 0) GPT 백엔드 URL 정의 (Railway 프로덕션 서버)
const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat'; [gpt-dialog.js]


window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

// LOZEE GPT 대화 로직 (중요도 순 정렬 및 중복 제거)
window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

/**
 * 1) 호격 조사 결정: '아/야'
 */
export function getKoreanVocativeParticle(name) { [gpt-dialog.js]
  if (!name) return '야';
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return '야';
  const hasBatchim = (code - 0xAC00) % 28 !== 0;
  return hasBatchim ? '아' : '야';
}

/**
 * 2) 인용 조사 결정: '(이)라고'
 */
export function getKoreanNamingParticle(name) { [gpt-dialog.js]
  if (!name) return '라고';
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return '라고';
  const hasBatchim = (code - 0xAC00) % 28 !== 0;
  return hasBatchim ? '이라고' : '라고';
}

/**
 * 3) 사용자 의도 감지 (감정 vs 사실)
 */
export function detectIntent(text) { [gpt-dialog.js]
  if (typeof text !== 'string') return 'fact';
  const keywords = ['슬펐','우울','화났','기분','행복','짜증','신나','분노','불안','걱정','스트레스','힘들','좋아','싫어'];
  return keywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

/**
 * 4) 추천 주제 목록 (추가 가능)
 */
 /** // 4-1) 대화 막힘 감지 (스턱 상태 판단 함수)
 * @param {string} userText 최근 사용자 입력
 * @param {Array} chatHistory 대화 기록
 * @param {object} meta { lastInputTimestamp: number, fillerCount: number, clickedOption: boolean }
 * @returns {boolean} 막힘 상태 여부
 */ //
export function detectStuck(userText, chatHistory, meta) { [gpt-dialog.js]
  const now = Date.now();
  if (meta.lastInputTimestamp && (now - meta.lastInputTimestamp) > 300000) {
    return true;
  }
  if (meta.fillerCount >= 3) {
    return true;
  }
  const recent = chatHistory.filter(m => m.role === 'user').slice(-5);
  if (recent.length === 5 && recent.every(m => m.content.trim().length < 5)) {
    return true;
  }
  if (meta.clickedOption) {
    return false;
  }
  return false;
}

// 4) 추천 주제 목록
export const preferenceTopics = [ 
  name => `${name}, 네가 가장 좋아하는 사람 3명은 누구야? 1등부터 3등까지 말해줄 수 있어?`,
  name => `${name}, 그럼 반대로 혹시 네가 별로 좋아하지 않거나 불편하게 느끼는 사람 3명이 있다면 알려줄 수 있을까?`,
  name => `${name}, 너는 누구와 새로운 것들을 배우고 즐기는 걸 좋아해? (최대 3명)`,
  name => `${name}, 네가 정말 좋아하는 것과 정말 싫어하는 것을 각각 3개씩 말해줄 수 있을까?`,
  name => `${name}, 네가 가장 자랑스러웠던 순간은 언제였어? 짧게라도 이야기해 줄래?`,
  name => `${name}, 만약 하루 동안 무엇이든 될 수 있다면, 뭐가 되고 싶어? 왜 그런지도 궁금한데!`,
  name => `${name}, 요즘 너를 가장 신나게 하거나 웃게 만드는 일은 뭐야?`,
  name => `${name}, 혹시 '이런 사람처럼 되고 싶다!' 하고 닮고 싶은 사람이 있어? 있다면 누구야?`,
  name => `${name}, 가장 행복했던 기억 하나만 살짝 들려줄 수 있을까?`,
  name => `${name}, 지금 당장 어디든 여행을 갈 수 있다면, 어디로 가고 싶어?`,
  name => `${name}, 너에 대해서 아직 내가 모르는 재미있는 사실 하나만 알려줄래?`,
  name => `${name}, '이 사람이랑 이야기하면 시간 가는 줄 모르겠다!' 하는 친구가 있다면 소개해 줄 수 있어?`,
  name => `${name}, 너의 소중한 가족들을 소개해 줄 수 있을까?`,
  name => `${name}, 혹시 요즘 '아, 이 친구랑 좀 더 친해지고 싶다!' 하는 사람이 있어? 있다면 누구인지, 왜 그런지 알려줄 수 있니?`
];

/**
 * 5) 시스템 프롬프트 생성 (간결, 핵심 지시 및 상호작용 가이드)
 */
export function getSystemPrompt({ userName='친구', userAge=0 }={}, intent='fact') { [gpt-dialog.js]
  const voc = getKoreanVocativeParticle(userName); // 같은 모듈 내 함수 호출
  const naming = getKoreanNamingParticle(userName); // 같은 모듈 내 함수 호출
  const nameVoc = `${userName}${voc}`;

  let prompt = `[필수] 1-2문장, 최대 60토큰 이내로 답변하세요.`;
  if (userAge >= 56) {
    prompt += `
사용자: ${userName}님 (56세 이상), 존댓말 사용.`;
  } else {
    prompt += `
사용자: ${nameVoc}, 편한 반말 사용. 호칭은 '${nameVoc}' 또는 '${userName}${naming}'.`;
  }
  prompt += `
당신은 따뜻한 심리 코치 'LOZEE'입니다.`;
  if (intent === 'emotion') {
    prompt += `
먼저 사용자의 감정을 인정하고 공감 질문을 우선하세요.`;
    prompt += `
[강도 질문] 사용자가 부정적 감정을 반복할 경우, "이번에 느끼는 감정의 강도를 1(약함)부터 5(매우 강함) 사이 숫자로 알려줄래?"라고 물어보세요.`;
  } else {
    prompt += `
먼저 사실을 정확히 이해하기 위한 질문을 우선하세요.`;
  }
  prompt += `
[ASD 지침] 명확하고 직접적인 언어 사용.`;
  prompt += `
[선택지 제안] 대화 전환점에 2-3개의 짧은 선택지를 제시하세요. 예: "지금까지 이야기했는데, ${nameVoc}, 어떻게 할까요? 1. 정리해보기 2. 다른 이야기하기".`;
  prompt += `
[추천 주제] 사용자가 대화를 이어가기 어려워할 때, 아래 목록에서 1가지를 랜덤으로 제시하세요. 이미 사용된 주제는 제외합니다.`;
  preferenceTopics.forEach((fn, idx) => { // 같은 모듈 내 preferenceTopics 사용
    prompt += `
${idx+1}. ${fn(nameVoc)}`;
  });
  prompt += `
[구조화 요약] 복잡한 내용에는 항목별 리스트로 요약하세요.`;
  prompt += `
[분석 JSON] 분석 객체만 JSON으로 반환: { sentiment, emotion_intensity, keywords, cognitive_distortion_flags, vocabularyDiversity, sentenceComplexity }.`;
  return prompt;
}


/**
 * 6) GPT 호출 및 메시지 구성
 */
export async function getGptResponse(userText, { chatHistory=[] }={}) { [gpt-dialog.js]
  const intent = detectIntent(userText); // 같은 모듈 내 함수 호출
  const userName = localStorage.getItem('lozee_username') || '친구';
  const userAge = parseInt(localStorage.getItem('lozee_userage')||0, 10);
  const systemPrompt = getSystemPrompt({ userName, userAge }, intent); // 같은 모듈 내 함수 호출

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: userText }
  ];

  const payload = { model: 'gpt-4-turbo', messages, max_tokens: 60, temperature: 0.7 };
  const res = await fetch(GPT_BACKEND_URL_GPT_DIALOG, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('authToken')}` },
    body: JSON.stringify(payload)
  });
  return res;
}

/**
 * 7) 대화 종료 메시지
 */
export function getExitPrompt(userName='친구', userAge=0) { [gpt-dialog.js]
  const voc = getKoreanVocativeParticle(userName); // 같은 모듈 내 함수 호출
  const promptEnd = userAge >= 56
    ? `${userName}님, 오늘 대화 감사합니다!`
    : `${userName}${voc}, 오늘 이야기 고마웠어요!}`;
  return `${promptEnd} 혹시 이 대화 전보다 기분이 얼마나 나아졌는지 1(전혀)부터 5(매우) 사이 숫자로 알려줄래요?`;
}
