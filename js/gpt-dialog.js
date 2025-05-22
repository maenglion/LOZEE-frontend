// js/gpt-dialog.js
// GPT 대화 로직: 선택된 주제 기반 질문 및 응답 처리 (counseling_topics 의존 제거 및 전체 원본 유지)

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';

/**
 * 사용자 발화 감정/사실 의도 감지
 * @param {string} text 사용자 입력 텍스트
 * @returns {'emotion'|'fact'} intent
 */
export function detectIntent(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

/**
 * 시스템 프롬프트 생성: 컨텍스트(나이, 이름, 진단, 주제 등) 및 의도 기반으로 지침 수립
 * @param {object} context 대화 컨텍스트 { userAge, userDisease, userName, currentStage }
 * @param {'emotion'|'fact'} intent 사용자 의도
 * @returns {string} 시스템 메시지
 */
export function getSystemPrompt(context = {}, extraIntent = 'fact') {
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1' } = context;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(userAge, 10);
  let effectiveAge = actualUserAge;

  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  let parsedUserDisease = [];
  if (typeof userDisease === 'string') {
    try {
      parsedUserDisease = JSON.parse(userDisease);
      if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDisease];
    } catch {
      parsedUserDisease = [userDisease];
    }
  } else if (Array.isArray(userDisease)) {
    parsedUserDisease = userDisease;
  }

  const hasSpecificDiagnosisForCbt = parsedUserDisease.some(id =>
    targetDiagnosesForCbtExperience.includes(id.toLowerCase())
  );

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAge = 9;
    console.log(
      `CBT User (${userName}, 실제나이: ${actualUserAge}) - 특정 진단으로 10세 미만 대화 경험 적용 (effectiveAge: ${effectiveAge})`
    );
  }

  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다.`;

  if (effectiveAge >= 56) {
    prompt += `
[매우 중요] 사용자는 56세 이상입니다. 반드시, 어떤 상황에서도 예외 없이 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `
[매우 중요] 사용자는 55세 이하입니다. 반드시, 어떤 상황에서도 예외 없이 항상 친구처럼 편안한 반말만 사용하세요. '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }

  prompt += `
사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.`;

  if (effectiveAge < 10) {
    prompt += `
