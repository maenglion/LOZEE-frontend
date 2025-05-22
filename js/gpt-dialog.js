// js/gpt-dialog.js
// GPT 대화 로직: 선택된 주제 기반 질문 및 응답 처리

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat'; // 실제 백엔드 API 주소

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
 * 이 함수에서 아스퍼거 아동의 특성을 고려한 상세한 대화 전략을 LLM에게 지시합니다.
 * @param {object} context 대화 컨텍스트 { userAge, userDisease, userName, currentStage }
 * @param {'emotion'|'fact'} extraIntent 사용자 의도
 * @returns {string} 시스템 메시지
 */
export function getSystemPrompt(context = {}, extraIntent = 'fact') {
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1' } = context;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(userAge, 10);
  let effectiveAge = actualUserAge;

  // 대상 진단명 (소문자로 비교하기 위해 준비)
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  let parsedUserDisease = [];

  // userDisease가 문자열일 경우 JSON 파싱 시도, 아니면 배열로 처리
  if (typeof userDisease === 'string') {
    try {
      parsedUserDisease = JSON.parse(userDisease); // userDisease가 JSON 문자열 형태의 배열이라고 가정
      if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDisease]; // 파싱 결과가 배열이 아니면 단일 요소 배열로
    } catch {
      parsedUserDisease = [userDisease]; // 파싱 실패 시 문자열 그대로 배열 요소로
    }
  } else if (Array.isArray(userDisease)) {
    parsedUserDisease = userDisease;
  }
   // userDisease 배열 내 각 요소를 소문자로 변환하여 비교 준비
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');


  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(id =>
    targetDiagnosesForCbtExperience.includes(id)
  );

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAge = 9; // CBT 참여 및 특정 진단 시 10세 미만 대화 경험으로 조정
    console.log(
      `CBT User (${userName}, 실제나이: ${actualUserAge}) - 특정 진단으로 10세 미만 대화 경험 적용 (effectiveAge: ${effectiveAge})`
    );
  }

  // 기본 시스템 프롬프트
  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다.`;

  // 나이에 따른 말투 및 호칭 설정
  if (effectiveAge >= 56) {
    prompt += `
[매우 중요] 사용자는 56세 이상입니다. 반드시, 어떤 상황에서도 예외 없이 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `
[매우 중요] 사용자는 55세 이하입니다. 반드시, 어떤 상황에서도 예외 없이 항상 친구처럼 편안한 반말만 사용하세요. '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }

  prompt += `
사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.`;

  // 연령대별 응대 가이드라인
  if (effectiveAge < 10) {
    prompt += `
