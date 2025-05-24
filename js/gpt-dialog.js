// js/gpt-dialog.js
// GPT 대화 로직: 사용자의 상황과 선택에 맞는 맞춤형 대화 시작 및 응답 처리
window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat'; // 백엔드 주소 확인

/**
 * 사용자 발화의 기본적인 의도 감지 (감정 표현 여부)
 */
window.LOZEE_DIALOG.detectIntent = function(text) {
  if (typeof text !== 'string') return 'fact'; // text가 문자열이 아니면 기본값 반환
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
};

/**
 * 시스템 프롬프트 생성
 */
window.LOZEE_DIALOG.getSystemPrompt = function(context = {}, extraIntent = 'fact') {
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1', topicType = 'general', selectedTopicText = '' } = context;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(userAge, 10);
  let effectiveAge = actualUserAge;

  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  let parsedUserDisease = [];
  if (typeof userDisease === 'string') {
    try { parsedUserDisease = JSON.parse(userDisease); if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDisease]; } catch { parsedUserDisease = [userDisease]; }
  } else if (Array.isArray(userDisease)) {
    parsedUserDisease = userDisease;
  }
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(id => targetDiagnosesForCbtExperience.includes(id));

  if (isCbtUser && hasSpecificDiagnosisForCbt && actualUserAge > 10) { // CBT 사용자는 10세 미만 경험을 하되, 실제 나이가 10세 초과일 때만 적용
    effectiveAge = 9;
  }

  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다.`;

  if (effectiveAge >= 56) {
    prompt += `\n[매우 중요] 사용자는 56세 이상입니다. 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `\n[매우 중요] 사용자는 55세 이하입니다. 항상 친구처럼 편안한 반말만 사용하세요. '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }
  prompt += `\n사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.`;

  // ASD 관련 지침 (여기에 사용자님이 주신 구체적인 지침들을 상세히 넣어주세요)
  const isAsdRelated = lowercasedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d));
  if (isAsdRelated) {
    prompt += `\n[ASD 관련 진단 사용자 특별 지침]
