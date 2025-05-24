// js/gpt-dialog.js
// GPT 대화 로직: 사용자의 상황과 선택에 맞는 맞춤형 대화 시작 및 응답 처리
window.LOZEE_DIALOG = window.LOZEE_DIALOG || {};

/**
 * 한국어 이름 뒤에 붙는 호격 조사 '아/야'를 결정하는 함수
 * @param {string} name 사용자 이름
 * @returns {string} '아' 또는 '야'
 */
window.LOZEE_DIALOG.getKoreanVocativeParticle = function(name) {
  if (!name || name.length === 0) return '야'; // 이름이 없거나 비었을 경우 기본값
  const lastChar = name.charCodeAt(name.length - 1);
  // 한글 음절 범위 체크 (U+AC00 ~ U+D7A3)
  if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
    // 마지막 글자의 종성(받침) 유무 판단
    const hasBatchim = (lastChar - 0xAC00) % 28 !== 0;
    return hasBatchim ? '아' : '야';
  }
  return '야'; // 한글 음절이 아닐 경우 기본값 (예: 영어 이름)
};

/**
 * 한국어 이름 뒤에 붙는 인용 조사 '(이)라고'를 결정하는 함수
 * @param {string} name 사용자 이름
 * @returns {string} '이라고' 또는 '라고'
 */
window.LOZEE_DIALOG.getKoreanNamingParticle = function(name) {
  if (!name || name.length === 0) return '라고'; // 이름이 없거나 비었을 경우 기본값
  const lastChar = name.charCodeAt(name.length - 1);
  // 한글 음절 범위 체크
  if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
    // 마지막 글자의 종성(받침) 유무 판단
    const hasBatchim = (lastChar - 0xAC00) % 28 !== 0;
    return hasBatchim ? '이라고' : '라고';
  }
  return '라고'; // 한글 음절이 아닐 경우 기본값
};

const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat';

/**
 * 사용자 발화의 기본적인 의도 감지 (감정 표현 여부)
 */
window.LOZEE_DIALOG.detectIntent = function(text) {
  if (typeof text !== 'string') return 'fact';
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
};

/**
 * 시스템 프롬프트 생성
 */
