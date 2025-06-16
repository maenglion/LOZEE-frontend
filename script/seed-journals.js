// 테스트에 사용할 고정 사용자 ID
const TEST_USER_ID = "test-user-01"; 

// Firestore 타임스탬프 객체를 생성하는 헬퍼 함수
const createTimestamp = (day) => {
    // 월은 0부터 시작하므로 6월은 5입니다.
    return new Date(2025, 5, day); 
};

// 12회 분량의 가짜 저널 데이터 배열
export const fakeJournals = [
    // --- 1~4회차: 새로운 환경에 대한 불안과 어려움 ---
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(1),
        title: "새로운 학교, 새로운 친구들",
        summary: "오늘 새로운 학교에 갔다. 아는 친구가 한 명도 없어서 너무 외로웠다. 먼저 말을 거는 게 너무 어렵고, 다들 나를 이상하게 보는 것 같았다. 점심도 혼자 먹었다. 내일 학교에 가기가 조금 무섭다.",
        detailedAnalysis: {
            keywords: ["새학기", "친구", "혼자", "불안", "어려움"],
            emotionToneData: { '기쁨': 0.1, '슬픔': 0.5, '불안': 0.4, '분노': 0.0, '중립': 0.0 },
            cognitiveDistortions: ["독심술 (다들 나를 이상하게 볼 거야)", "과잉일반화 (아무도 나랑 친구 안 할 거야)"],
            patterns: ["새로운 환경에 대한 불안 표현"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(3),
        title: "어색한 침묵",
        summary: "짝꿍에게 용기를 내서 말을 걸어봤지만, 대답이 짧았다. 더 무슨 말을 해야 할지 몰라서 그냥 조용히 있었다. 내가 재미없는 사람이라고 생각하는 것 같다. 역시 나는 친구를 사귀는 데 재능이 없나 보다.",
        detailedAnalysis: {
            keywords: ["짝꿍", "어색함", "침묵", "슬픔", "재능"],
            emotionToneData: { '기쁨': 0.0, '슬픔': 0.6, '불안': 0.3, '분노': 0.0, '중립': 0.1 },
            cognitiveDistortions: ["개인화 (내가 재미없어서 대답이 짧았을 거야)"],
            patterns: ["사회적 상호작용의 어려움 토로"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(5),
        title: "엄마와의 대화",
        summary: "학교에서의 일을 엄마에게 털어놓았다. 엄마는 괜찮다고, 시간이 걸릴 뿐이라고 위로해주셨다. 조금 마음이 놓이기는 했지만, 여전히 걱정이 된다. 엄마는 나를 이해해주시는 것 같다.",
        detailedAnalysis: {
            keywords: ["엄마", "위로", "걱정", "마음", "이해"],
            emotionToneData: { '기쁨': 0.2, '슬픔': 0.4, '불안': 0.3, '분노': 0.0, '중립': 0.1 },
            cognitiveDistortions: [],
            patterns: ["가족에게 정서적 지지를 구함"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(8),
        title: "과학 동아리",
        summary: "엄마의 추천으로 과학 동아리에 가입했다. 아직은 모든 게 낯설고 어렵다. 그래도 내가 좋아하는 로봇 이야기가 나와서 조금 흥미가 생겼다. 다음 주에도 가볼 생각이다.",
        detailedAnalysis: {
            keywords: ["동아리", "과학", "로봇", "흥미", "엄마"],
            emotionToneData: { '기쁨': 0.3, '슬픔': 0.2, '불안': 0.3, '분노': 0.0, '중립': 0.2 },
            cognitiveDistortions: [],
            patterns: ["새로운 활동을 통한 변화 시도"]
        }
    },
    // --- 5~8회차: 작은 성공과 관계의 시작 (누적 분석 가능) ---
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(11),
        title: "민지라는 친구",
        summary: "동아리에서 민지라는 친구가 먼저 말을 걸어주었다. 로봇 조립하는 것을 도와주었는데, 고맙다고 했다. 처음으로 학교에서 누군가와 긴 대화를 나눈 것 같다. 조금 기뻤다.",
        detailedAnalysis: {
            keywords: ["민지", "동아리", "로봇", "대화", "기쁨"],
            emotionToneData: { '기쁨': 0.5, '슬픔': 0.1, '불안': 0.2, '분노': 0.0, '중립': 0.2 },
            cognitiveDistortions: [],
            patterns: ["긍정적인 또래 관계 형성 시작"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(14),
        title: "같이 숙제하기",
        summary: "오늘 민지랑 방과 후에 남아서 같이 숙제를 했다. 모르는 문제를 서로 알려주면서 하니 시간이 금방 갔다. 혼자 할 때보다 훨씬 재미있었다. 이제 학교 가는 게 무섭지는 않다.",
        detailedAnalysis: {
            keywords: ["민지", "숙제", "재미", "친구", "학교"],
            emotionToneData: { '기쁨': 0.6, '슬픔': 0.0, '불안': 0.1, '분노': 0.0, '중립': 0.3 },
            cognitiveDistortions: [],
            patterns: ["협력적인 활동을 통한 관계 발전"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(16),
        title: "작은 오해",
        summary: "내가 한 말에 민지가 잠시 표정이 안 좋았다. 내가 뭘 잘못했나 싶어서 하루 종일 신경이 쓰였다. 집에 와서 곰곰이 생각해보니, 내 말투가 너무 단정적이었던 것 같다. 내일 사과해야겠다.",
        detailedAnalysis: {
            keywords: ["오해", "친구", "말투", "신경쓰임", "사과"],
            emotionToneData: { '기쁨': 0.1, '슬픔': 0.3, '불안': 0.4, '분노': 0.0, '중립': 0.2 },
            cognitiveDistortions: ["개인화 (나 때문에 표정이 안 좋았을 거야)"],
            patterns: ["갈등 상황에 대한 자기 성찰"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(17),
        title: "용기 내어 사과하기",
        summary: "어제 일에 대해 민지에게 사과했다. 민지는 괜찮다고, 오해였다고 말해주었다. 오히려 솔직하게 말해줘서 고맙다고 했다. 정말 다행이고, 마음이 한결 가벼워졌다. 용기 내길 잘했다.",
        detailedAnalysis: {
            keywords: ["용기", "사과", "친구", "솔직함", "성취감"],
            emotionToneData: { '기쁨': 0.7, '슬픔': 0.1, '불안': 0.1, '분노': 0.0, '중립': 0.1 },
            cognitiveDistortions: [],
            patterns: ["갈등 해결 및 관계 회복"]
        }
    },
    // --- 9~12회차: 자신감 획득 및 성장 (심층 분석 가능) ---
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(20),
        title: "동아리 발표",
        summary: "오늘 동아리에서 우리가 만든 로봇에 대해 발표했다. 민지랑 같이 준비해서 그런지 떨리지 않았다. 선생님과 친구들이 잘했다고 칭찬해주셔서 뿌듯했다. 예전의 나라면 상상도 못 할 일이다.",
        detailedAnalysis: {
            keywords: ["발표", "로봇", "칭찬", "뿌듯함", "성장", "선생님"],
            emotionToneData: { '기쁨': 0.8, '슬픔': 0.0, '불안': 0.1, '분노': 0.0, '중립': 0.1 },
            cognitiveDistortions: [],
            patterns: ["성공적인 과업 수행을 통한 자신감 획득"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(23),
        title: "다른 친구들",
        summary: "이제는 민지뿐만 아니라 동아리의 다른 친구들과도 조금씩 이야기를 나눈다. 내가 먼저 말을 거는 게 예전만큼 두렵지 않다. 학교생활이 재미있어지기 시작했다.",
        detailedAnalysis: {
            keywords: ["친구들", "자신감", "재미", "학교생활", "도전"],
            emotionToneData: { '기쁨': 0.7, '슬픔': 0.0, '불안': 0.1, '분노': 0.0, '중립': 0.2 },
            cognitiveDistortions: [],
            patterns: ["사회적 관계망 확장"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(26),
        title: "돌아보기",
        summary: "한 달 전의 나를 생각하면 지금이 믿기지 않는다. 혼자였고 불안했는데, 지금은 같이 웃는 친구가 생겼다. 작은 용기가 큰 변화를 만든다는 것을 깨달았다. 엄마에게도 감사하다.",
        detailedAnalysis: {
            keywords: ["변화", "깨달음", "친구", "용기", "감사", "엄마"],
            emotionToneData: { '기쁨': 0.6, '슬픔': 0.1, '불안': 0.1, '분노': 0.0, '중립': 0.2 },
            cognitiveDistortions: [],
            patterns: ["과거와 현재를 비교하며 자신의 성장을 인지함"]
        }
    },
    {
        userId: TEST_USER_ID,
        createdAt: createTimestamp(28),
        title: "다음 학기",
        summary: "이제 곧 방학이다. 다음 학기가 기다려진다. 민지랑 더 재미있는 로봇을 만들고 싶고, 다른 친구들과도 더 친해지고 싶다. 무엇이든 잘 해낼 수 있을 것 같은 자신감이 생긴다.",
        detailedAnalysis: {
            keywords: ["기대", "자신감", "계획", "친구", "로봇"],
            emotionToneData: { '기쁨': 0.7, '슬픔': 0.0, '불안': 0.0, '분노': 0.0, '중립': 0.3 },
            cognitiveDistortions: [],
            patterns: ["미래에 대한 긍정적 전망"]
        }
    }
];