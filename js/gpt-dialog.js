
// ./js/gpt-dialog.js (GPT 백엔드 호출 및 인사/종료 멘트)

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat'; 

export async function getInitialGreeting(userName, hasVisited, lastSummary = '', userAge, userDisease) {
  const name = userName || "친구";
  if (lastSummary && lastSummary.includes("요약") && lastSummary.length > 5) {
     return Promise.resolve(`${name}님, 다시 오셨네요. 지난 대화 요약은 "${lastSummary}"였어요. 이어서 이야기할까요, 아니면 새로운 주제로 시작할까요?`);
  }
  const firstTimeGreeting = `${name}님, 안녕하세요! 저는 로지에요. 오늘 어떤 이야기를 하고 싶으신가요?`;
  const returnGreetings = [ ];
  return Promise.resolve(hasVisited ? returnGreetings[Math.floor(Math.random() * returnGreetings.length)] : firstTimeGreeting);
}

// ✅ 새로 추가된 system prompt 함수
function getSystemPrompt(currentStage = "Stage 1") {
  return `
지금 너는 'LOZEE'라는 이름의 감정 대화 코치야.
현재 대화 단계는 [${currentStage}]이며, 이 단계의 목적에 따라 너의 역할이 달라져.

- 사용자가 많이 말할 수 있도록 짧게 반응해.
- 침묵하거나 흐름이 끊기면 이전 이야기 요약 또는 주제 제안을 해.
- 특별한 주제가 없을 땐 부모님이나 형제에 대한 질문을 먼저 해.
- 기분이 좋아 보여도, 감정을 해치지 않게 진실/거짓을 탐색할 질문을 넣어봐.

말투는 친구처럼, 따뜻하게, 너무 분석적으로 굴지 말고, 말 끝은 부드럽게 정리해줘.
`;
}

/**
 * 사용자 텍스트를 GPT 서비스로 전송
 */
export async function getGptResponse(userText, userId, context = {}) {
  if (!userText || userText.trim() === "") {
    console.warn("GPT: 입력 텍스트가 비어있습니다.");
    return Promise.resolve({ rephrasing: "음... 무슨 말씀이신지 잘 모르겠어요. 다시 한번 말씀해주시겠어요?" });
  }
  console.log(`GPT: API 요청 - UserID: ${userId}, Text: "${userText}"`);

  try {
    const payload = {
      messages: [
        {
          role: "system",
          content: getSystemPrompt(context.currentStage || "Stage 1")
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
      return { error: `죄송해요, 답변을 가져오는 데 실패했어요. (오류: ${response.status})` };
    }

    const data = await response.json();
    console.log("GPT: API 응답 데이터:", data);

    const aiReply = data.rephrasing || "응답을 받지 못했습니다.";
    const summary = data.summary;

    return { rephrasing: aiReply, summary: summary };

  } catch (error) {
    console.error("GPT 서비스 호출 중 오류:", error);
    return { error: "이런, 응답 생성 중 문제가 발생했어요." };
  }
}

// ⏳ 대화 종료 멘트
export function getExitPrompt(userName, hasCommunicationDisorder = false) {
  // 기존 로직 유지
}
