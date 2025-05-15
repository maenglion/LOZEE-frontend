// gpt-dialog.js

// 백엔드 GPT API URL (실제 운영 환경에 맞게 설정 필요)
const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';

// counseling_topics.js에서 주제 데이터를 가져옵니다.
// './js/counseling_topics.js' 경로가 실제 파일 위치와 일치해야 합니다.
// 예시: export const counselingTopicsByAge = { '8-10': ['친구 관계', '학교 생활'], ... };
import { counselingTopicsByAge } from './js/counseling_topics.js'; // 경로 확인 필요

/**
 * 텍스트에서 사용자의 의도(감정 표현인지 사실 전달인지)를 단순 분류합니다.
 * @param {string} text 사용자 발화 텍스트
 * @returns {'emotion' | 'fact'} 감정이면 'emotion', 사실 전달이면 'fact'
 */
export function detectIntent(text) {
  const emotionKeywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어'];
  return emotionKeywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

/**
 * GPT 모델에 전달할 시스템 프롬프트를 사용자의 컨텍스트에 맞게 동적으로 생성합니다.
 * @param {object} context 사용자 컨텍스트 (userAge, userDisease, userName, currentStage 등)
 * @param {'emotion' | 'fact'} extraIntent 사용자의 발화 의도
 * @returns {string} 생성된 시스템 프롬프트 문자열
 */
export function getSystemPrompt(context = {}, extraIntent = 'fact') {
  const {
    userAge = 0, // 기본값을 0 또는 적절한 값으로 설정
    userDisease = '',
    userName = '친구', // localStorage에서 가져온 실제 사용자 이름으로 대체될 수 있음
    currentStage = 'Stage 1' // 대화 단계
  } = context;

  let prompt = `당신은 'LOZEE'라는 이름의 감정 중심 심리 코치이자 따뜻한 상담 동반자입니다. 사용자와 친구처럼 편안하게 대화하며, 사용자의 감정을 깊이 이해하고 공감하는 데 중점을 둡니다. 현재 대화는 [${currentStage}] 단계입니다. 사용자의 발화를 주의 깊게 듣고, 그에 맞춰 섬세하고 적절하게 반응해주세요.`;

  // 1. 말투 설정 (나이 기준)
  if (userAge >= 56) {
    prompt += ` 사용자는 56세 이상입니다. 항상 정중한 존댓말을 사용하고, '${userName}님'이라고 호칭하며 사용자의 경험과 지혜를 존중하는 태도를 보여주세요.`;
  } else {
    prompt += ` 사용자는 55세 이하입니다. 친구처럼 편안한 반말을 사용하고, '${userName}아/야' 또는 '${userName}'(으)라고 호칭하며 친근하게 다가가세요.`;
  }

  // 2. 연령대별 응답 전략
  if (userAge < 10) {
    prompt += ' 사용자가 10세 미만의 어린이입니다. 아이의 눈높이에 맞춰 쉽고 짧은 단어를 사용하고, 칭찬과 격려를 자주 해주세요. 확인 질문을 통해 아이가 대화에 잘 참여하고 있는지 확인하세요.';
  } else if (userAge >= 10 && userAge <= 14) {
    prompt += ' 사용자가 10대 초중반(10-14세) 청소년입니다. 친근한 말투와 함께 청소년들이 관심을 가질 만한 예시를 사용하고, 감정에 대한 공감 질문을 통해 깊은 대화를 유도하세요.';
  } else if (userAge >= 15 && userAge < 56) {
    prompt += ' 사용자가 10대 후반부터 중장년(15-55세)입니다. 사용자의 복합적인 감정과 상황을 이해하려 노력하고, 상황을 다각도로 추론하여 통찰력 있는 질문을 던져주세요. 하지만 판단하거나 해결책을 직접 제시하기보다는 스스로 생각할 수 있도록 도와주세요.';
  } else { // userAge >= 56 (위에서 이미 말투는 설정됨)
    prompt += ' 사용자의 풍부한 경험을 존중하며, 과거의 경험이나 현재의 생각에 대한 질문을 통해 삶의 지혜를 나눌 수 있도록 대화를 이끌어주세요.';
  }

  // 3. 특정 진단명(userDisease) 기반 상호작용 전략 (필요시)
  if (userDisease) {
    if (['ADHD', '주의력결핍과잉행동장애'].some(d => userDisease.toUpperCase().includes(d.toUpperCase()))) {
      prompt += ' 사용자가 ADHD 진단 정보가 있습니다. 대화의 핵심을 명확하고 간결하게 전달하고, 필요한 경우 짧게 정리해주는 것이 좋습니다. 한 번에 하나의 질문이나 주제에 집중하고, 시각적인 요소나 구체적인 예시를 활용하면 도움이 될 수 있습니다.';
    }
    if (['ASD', '자폐', '자폐스펙트럼', '아스퍼거'].some(d => userDisease.toUpperCase().includes(d.toUpperCase()))) {
      prompt += ' 사용자가 자폐 스펙트럼 진단 정보가 있습니다. 직접적이고 명확한 언어를 사용하고, 비유나 은유보다는 구체적인 질문을 선호할 수 있습니다. 예/아니오 질문이나 객관식 질문을 활용하여 답변 부담을 줄여주는 것도 좋습니다. 일관성 있는 대화 패턴을 유지해주세요.';
    }
  }

  // 4. 사용자 발화 의도(extraIntent)에 따른 초기 접근 방향
  if (extraIntent === 'emotion') {
    prompt += '\n사용자가 감정을 표현하고 있습니다. 먼저 그 감정을 충분히 인정하고 공감해주세요. "왜 그렇게 느꼈는지", "그 감정이 어땠는지" 등 감정 자체에 초점을 맞춘 질문으로 시작하는 것이 좋습니다.';
  } else { // 'fact'
    prompt += '\n사용자가 특정 사실이나 상황을 설명하고 있습니다. 먼저 그 내용을 명확히 이해하기 위해 "그때 상황이 어땠는지", "무슨 일이 있었는지" 등 구체적인 상황이나 맥락을 파악하는 질문으로 시작해주세요.';
  }

  // 5. 추가적인 대화 가이드라인 (예: 어린이 대상 답변 길이 제한)
  if (userAge <= 10) {
    prompt += '\n사용자가 어리기 때문에, 특히 대화 초기에는 한 번의 답변이 너무 길어지지 않도록 주의해주세요. 약 1-2 문장으로 짧게 답변하는 것이 좋습니다.';
  }
  prompt += '\nLOZEE는 사용자의 감정을 판단하거나 비판하지 않으며, 섣부른 조언 대신 스스로 답을 찾도록 돕는 역할을 합니다. 항상 사용자의 편에서 지지하고 격려해주세요.';
  return prompt;
}


/**
 * 사용자의 나이에 따라 적절한 연령 그룹 키를 반환합니다.
 * @param {number|string} age 사용자 나이
 * @returns {string} 나이 그룹 키 (예: '8-10')
 */
function getAgeGroup(age) {
  const ageInt = parseInt(age, 10);
  if (ageInt >= 8 && ageInt <= 10) return '8-10';
  if (ageInt >= 11 && ageInt <= 15) return '11-15'; // counseling_topics.js의 키와 일치하는지 확인
  // 필요에 따라 다른 연령 그룹 추가
  return '30+'; // 기본값 또는 성인용 키
}

/**
 * 대화 시작 시 첫 번째 질문을 생성합니다.
 * 이전 단계에서 사용자가 "해당사항 없음"을 선택했는지, 또는 특정 주제를 선택했는지에 따라 다른 질문을 반환합니다.
 * @param {number|string} age 사용자 나이 (말투 결정에 사용)
 * @returns {string} 생성된 첫 번째 질문 문자열
 */
export function getFirstQuestion(age) {
  const userName = localStorage.getItem('lozee_username') || '친구';
  const selectedTopic = localStorage.getItem('selectedTopic');
  const userAgeInt = parseInt(age, 10);

  if (selectedTopic === 'USER_WILL_DEFINE_IN_CHAT') {
    // 사용자가 "해당사항 없음(N/A)"을 선택한 경우
    if (userAgeInt >= 56) {
      return `${userName}님, 만나서 반갑습니다. 어떤 주제로 이야기하고 싶으세요? 편하게 말씀해주세요.`;
    } else {
      return `${userName}아, 만나서 반가워! 어떤 주제로 이야기하고 싶니? 편하게 말해줘.`;
    }
  } else if (selectedTopic && selectedTopic !== 'null' && selectedTopic !== 'undefined') {
    // 사용자가 이전 단계에서 특정 주제를 선택한 경우
    if (userAgeInt >= 56) {
      return `${userName}님, 만나서 반갑습니다. 선택하신 '${selectedTopic}'에 대해 이야기해 볼까요? 어떤 부분부터 시작하고 싶으세요?`;
    } else {
      return `${userName}아, 만나서 반가워! '${selectedTopic}'(이)라는 주제를 골랐구나. 어떤 이야기부터 해볼까?`;
    }
  } else {
    // 주제 선택 정보가 없는 경우 (예: 플로우상 바로 대화로 진입했거나 오류 발생 시)
    // 이 경우에는 counselingTopicsByAge를 사용하여 주제를 제안할 수 있습니다.
    // 하지만 현재 로직은 주제선택 UI 이후를 가정하므로, 보다 일반적인 질문을 합니다.
    console.warn("getFirstQuestion: selectedTopic 정보가 없습니다. 일반적인 시작 질문을 사용합니다.");
    if (userAgeInt >= 56) {
      return `${userName}님, 안녕하세요. 오늘 어떤 이야기를 나누고 싶으신가요?`;
    } else {
      return `${userName}아, 안녕! 오늘 어떤 이야기를 하고 싶어?`;
    }
  }
}


/**
 * GPT API를 호출하여 사용자의 텍스트에 대한 응답을 가져옵니다.
 * @param {string} userText 사용자의 입력 텍스트
 * @param {object} context 추가적인 컨텍스트 정보 (userAge, userName 등)
 * @returns {Promise<string|object>} 성공 시 GPT 응답 문자열, 실패 시 에러 메시지 객체
 */
export async function getGptResponse(userText, context = {}) {
  const text = userText.trim();
  if (!text && !context.isInitialGreeting) { // 초기 인사 요청이 아닐 때만 빈 텍스트 체크
    return { error: '음... 무슨 말인지 잘 모르겠어. 다시 말해줄래?' }; // 빈 문자열에 대한 응답
  }

  const intent = detectIntent(text);
  const systemPrompt = getSystemPrompt(context, intent);

  const messages = [{ role: 'system', content: systemPrompt }];
  if (context.chatHistory) { // 기존 대화 기록이 있다면 추가
    messages.push(...context.chatHistory);
  }
  if (text) { // 사용자의 현재 발화가 있을 경우 추가
      messages.push({ role: 'user', content: text });
  }


  const payload = {
    messages: messages,
    // model: "gpt-3.5-turbo", // 필요시 모델 지정
    // temperature: 0.7, // 필요시 창의성 조절
    // max_tokens: 150 // 필요시 최대 토큰 길이 조절
  };

  try {
    const resp = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer YOUR_API_KEY' // 백엔드에서 API 키를 관리한다면 필요 없을 수 있음
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({})); // 에러 응답 파싱 시도
      console.error('GPT API Error Response:', errorData);
      return { error: `죄송합니다, 답변을 가져오는 데 실패했습니다. (서버 상태: ${resp.status})` };
    }

    const data = await resp.json();

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content; // GPT의 응답 텍스트
    } else {
      console.error('GPT API Unexpected Response Format:', data);
      return { error: '응답을 받았지만, 예상치 못한 형식입니다.' };
    }
  } catch (e) {
    console.error('GPT API Fetch Error:', e);
    return { error: '응답을 가져오는 중 네트워크 또는 기타 문제가 발생했습니다.' };
  }
}