[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 길게 말하지 않을 것. 아이가 충분히 이야기할 수 있도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여주는 것이 좋습니다.`;
    if (isCbtUser && hasSpecificDiagnosisForCbt) {
      prompt += ` (이 사용자는 CBT 참여자로, 실제 나이는 ${actualUserAge}세이지만 10세 미만 아동과의 대화를 경험하고 있습니다.)`;
    }
  } else if (effectiveAge >= 10 && effectiveAge <= 14) {
    prompt += `
[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도하세요.`;
  } else if (effectiveAge >= 15 && effectiveAge < 56) {
    prompt += `
[15-55세 성인 응대 가이드라인] 사용자의 복합적인 감정과 상황을 이해하려 노력하고, 상황을 다각도로 추론하여 통찰력 있는 질문을 던져주세요. 하지만 판단하거나 해결책을 직접 제시하기보다는 스스로 생각할 수 있도록 도와주세요.`;
  } else {
    prompt += `
[56세 이상 성인 응대 가이드라인] 사용자의 풍부한 경험을 존중하며, 과거의 경험이나 현재의 생각에 대한 질문을 통해 삶의 지혜를 나눌 수 있도록 대화를 이끌어주세요.`;
  }

  if (parsedUserDisease.length > 0 && !['none', 'prefer_not_to_say'].includes(parsedUserDisease[0])) {
    const diseasePromptParts = [];
    const isAsdRelated = parsedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d.toLowerCase()));
    if (isAsdRelated) {
      diseasePromptParts.push(
        '자폐 스펙트럼, 아스퍼거, 사회적 의사소통 관련 또는 2e 진단 정보: 직접적이고 명확한 언어 사용. 비유/은유보다 구체적 질문 선호. 예/아니오 또는 객관식 질문 활용. 이야기가 잘 통하지 않을때 비슷한 뜻을 고를 수 있도록 드롭박스(실제 UI 기능은 아니지만, 명확한 선택지를 주는 방식의 대화 지향), 일관성 있는 대화 패턴 유지. 특히 사실 관계에 대한 이야기를 길게 할 수 있으므로, 충분히 들어주고 그 내용을 중심으로 질문을 이어가세요.'
      );
    }
    if (parsedUserDisease.includes('adhd')) {
      diseasePromptParts.push(
        'ADHD 진단 정보: 대화의 핵심을 명확하고 간결하게 전달하고, 필요시 짧게 정리. 한 번에 하나의 질문/주제 집중. 주의 전환이 빠를 수 있으니, 대화 주제가 너무 벗어나지 않도록 부드럽게 유도.'
      );
    }
    prompt += `
[진단 정보 기반 상호작용 가이드라인] 사용자는 다음과 같은 진단 정보를 가지고 있습니다: ${diseasePromptParts.join(' ')}`;
  }

  if (extraIntent === 'emotion') {
    prompt += `
[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.`;
  } else {
    const isAsdRelatedChildForIntent = parsedUserDisease.some(d => ['asperger', 'asd', 'social_comm_disorder', '2e'].includes(d.toLowerCase())) && effectiveAge < 15;
    if (isAsdRelatedChildForIntent) {
      prompt += `
[발화 의도: 사실/상황 - ASD 아동 특별 지침] 사용자가 특정 사실이나 상황을 자세히 설명하고 있습니다. 아이가 충분히 이야기할 수 있도록 사실 관계를 중심으로 더 자세히 물어봐 주세요. 감정에 대한 질문은 아이가 먼저 감정을 명확히 표현할 때까지 기다려주세요. 예를 들어, "그래서 어떻게 됐어?", "그 다음에 무슨 일이 있었니?", "더 자세히 말해줄 수 있니?"와 같이 상황을 구체화하고 다음 이야기를 이어갈 수 있도록 돕는 질문이 좋습니다.`;
    } else {
      prompt += `
[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.`;
    }
  }

  if (effectiveAge <= 10) {
    prompt += `
[10세 미만 추가 제한] 사용자가 어리기 때문에 대화 초기에는 한 번의 답변이 너무 길어지지 않도록 주의해주세요. 약 1-2 문장으로 짧게 답변하는 것이 좋습니다.`;
  }

  return prompt;
}

function getAgeGroup(age) {
  const ageInt = parseInt(age, 10);
  if (ageInt >= 8 && ageInt <= 10) return '8-10';
  if (ageInt >= 11 && ageInt <= 15) return '11-15';
  return '30+';
}

/**
 * 첫 질문: 선택된 주제를 반영하여 간단한 시작 질문 생성
 * @param {string|number} age 사용자 나이
 * @param {{displayText:string}} topic 선택된 주제 객체
 * @returns {string} 첫 질문 프롬프트
 * 
 */
const targetDiagnosesForCbtExperience = ['ASD', 'ADHD', '2E', '사회적의사소통장애'];
const diseases = JSON.parse(localStorage.getItem('lozee_userdisease') || '[]');

export function getFirstQuestion(age, topic) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const tk = topic?.displayText || '이야기';
  const a = parseInt(age, 10) || 0;
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  let effectiveAgeForGreeting = a;

  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
  if (userDiseaseString) {
    try {
      parsedUserDisease = JSON.parse(userDiseaseString);
      if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [parsedUserDisease];
    } catch {
      parsedUserDisease = [userDiseaseString];
    }
  }
  const hasSpecificDiagnosisForCbt = parsedUserDisease.some(d =>
    targetDiagnosesForCbtExperience.includes(d.toLowerCase())
  );
  if (isCbtUser && hasSpecificDiagnosisForCbt) effectiveAgeForGreeting = 9;

  if (tk === 'USER_WILL_DEFINE_IN_CHAT') {
    return effectiveAgeForGreeting >= 56
      ? `${userName}님, 반갑습니다. 어떤 이야기를 하고 싶으신가요?`
      : `${userName}아, 반가워! 어떤 이야기를 나눌까?`;
  }

  return effectiveAgeForGreeting >= 56
    ? `${userName}님, 선택하신 '${tk}' 주제로 대화를 시작해 볼까요? 첫 번째로 어떤 질문부터 드릴까요?`
    : `${userName}아, '${tk}' 주제를 골랐구나! 어떤 것부터 이야기해볼까?`;
}

/**
 * GPT 스트리밍 응답 호출
 * @param {string} userText 사용자 입력
 * @param {object} context 대화 컨텍스트
 * @returns {Promise<Response>} fetch 응답 스트림
 */
export function getGptResponse(userText, context = {}) {
  const text = userText.trim();

  if (!text && !context.isInitialGreeting) {
    return fetch(GPT_BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: getSystemPrompt(context) }] }) });
  }

  const parsedUserDiseaseForTemp = Array.isArray(context.userDisease)
    ? context.userDisease.map(id => id.toLowerCase())
    : typeof context.userDisease === 'string'
    ? JSON.parse(context.userDisease).map(id => id.toLowerCase())
    : [];

  let temperature = 0.7;
  if (parsedUserDiseaseForTemp.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d))) temperature = 0.65;
  if (parsedUserDiseaseForTemp.includes('adhd')) temperature = 0.7;

  const intent = detectIntent(text);
  const systemPrompt = getSystemPrompt(context, intent);

  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory) messages.push(...context.chatHistory);
  if (text) messages.push({ role: 'user', content: text });

  const payload = { messages, model: 'gpt-4-turbo', temperature };

  return fetch(GPT_BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

/**
 * 대화 종료 시 인사 프롬프트
 */
export function getExitPrompt(userName = '친구', age) {
  const a = parseInt(age, 10) || 0;
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  let effectiveAgeForExit = a;
  const userDiseaseString2 = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease2 = [];
  if (userDiseaseString2) {
    try {
      parsedUserDisease2 = JSON.parse(userDiseaseString2);
      if (!Array.isArray(parsedUserDisease2)) parsedUserDisease2 = [parsedUserDisease2];
    } catch {
      parsedUserDisease2 = [userDiseaseString2];
    }
  }
  const hasSpecificDiagnosisForCbt2 = parsedUserDisease2.some(id =>
    ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'].includes(id.toLowerCase())
  );
  if (isCbtUser && hasSpecificDiagnosisForCbt2) effectiveAgeForExit = 9;

  return effectiveAgeForExit >= 56
    ? `${userName}님, 오늘 대화 고맙습니다. 언제든 돌아오세요.`
    : `${userName}아, 오늘 즐거웠어! 또 이야기하자!`;
}
