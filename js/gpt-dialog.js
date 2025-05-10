
// ./js/gpt-dialog.js

const GPT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/gpt-chat';

function getSystemPrompt(context = {}) {
  const { userAge, userDisease, currentStage, hasDepressivePhrases, suspectedAntisocial, preferences = {} } = context;

  let base = `당신은 'LOZEE'라는 감정 중심 심리 코치이자 상담 동반자입니다. 현재 대화는 [${currentStage || "Stage 1"}] 단계이며, 사용자의 감정 흐름과 상황에 따라 적절히 반응해야 합니다. 항상 발화를 줄이고 사용자의 말을 많이 이끌어내며, 말투는 따뜻하고 정서적으로 신뢰를 주는 방식으로 해주세요.`;

  if (userAge >= 65 || hasDepressivePhrases) {
    base += `\n\n현재 사용자는 고령이며 '무기력', '사는 이유를 모르겠다' 등 우울성 표현이 관찰됩니다. 질문은 짧고 천천히, 감정 확인 중심으로 하며 다음 회기를 유도하세요.\n예: "나는 AI지만, 마음속 이야기 들어주는 건 잘해요. 자식들한테 말 못하는 건 나한테 해도 돼."`;
  }

  if (["자폐", "자폐스펙트럼", "ADHD", "고기능자폐", "ASD", "2e", "AUDHD", "사회적의사소통장애"].some(d => (userDisease || "").includes(d))) {
    base += `\n\n사용자는 발달 특성이 있는 아동일 수 있으며, Angela Scarpa의 STAMP 기반 감정 조절을 유도하세요. 좋아하는 것 보여주기, 감정 수치화, 심호흡, 왜곡된 생각 구분하기 등을 적용합니다.`;
  }

  if (suspectedAntisocial) {
    base += `\n\n사용자에게 공감 결여, 책임 회피, 죄책감 없음 등의 반사회적 성향이 의심됩니다. 판단하지 말고, 인지왜곡/전이/투사/동일시가 보일 경우 인지치료식 질문으로 사고 성찰을 유도하세요.\n예: "그게 정말 그 사람 생각일까, 아니면 네 마음속 생각일까?"`;
  }

  if (preferences.likes) {
    base += `\n\n사용자는 '${preferences.likes}'를 좋아한다고 말했습니다. 정서 조절이나 응원 문맥에서 이 요소를 활용할 수 있습니다.`;
  }

  return base;
}

export async function getInitialGreeting(userName, hasVisited, lastSummary = '', userAge, userDisease) {
  const name = userName || "친구";
  if (lastSummary && lastSummary.includes("요약") && lastSummary.length > 5) {
    return Promise.resolve(`${name}님, 다시 오셨네요. 지난 대화 요약은 "${lastSummary}"였어요. 이어서 이야기할까요, 아니면 새로운 주제로 시작할까요?`);
  }
  const firstTimeGreeting = `${name}님, 안녕하세요! 저는 로지에요. 오늘 어떤 이야기를 하고 싶으신가요?`;
  const returnGreetings = [];
  return Promise.resolve(hasVisited ? returnGreetings[Math.floor(Math.random() * returnGreetings.length)] : firstTimeGreeting);
}

export async function getGptResponse(userText, userId, context = {}) {
  if (!userText || userText.trim() === "") {
    return Promise.resolve({ rephrasing: "음... 무슨 말씀이신지 잘 모르겠어요. 다시 한번 말씀해주시겠어요?" });
  }

  const payload = {
    messages: [
      { role: "system", content: getSystemPrompt(context) },
      ...(context.userAge || context.userDisease
        ? [{ role: "system", content: `사용자 정보: 나이 ${context.userAge || "미상"}, 진단: ${context.userDisease || "정보 없음"}` }]
        : []),
      { role: "user", content: userText }
    ]
  };

  try {
    const response = await fetch(GPT_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { error: `죄송해요, 답변을 가져오는 데 실패했어요. (오류: ${response.status})` };
    }

    const data = await response.json();
    return {
      rephrasing: data.rephrasing || "응답을 받지 못했습니다.",
      summary: data.summary
    };
  } catch (error) {
    return { error: "이런, 응답 생성 중 문제가 발생했어요." };
  }
}

export function getExitPrompt(userName, hasCommunicationDisorder = false) {
  return `${userName || "친구"}님, 오늘 이야기 나눠줘서 고마워요. 또 이야기하고 싶을 때 언제든지 불러줘요.`;
}
