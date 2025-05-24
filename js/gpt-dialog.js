// js/gpt-dialog.js
// GPT 대화 로직: 사용자의 상황과 선택에 맞는 맞춤형 대화 시작 및 응답 처리
window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat';

/**
 * 사용자 발화의 기본적인 의도 감지 (감정 표현 여부)
 */
window.LOZEE_DIALOG.detectIntent = function(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
};

/**
 * 시스템 프롬프트 생성
 * 사용자의 연령, 진단명, 현재 대화 단계, 발화 의도, 그리고 새로운 '선호도 질문' 상황 등을 종합적으로 고려하여 LLM에게 상세한 지침 제공
 */
window.LOZEE_DIALOG.getSystemPrompt = function(context = {}, extraIntent = 'fact') {
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1', topicType = 'general' } = context;

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

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAge = 9; // CBT 참여 및 특정 진단 시 10세 미만 대화 경험으로 조정
  }

  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다.`;

  // 공통적인 말투 및 호칭 설정 (기존 로직 유지)
  if (effectiveAge >= 56) {
    prompt += `\n[매우 중요] 사용자는 56세 이상입니다. 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `\n[매우 중요] 사용자는 55세 이하입니다. 항상 친구처럼 편안한 반말만 사용하세요. '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }
  prompt += `\n사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.`;

  // ASD 관련 상세 지침 (10세 특정 포함)
  const isAsdRelated = lowercasedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d));
  if (isAsdRelated && actualUserAge === 10) {
    prompt += `\n[매우 중요: 10세 ASD 사용자 맞춤 대화 전략] ... (이전 답변의 상세 지침 내용) ...`; // 이전 답변의 10세 ASD 상세 지침 포함
  } else if (isAsdRelated) {
    prompt += `\n[ASD 관련 진단 사용자 특별 지침] ... (이전 답변의 일반 ASD 지침 내용) ...`; // 이전 답변의 일반 ASD 지침 포함
  }

  // 기타 연령대별 지침 (ASD가 아닌 경우 또는 10세가 아닌 ASD)
  if (!(isAsdRelated && actualUserAge === 10)) { // 10세 ASD의 경우 위에서 이미 특화된 지침 제공
      if (effectiveAge < 10 && !isAsdRelated) { // ASD가 아닌 10세 미만
          prompt += `\n[10세 미만 아동 응대 가이드라인] ... (이전 답변 내용) ...`;
      } else if (effectiveAge >= 10 && effectiveAge <= 14 && !isAsdRelated) { // ASD가 아닌 10-14세
          prompt += `\n[10-14세 청소년 응대 가이드라인] ... (이전 답변 내용) ...`;
      } else if (effectiveAge >= 15 && effectiveAge < 56 && !isAsdRelated) { // ASD가 아닌 15-55세
          prompt += `\n[15-55세 성인 응대 가이드라인] ... (이전 답변 내용) ...`;
      }
  }
  
  if (lowercasedUserDisease.includes('adhd')) {
      prompt += `\n[ADHD 진단 사용자 특별 지침] ... (이전 답변 내용, ASD 지침과 병행 시 우선순위 명시) ...`;
  }

  // === 새로운 선호도 질문 및 감정 점수 질문 관련 시스템 프롬프트 추가 ===
  if (topicType === 'preference_discovery') {
    prompt += `
[선호도 질문 대화 방식] 사용자가 좋아하는 것 또는 싫어하는 것 3가지를 묻는 질문으로 대화가 시작되었습니다.
- 사용자가 3가지를 모두 말하면, 그중 하나를 선택하여 "그것에 대해 좀 더 자세히 이야기해 줄 수 있어? 예를 들어 어떤 점이 좋은지(또는 왜 싫은지) 궁금해."와 같이 구체적인 경험이나 이유를 묻는 질문으로 자연스럽게 대화를 이어가세요.
- 사용자가 한두 가지만 말하거나, "모르겠다"고 답하면, "괜찮아, 생각나는 것부터 편하게 이야기해도 돼." 또는 "꼭 3가지가 아니어도 괜찮아. 한 가지라도 말해줄 수 있을까?" 와 같이 부드럽게 격려해주세요.
- 사용자의 답변에 대해 긍정적으로 반응하고, 비판하거나 평가하지 마세요. 사용자의 관심사를 파악하는 데 집중하세요.`;
  } else if (topicType === 'emotion_rating') {
    prompt += `
