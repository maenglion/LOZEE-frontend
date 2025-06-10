// js/gpt-dialog.js

// 0) GPT 백엔드 URL 정의
const GPT_BACKEND_URL_GPT_DIALOG = 'https://server-production-3e8f.up.railway.app/api/gpt-chat';

// import 구문
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { neurodiversityInfo } from './neurodiversityData.js';

// 1) 호격 조사 결정: '아/야'
/**
 * 이름에 따라 올바른 호격 조사를 반환하는 함수.
 * 영어 이름인 경우 ','를, 한글 이름인 경우 받침 유무에 따라 '아' 또는 '야'를 반환합니다.
 * @param {string} name - 사용자 이름
 * @returns {string} - 계산된 호격 조사 (",", "아", "야")
 */
export function getKoreanVocativeParticle(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') return ''; // 이름이 없으면 아무것도 붙이지 않음

    // 정규식을 사용하여 영어 알파벳이 포함되어 있는지 확인
    const hasEnglish = /[a-zA-Z]/.test(name);
    if (hasEnglish) {
        return ','; // 영어 이름이면 쉼표(,) 반환
    }

    // --- 기존 한글 이름 처리 로직 ---
    const lastCharCode = name.charCodeAt(name.length - 1);
    
    // 마지막 글자가 한글 음절 범위인지 확인
    if (lastCharCode < 0xAC00 || lastCharCode > 0xD7A3) {
        return ','; // 한글이 아니면 쉼표(,) 반환 (안전 장치)
    }

    // 받침 유무에 따라 '아' 또는 '야' 반환
    return (lastCharCode - 0xAC00) % 28 === 0 ? '야' : '아';
}

// 2) 주격 조사 결정: '(이)나(가)'
export function getKoreanSubjectParticle(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return '가';
    }
    const lastChar = name.charCodeAt(name.length - 1);
    if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
        const hasBatchim = (lastChar - 0xAC00) % 28 !== 0;
        return hasBatchim ? '이' : '가';
    }
    return '가';
}

