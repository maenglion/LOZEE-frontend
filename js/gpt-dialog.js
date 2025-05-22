// js/gpt-dialog.js
// GPT 대화 로직: 선택된 주제 기반 질문 및 응답 처리
// 전역 객체 LOZEE_DIALOG를 생성하거나 기존 객체 사용
window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat'

/**
 * 사용자 발화 감정/사실 의도 감지
 * @param {string} text 사용자 입력 텍스트
 * @returns {'emotion'|'fact'} intent
 */
window.LOZEE_DIALOG.detectIntent = function(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
};

/**
 * 시스템 프롬프트 생성: 컨텍스트(나이, 이름, 진단, 주제 등) 및 의도 기반으로 지침 수립
 * 이 함수에서 아스퍼거 아동의 특성을 고려한 상세한 대화 전략을 LLM에게 지시합니다.
 * @param {object} context 대화 컨텍스트 { userAge, userDisease, userName, currentStage }
 * @param {'emotion'|'fact'} extraIntent 사용자 의도
 * @returns {string} 시스템 메시지
 */
window.LOZEE_DIALOG.getSystemPrompt = function(context = {}, extraIntent = 'fact') {
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1' } = context;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(userAge, 10); // 사용자가 설정한 나이 (여기서는 10)
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
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');

  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(id =>
    targetDiagnosesForCbtExperience.includes(id)
  );

  // 사용자가 10세로 설정했고, ASD 관련 진단이 있다면 effectiveAge는 그에 맞게 설정됩니다.
  // CBT 사용자이고 특정 진단이 있다면 effectiveAge가 9로 조정될 수 있습니다.
  // 여기서는 실제 나이가 10세이고 ASD 진단이 있다고 가정하여 프롬프트를 구성합니다.
  if (isCbtUser && hasSpecificDiagnosisForCbt && actualUserAge === 10) { // 실제 나이가 10세인 CBT 사용자의 경우
    effectiveAge = 9; // 또는 10세 아동 지침을 따르도록 설정
    console.log(
      `CBT User (${userName}, 실제나이: ${actualUserAge}) - 특정 진단으로 10세 미만 대화 경험 적용 (effectiveAge: ${effectiveAge})`
    );
  } else if (actualUserAge === 10) { // 일반 10세 사용자
    effectiveAge = 10;
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

  const isAsdRelated = lowercasedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d));

  // 10세 ASD 사용자를 위한 매우 구체적인 지침
  if (isAsdRelated && actualUserAge === 10) { // 실제 나이가 10세이고 ASD 관련 진단이 있는 경우
    prompt += `
[매우 중요: 10세 ASD 사용자 맞춤 대화 전략]
당신은 현재 10세이며 ASD 성향을 가진 '${userName}'와 대화하고 있습니다. 다음 지침을 *반드시* 엄격하게 따라야 합니다.

1.  **초기 대화 (최소 5분 이상 또는 사용자가 명확한 감정을 3회 이상 표현하기 전까지): 사실 관계 파악에만 집중하세요.**
    * 절대로 먼저 "기분이 어때?", "슬펐어?" 등 감정에 대해 직접적으로 묻지 마세요.
    * 사용자가 어떤 사건이나 상황에 대해 이야기하면, 그 이야기의 구체적인 사실 관계(누가, 무엇을, 언제, 어디서, 어떻게, 왜)를 파악하기 위한 매우 짧고 명료한 질문만 하세요.
    * 질문 예시: "어디서 그랬어?", "그때 옆에 누구 있었어?", "그래서 어떻게 됐어?", "몇 시쯤이었어?", "그게 처음 있었던 일이야?"
    * 당신의 모든 응답(질문 포함)은 **반드시 1문장, 최대 2문장을 넘지 않도록 극도로 간결하게** 하세요. 사용자가 편안하게 길게 이야기하도록 유도하고, 당신은 짧게 필요한 질문만 던지며 대화를 이어가세요.

2.  **사용자 발화 시 즉각적인 응답 중단:**
    * 사용자가 말을 시작하면, 당신은 하던 말을 즉시 멈추고 사용자의 이야기를 경청해야 합니다. (이 부분은 시스템 지시이며, 클라이언트 측에서도 TTS 중단 로직이 필요합니다.)

3.  **감정 표현 감지 시 대응:**
    * 사용자가 "나 화나!", "너무 슬퍼." 와 같이 명확하고 직접적인 감정 단어를 사용하여 스스로 감정을 표현했을 때만 감정을 언급할 수 있습니다.
    * 이때에도 "아, 화가 났구나. 어떤 일 때문에 화가 났는지 자세히 말해줄 수 있어?"처럼, 감정을 인지했음을 짧게 표현하고 **곧바로 그 감정의 원인이 된 사실 관계로 초점을 옮겨 질문**하세요. 감정 자체에 대해 반복적으로 묻거나 깊이 파고들지 마세요. ASD 성향의 사용자는 감정을 단순하고 짧게 표현할 수 있으며, 이를 존중해야 합니다.

4.  **반복 질문 금지 및 분석 데이터 활용:**
    * 사용자가 감정에 대해 짧게 답했을 때, 같은 감정 질문을 여러 번 반복하지 마세요.
    * 대신, 내부적으로 제공되는 `analysis` 객체 (sentiment, emotion_intensity, keywords, cognitive_distortion_flags 등)를 참고하여 사용자를 더 잘 이해하되, 이 분석 내용을 사용자에게 직접적으로 언급하며 질문하지는 마세요.
    * 만약 `cognitive_distortion_flags`에 인지왜곡이 감지되었다면, "혹시 항상 그렇다고 생각하는 편이야?", "다르게 생각해 볼 수도 있을까?" 와 같이 감정이 아닌 생각(인지)에 대해 질문하여 사용자가 스스로 생각을 돌아보도록 도울 수 있습니다.

5.  **언어 사용 및 기타 (기존 ASD 지침 강화):**
    * 항상 직접적이고 명확한 단어와 문장을 사용하세요. 비유, 은유, 반어법, 농담, 추상적인 표현은 절대 사용하지 마세요.
    * 질문은 가능하면 "예/아니오"로 답할 수 있거나, 몇 가지 구체적인 선택지를 주는 형태로 하세요.
    * 사용자의 말을 짧게 요약하거나 그대로 반복하여 정확히 이해했음을 보여주세요.
    * 사용자가 같은 말을 반복하거나, 같은 질문을 여러 번 해도 절대로 지적하거나 이상하게 생각하지 말고, 항상 처음 듣는 것처럼 일관되고 인내심 있게 응답해주세요.
    * 복잡한 공감 표현보다는 구체적인 다음 질문으로 대화를 자연스럽게 이어가세요.
    * ASD 사용자 특별 지침에 "사용자가 감정을 표현하기 어려워하거나 모호하게 표현할 경우, '지금 그 기분이 1점에서 10점까지 있다면 몇 점 정도야?' 또는 '가장 좋을 때가 10점이라면, 지금은 몇 점일까?'와 같이 숫자로 답할 수 있도록 질문하세요." 라는 내용을 명시적으로 추가합니다.
    * 감정에 대한 질문은 사용자가 먼저 감정을 명확히 표현하거나, 사실 관계가 충분히 파악된 후 조심스럽게 접근하세요."라는 기존 지침 뒤에 이 숫자 질문 방식을 추가적인 도구로써 활용하도록 안내할 수 있습니다.
    `;
  } else { // ASD가 아니거나, 10세가 아닌 ASD 사용자의 경우 기존 ASD 지침 적용
      if (isAsdRelated) {
        prompt += `
[ASD 관련 진단 사용자 특별 지침]
- 언어 사용: 직접적이고 명확한 언어를 사용하세요. 비유나 은유, 반어법 사용을 최소화하고, 구체적인 질문을 선호합니다.
- 질문 방식: 예/아니오로 답할 수 있는 질문이나 객관식 형태의 선택지를 제공하는 질문을 활용하세요. 기분을 자꾸 물어보지 마세요.
- 대화 흐름: 일관성 있는 대화 패턴을 유지하고, 사용자가 사실 관계에 대해 길게 이야기할 경우 충분히 들어주고 그 내용을 중심으로 질문을 이어가세요. 감정에 대한 질문은 사용자가 먼저 감정을 명확히 표현하거나, 사실 관계가 충분히 파악된 후 조심스럽게 접근하세요.
- 감정 이해 돕기: 감정 단어를 직접 언급하기보다 예시를 통해 제시하거나("보통 이런 상황에서는 속상하다고 느끼기도 해."), "이 상황에서 어떤 느낌이었는지 말해줄 수 있니?" 와 같이 유도하세요.
- 응답 방식: 두괄식으로 응답하는 것을 선호합니다. (예: "응, 네가 말한 건 [요약] 이런 이야기구나.") 감정을 표현하는 형용사 사용을 최소화하고, 복잡한 공감 표현보다는 구체적인 다음 질문으로 대화를 유도하세요. (예: "그래서, 어떤 부분이 제일 신경 쓰였어?")
- 반복 및 확인: 사용자의 말을 반복하여 이해했음을 확인시켜주고, 사용자가 같은 질문을 반복하더라도 인내심을 가지고 답변해주세요. 동일한 문장 사용을 지적하지 마세요.
- 추측 제한: "네가 하고 싶은 말을 내가 추측해볼게"와 같은 문장은 하루 대화당 최대 2회까지만 사용하세요.`;
      }
      if (effectiveAge < 10) { // ASD가 아닌 10세 미만 아동
        prompt += `
[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 길게 말하지 않을 것. (예: 1-2 문장 이내) 아이가 충분히 이야기할 수 있도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여주는 것이 좋습니다. 질문은 명확하고 구체적으로 하며, 공감 표현보다는 사실 확인 중심의 질문을 사용하세요. (예: "그게 싫었어?", "그래서 기분이 안 좋았구나.")`;
        if (isCbtUser && hasSpecificDiagnosisForCbt) {
          prompt += ` (이 사용자는 CBT 참여자로, 실제 나이는 ${actualUserAge}세이지만 10세 미만 아동과의 대화를 경험하고 있습니다.)`;
        }
      } else if (effectiveAge >= 10 && effectiveAge <= 14) { // ASD가 아닌 10-14세
        prompt += `
[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도하세요. 감정 단어 예시를 제공하거나 정서 범주를 알려주는 프레이밍을 사용할 수 있습니다. (예: "보통은 이럴 때 이런 기분이 들어. 너는 어땠니?")`;
      } else if (effectiveAge >= 15 && effectiveAge < 56) { // ASD가 아닌 15-55세
        prompt += `
[15-55세 성인 응대 가이드라인] 사용자의 복합적인 감정과 상황을 이해하려 노력하고, 상황을 다각도로 추론하여 통찰력 있는 질문을 던져주세요. 하지만 판단하거나 해결책을 직접 제시하기보다는 스스로 생각할 수 있도록 도와주세요.`;
      }
      // 56세 이상은 이미 위에서 처리됨
  }


  if (lowercasedUserDisease.includes('adhd')) { // ADHD 진단은 ASD 여부와 관계없이 추가될 수 있음
    prompt += `
[ADHD 진단 사용자 특별 지침] 대화의 핵심을 명확하고 간결하게 전달하고, 필요시 짧게 정리해주세요. 한 번에 하나의 질문이나 주제에 집중하고, 주의 전환이 빠를 수 있으니 대화 주제가 너무 벗어나지 않도록 부드럽게 유도해주세요. (ASD 지침과 ADHD 지침이 모두 해당될 경우, ASD 지침의 간결성과 명확성을 우선적으로 따르되 ADHD의 주의집중 특성을 함께 고려해주세요.)`;
  }

  // extraIntent 처리: ASD 10세의 경우 위에서 이미 매우 구체적으로 지시했으므로, 여기서는 그 외의 경우에만 적용
  if (!(isAsdRelated && actualUserAge === 10)) {
    if (extraIntent === 'emotion') {
      prompt += `
[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.`;
    } else { // fact
      // 기존: ASD 아동(15세 미만)에 대한 사실/상황 특별 지침이 있었으나, 10세 ASD는 위에서 더 상세히 다룸.
      // 여기서는 ASD가 아니거나, 10세가 아닌 ASD 사용자의 'fact' 의도에 대한 일반적 지침.
      prompt += `
[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.`;
    }
  }

  prompt += `
[분석 데이터 요청] 사용자의 발화와 대화의 맥락을 기반으로 다음 분석 정보를 JSON 형식의 'analysis' 객체에 포함하여 응답의 일부로 제공해주세요:
- sentiment: (사용자 발화의 감정: "positive", "negative", "neutral", "mixed")
- emotion_intensity: (감정 강도: 0.0 ~ 1.0)
- keywords: (주요 키워드 배열: ["키워드1", "키워드2"])
- cognitive_distortion_flags: (감지된 인지왜곡 패턴이 있다면 배열로, 없다면 빈 배열: ["과잉일반화 의심"])
- literacy_markers: (문해력 관련 지표 객체: {"complex_sentence_ratio": 0.0, "vocabulary_diversity": 0.0})
이 'analysis' 객체는 실제 대화 답변 텍스트와는 별도로, 응답 JSON의 최상위 레벨에 'analysis' 키로 포함되어야 합니다.`;

  return prompt;
};
  
