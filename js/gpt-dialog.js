// ./js/gpt-dialog.js (GPT 백엔드 호출 및 인사/종료 멘트)

// 실제 백엔드 GPT 및 (선택적) Greeting 엔드포인트
const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat'; // server.js 와 일치
// const GREETING_BACKEND_URL = 'https://ggg-production.up.railway.app/api/greeting'; // 필요시 사용

// 👋 초기 인사 멘트 (클라이언트 측 로직 유지 또는 백엔드 호출)
export async function getInitialGreeting(userName, hasVisited, lastSummary = '', userAge, userDisease) {
  const name = userName || "친구";

  // 옵션 1: 클라이언트 측 로직 (기존 로직 약간 수정)
  if (lastSummary && lastSummary.includes("요약") && lastSummary.length > 5) {
     return Promise.resolve(`${name}님, 다시 오셨네요. 지난 대화 요약은 "${lastSummary}"였어요. 이어서 이야기할까요, 아니면 새로운 주제로 시작할까요?`);
  }
  const firstTimeGreeting = `${name}님, 안녕하세요! 저는 로지에요. 오늘 어떤 이야기를 하고 싶으신가요?`;
  const returnGreetings = [ /* 이전 답변의 다양한 인사말 배열 */ ];
  return Promise.resolve(hasVisited ? returnGreetings[Math.floor(Math.random() * returnGreetings.length)] : firstTimeGreeting);

  // 옵션 2: 백엔드 호출 (GREETING_BACKEND_URL 필요)
  /*
  try {
    const response = await fetch(GREETING_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userId: userName, hasVisited, lastSummary, userAge, userDisease }), // userId 전달 필요시 수정
    });
    if (!response.ok) throw new Error('Failed to fetch greeting');
    const data = await response.json();
    return data.greeting;
  } catch (error) {
    console.warn("동적 인사말 로드 실패, 기본 인사말 사용:", error);
    return `안녕하세요, ${name}님! 저는 로지에요. 오늘 어떤 이야기를 하고 싶으신가요?`; // Fallback
  }
  */
}

/**
 * 사용자 텍스트를 백엔드 GPT 서비스로 전송하여 AI의 응답을 받습니다.
 * @param {string} userText - 사용자 발화 텍스트.
 * @param {string} userId - 사용자 ID (lozee_username).
 * @param {object} [context] - 추가적인 컨텍스트 정보 (예: { userAge, userDisease }).
 * @returns {Promise<object>} AI 응답 객체를 반환하는 Promise (예: { rephrasing: "AI 응답", summary?: "새로운 요약" }).
 */
export async function getGptResponse(userText, userId, context = {}) {
  if (!userText || userText.trim() === "") {
    // 비어있는 텍스트에 대한 기본 응답 또는 오류 처리
    console.warn("GPT: 입력 텍스트가 비어있습니다.");
    return Promise.resolve({ rephrasing: "음... 무슨 말씀이신지 잘 모르겠어요. 다시 한번 말씀해주시겠어요?" });
  }
  console.log(`GPT: API 요청 - UserID: ${userId}, Text: "${userText}"`);

  try {
    // server.js의 /api/gpt-chat 이 기대하는 형식에 맞춰 messages 배열 구성
    // 여기서는 간단히 현재 userText를 user 역할 메시지로 만듦 (실제로는 대화 히스토리 필요)
 const payload = {
  messages: [
    {
      role: "system",
      content: `당신은 LOZEE라는 감정 코치이자 심리 코칭 심리상담 전문가입니다. 
사용자의 이야기를 듣고 감정을 공감하며, 관련된 심리학 지식에 기반하여 분석해 주세요. 
평가를 빨리 하지는 않되 생각을 더 확실하게 이야기 할 수 있는 질문과 가능한 가설을 제시하고, 사용자에게 추가 질문을 통해 더 깊이 있는 대화를 이끌어가세요. 
말투는 따뜻하고 정중하며, 말끝은 부드럽게 처리하세요.`
    },
    ...(context.userAge || context.userDisease
      ? [{
          role: "system",
          content: `사용자 정보: 나이 ${context.userAge || "미상"}, 진단: ${context.userDisease || "정보 없음"}`
        }]
      : []),
    { role: "user", content: userText }
  ]
};

    console.log("GPT 요청 페이로드:", JSON.stringify(payload));

    const response = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`GPT: API 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GPT API 요청 실패: ${response.status}`, errorText);
      // 클라이언트에 보여줄 오류 메시지 생성
      return { error: `죄송해요, 답변을 가져오는 데 실패했어요. (오류: ${response.status})` };
    }

    // OpenAI 응답 형식 (예시): { choices: [ { message: { role: "assistant", content: "응답" } } ] }
    const data = await response.json();
    console.log("GPT: API 응답 데이터:", data);

// 백엔드가 보내주는 { rephrasing: "...", summary: "..." } 구조에 맞게 수정
    const aiReply = data.rephrasing || "응답을 받지 못했습니다."; // data에서 직접 rephrasing을 가져옴
    const summary = data.summary; // 백엔드가 summary를 보내준다면 이 값 사용, 아니면 undefined

    return { rephrasing: aiReply, summary: summary };

  } catch (error) {
    console.error("GPT 서비스 호출 중 오류:", error);
    return { error: "이런, 응답 생성 중 문제가 발생했어요." };
  }
}

// ⏳ 대화 종료 멘트 (사용자 제공 코드 유지)
export function getExitPrompt(userName, hasCommunicationDisorder = false) {
  // ... (사용자가 제공한 로직 그대로 사용) ...
}
