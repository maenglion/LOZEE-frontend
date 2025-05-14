
const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';

/**
 * 텍스트 의도를 단순 분류: 감정 vs 사실
 */
export function detectIntent(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '분노', '불안', '걱정', '스트레스', '힘들'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

/**
 * 시스템 프롬프트를 조합
 */
export function getSystemPrompt(context = {}, extraIntent = 'fact') {
  const {
    userAge = 0,
    userDisease = '',
    userName = '친구',
    currentStage = 'Stage 1'
  } = context;

  let prompt = `당신은 'LOZEE'라는 감정 중심 심리 코치이자 상담 동반자입니다. 현재 대화는 [${currentStage}] 단계입니다. 사용자의 발화를 잘 듣고 적절히 반응하세요.`;
  
  // 말투 고정
  if (userAge >= 56) {
    prompt += ' 사용자는 56세 이상입니다. 반드시 존댓말만 사용하세요.';
  } else {
    prompt += ' 사용자는 55세 이하입니다. 반드시 반말만 사용하세요.';
  }

  // 연령별 응답 시나리오
  if (userAge < 10) {
    prompt += ' 사용자가 10세 미만입니다. 짧고 확인 중심의 질문으로 진행하세요.';
  } else if (userAge <= 14) {
    prompt += ' 사용자가 11~14세입니다. 친근한 예시와 공감 질문을 섞어 진행하세요.';
  } else if (userAge < 60) {
    prompt += ' 사용자가 15~59세입니다. 복합적인 감정과 상황 추론을 반영해 질문하세요.';
  } else {
    prompt += ' 사용자가 60세 이상입니다. 존중하는 톤으로 경험 기반 질문을 이어가세요.';
  }

  // 진단명 기반 전략
  if (['ADHD','ASD','자폐','자폐스펙트럼','고기능자폐'].some(d => userDisease.includes(d))) {
    prompt += ' 사용자가 ADHD/ASD 진단 정보가 있습니다. 핵심을 짧게 정리하고 yes/no 질문을 활용하세요.';
  }

  // 발화 의도별 가이드
  if (extraIntent === 'emotion') {
    prompt += '\n사용자가 감정 위주로 발화했습니다. "왜 그렇게 느꼈는지" 공감 질문을 먼저 해주세요.';
  } else {
    prompt += '\n사용자가 사실·상황을 설명했습니다. 상황의 세부 맥락을 파고드는 질문을 먼저 해주세요.';
  }

  // 어린이 추가 제한
  if (userAge <= 10) {
    prompt += '\n사용자가 10세 이하입니다. 초기 10분간 15글자 이상의 긴 답변은 자제하세요.';
  }

  return prompt;
}

/**
const API_BASE = '/api/gpt';

/** 첫 인사문 생성 */
import { counselingTopicsByAge } from './counseling_topics.js';

export function getFirstQuestion(age) {
  const topics = counselingTopicsByAge[ getAgeGroup(age) ] || [];
  const opts = topics.slice(0,5).join(', '); // 예: 상위 5개만
  const userName = localStorage.getItem('lozee_username') || '친구';
return `안녕하세요! ${userName} 만나서 반가워요. ${opts}. 이 중 하나를 골라 이야기해 볼까요?`;

}

function getAgeGroup(age) {
  const a = parseInt(age, 10);
  if (a >= 8 && a <= 10) return '8-10';
  if (a >= 12 && a <= 15) return '12-15';
  return '30+';
}

/** 유저 발화에 대한 GPT 응답 */
export async function getGptResponse(userText) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText })
  });
  if (!res.ok) throw new Error('GPT 응답 불러오기 실패');
  const { reply } = await res.json();
  return reply;
}

/**
 * GPT API 호출
 */
export async function getGptResponse(userText, context = {}) {
  const text = userText.trim();
  if (!text) {
    return { rephrasing: '음... 무슨 말인지 잘 모르겠어. 다시 말해줄래?' };
  }
  const intent = detectIntent(text);
  const systemPrompt = getSystemPrompt(context, intent);
  const payload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]
  };

  try {
    const resp = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      return { error: `죄송해, 답변을 가져오지 못했어. (코드 ${resp.status})` };
    }
    const data = await resp.json();
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return { error: '응답을 받지 못했어.' };
  } catch (e) {
    return { error: '응답 중 문제가 생겼어.' };
  }
}

/**
 * 종료 인사 생성
 */
export function getExitPrompt(userName = '친구') {
  return `${userName}야, 오늘 이야기해줘서 고마워. 또 대화하자.`;
}