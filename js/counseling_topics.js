// counseling_topics.js (수정 완료된 최종본)

// 상담실 주제: 사용자 유형 및 나이별 관리용 데이터
export const counselingTopicsByAge = {
  directUser: { // 당사자가 직접 상담받는 경우
    // [수정] '10세미만' 데이터 구조를 배열 형태로 변경
'10세미만': [
  {
    name: "감정 표현하기", // 1. 감정표현
    subTopics: [
      { icon: "😡", displayText: "나 엄청 화나!", tags: ["분노", "감정조절"], type: "emotion_intensity" },
      { icon: "🎉", displayText: "슬픈 일이 있었어", tags: ["슬픔", "우울감"], type: "else" },
      { icon: "😭", displayText: "나 너무 억울해", tags: ["억울함", "부당함", "분노"], type: "situation" }, // 신규
      { icon: "😥", displayText: "작은 일에도 쉽게 마음이 다쳐", tags: ["예민함", "소심함", "감정기복"], type: "else" },
      { icon: "🔥", displayText: "화가 나면 조절이 안돼", tags: ["감정조절 어려움", "충동성"], type: "situation" },
      { icon: "❤️", displayText: "고맙다고 하고 싶은 사람이 생겼어", tags: ["감사", "긍정 관계", "행복"], type: "situation" }, // 긍정+
      { icon: "❓", displayText: "이 기분은 뭐야야?", tags: ["공감", "감정 이해", "사회성"], type: "else" } // 신규
    ]
  },
  {
    name: "친구 이야기", // 2. 친구이야기
    subTopics: [
      { icon: "🤝", displayText: "새로운 친구가 생겼어!", tags: ["친구 관계", "새로운 관계", "기쁨"], type: "situation" }, // 긍정+
      { icon: "🎲", displayText: "친구랑 같이 노니까 정말 재밌었어", tags: ["친구 관계", "즐거움", "협동"], type: "situation" }, // 긍정+
      { icon: "🥺", displayText: "친구를 사귀려면 어떻게 말을 걸어?", tags: ["친구 관계 어려움", "사회성", "소심함"], type: "situation" },
      { icon: "😠", displayText: "나만 빼고 노는 것 같아서 속상해", tags: ["친구 관계 어려움", "소외감", "서운함"], type: "situation" },
      { icon: "🧐", displayText: "자꾸 나한테 눈치가 없대", tags: ["사회적 의사소통 어려움", "눈치", "비언어적 단서"], type: "situation" },
      { icon: "🥊", displayText: "친구가 놀릴 때 어떻게 해야 해?", tags: ["친구 관계 어려움", "괴롭힘 대처", "자기보호"], type: "situation" },
      { icon: "❤️", displayText: "내가 좋아하는 친구가 있어", tags: ["친구 관계", "애정", "긍정 관계"], type: "situation" }, // 긍정+
      { icon: "🤷", displayText: "친구랑 싸웠는데 누가 잘못한 거야?", tags: ["친구 관계 어려움", "갈등 해결"], type: "situation" }
    ]
  },
  {
    name: "가족 이야기", // 3. 가족 이야기
    subTopics: [
      { icon: "🥰", displayText: "엄마(아빠)한테 칭찬받아서 기분 좋아", tags: ["가족 관계", "칭찬", "자존감"], type: "situation" }, // 긍정+
      { icon: "🏕️", displayText: "우리 가족 다 같이 놀러 갔던 게 생각나", tags: ["가족 관계", "행복한 기억", "추억"], type: "situation" }, // 긍정+
      { icon: "😠", displayText: "엄마(아빠)랑 맨날 싸워", tags: ["가족 관계 어려움", "부모와 갈등"], type: "situation" },
      { icon: "😠", displayText: "이상한 가족이 있어", tags: ["가족 관계 어려움", "갈등"], type: "situation" },
      { icon: "😥", displayText: "부모님이 내 마음을 잘 몰라줘", tags: ["가족 관계 어려움", "이해받고 싶은 마음", "소외감"], type: "situation" },
      { icon: "👶", displayText: "동생(형/누나) 때문에 짜증나", tags: ["가족 관계 어려움", "형제자매 갈등", "질투"], type: "situation" }, // 신규
      { icon: "🎁", displayText: "가족들한테 자랑하고 싶은 게 있어", tags: ["가족 관계", "성취", "자랑"], type: "situation" } // 긍정+
    ]
  },
  {
    name: "말하기가 어려워", // 4. 언어표현 (카테고리 구체화)
    subTopics: [
      { icon: "🤫", displayText: "내 마음, 뭐라고 해야해?", tags: ["언어문제", "표현언어", "소통"], type: "situation" },
      { icon: "🗣️", displayText: "싫다고 하지 말라고 거절해도 괜찮을까?", tags: ["자기표현", "거절하기", "주장 훈련"], type: "situation" }, // 신규
      { icon: "🙏", displayText: "미안하다고 어떻게 말해야 할까?", tags: ["사과하기", "관계 회복", "사회적 기술"], type: "situation" }, // 신규
      { icon: "👍", displayText: "좋아하는 친구한테 표현하고 싶어", tags: ["칭찬하기", "긍정적 상호작용", "사회적 기술"], type: "situation" }, // 신규
      { icon: "⁉️", displayText: "농담인지 진담인지 헷갈려", tags: ["사회적 의사소통 어려움", "상황 이해", "유머 이해"], type: "situation" }
    ]
  },
  {
    name: "내 마음 들여다보기", // 5. 내 마음 이야기
    subTopics: [
      { icon: "⭐", displayText: "내가 나 스스로를 칭찬해주고 싶어", tags: ["자존감", "자기인식", "성취"], type: "emotion_intensity" }, // 긍정+
      { icon: "👎", displayText: "잘하는 게 하나도 없는 것 같아", tags: ["낮은 자존감", "무력감", "슬픔"], type: "emotion_intensity" },
      { icon: "👽", displayText: "친구들이 내가 좀 특이하대", tags: ["자기 인식", "소외감", "정체성"], type: "else" },
      { icon: "🎯", displayText: "나도 잘하는 게 뭘까?", tags: ["강점 찾기", "자기 발견", "긍정적 자아상"], type: "else" },
      { icon: "💭", displayText: "요즘 내가 푹 빠져있는 게 있어", tags: ["흥미", "관심사", "자기 발견"], type: "situation" }, // 긍정+
      { icon: "🏫", displayText: "학교(유치원) 가기 싫어", tags: ["등교 거부", "학교 부적응", "분리 불안"], type: "situation" } // 학교생활 → 내 마음으로 이동
    ]
  }
],
    '11-15세': [ // (기존 구조가 올바르므로 유지)
      { name: "학교와 공부", subTopics: [/* ... */] },
      { name: "친구와 관계", subTopics: [/* ... */] },
      { name: "나와 내 마음", subTopics: [/* ... */] },
      { name: "가족 관계", subTopics: [/* ... */] },
      { name: "이성 및 기타 고민", subTopics: [/* ... */] }
    ],
    '16-29세': [ // (기존 구조가 올바르므로 유지)
      { name: "학업 및 진로", subTopics: [/* ... */] },
      { name: "친구 및 대인관계 (연애, 결혼 포함)", subTopics: [/* ... */] },
      { name: "나와 내 마음 (정체성)", subTopics: [/* ... */] },
      { name: "독립 및 사회생활", subTopics: [/* ... */] }
    ]
  },
  caregiver: { // 양육자 모드
    // [수정] 양육자 모드도 일관된 구조로 변경 (나이 구분이 없으므로 'common' 키 하나만 사용)
    'common': [
      {
        name: "양육의 어려움",
        subTopics: [
          { icon: "😩", displayText: "양육 스트레스", tags: ["양육 스트레스", "소진", "번아웃"], type: "emotion_intensity" },
          { icon: "🧩", displayText: "진단·특성에 대한 이해", tags: ["신경다양성 이해", "자폐", "ADHD"], type: "else" },
          { icon: "💸", displayText: "치료비 교육 부담", tags: ["경제적 부담", "장기 치료"], type: "situation" },
        ]
      },
      {
        name: "신경다양성 아이로 인한 나의 인간관계",
        subTopics: [
          { icon: "😥", displayText: "양육으로 인한 의견충돌", tags: ["부부 갈등", "양육 스트레스"], type: "situation" },
          { icon: "😩", displayText: "아이로 인한 인간관계", tags: ["차별", "회피", "사회적 편견"], type: "else" },
          { icon: "👵🏻", displayText: "조부모와 충돌", tags: ["세대 차이", "육아 갈등"], type: "situation" },
        ]
      },
      {
        name: "나의 감정상태",
        subTopics: [
          { icon: "😔", displayText: "자존감 저하", tags: ["자존감", "무력감"], type: "emotion_intensity" },
          { icon: "😣", displayText: "불안과 걱정", tags: ["불안", "미래 걱정"], type: "emotion_intensity" },
          { icon: "😢", displayText: "슬픔과 외로움", tags: ["우울", "외로움"], type: "emotion_intensity" },
          { icon: "😢", displayText: "기타", tags: ["자유주제"], type: "else" },
        ]
      }
    ]
  }
};

// [수정] 아래의 중복된 변수들은 모두 제거합니다.
// export const counselingTopicsForChild = { ... };
// export const counselingTopicsForParent_ND = [ ... ];
// export const counselingTopicsForParent_Typical = [ ... ];