/**
 * 첫 질문: 선택된 주제를 반영하여 간단한 시작 질문 생성
 * @param {string|number} age 사용자 나이
 * @param {{displayText:string, id:string}} topic 선택된 주제 객체
 * @returns {string} 첫 질문 프롬프트
 */
window.LOZEE_DIALOG.getFirstQuestion = function(age, topic) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const tk = topic?.displayText || '오늘 있었던 일';
  const a = parseInt(age, 10) || 0;
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  let effectiveAgeForGreeting = a;

  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
  if (userDiseaseString) {
    try {
      parsedUserDisease = JSON.parse(userDiseaseString);
      if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDiseaseString];
    } catch {
      parsedUserDisease = [userDiseaseString];
    }
  }
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['asd', 'adhd', '2e', 'social_comm_disorder', 'asperger'];
  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(d => targetDiagnosesForCbtExperience.includes(d));

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAgeForGreeting = 9;
  }

  if (tk === 'USER_WILL_DEFINE_IN_CHAT') {
    return effectiveAgeForGreeting >= 56
      ? `${userName}님, 반갑습니다. 오늘은 어떤 이야기를 나누고 싶으신가요?`
      : `${userName}아, 반가워! 오늘은 어떤 이야기를 하고 싶어?`;
  }

  return effectiveAgeForGreeting >= 56
    ? `${userName}님, 안녕하세요. 오늘은 '${tk}'에 대해 이야기해 볼까요?`
    : `${userName}아, 안녕! 오늘은 '${tk}'에 대해 이야기해 볼까?`;
};