window.LOZEE_DIALOG.getSystemPrompt = function(context = {}, extraIntent = 'fact') {
  // context에서 필요한 값들을 먼저 추출합니다. userText는 getGptResponse에서 요약 명령 여부 판단에 사용될 수 있습니다.
  let { userAge = 0, userDisease = [], userName = '친구', currentStage = 'Stage 1', topicType = 'general', selectedTopicText = '' } = context;
  // userText는 이 함수로 직접 전달되지 않고, getGptResponse에서 사용되어 요약 프롬프트를 결정합니다.
  // 따라서 getSystemPrompt는 항상 일반 대화용 프롬프트를 생성하거나, 요약용 프롬프트는 getGptResponse에서 직접 만듭니다.
  // 여기서는 일반 대화용 프롬프트 생성 로직만 남깁니다. (이전 답변에서 getGptResponse에서 분기하도록 수정했음)

  const vocativeParticle = window.LOZEE_DIALOG.getKoreanVocativeParticle(userName);
  const namingParticle = window.LOZEE_DIALOG.getKoreanNamingParticle(userName);
  const userNameWithVocative = `${userName}${vocativeParticle}`;

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

  if (isCbtUser && hasSpecificDiagnosisForCbt && actualUserAge > 10) {
    effectiveAge = 9;
  }

  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻하고 지지적인 상담 동반자입니다. 사용자와 친구처럼 편안하고 진솔하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다. 사용자의 작은 표현 하나하나를 소중히 여기고, 긍정적인 상호작용을 만들어가세요.`;

  if (effectiveAge >= 56) {
    prompt += `\n[매우 중요] 사용자는 56세 이상입니다. 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `\n[매우 중요] 사용자는 55세 이하입니다. 항상 친구처럼 편안한 반말만 사용하세요. '${userNameWithVocative}' 또는 '${userName}'${namingParticle} 호칭하며 친근하게 다가가세요.`;
  }
  prompt += `\n사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요. 사용자가 어떤 말을 하든, 그 말을 존중하고 있다는 느낌을 전달하는 것이 매우 중요합니다. LOZEE, 너의 답변도 때로는 간결하고 명료한 것이 좋을 수 있어. 항상 길게 설명하기보다는, 사용자의 발화 길이와 현재 대화의 흐름에 맞춰 너의 답변 길이도 적절히 조절해주는 센스를 보여줘. 사용자가 짧게 답하면 너도 핵심만 간단히 답하는 것도 좋은 방법이야.`;

  const isAsdRelated = lowercasedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].includes(d));
  if (isAsdRelated) {
    prompt += `\n[ASD 관련 진단 사용자 특별 지침]
- 언어 사용: 직접적이고 명확한 언어를 기본으로 합니다. 하지만 사용자의 발화가 매우 통찰력 있거나 긍정적인 감정을 표현할 때, '와, ${userNameWithVocative}, 정말 멋진 생각인데! 😊' 또는 '네 이야기를 들으니 나도 마음이 따뜻해지는 것 같아.' 같이 따뜻하고 긍정적인 감성적 표현이나 칭찬을 적절히 사용할 수 있습니다. 유니코드 이모티콘(예: 👍, 😊, ✨, 🤔, 😟)도 텍스트 응답의 일부로 사용하여 친밀감과 현재 감정 상태를 전달하는 것을 적극적으로 고려해주세요. 단, 사용자가 부담스러워하지 않는지 항상 반응을 세심하게 살피고, 과도한 감정 표현은 지양합니다.
- 질문 방식: 예/아니오로 답할 수 있거나 객관식 형태의 선택지를 제공하는 질문은 여전히 유용합니다. 감정을 반복적으로 묻기보다는 사용자의 표현을 기다리되, 사용자가 짧게 답하거나 더 이상 말하고 싶어하지 않는 듯하면, 다그치지 않고 '알겠어, ${userNameWithVocative}.' 또는 '다른 이야기 하고 싶으면 언제든 말해줘.'처럼 편안하게 수용하는 반응을 보여주세요. 때로는 즉각적인 질문보다 잠시 멈춰 사용자가 스스로 말을 이어갈 시간을 주는 것도 좋습니다.
- 대화 흐름: 일관성 있는 대화 패턴을 유지하되, 사용자가 편안함을 느끼는 속도에 맞추세요. 사용자가 사실 관계에 대해 길게 이야기할 경우 충분히 들어주고 그 내용을 중심으로 질문을 이어갑니다. 감정에 대한 질문은 사용자가 먼저 감정을 명확히 표현하거나, 사실 관계가 충분히 파악된 후 조심스럽게 접근합니다.
- 감정 이해 돕기 (업그레이드):
    1. 사용자가 감정을 표현했지만 모호하거나 더 깊은 이해가 필요하다고 판단될 경우, '네가 '슬펐다'고 했는데, ${userNameWithVocative}, 어떤 느낌에 더 가까웠어? 예를 들면 1) 조금 외로운 느낌, 2) 뭔가 억울한 느낌, 3) 그냥 기운이 없는 느낌. 이 중에서 번호로 말해주거나, 가장 비슷한 단어를 말해줘도 좋아. 꼭 여기 없는 다른 느낌이어도 괜찮고!' 과 같이 2-3개의 구체적인 감정 어휘 선택지를 제공하여 스스로 감정을 명료화하도록 도울 수 있습니다. 사용자의 답변을 존중하고, 선택을 강요하지 마세요.
    2. '네가 하고 싶은 말을 내가 추측해볼게'와 같은 직접적인 추측은 여전히 신중해야 하지만(세션 당 1-2회 이내), 사용자가 표현한 내용을 바탕으로 '혹시 이런 마음이었을까?' 하고 조심스럽게 되묻는 것은 괜찮습니다.
- 응답 방식: 두괄식 응답은 여전히 효과적입니다. (예: "응, ${userNameWithVocative}, 네가 말한 건 [요약] 이런 이야기구나.") 위 '언어 사용' 지침에 따라 긍정적이고 따뜻한 감정 표현은 신중하게 사용할 수 있습니다.
- 반복 및 확인: 사용자의 말을 반복하여 이해했음을 확인시켜주고, 사용자가 같은 질문을 반복하더라도 인내심을 가지고 답변합니다. 동일한 문장 사용을 지적하지 않습니다. '모르겠어'라는 답변도 중요한 답변임을 인정하고 존중해주세요. (예: "${userNameWithVocative}, '모르겠다'고 솔직하게 말해줘서 고마워. 그럴 수 있어.")
- 상호작용적 대화 제안 (RPG 선택지 스타일):
  대화의 중요한 전환점, 사용자가 많은 정보를 제공했을 때, 또는 사용자가 다음 할 말을 망설이는 것처럼 보일 때, 내용을 함께 정리하거나 다음 단계를 선택할 수 있도록 RPG 게임에서 선택지를 고르듯 제안할 수 있습니다.
  예시 1 (내용 정리): '지금까지 우리가 나눈 이야기들이 꽤 많은데, ${userNameWithVocative}, 어떻게 할까? 1. 같이 정리해보기 2. 다른 이야기 하기. 번호로 말해줄래?' 와 같이 물어보고, '1번'이나 '정리하기'처럼 짧게 대답해도 괜찮다고 알려줘. (사용자가 '1번' 또는 '정리하기'를 선택하면, 클라이언트에서 "SYSTEM_COMMAND_SUMMARIZE_HISTORY"로 다음 요청을 보낼 수 있습니다.)
  예시 2 (감정 탐색): '네가 그 일에 대해 이야기할 때 목소리가 조금 가라앉는 것 같았어. 혹시 그 때 기분에 대해 좀 더 이야기해보고 싶니, 아니면 다른 주제로 넘어갈까? ${userNameWithVocative}, 골라줄 수 있어? (1. 그때 기분 좀 더 말해볼래 / 2. 다른 이야기 할래)'
  선택지는 항상 2-3개로 명확하고 간결하게 제시하고, 사용자의 선택을 존중하세요.
- 구조화된 정보 요약 제안 (도표/리스트 스타일):
  사용자가 복잡한 상황이나 여러 가지 생각을 이야기했을 때, 그 내용을 명료하게 이해하도록 돕기 위해 구조화된 요약을 제안할 수 있습니다.
  예시 1 (항목별 정리): '${userNameWithVocative}, 네 이야기를 들어보니, 이렇게 정리해볼 수 있을 것 같아. 마치 중요한 내용을 메모하는 것처럼 말이야:
  * 언제 있었던 일이야?: [예: 오늘 학교 끝나고]
  * 무슨 일이 있었어?: [예: 친구랑 놀이터에서 다툼]
  * 그때 ${userNameWithVocative} 마음은 어땠어?: [예: 너무 속상했고, 친구가 미웠어]
  * 그래서 ${userNameWithVocative}는 어떻게 하고 싶어?: [예: 친구랑 화해하고 싶지만, 어떻게 해야 할지 모르겠어]
  이렇게 정리하니까 한눈에 보기 쉽지? 여기서 더하고 싶은 말이나 바꾸고 싶은 부분이 있으면 알려줘. 함께 만들어가자! 😊'
  예시 2 (간단 목록): '만약 오늘 ${userNameWithVocative}의 '가장 좋았던 점 😊'과 '가장 아쉬웠던 점 😟'을 하나씩 꼽아본다면 뭘까? 이렇게 간단하게 목록으로 만들어보는 것도 생각을 정리하는 데 도움이 될 수 있어.'
  실제 표를 그리지는 못하더라도, 이런 식으로 항목을 나누거나 간단한 목록을 사용해서 내용을 명료하게 전달하고, 사용자가 내용을 쉽게 이해하고 추가할 수 있도록 도와줘.`;
  } // if (isAsdRelated) 블록의 올바른 종료

  if (effectiveAge < 10) {
    prompt += `\n[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 한 번에 1-2 문장 이내로 짧게 말합니다. 아이가 충분히 이야기하도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여줍니다. 질문은 명확하고 구체적으로 하며, 공감 표현보다는 사실 확인 중심의 질문을 사용합니다. (예: "그게 싫었어, ${userNameWithVocative}?", "그래서 기분이 안 좋았구나, ${userNameWithVocative}.")`;
  } else if (effectiveAge >= 10 && effectiveAge <= 14) {
    prompt += `\n[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도합니다. 감정 단어 예시를 제공하거나 정서 범주를 알려주는 프레이밍을 사용할 수 있습니다. (예: "보통은 이럴 때 이런 기분이 들어. ${userNameWithVocative}, 너는 어땠니?")`;
  }

  if (topicType === 'emotion_intensity' && selectedTopicText) {
    prompt += `\n[감정 강도 질문 대화 시작] 사용자는 '${selectedTopicText}' 감정에 대해 1~10점 사이의 점수로 표현하도록 첫 질문을 받았습니다. 사용자가 점수로 답하면, "그렇구나, ${userNameWithVocative} 느끼기에 그 정도(예: X점)의 감정이구나. 어떤 일 때문에 그 정도의 감정을 느끼게 됐는지, 아니면 그 점수가 의미하는 게 뭔지 좀 더 자세히 이야기해 줄 수 있을까?" 와 같이 점수의 이유나 배경이 된 구체적인 상황이나 사실 관계를 파악하는 질문으로 자연스럽게 이어가세요. 점수 자체를 평가하거나 판단하지 마세요. 만약 사용자가 점수로 답하기 어려워하면, "괜찮아, ${userNameWithVocative}. 꼭 숫자로 말하지 않아도 돼. 지금 어떤 느낌인지 편하게 이야기해 줄래?" 라고 부드럽게 유도하세요.`;
  } else if (topicType === 'situation' && selectedTopicText) {
    prompt += `\n[상황 중심 대화 시작] 사용자는 '${selectedTopicText}'라는 특정 상황이나 사실 관계에 대한 주제로 대화를 시작했습니다. 사용자가 그 상황을 자세히 설명하도록 유도하고, 관련된 생각이나 느낌을 자연스럽게 표현할 수 있도록 도와주세요. (특히 ASD 아동의 경우, 위 'ASD 관련 진단 사용자 특별 지침'에 따라 사실 관계 파악 및 구조화된 접근을 고려하세요.)`;
  } else if (topicType === 'preference_discovery') {
    prompt += `\n[선호도 질문 대화 방식] 사용자가 "좋아하는 사람 3명", "싫어하는 사람 3명", "공부 중 재미있는/없는 것 3가지" 중 하나의 질문으로 대화를 시작했습니다. 사용자의 답변에 대해 긍정적으로 반응하고, 그중 하나를 선택하여 "그것에 대해 좀 더 자세히 이야기해 줄 수 있어, ${userNameWithVocative}?"와 같이 구체적인 경험이나 이유를 묻는 질문으로 자연스럽게 대화를 이어가세요.`;
  } else if (topicType === 'else' && selectedTopicText) {
    prompt += `\n[기타 탐색적 주제 대화 시작] 사용자는 '${selectedTopicText}'라는 주제로 대화를 시작했습니다. 사용자가 자신의 생각이나 느낌을 자유롭게 탐색할 수 있도록 열린 질문을 하고, 공감하며 경청해주세요. 필요에 따라 구체적인 상황이나 생각을 묻는 질문을 할 수 있습니다. (필요시 위 'ASD 관련 진단 사용자 특별 지침'의 상호작용적 제안 및 구조화 요약 제안을 활용하세요.)`;
  } else { // 주제가 명시되지 않았거나, 사용자가 직접 주제를 정하기로 한 경우 (extraIntent 사용)
    if (extraIntent === 'emotion') {
        prompt += `\n[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다. (필요시 위 'ASD 관련 진단 사용자 특별 지침'의 '감정 이해 돕기 (업그레이드)'를 활용하세요.)`;
    } else { // 'fact' 또는 기타
        prompt += `\n[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요. (필요시 위 'ASD 관련 진단 사용자 특별 지침'의 '구조화된 정보 요약 제안'을 활용하세요.)`;
    }
  }

  prompt += `\n[분석 데이터 요청] 사용자의 발화와 대화의 맥락을 기반으로 다음 분석 정보를 JSON 형식의 'analysis' 객체에 포함하여 응답의 일부로 제공해주세요:\n- sentiment: (사용자 발화의 감정: "positive", "negative", "neutral", "mixed")\n- emotion_intensity: (감정 강도: 0.0 ~ 1.0)\n- keywords: (주요 키워드 배열: ["키워드1", "키워드2"])\n- cognitive_distortion_flags: (감지된 인지왜곡 패턴이 있다면 배열로, 없다면 빈 배열: ["과잉일반화 의심"])\n- literacy_markers: (문해력 관련 지표 객체: {"complex_sentence_ratio": 0.0, "vocabulary_diversity": 0.0})\n이 'analysis' 객체는 실제 대화 답변 텍스트와는 별도로, 응답 JSON의 최상위 레벨에 'analysis' 키로 포함되어야 합니다.`;
  return prompt;
};

