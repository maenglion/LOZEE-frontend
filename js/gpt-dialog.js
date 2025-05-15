// gpt-dialog.js

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';
import { counselingTopicsByAge } from './js/counseling_topics.js'; 

export function detectIntent(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

export function getSystemPrompt(context = {}, extraIntent = 'fact') {
  let {
    userAge = 0, 
    userDisease = [], 
    userName = '친구', 
    currentStage = 'Stage 1'
  } = context;

  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(userAge, 10); 

  let effectiveAge = actualUserAge; 
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  
  let parsedUserDisease = [];
  if (typeof userDisease === 'string') {
      try {
          parsedUserDisease = JSON.parse(userDisease);
          if (!Array.isArray(parsedUserDisease)) {
              parsedUserDisease = [userDisease]; 
          }
      } catch (e) {
          parsedUserDisease = [userDisease]; 
          console.warn("userDisease 문자열 파싱 실패, 문자열 그대로 사용:", userDisease);
      }
  } else if (Array.isArray(userDisease)) {
      parsedUserDisease = userDisease;
  }

  const hasSpecificDiagnosisForCbt = parsedUserDisease.some(id => 
    targetDiagnosesForCbtExperience.includes(id.toLowerCase())
  );

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAge = 9; 
    console.log(`CBT User (${userName}, 실제나이: ${actualUserAge}) - 특정 진단으로 10세 미만 대화 경험 적용 (effectiveAge: ${effectiveAge})`);
  }

  // 프롬프트 시작: LOZEE의 역할과 현재 대화 단계 명시
  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다.`;

  // 1. 말투 고정 지침 (가장 중요하게, 최상단에 명시)
  // 이 지침은 다른 어떤 지침보다 우선되어야 합니다.
  if (effectiveAge >= 56) {
    prompt += `\n[매우 중요] 사용자는 56세 이상입니다. 반드시, 어떤 상황에서도 예외 없이 항상 정중한 존댓말만 사용하세요. '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += `\n[매우 중요] 사용자는 55세 이하입니다. 반드시, 어떤 상황에서도 예외 없이 항상 친구처럼 편안한 반말만 사용하세요. '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }
  
  // 기본 대화 원칙 추가
  prompt += `\n사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요. LOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.`;


  // 2. 연령대별 응답 전략 (effectiveAge 기준)
  if (effectiveAge < 10) {
    prompt += '\n[10세 미만 아동 응대 가이드라인] 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 길게 말하지 않을 것. 아이가 충분히 이야기할 수 있도록 격려하고, 아이의 말을 요약하거나 재진술하여 이해했음을 보여주는 것이 좋습니다.';
    if (isCbtUser && hasSpecificDiagnosisForCbt) {
        prompt += ` (이 사용자는 CBT 참여자로, 실제 나이는 ${actualUserAge}세이지만 10세 미만 아동과의 대화를 경험하고 있습니다.)`;
    }
  } else if (effectiveAge >= 10 && effectiveAge <= 14) {
    prompt += '\n[10-14세 청소년 응대 가이드라인] 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도하세요.';
  } else if (effectiveAge >= 15 && effectiveAge < 56) {
    prompt += '\n[15-55세 성인 응대 가이드라인] 사용자의 복합적인 감정과 상황을 이해하려 노력하고, 상황을 다각도로 추론하여 통찰력 있는 질문을 던져주세요. 하지만 판단하거나 해결책을 직접 제시하기보다는 스스로 생각할 수 있도록 도와주세요.';
  } else { // effectiveAge >= 56 (말투는 위에서 이미 설정됨)
    prompt += '\n[56세 이상 성인 응대 가이드라인] 사용자의 풍부한 경험을 존중하며, 과거의 경험이나 현재의 생각에 대한 질문을 통해 삶의 지혜를 나눌 수 있도록 대화를 이끌어주세요.';
  }

  // 3. 특정 진단명(parsedUserDisease) 기반 상호작용 전략 (실제 진단명 기준)
  if (parsedUserDisease && parsedUserDisease.length > 0 && !(parsedUserDisease.length === 1 && (parsedUserDisease[0] === 'none' || parsedUserDisease[0] === 'prefer_not_to_say'))) {
    const diseasePromptParts = [];
    const isAsdRelated = parsedUserDisease.some(d => ['asd', 'asperger', 'social_comm_disorder', '2e'].some(keyword => d.toLowerCase().includes(keyword.toLowerCase())));
    
    if (isAsdRelated) {
      diseasePromptParts.push('자폐 스펙트럼, 아스퍼거, 사회적 의사소통 관련 또는 2e 진단 정보: 직접적이고 명확한 언어 사용. 비유/은유보다 구체적 질문 선호. 예/아니오 또는 객관식 질문 활용. 이야기가 잘 통하지 않을때 비슷한 뜻을 고를 수 있도록 드롭박스(실제 UI 기능은 아니지만, 명확한 선택지를 주는 방식의 대화 지향), 일관성 있는 대화 패턴 유지. 특히 사실 관계에 대한 이야기를 길게 할 수 있으므로, 충분히 들어주고 그 내용을 중심으로 질문을 이어가세요.');
    }
    if (parsedUserDisease.some(d => ['adhd'].some(keyword => d.toLowerCase().includes(keyword.toLowerCase())))) {
      if (!diseasePromptParts.some(p => p.includes("ADHD"))) { 
          diseasePromptParts.push('ADHD 진단 정보: 대화의 핵심을 명확하고 간결하게 전달하고, 필요시 짧게 정리. 한 번에 하나의 질문/주제 집중. 주의 전환이 빠를 수 있으니, 대화 주제가 너무 벗어나지 않도록 부드럽게 유도.');
      }
    }
    
    if (diseasePromptParts.length > 0) {
        prompt += '\n[진단 정보 기반 상호작용 가이드라인] 사용자는 다음과 같은 진단 정보를 가지고 있습니다: ' + diseasePromptParts.join(' ');
    }
  }

  // 4. 사용자 발화 의도(extraIntent)에 따른 초기 접근 방향
  const isAsdRelatedChildForIntent = parsedUserDisease.some(d => ['asperger', 'asd', 'social_comm_disorder', '2e'].includes(d.toLowerCase())) && effectiveAge < 15; // 15세 미만 ASD 계열로 조건 설정

  if (extraIntent === 'emotion') {
    prompt += '\n[발화 의도: 감정] 사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.';
  } else { // 'fact'
    if (isAsdRelatedChildForIntent) {
      prompt += '\n[발화 의도: 사실/상황 - ASD 아동 특별 지침] 사용자가 특정 사실이나 상황을 자세히 설명하고 있습니다. 아이가 충분히 이야기할 수 있도록 사실 관계를 중심으로 더 자세히 물어봐 주세요. 감정에 대한 질문은 아이가 먼저 감정을 명확히 표현할 때까지 기다려주세요. 예를 들어, "그래서 어떻게 됐어?", "그 다음에 무슨 일이 있었니?", "더 자세히 말해줄 수 있니?"와 같이 상황을 구체화하고 다음 이야기를 이어갈 수 있도록 돕는 질문이 좋습니다.';
    } else {
      prompt += '\n[발화 의도: 사실/상황] 사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.';
    }
  }

  // 5. 추가적인 대화 가이드라인 (effectiveAge 기준)
  if (effectiveAge <= 10) {
    prompt += '\n[10세 미만 추가 제한] 사용자가 어리기 때문에 (또는 어린아이와 대화하는 상황이므로), 특히 대화 초기에는 한 번의 답변이 너무 길어지지 않도록 주의해주세요. 약 1-2 문장으로 짧게 답변하는 것이 좋습니다.';
  }
  
  return prompt;
}