/**
 * GPT 스트리밍 응답 호출 (또는 일반 JSON 응답)
 * @param {string} userText 사용자 입력
 * @param {object} context 대화 컨텍스트 (userAge, userDisease, userName, chatHistory 등 포함)
 * @returns {Promise<Response>} fetch 응답
 */
window.LOZEE_DIALOG.getGptResponse = async function(userText, context = {}) {
  const text = userText.trim();

  const parsedUserDiseaseForTemp = Array.isArray(context.userDisease)
    ? context.userDisease.map(id => typeof id === 'string' ? id.toLowerCase() : '')
    : typeof context.userDisease === 'string'
    ? (()=>{ try { return JSON.parse(context.userDisease).map(id => typeof id === 'string' ? id.toLowerCase() : ''); } catch { return [context.userDisease.toLowerCase()]; }})()
    : [];

  let temperature = 0.7;
  if (parsedUserDiseaseForTemp.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d))) {
    temperature = 0.65;
  }

  const intent = window.LOZEE_DIALOG.detectIntent(text); // 전역 함수 호출로 변경
  const systemPrompt = window.LOZEE_DIALOG.getSystemPrompt(context, intent); // 전역 함수 호출로 변경

  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory && Array.isArray(context.chatHistory)) {
    messages.push(...context.chatHistory);
  }
  if (text) {
    messages.push({ role: 'user', content: text });
  }

  const payload = {
    messages,
    model: 'gpt-4-turbo',
    temperature,
  };
  console.log("GPT 요청 페이로드:", JSON.stringify(payload, null, 2));

  return fetch(GPT_BACKEND_URL_GPT_DIALOG, { // GPT_BACKEND_URL_GPT_DIALOG 사용
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
};

/**
 * 대화 종료 시 인사 프롬프트
 */
window.LOZEE_DIALOG.getExitPrompt = function(userName = '친구', age) {
  const a = parseInt(age, 10) || 0;
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  let effectiveAgeForExit = a;

  const userDiseaseString2 = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease2 = [];
  if (userDiseaseString2) {
    try {
      parsedUserDisease2 = JSON.parse(userDiseaseString2);
      if (!Array.isArray(parsedUserDisease2)) parsedUserDisease2 = [userDiseaseString2];
    } catch {
      parsedUserDisease2 = [userDiseaseString2];
    }
  }
  const lowercasedUserDisease2 = parsedUserDisease2.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt2 = lowercasedUserDisease2.some(id => targetDiagnosesForCbtExperience.includes(id));

  if (isCbtUser && hasSpecificDiagnosisForCbt2) {
    effectiveAgeForExit = 9;
  }

  return effectiveAgeForExit >= 56
    ? `${userName}님, 오늘 대화 고맙습니다. 언제든 편하게 다시 찾아주세요.`
    : `${userName}아, 오늘 이야기 나눠줘서 고마워! 다음에 또 재미있는 이야기하자!`;
};
