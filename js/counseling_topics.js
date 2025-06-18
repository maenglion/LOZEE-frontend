// counseling_topics.js (수정 완료된 최종본)

// 상담실 주제: 사용자 유형 및 나이별 관리용 데이터
export const counselingTopicsByAge = {
  directUser: { // 당사자가 직접 상담받는 경우
    // [수정] '10세미만' 데이터 구조를 배열 형태로 변경
    '10세미만': [
      {
        name: "감정 이야기",
        subTopics: [
          { icon: "😡", displayText: "나 엄청 화나!", tags: ["감정조절 어려움", "분노"], type: "emotion_intensity" },
          { icon: "😭", displayText: "뭐든지 참을 수는 없을까? 마음을 조절하기 어려워", tags: ["감정조절 어려움", "충동성"], type: "else" },
          { icon: "😢", displayText: "나 요즘 속상한 일이 있어.", tags: ["슬픔", "우울감"], type: "else" },
          { icon: "😟", displayText: "잠을 잘 못자겠어.", tags: ["불안감", "수면 문제", "악몽"], type: "situation" },
          { icon: "😥", displayText: "작은 일에도 쉽게 속상해.", tags: ["예민함", "소심함", "감정기복"], type: "else" },
          { icon: "🎉", displayText: "한번 화가나면 멈출 수 없어. 나중에 후회가 돼", tags: ["감정조절 어려움", "분노", "충동성", "후회"], type: "situation" },
          { icon: "😒", displayText: "자꾸 혼나니까 나쁜 마음이 생겨", tags: ["반항심", "분노", "억울함"], type: "emotion_intensity" },
          { icon: "🤫", displayText: "내 감정을 말로 하기 어려워", tags: ["언어문제","표현언어", "소통"], type: "situation" },
          { icon: "💬", displayText: "거절은 싫어", tags: ["감정조절 어려움", "사회적 상호작용", "떼쓰기","회피"], type: "emotion_intensity" }
        ]
      },
      {
        name: "친구 이야기",
        subTopics: [
          { icon: "🥺", displayText: "친구를 사귀려면 어떻게 말 걸어?", tags: ["친구 관계 어려움", "사회성", "소심함"], type: "situation" },
          { icon: "😠", displayText: "내가 특이한 거야?", tags: ["친구 관계 어려움", "소외감", "자기 인식"], type: "situation" },
          { icon: "🤦", displayText: "친구들이 내 의도를 몰라줘", tags: ["친구 관계 어려움", "오해", "서운함"], type: "situation" },
          { icon: "🧐", displayText: "자꾸 나한테 눈치가 없대", tags: ["사회적 의사소통 어려움", "눈치", "비언어적 단서"], type: "situation" },
          { icon: "🤝", displayText: "친구랑 싸웠는데 누가 잘못한거야?", tags: ["친구 관계 어려움", "갈등 해결"], type: "situation" },
          { icon: "😨", displayText: "난 변화가 너무 불편해", tags: ["강박적 성향", "변화저항", "불안감"], type: "situation" },
          { icon: "👀", displayText: "눈 마주치기 너무 부담스러워", tags: ["사회적 의사소통 어려움", "시선 회피", "불안감"], type: "situation" },
          { icon: "😳", displayText: "사실을 말한 건데, 잘못된 걸까?", tags: ["사회적 의사소통 어려움", "상황 이해", "눈치"], type: "situation" },
          { icon: "⁉️", displayText: "농담인지 진담인지 헷갈려", tags: ["사회적 의사소통 어려움", "상황 이해", "유머 이해"], type: "situation" },
          { icon: "🥊", displayText: "친구가 놀릴 때 어떻게 해야 해?", tags: ["친구 관계 어려움", "괴롭힘 대처", "자기보호"], type: "situation" },
          { icon: "🫂", displayText: "다른 사람과 몸이 닿으면 너무 불편해", tags: ["감각 민감성", "촉각 방어"], type: "situation" },
        ]
      },
      {
        name: "학교생활 이야기",
        subTopics: [
          { icon: "😫", displayText: "학교(유치원) 가기 너무 싫어", tags: ["등교 거부", "학교 부적응", "분리 불안"], type: "situation" },
          { icon: "🤯", displayText: "재미없는 수업에 집중하기 힘들어", tags: ["학업 어려움", "주의력 부족", "산만함"], type: "emotion_intensity" },
          { icon: "🚧", displayText: "좋은 일이 있었어", tags: ["성취", "긍정", "기쁨"], type: "situation" },
          { icon: "📐", displayText: "규칙이 갑자기 바뀌거나 다르면 너무 화가 나", tags: ["강박적 성향", "규칙집착", "융통성 부족"], type: "situation" },
        ]
      },
      {
        name: "가족 이야기",
        subTopics: [
          { icon: "😠", displayText: "엄마(아빠)랑 맨날 싸워", tags: ["가족 관계 어려움", "부모와 갈등"], type: "situation" },
          { icon: "😥", displayText: "부모님이 내 마음을 잘 몰라줘", tags: ["가족 관계 어려움", "이해받고 싶은 마음", "소외감"], type: "situation" },
        ]
      },
      {
        name: "내 마음 이야기",
        subTopics: [
          { icon: "👽", displayText: "친구들이 내가 특이하다고 해", tags: ["자기 인식", "소외감", "사회적 의사소통 어려움"], type: "else" },
          { icon: "👎", displayText: "잘하는 게 하나도 없는 것 같아 슬퍼", tags: ["낮은 자존감", "무력감", "슬픔"], type: "emotion_intensity" },
          { icon: "⭐", displayText: "나도 잘하는 게 있거나 특별한 점이 있을까?", tags: ["강점 찾기", "자기 발견", "긍정적 자아상"], type: "else" },
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