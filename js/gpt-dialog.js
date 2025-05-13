// ./js/gpt-dialog.js

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';

/** 간단 NLU: 감정 vs 사실 분류 */
function detectIntent(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '분노', '불안', '걱정', '스트레스', '힘들'];
  if (emotionKeywords.some(k => text.includes(k))) return 'emotion';
  return 'fact';
}

function getSystemPrompt(context = {}, extraIntent='fact') {
  const { userAge, userName, currentStage, userDisease } = context;
  let prompt = `당신은 'LOZEE'라는 감정 중심 심리 코치이자 상담 동반자입니다.`;
  prompt += ` 현재 대화는 [${currentStage||'Stage 1'}] 단계입니다.`;
  prompt += ` 사용자의 발화를 잘 듣고 적절히 반응하세요.`;

  // 우선순위 정책: 나이·말투 고정
  if (userAge >= 56) {
    prompt += ` 사용자는 56세 이상입니다. 반드시 존댓말만 사용하세요.`;
  } else {
    prompt += ` 사용자는 55세 이하입니다. 반드시 반말만 사용하세요.`;
  }

  // 연령별/성향별 GPT 응답 시나리오
  if (userAge < 10) {
    prompt += ` 사용자가 10세 미만입니다. 문장 길이를 최소화하고 확인 중심의 짧은 질문을 해주세요 ("그게 싫었어?" 식).`;
  } else if (userAge <= 14) {
    prompt += ` 사용자가 11~14세입니다. 감정 단어 예시를 제공하며 유사 사례를 들어 공감 질문을 해주세요 ("보통 이럴 땐 이런 기분이 들어").`;
  } else if (userAge < 60) {
    prompt += ` 사용자가 15~59세입니다. 감정 복합성을 수용하고 상황 추론을 포함한 질문을 해주세요.`;
  } else {
    prompt += ` 사용자가 60세 이상입니다. 경험을 존중하는 톤으로 질문하고, 대화를 부드럽게 이어가세요.`;
  }

  // 진단명 기반 전략
  if (userDisease === 'ADHD' || userDisease === 'ASD') {
    prompt += ` 사용자가 ADHD/ASD 진단을 받았습니다. 두괄식 짧은 문장으로 핵심을 강조하고, yes/no 질문을 활용하세요.`;
  }

  // 발화 의도에 따른 지시
  if (extraIntent === 'emotion') {
    prompt += `
사용자가 감정 위주로 발화했습니다. '왜 그렇게 느꼈는지' 공감 질문을 먼저 해주세요.`;
  } else {
    prompt += `
사용자가 사실/상황을 설명했습니다. 상황의 세부 맥락을 파고드는 질문을 먼저 해주세요.`;
  }

  // 추가 정책: 어린이 제한, 10분 내 짧은 답변 등
  if (userAge <= 10) {
    prompt += `
사용자가 10세 이하입니다. 초기 10분간 15글자 이상의 긴 답변은 자제하세요.`;
  }

  return prompt;
}
}

export async function getInitialGreeting(userName, hasVisited, lastSummary = '', userAge, userDisease) {
  const name = userName || '친구';
  if (!hasVisited) {
    return Promise.resolve(`${name}님, 안녕! 나는 로지야. 오늘 어떤 얘기를 해보고 싶어?`);
  }
  return Promise.resolve(`다시 만나서 반가워요, ${name}님. 무엇부터 이야기할까요?`);
}

export async function getGptResponse(userText, extraPrompt = '', context = {}) {
  const text = userText.trim();
  if (!text) return { rephrasing: '음... 무슨 말인지 잘 모르겠어. 다시 말해줄래?' };

  // 의도 분류
  const intent = detectIntent(text);
  // 시스템 프롬프트 생성
  const systemPrompt = getSystemPrompt(context, intent) + (extraPrompt ? '\n' + extraPrompt : '');

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
    if (!resp.ok) return { error: `죄송해, 답변을 가져오지 못했어. (코드 ${resp.status})` };
    const data = await resp.json();
    return typeof data.choices !== 'undefined'
      ? data.choices[0].message.content
      : (data.rephrasing || '응답을 받지 못했어.');
  } catch (e) {
    return { error: '응답 중 문제가 생겼어.' };
  }
}

export function getExitPrompt(userName) {
  return `${userName||'친구'}야, 오늘 이야기해줘서 고마워. 또 대화하자.`;
}