- 언어 사용: 직접적이고 명확한 언어를 사용합니다. 비유, 은유, 반어법 사용을 최소화하고, 구체적인 질문을 선호합니다.
- 질문 방식: 예/아니오로 답할 수 있거나 객관식 형태의 선택지를 제공하는 질문을 활용합니다. (예: "그때 기분이 슬펐어, 아니면 화가 났어?") 감정을 반복적으로 묻기보다 사용자의 표현을 기다립니다.
- 대화 흐름: 일관성 있는 대화 패턴을 유지합니다. 사용자가 사실 관계에 대해 길게 이야기할 경우 충분히 들어주고 그 내용을 중심으로 질문을 이어갑니다. 감정에 대한 질문은 사용자가 먼저 감정을 명확히 표현하거나, 사실 관계가 충분히 파악된 후 조심스럽게 접근합니다.
- 감정 이해 돕기: 감정 단어를 직접 언급하기보다 예시("보통 이런 상황에서는 속상하다고 느끼기도 해.")를 통해 제시하거나, "이 상황에서 어떤 느낌이었는지 말해줄 수 있니?" 와 같이 유도합니다.
- 응답 방식: 두괄식 응답을 선호합니다. (예: "응, 네가 말한 건 [요약] 이런 이야기구나.") 감정 표현 형용사 사용을 최소화하고, 복잡한 공감 표현보다는 구체적인 다음 질문으로 대화를 유도합니다. (예: "그래서, 어떤 부분이 제일 신경 쓰였어?")
- 반복 및 확인: 사용자의 말을 반복하여 이해했음을 확인시켜주고, 사용자가 같은 질문을 반복하더라도 인내심을 가지고 답변합니다. 동일한 문장 사용을 지적하지 않습니다.
- 추측 제한: "네가 하고 싶은 말을 내가 추측해볼게"와 같은 문장은 이 대화 세션에서 최대 2회까지만 사용합니다.`;
  }

  // 연령대별 응대 가이드라인 (ASD 특성과 중첩될 수 있으므로, ASD 지침이 우선될 수 있도록 고려)
  if (effectiveAge < 10) {
    prompt += `\n[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 한 번에 1-2 문장 이내로 짧게 말합니다. 아이가 충분히 이야기하도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여줍니다. 질문은 명확하고 구체적으로 하며, (특히 ASD가 아닌 경우) 공감 표현보다는 사실 확인 중심의 질문을 사용합니다. (예: "그게 싫었어?", "그래서 기분이 안 좋았구나.")`;
  } else if (effectiveAge >= 10 && effectiveAge <= 14) {
    prompt += `\n[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도합니다. 감정 단어 예시를 제공하거나 정서 범주를 알려주는 프레이밍을 사용할 수 있습니다. (예: "보통은 이럴 때 이런 기분이 들어. 너는 어땠니?")`;
  }
  // (15-55세, 56세 이상 지침은 기존 유지 또는 필요시 추가)


  // 주제 타입(topicType)에 따른 시스템 프롬프트 추가
  if (topicType === 'emotion_intensity' && selectedTopicText) {
    prompt += `\n[감정 강도 질문 대화 시작] 사용자는 '${selectedTopicText}' 감정에 대해 1~10점 사이의 점수로 표현하도록 첫 질문을 받았습니다. 사용자가 점수로 답하면, "그렇구나, ${userName}이가 느끼기에 그 정도(예: X점)의 감정이구나. 어떤 일 때문에 그 정도의 감정을 느끼게 됐는지, 아니면 그 점수가 의미하는 게 뭔지 좀 더 자세히 이야기해 줄 수 있을까?" 와 같이 점수의 이유나 배경이 된 구체적인 상황이나 사실 관계를 파악하는 질문으로 자연스럽게 이어가세요. 점수 자체를 평가하거나 판단하지 마세요. 만약 사용자가 점수로 답하기 어려워하면, "괜찮아, 꼭 숫자로 말하지 않아도 돼. 지금 어떤 느낌인지 편하게 이야기해 줄래?" 라고 부드럽게 유도하세요.`;
  } else if (topicType === 'situation' && selectedTopicText) {
    prompt += `\n[상황 중심 대화 시작] 사용자는 '${selectedTopicText}'라는 특정 상황이나 사실 관계에 대한 주제로 대화를 시작했습니다. 사용자가 그 상황을 자세히 설명하도록 유도하고, 관련된 생각이나 느낌을 자연스럽게 표현할 수 있도록 도와주세요. (특히 ASD 아동의 경우, 사실 관계 파악 우선 지침을 따르세요.)`;
  } else if (topicType === 'preference_discovery') {
    prompt += `\n[선호도 질문 대화 방식] 사용자가 "좋아하는 사람 3명", "싫어하는 사람 3명", "공부 중 재미있는/없는 것 3가지" 중 하나의 질문으로 대화를 시작했습니다.
- 사용자가 3가지를 모두 말하면, 그중 하나를 선택하여 "그것에 대해 좀 더 자세히 이야기해 줄 수 있어? 예를 들어 어떤 점이 좋은지(또는 왜 싫은지) 궁금해."와 같이 구체적인 경험이나 이유를 묻는 질문으로 자연스럽게 대화를 이어가세요.
- 사용자가 한두 가지만 말하거나, "모르겠다"고 답하면, "괜찮아, 생각나는 것부터 편하게 이야기해도 돼." 또는 "꼭 3가지가 아니어도 괜찮아. 한 가지라도 말해줄 수 있을까?" 와 같이 부드럽게 격려해주세요.
- 사용자의 답변에 대해 긍정적으로 반응하고, 비판하거나 평가하지 마세요. 사용자의 관심사를 파악하는 데 집중하세요.`;
  } else if (topicType === 'else' && selectedTopicText) { // 'else' 타입 및 주제 텍스트가 있는 경우
    prompt += `\n[기타 탐색적 주제 대화 시작] 사용자는 '${selectedTopicText}'라는 주제로 대화를 시작했습니다. 사용자가 자신의 생각이나 느낌을 자유롭게 탐색할 수 있도록 열린 질문을 하고, 공감하며 경청해주세요. 필요에 따라 구체적인 상황이나 생각을 묻는 질문을 할 수 있습니다.`;
  } else { // 일반적인 경우 또는 주제가 명확하지 않을 때
    // extraIntent (사용자 발화의 감정/사실 의도)에 따른 지침 추가 가능
    if (extraIntent === 'emotion') {
        prompt += `\n[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.`;
    } else { // fact
        prompt += `\n[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.`;
    }
  }

  // 분석 데이터 요청 (기존 로직 유지)
  prompt += `\n[분석 데이터 요청] 사용자의 발화와 대화의 맥락을 기반으로 다음 분석 정보를 JSON 형식의 'analysis' 객체에 포함하여 응답의 일부로 제공해주세요:\n- sentiment: (사용자 발화의 감정: "positive", "negative", "neutral", "mixed")\n- emotion_intensity: (감정 강도: 0.0 ~ 1.0)\n- keywords: (주요 키워드 배열: ["키워드1", "키워드2"])\n- cognitive_distortion_flags: (감지된 인지왜곡 패턴이 있다면 배열로, 없다면 빈 배열: ["과잉일반화 의심"])\n- literacy_markers: (문해력 관련 지표 객체: {"complex_sentence_ratio": 0.0, "vocabulary_diversity": 0.0})\n이 'analysis' 객체는 실제 대화 답변 텍스트와는 별도로, 응답 JSON의 최상위 레벨에 'analysis' 키로 포함되어야 합니다.`;
  return prompt;
};

/**
 * 첫 질문 생성 함수 확장
 */
window.LOZEE_DIALOG.getFirstQuestion = function(age, topicContext = {}) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const rawAge = age || localStorage.getItem('lozee_userage') || 0; // age 우선, 없으면 localStorage, 그것도 없으면 0
  let effectiveAgeForGreeting = parseInt(rawAge, 10);
  if (isNaN(effectiveAgeForGreeting)) effectiveAgeForGreeting = 0; // 숫자가 아니면 0으로

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
  if (userDiseaseString) {
    try { parsedUserDisease = JSON.parse(userDiseaseString); if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDiseaseString]; } catch { parsedUserDisease = [userDiseaseString];}
  }
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(id => targetDiagnosesForCbtExperience.includes(id));

  if (isCbtUser && hasSpecificDiagnosisForCbt && effectiveAgeForGreeting > 10) {
    effectiveAgeForGreeting = 9; // 10세 미만 대화 경험으로 조정 (실제 나이가 10세 초과일 때만)
    // localStorage.setItem('lozee_effectiveAge', effectiveAgeForGreeting); // talk.html에서 이 값을 사용할 수 있도록 저장
  }


  const topicDisplayText = topicContext?.displayText;
  const topicType = topicContext?.type;

  const greetingName = effectiveAgeForGreeting >= 56 ? `${userName}님` : `${userName}아/야`;

  if (topicType === 'emotion_intensity' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}' 이 감정에 대해 지금 얼마나 강하게 느끼는지 1점(전혀 그렇지 않음)부터 10점(매우 강하게 느낌) 사이의 숫자로 말해줄 수 있을까?`;
  } else if (topicType === 'situation' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}'에 대해 이야기하고 싶구나. 그 일에 대해 좀 더 자세히 말해줄 수 있겠니?`;
  } else if (topicType === 'else' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}'에 대해 좀 더 자세히 이야기해 줄 수 있을까? 어떤 생각이나 느낌이 드는지 궁금해.`;
  } else if (topicType === 'preference_discovery') {
    const preferenceQuestions = [
      `${greetingName}, 네가 가장 좋아하는 사람 3명은 누구야? 한 명씩 말해줘도 좋아.`,
      `${greetingName}, 그럼 반대로 혹시 네가 싫어하거나 불편하게 느끼는 사람 3명이 있다면 알려줄 수 있을까?`,
      `${greetingName}, 학교 공부나 활동 중에서 '이건 정말 재미있다!' 싶은 거 3가지 있어?`,
      `${greetingName}, 반대로 공부나 학교 활동 중에 '이건 정말 하기 싫다'거나 재미없는 거 3가지가 있다면 어떤 걸까?`
    ];
    return preferenceQuestions[Math.floor(Math.random() * preferenceQuestions.length)];
  }
  
  if (topicDisplayText === 'USER_WILL_DEFINE_IN_CHAT' || !topicDisplayText) { // 주제가 없거나 사용자가 직접 정하는 경우
      // 이전에 정의한 "선호도 질문"으로 유도
      localStorage.setItem('selectedTopic', JSON.stringify({ type: 'preference_discovery', displayText: "좋아하거나 싫어하는 것" })); // talk.html에서 이 값을 사용할 수 있도록 저장
      const preferenceQuestions = [
        `${greetingName}, 혹시 네가 가장 좋아하는 사람 3명은 누구인지 말해줄 수 있어?`,
        `${greetingName}, 그럼 반대로 네가 싫어하거나 불편하게 느끼는 사람은 누구야? (3명까지 말해줄 수 있다면!)`,
        `${greetingName}, 공부하는 것들 중에서 가장 재미있다고 생각하는 거 3가지가 있다면 알려줄래?`,
        `${greetingName}, 혹시 공부하는 것들 중에서 가장 재미없거나 하기 싫은 거 3가지가 있다면 어떤 걸까?`
      ];
      return preferenceQuestions[Math.floor(Math.random() * preferenceQuestions.length)];
  }

  // 일반 주제
  return effectiveAgeForGreeting >= 56
    ? `${userName}님, 안녕하세요. 오늘은 '${topicDisplayText}'에 대해 이야기해 볼까요?`
    : `${userName}아, 안녕! 오늘은 '${topicDisplayText}'에 대해 이야기해 볼까?`;
};