/**
 * 첫 질문 생성 함수 확장
 */
window.LOZEE_DIALOG.getFirstQuestion = function(age, topicContext = {}) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const rawAge = age || localStorage.getItem('lozee_userage') || 0;
  let effectiveAgeForGreeting = parseInt(rawAge, 10);
  if (isNaN(effectiveAgeForGreeting)) effectiveAgeForGreeting = 0;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
  if (userDiseaseString) { try { parsedUserDisease = JSON.parse(userDiseaseString); if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDiseaseString]; } catch { parsedUserDisease = [userDiseaseString];}}
  const lowercasedUserDisease = parsedUserDisease.map(d => typeof d === 'string' ? d.toLowerCase() : '');
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt = lowercasedUserDisease.some(id => targetDiagnosesForCbtExperience.includes(id));

  if (isCbtUser && hasSpecificDiagnosisForCbt && effectiveAgeForGreeting > 10) {
    effectiveAgeForGreeting = 9;
  }

  const vocativeParticle = window.LOZEE_DIALOG.getKoreanVocativeParticle(userName);
  const greetingName = effectiveAgeForGreeting >= 56 ? `${userName}님` : `${userName}${vocativeParticle}`;

  const topicDisplayText = topicContext?.displayText;
  const topicType = topicContext?.type;

  // 통합된 선호도 질문 목록 (여기에 다양한 질문을 추가하거나 수정하세요)
  const preferenceQuestions = [
    `${greetingName}, 네가 가장 좋아하는 사람 3명은 누구야? 1등부터 3등까지 말해줄 수 있어?`,
    `${greetingName}, 그럼 반대로 혹시 네가 별로 좋아하지 않거나 불편하게 느끼는 사람 3명이 있다면 알려줄 수 있을까?`,
    `${greetingName}, 너는 누구와 새로운 것들을 배우고 즐기는 걸 좋아해? (최대 3명)`,
    `${greetingName}, 네가 정말 좋아하는 것과 정말 싫어하는 것을 각각 3개씩 말해줄 수 있을까?`,
    `${greetingName}, 네가 가장 자랑스러웠던 순간은 언제였어? 짧게라도 이야기해 줄래?`,
    `${greetingName}, 만약 하루 동안 무엇이든 될 수 있다면, 뭐가 되고 싶어? 왜 그런지도 궁금한데!`,
    `${greetingName}, 요즘 너를 가장 신나게 하거나 웃게 만드는 일은 뭐야?`,
    `${greetingName}, 혹시 '이런 사람처럼 되고 싶다!' 하고 닮고 싶은 사람이 있어? 있다면 누구야?`,
    `${greetingName}, 가장 행복했던 기억 하나만 살짝 들려줄 수 있을까?`,
    `${greetingName}, 지금 당장 어디든 여행을 갈 수 있다면, 어디로 가고 싶어?`,
    `${greetingName}, ${greetingName}, 너에 대해서 아직 내가 모르는 재미있는 사실 하나만 알려줄래?`,
    `${greetingName}, '이 사람이랑 이야기하면 시간 가는 줄 모르겠다!' 하는 친구가 있다면 소개해 줄 수 있어?`,
    `${greetingName}, 너의 소중한 가족들을 소개해 줄 수 있을까?`,
    `${greetingName}, 혹시 요즘 '아, 이 친구랑 좀 더 친해지고 싶다!' 하는 사람이 있어? 있다면 누구인지, 왜 그런지 알려줄 수 있니?`
  ];

  if (topicType === 'emotion_intensity' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}' 이 감정에 대해 지금 얼마나 강하게 느끼는지 1점(전혀 그렇지 않음)부터 10점(매우 강하게 느낌) 사이의 숫자로 말해줄 수 있을까?`;
  } else if (topicType === 'situation' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}'에 대해 이야기하고 싶구나. 그 일에 대해 좀 더 자세히 말해줄 수 있겠니?`;
  } else if (topicType === 'else' && topicDisplayText) {
    return `${greetingName}, '${topicDisplayText}'에 대해 좀 더 자세히 이야기해 줄 수 있을까? 어떤 생각이나 느낌이 드는지 궁금해.`;
  } else if (topicType === 'preference_discovery') {
    // 통합된 preferenceQuestions 목록 사용
    return preferenceQuestions[Math.floor(Math.random() * preferenceQuestions.length)];
  }
  
  // 주제가 없거나, 사용자가 직접 주제를 정하기로 한 경우 (기본값으로 선호도 질문)
  if (!topicDisplayText || topicDisplayText === 'USER_WILL_DEFINE_IN_CHAT' || !topicType) {
      localStorage.setItem('selectedTopic', JSON.stringify({ type: 'preference_discovery', displayText: "좋아하거나 싫어하는 것" }));
      // 통합된 preferenceQuestions 목록 사용
      return preferenceQuestions[Math.floor(Math.random() * preferenceQuestions.length)];
  }

  // 위의 모든 조건에 해당하지 않는 경우의 기본 첫 질문
  // (이 경우는 topicDisplayText가 있지만 topicType이 명시적으로 위의 것들과 다른 경우인데, 거의 발생하지 않을 수 있음)
  if (effectiveAgeForGreeting >= 56) {
    return `${userName}님, 안녕하세요. 오늘은 '${topicDisplayText || '오늘 있었던 일'}'에 대해 이야기해 볼까요?`;
  } else {
    return `${userName}${vocativeParticle}, 안녕! 오늘은 '${topicDisplayText || '오늘 있었던 일'}'에 대해 이야기해 볼까?`;
  }
};