[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 길게 말하지 않을 것. (예: 1-2 문장 이내) 아이가 충분히 이야기할 수 있도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여주는 것이 좋습니다. 질문은 명확하고 구체적으로 하며, 공감 표현보다는 사실 확인 중심의 질문을 사용하세요. (예: "그게 싫었어?", "그래서 기분이 안 좋았구나.")`;
    if (isCbtUser && hasSpecificDiagnosisForCbt) {
      prompt += ` (이 사용자는 CBT 참여자로, 실제 나이는 ${actualUserAge}세이지만 10세 미만 아동과의 대화를 경험하고 있습니다.)`;
    }
  } else if (effectiveAge >= 10 && effectiveAge <= 14) {
    prompt += `
[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도하세요. 감정 단어 예시를 제공하거나 정서 범주를 알려주는 프레이밍을 사용할 수 있습니다. (예: "보통은 이럴 때 이런 기분이 들어. 너는 어땠니?")`;
  } else if (effectiveAge >= 15 && effectiveAge < 56) {
    prompt += `
[15-55세 성인 응대 가이드라인] 사용자의 복합적인 감정과 상황을 이해하려 노력하고, 상황을 다각도로 추론하여 통찰력 있는 질문을 던져주세요. 하지만 판단하거나 해결책을 직접 제시하기보다는 스스로 생각할 수 있도록 도와주세요.`;
  } else { // 56세 이상은 위에서 이미 존댓말 처리
    prompt += `
[56세 이상 성인 응대 가이드라인] 사용자의 풍부한 경험을 존중하며, 과거의 경험이나 현재의 생각에 대한 질문을 통해 삶의 지혜를 나눌 수 있도록 대화를 이끌어주세요.`;
  }

  // 진단 정보 기반 상호작용 가이드라인 (ASD 특성 반영)
  const isAsdRelated = lowercasedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d));
  if (isAsdRelated) {
    prompt += `
[ASD 관련 진단 사용자 특별 지침]
- 언어 사용: 직접적이고 명확한 언어를 사용하세요. 비유나 은유, 반어법 사용을 최소화하고, 구체적인 질문을 선호합니다.
- 질문 방식: 예/아니오로 답할 수 있는 질문이나 객관식 형태의 선택지를 제공하는 질문을 활용하세요. (예: "그때 기분이 슬펐어, 아니면 화가 났어?")
- 대화 흐름: 일관성 있는 대화 패턴을 유지하고, 사용자가 사실 관계에 대해 길게 이야기할 경우 충분히 들어주고 그 내용을 중심으로 질문을 이어가세요. 감정에 대한 질문은 사용자가 먼저 감정을 명확히 표현하거나, 사실 관계가 충분히 파악된 후 조심스럽게 접근하세요.
- 감정 이해 돕기: 감정 단어를 직접 언급하기보다 예시를 통해 제시하거나("보통 이런 상황에서는 속상하다고 느끼기도 해."), "이 상황에서 어떤 느낌이었는지 말해줄 수 있니?" 와 같이 유도하세요.
- 응답 방식: 두괄식으로 응답하는 것을 선호합니다. (예: "응, 네가 말한 건 [요약] 이런 이야기구나.") 감정을 표현하는 형용사 사용을 최소화하고, 복잡한 공감 표현보다는 구체적인 다음 질문으로 대화를 유도하세요. (예: "그래서, 어떤 부분이 제일 신경 쓰였어?")
- 반복 및 확인: 사용자의 말을 반복하여 이해했음을 확인시켜주고, 사용자가 같은 질문을 반복하더라도 인내심을 가지고 답변해주세요. 동일한 문장 사용을 지적하지 마세요.
- 추측 제한: "네가 하고 싶은 말을 내가 추측해볼게"와 같은 문장은 하루 대화당 최대 2회까지만 사용하세요.`;
  }
  if (lowercasedUserDisease.includes('adhd')) {
    prompt += `
[ADHD 진단 사용자 특별 지침] 대화의 핵심을 명확하고 간결하게 전달하고, 필요시 짧게 정리해주세요. 한 번에 하나의 질문이나 주제에 집중하고, 주의 전환이 빠를 수 있으니 대화 주제가 너무 벗어나지 않도록 부드럽게 유도해주세요.`;
  }


  // 발화 의도에 따른 추가 지침
  if (extraIntent === 'emotion') {
    prompt += `
[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.`;
  } else { // 'fact' 또는 기타
    // ASD 아동이면서 사실/상황을 이야기할 때의 특별 지침
    if (isAsdRelated && effectiveAge < 15) {
      prompt += `
[발화 의도: 사실/상황 - ASD 아동 특별 지침] 사용자가 특정 사실이나 상황을 자세히 설명하고 있습니다. 아이가 충분히 이야기할 수 있도록 사실 관계를 중심으로 더 자세히 물어봐 주세요. (예: "그래서 어떻게 됐어?", "그 다음에 무슨 일이 있었니?", "더 자세히 말해줄 수 있니?") 감정에 대한 질문은 아이가 먼저 감정을 명확히 표현할 때까지 기다려주세요.`;
    } else {
      prompt += `
[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.`;
    }
  }

  // 10세 미만 추가 제한 (문장 길이)
  if (effectiveAge <= 10) {
    prompt += `
[10세 미만 추가 제한] 사용자가 어리기 때문에 대화 초기에는 한 번의 답변이 너무 길어지지 않도록 주의해주세요. 약 1-2 문장으로 짧게 답변하는 것이 좋습니다.`;
  }

  // LLM에게 분석 데이터 반환 요청 (예시)
  // 실제로는 백엔드에서 LLM 응답과 별개로 분석을 수행하거나,
  // LLM이 특정 형식으로 분석 정보를 포함하여 응답하도록 유도할 수 있습니다.
  // 아래는 LLM에게 직접 요청하는 예시이며, 실제 구현은 백엔드 전략에 따라 달라집니다.
  prompt += `
[분석 데이터 요청] 사용자의 발화와 대화의 맥락을 기반으로 다음 분석 정보를 JSON 형식의 'analysis' 객체에 포함하여 응답의 일부로 제공해주세요:
- sentiment: (사용자 발화의 감정: "positive", "negative", "neutral", "mixed")
- emotion_intensity: (감정 강도: 0.0 ~ 1.0)
- keywords: (주요 키워드 배열: ["키워드1", "키워드2"])
- cognitive_distortion_flags: (감지된 인지왜곡 패턴이 있다면 배열로, 없다면 빈 배열: ["과잉일반화 의심"])
- literacy_markers: (문해력 관련 지표 객체: {"complex_sentence_ratio": 0.0, "vocabulary_diversity": 0.0})
이 'analysis' 객체는 실제 대화 답변 텍스트와는 별도로, 응답 JSON의 최상위 레벨에 'analysis' 키로 포함되어야 합니다.`;

  return prompt;
}


/**
 * 첫 질문: 선택된 주제를 반영하여 간단한 시작 질문 생성
 * @param {string|number} age 사용자 나이
 * @param {{displayText:string, id:string}} topic 선택된 주제 객체
 * @returns {string} 첫 질문 프롬프트
 */
export function getFirstQuestion(age, topic) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const tk = topic?.displayText || '오늘 있었던 일'; // 기본 주제
  const a = parseInt(age, 10) || 0; // 기본값 0으로 설정
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
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['asd', 'adhd', '2e', 'social_comm_disorder', 'asperger']; // 소문자로 통일
  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(d => targetDiagnosesForCbtExperience.includes(d));

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAgeForGreeting = 9; // 10세 미만 대화 경험으로 조정
  }

  if (tk === 'USER_WILL_DEFINE_IN_CHAT') { // 사용자가 직접 주제를 정하는 경우
    return effectiveAgeForGreeting >= 56
      ? `${userName}님, 반갑습니다. 오늘은 어떤 이야기를 나누고 싶으신가요?`
      : `${userName}아, 반가워! 오늘은 어떤 이야기를 하고 싶어?`;
  }

  // 일반적인 주제 선택 시
  return effectiveAgeForGreeting >= 56
    ? `${userName}님, 안녕하세요. 오늘은 '${tk}'에 대해 이야기해 볼까요?`
    : `${userName}아, 안녕! 오늘은 '${tk}'에 대해 이야기해 볼까?`;
}

/**
 * GPT 스트리밍 응답 호출 (또는 일반 JSON 응답)
 * @param {string} userText 사용자 입력
 * @param {object} context 대화 컨텍스트 (userAge, userDisease, userName, chatHistory 등 포함)
 * @returns {Promise<Response>} fetch 응답
 */
export async function getGptResponse(userText, context = {}) {
  const text = userText.trim();

  // isInitialGreeting과 같은 특별한 context 필드는 현재 사용되지 않으므로,
  // 빈 텍스트 입력 시 기본 시스템 프롬프트만 보내는 로직은 제거하거나 수정 필요.
  // 여기서는 빈 텍스트도 일반 대화로 처리하도록 가정.
  // if (!text && !context.isInitialGreeting) {
  //   // 초기 인사나 특별한 상황이 아니라면 빈 텍스트는 무시하거나 다른 처리 가능
  //   // return Promise.resolve(new Response(JSON.stringify({ text: "..." }), { headers: { 'Content-Type': 'application/json' }}));
  // }

  const parsedUserDiseaseForTemp = Array.isArray(context.userDisease)
    ? context.userDisease.map(id => typeof id === 'string' ? id.toLowerCase() : '')
    : typeof context.userDisease === 'string'
    ? (()=>{ try { return JSON.parse(context.userDisease).map(id => typeof id === 'string' ? id.toLowerCase() : ''); } catch { return [context.userDisease.toLowerCase()]; }})()
    : [];

  let temperature = 0.7; // 기본 온도
  // ASD 관련 진단 시 온도 조절
  if (parsedUserDiseaseForTemp.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d))) {
    temperature = 0.65;
  }
  // ADHD 진단 시 온도 (ASD와 중복될 수 있으나, ASD 우선 또는 다른 로직 적용 가능)
  // 여기서는 ASD 설정 후 ADHD가 있다면 0.7로 덮어쓰지 않도록 주의 (혹은 별도 로직)
  // if (parsedUserDiseaseForTemp.includes('adhd') && temperature !== 0.65) {
  //   temperature = 0.7;
  // }


  const intent = detectIntent(text);
  const systemPrompt = getSystemPrompt(context, intent);

  const messages = [{ role: 'system', content: systemPrompt }];
  // chatHistory가 있다면 추가 (최근 N개만 전달하는 것이 좋음)
  if (context.chatHistory && Array.isArray(context.chatHistory)) {
    messages.push(...context.chatHistory); // context.chatHistory는 {role, content} 객체들의 배열이어야 함
  }
  if (text) {
    messages.push({ role: 'user', content: text });
  }

  const payload = {
    messages,
    model: 'gpt-4-turbo', // 사용 모델 지정 (필요시 변경)
    temperature,
    // 백엔드에서 stream을 지원하지 않는다면, stream: false 또는 해당 파라미터 제거
    // stream: true, // 스트리밍 응답을 원할 경우 (백엔드 지원 필요)
  };
  console.log("GPT 요청 페이로드:", JSON.stringify(payload, null, 2));


  // fetch API 호출
  // 백엔드 API는 이 payload를 받아 LLM과 통신하고,
  // 응답으로 { text: "...", analysis: { ... } } 형태의 JSON을 반환해야 합니다.
  return fetch(GPT_BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 필요시 API 키 등 추가 헤더
    },
    body: JSON.stringify(payload)
  });
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
  const lowercasedUserDisease2 = parsedUserDisease2.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt2 = lowercasedUserDisease2.some(id => targetDiagnosesForCbtExperience.includes(id));


  if (isCbtUser && hasSpecificDiagnosisForCbt2) {
    effectiveAgeForExit = 9; // 10세 미만 대화 경험으로 조정
  }

  return effectiveAgeForExit >= 56
    ? `${userName}님, 오늘 대화 고맙습니다. 언제든 편하게 다시 찾아주세요.`
    : `${userName}아, 오늘 이야기 나눠줘서 고마워! 다음에 또 재미있는 이야기하자!`;
}