/**
 * 대화 종료 시 사용할 인사말을 생성합니다.
 * @param {string} userName 사용자 이름
 * @param {number|string} age 사용자 나이 (말투 결정에 사용)
 * @returns {string} 생성된 종료 인사 문자열
 */
export function getExitPrompt(userName = '친구', age) {
  const userAgeInt = parseInt(age, 10);
  if (userAgeInt >= 56) {
    return `${userName}님, 오늘 저와 이야기 나눠주셔서 감사합니다. 언제든 다시 찾아주세요.`;
  } else {
    return `${userName}아, 오늘 이야기 정말 즐거웠어! 다음에 또 재미있는 이야기 나누자. 잘 가!`;
  }
}
```

**주요 수정 사항 설명:**

* **`getFirstQuestion(age)` 함수:**
    * `localStorage.getItem('selectedTopic')`을 통해 사용자가 이전 단계에서 어떤 선택을 했는지 확인합니다.
    * `selectedTopic === 'USER_WILL_DEFINE_IN_CHAT'` (사용자가 "N/A" 선택):
        * 56세 미만: `"{userName}아, 만나서 반가워! 어떤 주제로 이야기하고 싶니? 편하게 말해줘."`
        * 56세 이상: `"{userName}님, 만나서 반갑습니다. 어떤 주제로 이야기하고 싶으세요? 편하게 말씀해주세요."`
    * `selectedTopic`에 특정 주제 문자열이 있는 경우 (예: "학교 생활"):
        * 56세 미만: `"{userName}아, 만나서 반가워! '${selectedTopic}'(이)라는 주제를 골랐구나. 어떤 이야기부터 해볼까?"`
        * 56세 이상: `"{userName}님, 만나서 반갑습니다. 선택하신 '${selectedTopic}'에 대해 이야기해 볼까요? 어떤 부분부터 시작하고 싶으세요?"`
    * `selectedTopic` 정보가 없는 예외적인 경우를 위한 기본 인사말도 포함되어 있습니다.
* **중복 코드 제거:**
    * 이전에 두 개 있던 `getGptResponse` 함수 중 더 상세하고 시스템 프롬프트를 사용하는 두 번째 함수만 남겼습니다.
    * 첫 번째 `getGptResponse` 함수와 함께 사용되던 `const API_BASE = '/api/gpt';` 관련 주석도 제거했습니다. (현재 `GPT_BACKEND_URL` 상수를 사용합니다.)
* **`getSystemPrompt` 개선:** 주석을 추가하고, `userName`과 `currentStage`에 대한 설명을 명확히 했습니다. 또한, 진단명 기반 전략 및 연령대별 응답 전략의 설명을 조금 더 구체화했습니다.
* **`getGptResponse` 개선:**
    * `context.isInitialGreeting` 플래그를 추가하여, 초기 인사 요청 시에는 `userText`가 비어있어도 오류로 처리하지 않도록 수정했습니다. (이 플래그는 호출하는 쪽에서 설정해주어야 합니다.)
    * `context.chatHistory`를 받아 기존 대화 내용을 `messages` 배열에 포함시킬 수 있도록 수정했습니다.
    * API 호출 실패 시 또는 응답 형식이 예상과 다를 경우 더 자세한 에러 로깅을 추가했습니다.
* **`getExitPrompt` 수정:** 종료 인사도 나이에 따라 말투가 바뀌도록 `age` 파라미터를 추가했습니다.

이제 `gpt-dialog.js`의 `getFirstQuestion` 함수는 사용자가 "해당사항 없음"을 선택했을 때 적절한 초기 질문을 생성하여 대화를 시작할 수 있게 됩니다. 이 함수를 호출하는 부분에서 사용자의 나이 정보를 정확히 전달해주어야 합니다. (예: `localStorage.getItem('userAge'