function getAgeGroup(age) {
  const ageInt = parseInt(age, 10);
  if (ageInt >= 8 && ageInt <= 10) return '8-10';
  if (ageInt >= 11 && ageInt <= 15) return '11-15'; 
  return '30+'; 
}

export function getFirstQuestion(age) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const selectedTopic = localStorage.getItem('selectedTopic');
  
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(age, 10);
  let effectiveAgeForGreeting = actualUserAge;

  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
    if (userDiseaseString) {
        try {
            parsedUserDisease = JSON.parse(userDiseaseString);
            if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDiseaseString];
        } catch (e) {
            parsedUserDisease = [userDiseaseString];
        }
    }
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt = parsedUserDisease.some(id => 
    targetDiagnosesForCbtExperience.includes(id.toLowerCase())
  );

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAgeForGreeting = 9; 
  }

  if (selectedTopic === 'USER_WILL_DEFINE_IN_CHAT') {
    if (effectiveAgeForGreeting >= 56 && !isCbtUser) { 
      return `${userName}님, 만나서 반갑습니다. 어떤 주제로 이야기하고 싶으세요? 편하게 말씀해주세요.`;
    } else {
      return `${userName}아, 만나서 반가워! 어떤 주제로 이야기하고 싶니? 편하게 말해줘.`;
    }
  } else if (selectedTopic && selectedTopic !== 'null' && selectedTopic !== 'undefined') {
    if (effectiveAgeForGreeting >= 56 && !isCbtUser) {
      return `${userName}님, 만나서 반갑습니다. 선택하신 '${selectedTopic}'에 대해 이야기해 볼까요? 어떤 부분부터 시작하고 싶으세요?`;
    } else {
      return `${userName}아, 만나서 반가워! '${selectedTopic}'(이)라는 주제를 골랐구나. 어떤 이야기부터 해볼까?`;
    }
  } else {
    console.warn("getFirstQuestion: selectedTopic 정보가 없습니다. 일반적인 시작 질문을 사용합니다.");
    if (effectiveAgeForGreeting >= 56 && !isCbtUser) {
      return `${userName}님, 안녕하세요. 오늘 어떤 이야기를 나누고 싶으신가요?`;
    } else {
      return `${userName}아, 안녕! 오늘 어떤 이야기를 하고 싶어?`;
    }
  }
}