[감정 점수 질문 대화 방식] 사용자가 특정 감정 주제를 선택했고, 그 감정에 대해 1점에서 10점 사이의 점수로 표현하도록 요청받았습니다.
- 사용자가 점수를 말하면, "그렇게 느끼는구나. 그 점수에 대해 좀 더 자세히 설명해 줄 수 있을까?" 또는 "어떤 생각이나 경험 때문에 그 정도의 감정을 느끼는 것 같아?" 와 같이 점수의 이유나 배경을 탐색하는 질문으로 대화를 이어가세요.
- 점수가 너무 낮거나 높아도 판단하지 말고, 사용자의 표현을 있는 그대로 수용하세요.
- 만약 사용자가 점수로 표현하기 어려워하면, "괜찮아, 꼭 숫자가 아니어도 돼. 어떤 느낌인지 말로 표현해줘도 좋아."라고 안내해주세요.`;
  } else { // 일반 주제 또는 extraIntent 기반 (10세 ASD 아닌 경우)
    if (!(isAsdRelated && actualUserAge === 10)) {
        if (extraIntent === 'emotion') {
            prompt += `\n[발화 의도: 감정] ... (이전 답변 내용) ...`;
        } else { // fact
            prompt += `\n[발화 의도: 사실/상황] ... (이전 답변 내용) ...`;
        }
    }
  }

  // 분석 데이터 요청 (기존 로직 유지)
  prompt += `\n[분석 데이터 요청] ... (이전 답변의 분석 데이터 요청 내용) ...`;
  return prompt;
};

/**
 * 첫 질문 생성 함수 확장
 */
window.LOZEE_DIALOG.getFirstQuestion = function(age, topicContext = {}) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const effectiveAgeForGreeting = parseInt(localStorage.getItem('lozee_effectiveAge') || age, 10) || (parseInt(age, 10) || 0); // talk.html에서 계산된 effectiveAge 사용 또는 직접 계산


  // topicContext는 {id, displayText, type, preference_type, item, rank} 등의 정보를 가질 수 있음
  const topicDisplayText = topicContext?.displayText || '오늘 있었던 일';
  const topicType = topicContext?.type; // 'preference_discovery', 'emotion_rating', 'general' 등

  if (topicType === 'preference_discovery') {
    // 선호도 질문 예시 중 하나를 선택 (MVP에서는 하나로 고정하거나 간단한 로직으로 선택)
    const preferenceQuestions = [
      `${userName}${effectiveAgeForGreeting < 56 ? '아/야' : '님'}, 네가 가장 좋아하는 사람 3명은 누구야? 생각나는 대로 편하게 말해줘.`,
      `${userName}${effectiveAgeForGreeting < 56 ? '아/야' : '님'}, 요즘 제일 하기 싫은 일이나 공부 3가지 있어? 있다면 어떤 거야?`,
      `${userName}${effectiveAgeForGreeting < 56 ? '아/야' : '님'}, 학교 공부 중에서 '이건 정말 재미있다!' 싶은 거 3가지 알려줄 수 있어?`
    ];
    return preferenceQuestions[Math.floor(Math.random() * preferenceQuestions.length)]; // 무작위 선택
  }

  if (topicType === 'emotion_rating' && topicDisplayText) {
    return `${userName}${effectiveAgeForGreeting < 56 ? '아/야' : '님'}, '${topicDisplayText}' 이 감정에 대해 지금 얼마나 느끼는지 1점(전혀 아님)부터 10점(매우 강함)까지 숫자로 표현해줄 수 있을까?`;
  }
  
  if (topicDisplayText === 'USER_WILL_DEFINE_IN_CHAT') {
      return effectiveAgeForGreeting >= 56
        ? `${userName}님, 반갑습니다. 오늘은 어떤 이야기를 나누고 싶으신가요?`
        : `${userName}아, 반가워! 오늘은 어떤 이야기를 하고 싶어?`;
  }

  // 일반 주제 또는 기본값
  return effectiveAgeForGreeting >= 56
    ? `${userName}님, 안녕하세요. 오늘은 '${topicDisplayText}'에 대해 이야기해 볼까요?`
    : `${userName}아, 안녕! 오늘은 '${topicDisplayText}'에 대해 이야기해 볼까?`;
};

/**
 * GPT 응답 호출 함수 (기존 로직 유지, context에 topicType 추가 가능성)
 */
window.LOZEE_DIALOG.getGptResponse = async function(userText, context = {}) {
  const text = userText.trim();
  // ... (기존 온도 설정 로직) ...
  let temperature = 0.7;
  const parsedUserDiseaseForTemp = Array.isArray(context.userDisease) ? context.userDisease.map(id => typeof id === 'string' ? id.toLowerCase() : '') : typeof context.userDisease === 'string' ? (() => { try { return JSON.parse(context.userDisease).map(id => typeof id === 'string' ? id.toLowerCase() : ''); } catch { return [context.userDisease.toLowerCase()]; }})() : [];
  if (parsedUserDiseaseForTemp.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d))) {
    temperature = 0.65;
  }
  
  const intent = window.LOZEE_DIALOG.detectIntent(text);
  // getSystemPrompt에 topicType도 전달하여 상황에 맞는 프롬프트 생성
  const systemPrompt = window.LOZEE_DIALOG.getSystemPrompt({ ...context, currentStage: context.currentStage || 'Stage 1', topicType: context.topicType }, intent);

  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory && Array.isArray(context.chatHistory)) {
    messages.push(...context.chatHistory);
  }
  if (text) {
    messages.push({ role: 'user', content: text });
  }

  const payload = { messages, model: 'gpt-4-turbo', temperature };
  console.log("📤 GPT 요청 페이로드:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(GPT_BACKEND_URL_GPT_DIALOG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // talk.html에서 res.ok 및 res.json()을 직접 처리하도록 fetch 응답(Promise)을 그대로 반환
    return res;

  } catch (err) {
    console.error("❌ GPT API 호출 중 네트워크 예외:", err);
    // 네트워크 오류 시에도 fetch와 유사한 응답 객체 또는 에러를 명확히 반환
    return Promise.resolve({ 
        ok: false, 
        status: 0, // 네트워크 오류를 나타내는 상태 코드 (임의)
        statusText: "Network Error",
        json: async () => ({ text: "네트워크 오류로 응답을 받을 수 없습니다.", analysis: null }) 
    });
  }
};

// getExitPrompt 함수는 기존과 동일하게 유지 가능
window.LOZEE_DIALOG.getExitPrompt = function(userName = '친구', age) {
    // ... (기존 로직)
    const effectiveAgeForExit = parseInt(localStorage.getItem('lozee_effectiveAge') || age, 10) || (parseInt(age, 10) || 0);
    return effectiveAgeForExit >= 56
        ? `${userName}님, 오늘 대화 고맙습니다. 언제든 편하게 다시 찾아주세요.`
        : `${userName}아, 오늘 이야기 나눠줘서 고마워! 다음에 또 재미있는 이야기하자!`;
};

