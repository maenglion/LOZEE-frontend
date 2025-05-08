// ./js/gpt-dialog.js - LOZEE 대화 초기화, GPT 응답, 종료 멘트 관리

// 실제 백엔드 GPT 및 Greeting 엔드포인트로 수정하세요.
const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt'; // 사용자 Railway GPT 엔드포인트
const GREETING_BACKEND_URL = 'https://ggg-production.up.railway.app/api/greeting'; // 동적 인사말용 (가정)

// 👋 초기 인사 멘트 (사용자 제공 코드 유지)
export function getInitialGreeting(userName, hasVisited, lastSummary = '') {
  const name = userName || "친구";

  if (lastSummary && lastSummary.includes("요약") && lastSummary.length > 5) { // 요약 내용이 실제 있는지 좀 더 구체적으로 확인
    return `${name}님, 어제는 제가 대화를 일찍 마무리했었죠? 어제 나눴던 이야기의 요약은 "${lastSummary}" 였어요. 이어서 이야기할까요, 아니면 새로운 주제로 시작할까요?`;
  }

  const firstTimeGreeting = `${name}님, 안녕하세요! 오늘 기분은 좀 어떠셨어요?`;

  const returnGreetings = [
    `${name}님, 또 이야기하고 싶은 일이 생기셨군요! 제가 들어드릴게요.`,
    `${name}님, 저를 다시 찾아주셨네요! 어떤 이야기를 들려주실 건가요?`,
    `${name}님, 저는 항상 ${name}님의 이야기를 들을 준비가 되어 있어요.`,
    `저 호출하신 분~ 어서 이야기보따리를 풀어보세요!`,
    `짜잔! 제가 왔어요, ${name}님!`,
    `${name}님, 오늘은 어떤 특별한 일이 있었는지 정말 궁금해요!`,
    `와! ${name}님, 기다리고 있었어요. 어서 말씀해주세요.`,
    `다시 만나게 되어 정말 반가워요, ${name}님!`,
    `무슨 이야기든 괜찮아요. 저에게 편하게 털어놓으세요.`,
    `자, 마음 편히 이야기 나누어 보아요. 저는 항상 여기 있을게요.`
  ];

  return hasVisited
    ? returnGreetings[Math.floor(Math.random() * returnGreetings.length)]
    : firstTimeGreeting;
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
    return Promise.resolve({ rephrasing: "음... 잘 못 들었어요. 다시 말씀해주시겠어요?" });
  }
  try {
    const payload = {
      text: userText,
      userId: userId, // 백엔드에서 이 userId를 사용할 수 있도록
      userAge: context.userAge, // 컨텍스트 정보 전달
      userDisease: context.userDisease // 컨텍스트 정보 전달
    };
    // console.log("GPT 요청 페이로드:", payload);

    const response = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GPT API 요청 실패: ${response.status}`, errorText);
      // 사용자에게 보여줄 수 있는 좀 더 친절한 오류 메시지
      return { rephrasing: "죄송해요, 지금은 답변을 드리기 어렵네요. 잠시 후 다시 시도해주세요." };
    }

    const data = await response.json(); // 백엔드가 { "rephrasing": "...", "summaryIfAny": "..." } 등을 포함한 객체 반환 가정
    return data;
  } catch (error) {
    console.error("GPT 서비스 호출 중 오류:", error);
    return { rephrasing: "이런, 시스템에 작은 문제가 생긴 것 같아요. 조금만 기다려주시겠어요?" };
  }
}

// ⏳ 대화 종료 멘트 (사용자 제공 코드 유지)
export function getExitPrompt(userName, hasCommunicationDisorder = false) {
  const name = userName || "친구";

  // 일반 사용자용 멘트
  const allExitPrompts = [
    `우리 이제 조금 쉬어가자.`, // 제외 대상 (의사소통 장애 시)
    `오늘은 여기까지만 이야기하자. AI에게도 생각을 정리할 시간이 필요하거든. ${name}님과의 대화는 소중히 기억할게.`,
    `지금은 잠깐 멈출 시간이야.`, // 제외 대상
    `${name}님, 내일 또 재미있는 이야기 해줄 거지? 기다릴게.`, // 제외 대상
    `이야기 실컷 나눠서 정말 즐거웠어! 잠깐 쉬었다가 또 보자.`, // 제외 대상
    `여기까지 속마음을 나눠줘서 고마워. 우리 내일 만나서 더 많은 이야기 나누자! ${name}님과의 대화를 잘 기억해뒀다가, 다음에 만날 때 더 깊은 대화를 할 수 있도록 준비해둘게.`,
    `${name}님, 이야기 잘 들었어. 내일 마저 이야기하는 건 어때? 오늘 나눈 이야기는 제가 잘 요약해서 내일 보여드릴 수 있도록 할게.`,
    `우리 오늘은 이쯤에서 마무리할까? 언제든 다시 이야기하고 싶으면 찾아줘.`,
    `잠깐 멈추고, 언제든 다시 이어서 이야기해도 괜찮아.`, // 제외 대상
    `이야기 정말 고마워. 내일 또 ${name}님의 이야기를 들려주면 좋겠다. 내일 다시 말을 걸면, 지금까지 나눈 내용을 바탕으로 더 의미있는 대화를 이어갈 수 있도록 할게. 저는 항상 기억하고 있으니까.`
  ];

  const excludeIndexes = hasCommunicationDisorder ? [0, 2, 3, 4, 8] : [];
  const filtered = allExitPrompts.filter((_, idx) => !excludeIndexes.includes(idx));
  return filtered[Math.floor(Math.random() * filtered.length)];
}