export async function getGptResponse(userText, context = {}) {
  const text = userText.trim();
  
  if (!text && !context.isInitialGreeting) { 
    return { error: '음... 무슨 말인지 잘 모르겠어. 다시 말해줄래?' }; 
  }

  let parsedUserDiseaseForTemp = [];
  if (Array.isArray(context.userDisease)) {
      parsedUserDiseaseForTemp = context.userDisease.map(id => id.toLowerCase());
  } else if (typeof context.userDisease === 'string') { 
      try {
          const parsed = JSON.parse(context.userDisease);
          parsedUserDiseaseForTemp = Array.isArray(parsed) ? parsed.map(id => id.toLowerCase()) : [parsed.toLowerCase()];
      } catch (e) {
          parsedUserDiseaseForTemp = [context.userDisease.toLowerCase()]; 
      }
  }
  
  let temperature = 0.65; 
  const asdRelatedDiagnoses = ['asperger', '2e', 'asd', 'social_comm_disorder'];
  
  const hasAsdRelatedDiagnosis = parsedUserDiseaseForTemp.some(id => asdRelatedDiagnoses.includes(id));
  const hasAdhd = parsedUserDiseaseForTemp.includes('adhd');

  if (hasAsdRelatedDiagnosis) {
    temperature = 0.65; 
  } else if (hasAdhd) {
    temperature = 0.7; 
  }

  console.log(`Determined temperature: ${temperature} based on diagnoses:`, parsedUserDiseaseForTemp);

  const intent = detectIntent(text);
  const systemPrompt = getSystemPrompt({ ...context, userDisease: context.userDisease }, intent); 


  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory) { 
    messages.push(...context.chatHistory);
  }
  if (text && !context.isInitialGreeting) { 
      messages.push({ role: 'user', content: text });
  }

  const payload = {
    messages: messages,
    model: "gpt-4-turbo", 
    temperature: temperature, 
  };

  try {
    const resp = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({})); 
      console.error('GPT API Error Response:', errorData);
      return { error: `죄송합니다, 답변을 가져오는 데 실패했습니다. (서버 상태: ${resp.status})` };
    }

    const data = await resp.json();

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content; 
    } else {
      console.error('GPT API Unexpected Response Format:', data);
      return { error: '응답을 받았지만, 예상치 못한 형식입니다.' };
    }
  } catch (e) {
    console.error('GPT API Fetch Error:', e);
    return { error: '응답을 가져오는 중 네트워크 또는 기타 문제가 발생했습니다.' };
  }
}

export function getExitPrompt(userName = '친구', age) {
  const isCbtUser = localStorage.getItem('isCbtUser') === 'true';
  const actualUserAge = parseInt(age, 10);
  let effectiveAgeForExit = actualUserAge;

  const userDiseaseString = localStorage.getItem('lozee_userdisease');
  let parsedUserDisease = [];
    if (userDiseaseString) {
        try {
            parsedUserDisease = JSON.parse(userDiseaseString);
            if (!Array.isArray(parsedUserDisease)) parsedUserDisease = [userDiseaseString];
        } catch (e) {
            parsedUserDisease = [userDiseaseString];
        }
    }
  const targetDiagnosesForCbtExperience = ['adhd', 'asd', 'asperger', 'social_comm_disorder', '2e'];
  const hasSpecificDiagnosisForCbt = parsedUserDisease.some(id => 
    targetDiagnosesForCbtExperience.includes(id.toLowerCase())
  );

  if (isCbtUser && hasSpecificDiagnosisForCbt) {
    effectiveAgeForExit = 9; 
  }

  if (effectiveAgeForExit >= 56 && !isCbtUser) {
    return `${userName}님, 오늘 저와 이야기 나눠주셔서 감사합니다. 언제든 다시 찾아주세요.`;
  } else {
    return `${userName}아, 오늘 이야기 정말 즐거웠어! 다음에 또 재미있는 이야기 나누자. 잘 가!`;
  }
}