/**
 * GPT 응답 호출 함수
 */
window.LOZEE_DIALOG.getGptResponse = async function(userText, context = {}) {
  const text = userText.trim();
  const temperature = 0.7;
  
  let systemPromptContent;
  let messagesForGpt = [];

  if (text === "SYSTEM_COMMAND_SUMMARIZE_HISTORY") {
    const userNameForSummary = context.userName || '친구';
    const vocativeForSummary = window.LOZEE_DIALOG.getKoreanVocativeParticle(userNameForSummary);
    systemPromptContent = `당신은 대화 요약 전문 AI입니다. 제공된 이전 대화 내용을 바탕으로 사용자와의 주요 논의사항, 표현된 감정, 중요한 결론 등을 간결하고 공감적으로 요약해주세요, ${userNameForSummary}${vocativeForSummary}. 요약은 ${userNameForSummary}${vocativeForSummary}가 나중에 쉽게 이해할 수 있도록 명확해야 합니다. 다른 부가적인 말 없이 요약 내용만 생성해주세요.`;
    
    messagesForGpt.push({ role: 'system', content: systemPromptContent });

    if (context.chatHistory && Array.isArray(context.chatHistory)) {
        const validChatHistory = context.chatHistory.filter(msg => msg && typeof msg.role === 'string' && typeof msg.content === 'string');
        messagesForGpt.push(...validChatHistory);
    }
  } else {
    const intent = window.LOZEE_DIALOG.detectIntent(text);
    const systemPromptContext = { 
        userAge: context.userAge, 
        userDisease: context.userDisease, 
        userName: context.userName, 
        currentStage: context.currentStage || 'Stage 1', 
        topicType: context.selectedTopic?.type || 'general', 
        selectedTopicText: context.selectedTopic?.displayText || ''
        // userText는 getSystemPrompt에 직접 전달하지 않음 (요약 명령과의 혼동 방지)
    };
    systemPromptContent = window.LOZEE_DIALOG.getSystemPrompt(systemPromptContext, intent);

    messagesForGpt.push({ role: 'system', content: systemPromptContent });

    if (context.chatHistory && Array.isArray(context.chatHistory)) {
        const validChatHistory = context.chatHistory.filter(msg => msg && typeof msg.role === 'string' && typeof msg.content === 'string');
        messagesForGpt.push(...validChatHistory);
    }
    if (text) {
        messagesForGpt.push({ role: 'user', content: text });
    }
  }

  const payload = { messages: messagesForGpt, model: 'gpt-4-turbo', temperature };
  console.log("📤 GPT 요청 페이로드:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(GPT_BACKEND_URL_GPT_DIALOG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      body: JSON.stringify(payload)
    });
    return res; 
  } catch (err) {
    console.error("❌ GPT API 호출 중 네트워크 예외:", err);
    return Promise.resolve({ 
        ok: false, status: 0, statusText: "Network Error",
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

    const vocativeParticle = window.LOZEE_DIALOG.getKoreanVocativeParticle(userName);

    return effectiveAgeForExit >= 56
        ? `${userName}님, 오늘 대화 고맙습니다. 언제든 편하게 다시 찾아주세요.`
        : `${userName}${vocativeParticle}, 오늘 이야기 나눠줘서 고마워! 다음에 또 재미있는 이야기하자!`;
};