/**
 * GPT 응답 호출 함수
 */
window.LOZEE_DIALOG.getGptResponse = async function(userText, context = {}) {
  const text = userText.trim();
  let temperature = 0.7;
  const parsedUserDiseaseForTemp = Array.isArray(context.userDisease) ? context.userDisease.map(id => typeof id === 'string' ? id.toLowerCase() : '') : typeof context.userDisease === 'string' ? (() => { try { return JSON.parse(context.userDisease).map(id => typeof id === 'string' ? id.toLowerCase() : ''); } catch { return [context.userDisease.toLowerCase()]; }})() : [];
  if (parsedUserDiseaseForTemp.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d))) {
    temperature = 0.65;
  }
  
  const intent = window.LOZEE_DIALOG.detectIntent(text);
  const systemPrompt = window.LOZEE_DIALOG.getSystemPrompt({ 
      userAge: context.userAge, 
      userDisease: context.userDisease, 
      userName: context.userName, 
      currentStage: context.currentStage || 'Stage 1', 
      topicType: context.selectedTopic?.type || 'general', // talk.html에서 context.selectedTopic.type을 전달해야 함
      selectedTopicText: context.selectedTopic?.displayText || '' // talk.html에서 context.selectedTopic.displayText를 전달해야 함
  }, intent);

  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory && Array.isArray(context.chatHistory)) {
    // chatHistory의 각 메시지가 {role, content} 형태인지 확인하고, 아니면 변환하거나 필터링
    const validChatHistory = context.chatHistory.filter(msg => msg && typeof msg.role === 'string' && typeof msg.content === 'string');
    messages.push(...validChatHistory);
  }
  if (text) {
    messages.push({ role: 'user', content: text });
  }

  const payload = { messages, model: 'gpt-4-turbo', temperature };
  console.log("📤 GPT 요청 페이로드:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(GPT_BACKEND_URL_GPT_DIALOG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` /* 예시: 인증 토큰 추가 */ },
      body: JSON.stringify(payload)
    });
    return res; // talk.html에서 res.ok 및 res.json() 처리
  } catch (err) {
    console.error("❌ GPT API 호출 중 네트워크 예외:", err);
    return Promise.resolve({ 
        ok: false, 
        status: 0, 
        statusText: "Network Error",
        json: async () => ({ text: "네트워크 오류로 응답을 받을 수 없습니다. 인터넷 연결을 확인해주세요.", analysis: null }) 
    });
  }
};

/**
 * 대화 종료 시 인사 프롬프트
 */
window.LOZEE_DIALOG.getExitPrompt = function(userName = '친구', age) {
    const rawAge = age || localStorage.getItem('lozee_userage') || 0;
    let effectiveAgeForExit = parseInt(rawAge, 10);
    if (isNaN(effectiveAgeForExit)) effectiveAgeForExit = 0;

    // CBT 사용자 여부 및 특정 진단에 따른 effectiveAge 조정 로직 (getFirstQuestion과 유사하게 적용 가능)
    // ... (필요시 추가) ...

    return effectiveAgeForExit >= 56
        ? `${userName}님, 오늘 대화 고맙습니다. 언제든 편하게 다시 찾아주세요.`
        : `${userName}아, 오늘 이야기 나눠줘서 고마워! 다음에 또 재미있는 이야기하자!`;
};