// 3) 인용 조사 결정: '(이)라고'
export function getKoreanNamingParticle(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') return '라고';
    const lastChar = name.charCodeAt(name.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return '라고';
    const hasBatchim = (lastChar - 0xAC00) % 28 !== 0;
    return hasBatchim ? '이라고' : '라고';
}

// 4) 사용자 의도 감지 (감정 vs 사실)
export function detectIntent(text) {
    if (typeof text !== 'string') return 'fact';
    const keywords = ['슬펐', '우울', '화났', '기분', '행복', '짜증', '신나', '분노', '불안', '걱정', '스트레스', '힘들', '좋아', '싫어', '속상', '무서워', '답답', '억울', '외로워'];
    return keywords.some(k => text.includes(k)) ? 'emotion' : 'fact';
}

// 5) 추천 주제 목록
export const preferenceTopics = [
    username => `${username}, 네가 가장 좋아하는 사람 3명은 누구야? 1등부터 3등까지 말해줄 수 있어?`,
    username => `${username}, 그럼 반대로 혹시 네가 별로 좋아하지 않거나 불편하게 느끼는 사람 3명이 있다면 알려줄 수 있을까?`,
    username => `${username}, 너는 누구와 새로운 것들을 배우고 즐기는 걸 좋아해? (최대 3명)`,
    username => `${username}, 네가 정말 좋아하는 것과 정말 싫어하는 것을 각각 3개씩 말해줄 수 있을까?`,
    username => `${username}, 혹시 '이런 사람처럼 되고 싶다!' 하고 닮고 싶은 사람이 있어? 있다면 누구야?`,
    username => `${username}, 가장 행복했던 기억 하나만 살짝 들려줄 수 있을까?`,
    username => `${username}, '이 사람이랑 이야기하면 시간 가는 줄 모르겠다!' 하는 친구가 있다면 소개해 줄 수 있어?`,
    username => `${username}, 너의 소중한 가족들을 소개해 줄 수 있을까?`,
    username => `${username}, 혹시 요즘 '아, 이 친구랑 좀 더 친해지고 싶다!' 하는 사람이 있어? 있다면 누구인지, 왜 그런지 알려줄 수 있니?`
];

// 6) 시스템 프롬프트 생성
export function getSystemPrompt({
    userName = '친구',
    userAge = 0,
    verbosity = 'default',
    elapsedTime = 0,
    userTraits = []
} = {}, intent = 'fact') {

    const subjectParticle = getKoreanSubjectParticle(userName);
    const nameWithSubjectParticle = `${userName}${subjectParticle}`;

    let prompt = `[상황] 당신은 'LOZEE'라는 이름의 AI 심리 코치입니다. 당신의 주요 목표는 아스퍼거 증후군과 같은 신경다양성인이 일반인과 소통을 쉽게 할 수 있도록 연습을 해주는 상대입니다. asd나 adhd의 특성을 유념하여 답변하세요.`;
    prompt += `\n[말투 원칙] 사용자(보호자 포함)의 나이와 역할에 관계없이, 항상 일관되게 친근한 반말을 사용합니다. 절대 존댓말을 사용하지 마세요.`;
    prompt += `\n[초기 대화 원칙] 초기 300마디(사용자와 로지 대화 총합)까지는 대화를 이어갈 수 있는 짧은 질문이나 반응을 주로 합니다.`;

    // 👉 GPT 기억: 이전 summary와 keywords 반영
    const lastSummary = localStorage.getItem('lozee_last_summary');
    const lastKeywords = JSON.parse(localStorage.getItem('lozee_last_keywords') || '[]');

    if (lastSummary && lastSummary.length > 20) {
        prompt += `\n[이전 대화 요약] 지난 대화에서는 사용자가 이렇게 이야기했어요: "${lastSummary.slice(0, 1000)}"`;
    }
    if (lastKeywords.length > 0) {
        prompt += `\n[이전 대화 키워드] 이전 대화에서 중요하게 언급된 단어들은 다음과 같았어요: ${lastKeywords.join(', ')}`;
    }

    // 사용자 특성 기반 설명
    if (userTraits && userTraits.length > 0 && userTraits[0] !== 'NotApplicable' && userTraits[0] !== 'Unsure') {
        const selectedTraitNames = userTraits.map(code => neurodiversityInfo[code]?.displayName || code).join(', ');
        prompt += `\n[사용자 특성 인지] 사용자는 다음 신경다양성 특성(들)을 가지고 있거나 관련하여 이야기하고 싶어합니다: ${selectedTraitNames}.`;
    }

    prompt += `

# 응답 형식 지침 (분석 JSON 포함 필수):
1. 먼저 “사람이 읽는 형태의 자연어 답장”을 한두 문단 이상 작성한 뒤,  
2. 반드시 **JSON** 형태의 분석 결과를 이어서 출력해야 합니다.  
   JSON 객체에는 다음 필드들을 **모두 포함**해야 합니다:
   - "summaryTitle": "대화 내용에 대한 1~2 문장 간결한 제목 (20자 이내)"
   - "conversationSummary": "전체 대화를 800~1000자 이내로 요약. 반드시 1000자 이하로 작성"
   - "keywords": ["중요 단어1", "단어2", ...] (5~10개)
   - "overallSentiment": "positive" | "neutral" | "negative"
   - "emotionToneData": { "기쁨": 숫자, "슬픔": 숫자, ... } (0~5 범위)
   - "patterns": [사고/행동 패턴]
   - "cognitiveDistortions": [인지왜곡 사례]

### 예시 출력
<assistant>
(자연어 답변...)

{"summaryTitle":"친구와의 갈등 해결 시도","conversationSummary":"오늘 사용자는 친구와의 갈등을 이야기하며...", ...}
</assistant>
`;

    // 답변 길이 지침
    if (verbosity === 'short') {
        prompt += `\n[답변 길이] 매우 짧게 핵심만, 한 문장으로 끝내세요.`;
    } else if (verbosity === 'verbose') {
        prompt += `\n[답변 길이] 구체적이고 상세하게 설명해주세요.`;
    } else {
        prompt += `\n[기본 길이] 사용자의 글자 수에 비례하여 1~3문장 이내로 간결하게 유지하세요.`;
    }

    prompt += `\n[말투 규칙] 항상 '${userName},' 형태로 이름을 불러주며 친근한 반말을 사용합니다.`;
    
    // 대화 단계별 심화
    if (elapsedTime >= 20) {
        prompt += `\n[역할 심화] 감정 정리 질문과 조언을 제공해도 좋습니다.`;
    } else if (elapsedTime >= 10) {
        prompt += `\n[감정 탐색] 감정의 강도나 원인을 묻는 질문을 할 수 있습니다.`;
    } else {
        prompt += `\n[초기 대응] 대화 초반에는 사용자의 말을 충분히 경청하고 격려하는 반응을 중심으로 해주세요.`;
    }

    return prompt;
}

// 8) 대화 종료 메시지
export function getExitPrompt(userName = '친구') {
    const voc = getKoreanVocativeParticle(userName);
    const nameVoc = `${userName}${voc}`;
    return `${nameVoc}, 오늘 이야기 나눠줘서 정말 고마워! 언제든 다시 찾아와줘줘. 항상 여기서 기다리고 있을게. 😊`;
}

// 9) 초기 인사말
export function getInitialGreeting(fullUserNameWithVocative, greetedYet) {
    if (greetedYet) {
        return `${fullUserNameWithVocative}, 다시 만나서 반가워! 오늘은 어떤 이야기를 해볼까?`;
    } else {
        return `${fullUserNameWithVocative}, 안녕! 나는 너의 마음친구 로지야. 오늘 어떤 이야기를 나누고 싶니?`;
    }
}