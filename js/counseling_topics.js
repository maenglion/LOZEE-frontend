// counseling_topics.js

// 상담실 주제: 나이별 관리용 데이터
export const counselingTopicsByAge = {
  '7-10': { // 10세 이하 특정 필요 아동 대상 주제 (카테고리별 그룹화)
    "감정 이야기": [
      { icon: "😡", displayText: "나 엄청 화나가!", tags: ["분노 폭발", "감정 조절 어려움"], type: "emotion_intensity" },
      { icon: "😭", displayText: "이유 없이 화가 막 나", tags: ["갑작스러운 분노", "이유 모를 화"], type: "emotion_intensity" },
      { icon: "😢", displayText: "갑자기 너무 슬퍼", tags: ["갑작스러운 슬픔", "이유 모를 슬픔"], type: "emotion_intensity" },
      { icon: "🤔", displayText: "내 마음인데 조절이 안돼", tags: ["감정 조절 어려움", "자기 통제 부족"], type: "else" }, // 감정 조절의 '상황'이나 '양상'을 묻는 것이 더 적절
      { icon: "🎢", displayText: "기분이 갑자기 좋았다 나빠져", tags: ["감정 기복", "변덕스러움"], type: "else" }, // 감정 변화의 '양상'이나 '계기'를 묻는 것이 더 적절
      { icon: "😟", displayText: "무서워서 밤에 잠을 못자.", tags: ["불안", "두려움", "악몽", "수면 문제"], type: "emotion_intensity" },
      { icon: "😥", displayText: "작은 일에도 쉽게 속상하고 울어", tags: ["예민함", "슬픔", "감정 과민"], type: "else" },
      { icon: "❓", displayText: "내가 왜 이러는지 모르겠어", tags: ["혼란스러운 감정", "자기 이해 부족"], type: "else" }, // 탐색적 질문 필요
      { icon: "🎉", displayText: "한번 시작하면 멈출 수 없어", tags: ["과도한 흥분", "충동성", "자기 조절 어려움"], type: "situation" }, // 행동/상황에 가까움
      { icon: "🗣️", displayText: "나 말을 너무 못해서 답답해", tags: ["감정 표현의 어려움", "의사 표현의 어려움"], type: "situation" }, // 결과적인 감정은 있지만, 상황/능력
      { icon: "😒", displayText: "괜히 짜증 나고 다 싫어", tags: ["짜증", "거부감", "반항심"], type: "emotion_intensity" },
      { icon: "🤫", displayText: "내 감정을 말로 하기 어려워", tags: ["표현의 어려움", "내적 언어"], type: "situation" }, // 감정 표현의 어려움 자체가 핵심
      { icon: "💔", displayText: "내 마음 몰라줘서 속상해", tags: ["이해받지 못함", "서운함"], type: "situation" }, // 상황. 왜, 무슨일이야? 라고 물어봐야 할 거 같아
      { icon: "💧", displayText: "울고싶은데 참아야해.", tags: ["억눌린 슬픔", "감정 억압"], type: "situation" }, // 상황. 왜, 무슨일이야? 라고 물어봐야 할 거 같아
      { icon: "💬", displayText: "난 발표하는게 너무 떨려", tags: ["발화 전 생각 멈춤", "발표 불안", "긴장"], type: "emotion_intensity" } // 특정 상황에서의 감정 강도
    ],
    "친구 이야기": [ 
      { icon: "😔", displayText: "친구들이 날 피하는 것 같아", tags: ["따돌림", "소외감", "친구 관계 어려움"], type: "situation" },
      { icon: "🥺", displayText: "친구랑 놀고 싶은데, 어떻게 말 걸어?", tags: ["관계 시작의 어려움", "사회성 부족", "소심함"], type: "situation" },
      { icon: "😠", displayText: "친구들이 내 말 안 들어줘서 속상해", tags: ["무시당하는 느낌", "존중받지 못함"], type: "situation" }, // 상황 + 감정이나, 상황 탐색 우선
      { icon: "🤦", displayText: "친구들이 날 이해 못 하는 것 같아", tags: ["오해", "서운함", "공감 부족"], type: "situation" },
      { icon: "🧐", displayText: "나만 모르는 친구들 규칙이 있나봐", tags: ["사회적 규칙 이해 어려움", "눈치 없음"], type: "situation" },
      { icon: "🤝", displayText: "친구랑 싸웠는데 누가 잘못한거야?", tags: ["갈등 해결의 어려움", "친구 관계 어려움"], type: "situation" },
      { icon: "😨", displayText: "새로운 곳, 새로운 사람 이런 거 너무 불편해", tags: ["강박", "사회적 불안", "낯가림"], type: "situation" }, // 상황으로 인한 감정
      { icon: "😵", displayText: "다른 사람 표정/말투, 잘 모르겠어", tags: ["비언어적 단서 파악 어려움", "공감 능력 부족"], type: "situation" },
      { icon: "👀", displayText: "눈 마주치기 너무 부담스러워", tags: ["시선 처리의 어려움", "사회적 불안"], type: "situation" }, // 상황에 따른 감정
      { icon: "😳", displayText: "같이 놀고 싶은데, 애들이 이상하게 봐", tags: ["시선 불안", "소속감 문제", "자의식 과잉"], type: "situation" },
      { icon: "⁉️", displayText: "농담인지 진담인지 헷갈려", tags: ["맥락 파악 어려움", "유머 이해 부족", "사회적 단서 부족"], type: "situation" },
      { icon: "🥊", displayText: "친구가 놀릴 때 어떻게 해야 해?", tags: ["괴롭힘 대처", "자기방어 어려움"], type: "situation" },
      { icon: "🫂", displayText: "다른 사람이 만지면 너무 불편해", tags: ["감각과민", "개인 공간 침해"], type: "situation" }, // 상황에 따른 감각/감정
      { icon: "👨‍👩‍👧‍👦", displayText: "다 같이 놀 때 끼기 어려워", tags: ["그룹 활동 어려움", "사회성 부족"], type: "situation" },
      { icon: "🗣️", displayText: "내 말이 잘 안 통해, 답답해", tags: ["의사소통의 어려움", "조리 있게 말하기"], type: "situation" },
      { icon: "😥", displayText: "내가 말 못해서 대화 끊길까 봐 걱정돼", tags: ["언어 지연 우려", "대화 불안", "말더듬"], type: "situation" },
      { icon: "😤", displayText: "내 말을 오해해서 너무 억울해", tags: ["오해로 인한 억울함", "의사소통 오류"], type: "situation" }, // 왜 억울한지 상황을 듣고 감정 강도를 물어봐야 함
      { icon: "🗣️", displayText: "사람들 앞에서 목소리가 떨려", tags: ["발표 불안", "대면 불안", "사회 공포"], type: "emotion_intensity" } // 보통 얼마나 떨리는데 1부터 10까지로 말해봐
    ],
    "학교생활 이야기": [ // 대부분 situation 타입으로 분류
      { icon: "😫", displayText: "학교(유치원) 가기 너무 싫어", tags: ["등교 거부", "학교 부적응", "분리 불안"], type: "situation" }, // 상황  왜?
      { icon: "🤯", displayText: "선생님 말에 집중하기 힘들어", tags: ["주의력 결핍", "산만함", "수업 집중 어려움"], type: "emotion_intensity" }, // 얼마나 힘든데? 1~10
      { icon: "🤸", displayText: "가만히 있기 너무 답답해", tags: ["과잉행동", "충동성", "불안"], type: "emotion_intensity" }, // 가만히 있으려고 하면 얼마나 답답해? 1~10
      { icon: "🧠", displayText: "자꾸 뭘 잃어버리거나 깜빡해", tags: ["건망증", "부주의", "실행 기능 저하"], type: "situation" }, // 얼마나 자주?
      { icon: "🌪️", displayText: "주변이 바뀌면 너무 불안해", tags: ["변화에 대한 저항", "예측 불가능성 불안"], type: "emotion_intensity" }, // 얼마나 불안해? 1~10 
      { icon: "📐", displayText: "내 규칙 깨지면 너무 화나", tags: ["강박적 사고", "루틴 집착", "융통성 부족"], type: "situation" }, // 최근 그런 일이 있었니?
      { icon: "🙉", displayText: "난 남들보다 예민해", tags: ["감각 과민성", "청각 민감", "시각 민감", "후각 민감", "미각 민감", "예민함" ], type: "emotion_intensity" }, // 5를 일반적인 사람들이라고 치자. 그럴때 1~10까지 중 너는 몇? 
      { icon: "❓", displayText: "다른 애들은 괜찮은데, 왜 나만 불편해?", tags: ["감각 차이 인식", "자기 인식"], type: "situation" },
      { icon: "🗓️", displayText: "하던 일 바뀌면 너무 짜증나", tags: ["루틴 변경 불안", "예측 가능성 선호"], type: "emotion_intensity" }, // 얼마나 짜증나? 1~10 
      { icon: "⏰", displayText: "시간 약속 못 지켜서 혼나거나 불안해", tags: ["시간 관리 어려움", "지각", "계획성 부족"], type: "situation" },
      { icon: "📚", displayText: "숙제/공부 너무 어렵고 하기 싫어", tags: ["학습 어려움", "학업 스트레스", "학습 동기 저하"], type: "situation" },
      { icon: "📉", displayText: "설명해주면 금방 잊어버려", tags: ["단기 기억력 문제", "작업 기억 부족"], type: "situation" },
      { icon: "🚧", displayText: "계획대로 안 될 때", tags: ["실행 기능 어려움", "계획 수정의 어려움", "좌절"], type: "situation" },
      { icon: "✨", displayText: "작은 변화에도 너무 신경 쓰여", tags: ["과도한 민감성", "불안정성" ,"예민함" ], type: "situation" } // 어떤 일이 그런데?
    ],
    "가족 이야기": [ // 대부분 situation 타입으로 분류
      { icon: "😠", displayText: "엄마(아빠)랑 맨날 싸워", tags: ["부모와의 갈등", "가족 불화"], type: "situation" },
      { icon: "😥", displayText: "부모님이 내 마음을 잘 몰라줘", tags: ["부모와의 소통 부재", "이해받지 못함"], type: "situation" }, // 상황 + 감정이나, 상황 탐색 우선
      { icon: "😭", displayText: "우리 부모님은 이혼했어", tags: ["이혼 가정", "가족 해체", "슬픔"], type: "situation" }, // 상황 설명 후 감정 탐색 가능
      { icon: "😠", displayText: "이상한 가족이 있어", tags: ["이해안돼", "거짓말하는사람","나쁜사람"], type: "situation" },
      { icon: "🤔", displayText: "새 가족이 생겼는데 어색해", tags: ["재혼 가정", "새로운 가족 적응"], type: "situation" },
      { icon: "😡", displayText: "형제랑 너무 많이 싸워서 힘들어", tags: ["형제자매 갈등", "경쟁심"], type: "situation" }, // 형제에 대해 묻기
      { icon: "😔", displayText: "나만 혼나는 것 같아서 억울해", tags: ["차별받는 느낌", "억울함"], type: "situation" },
      { icon: "🤫", displayText: "가족에게 말 못 할 비밀이 있어", tags: ["비밀", "가족 내 소통 어려움"], type: "situation" },
      { icon: "😟", displayText: "집에 들어가기 싫을 때가 있어", tags: ["가정 불화", "회피"], type: "situation" } // 지금 그래? 아니면 그런 적이 최근 언제였어?
    ],
    "내 마음 이야기": [ // 대부분 else 또는 emotion_intensity로 분류
      { icon: "👽", displayText: "애들이 내가 특이하대", tags: ["소외감", "정체성 혼란", "다름에 대한 인식"], type: "else" }, // 그런 소리 들을 때 기분이 어떤지 or 왜 그런 소리를 애들이 했는지
      { icon: "❓", displayText: "난 왜 맨날 이상하다는 소리 듣지?", tags: ["자기 인식", "정체성 고민", "자아 탐색"], type: "else" }, // 그런 소리 들을 때 기분이 어떤지 or 무슨 일이 있었는지
      { icon: "👎", displayText: "잘하는 게 하나도 없는 것 같아 슬퍼", tags: ["낮은 자존감", "무력감", "자기 효능감 부족"], type: "emotion_intensity" }, // 감정의 강도가 세면 자존감 대화 필요
      { icon: "🤡", displayText: "내가 너무 바보 같고 창피해", tags: ["자기 비하", "수치심"], type: "emotion_intensity" }, // 얼마나 그런 기분을 강하게 느끼고 있어? 1~10, 감정의 강도가 세면 자존감을 올려줄 수 있는 대화를 할 것
      { icon: "😨", displayText: "실수할까 봐 시작하기 무서워", tags: ["실패에 대한 두려움", "완벽주의 성향", "도전 회피"], type: "situation" }, // 최근 그런 일이 있었니?
      { icon: "⭐", displayText: "나도 특별한 점이나 잘하는 게 있을까?", tags: ["강점 찾기", "자기 발견", "긍정적 자기 인식"], type: "else" },
      { icon: "💔", displayText: "내가 너무 싫을 때", tags: ["자기혐오", "부정적 자아상"], type: "emotion_intensity" }, // 그런 감정이 지금 얼마나 강한거야? 1~10 / 자존감 대화 필요
      { icon: "🧍", displayText: "혼자 있고 싶은데 외로워", tags: ["양가감정", "소속감 욕구", "대인관계 어려움"], type: "emotion_intensity" },// 요즘 외롭다는 느낌이 얼만큼 강하게 들은거야? 1~10 
      { icon: "❓", displayText: "내가 진짜 뭘 좋아하는지 잘 모르겠어", tags: ["자기 탐색의 어려움", "흥미 발견 부족"], type: "else" } // 그럼 우리 먼저 네가 잘하는 것을 찾아볼까?
    ]
  },
  '11-15': { 
    "학교와 공부": [
      { icon: "📚", displayText: "공부 때문에 너무 스트레스 받아", tags: ["학업 스트레스", "성적 고민", "시험 불안"], type: "emotion_intensity" },
      { icon: "🤔", displayText: "내가 뭘 잘하는지, 뭘 하고 싶은지 모르겠어", tags: ["진로 고민", "장래희망", "적성 찾기"], type: "else" },
      { icon: "😫", displayText: "학교 가기 싫어, 재미 없어", tags: ["학교 부적응", "등교 거부", "수업 흥미 저하"], type: "situation" },
      { icon: "🤯", displayText: "수업 내용이 이해 안 돼", tags: ["학습 부진", "수업 이해 어려움"], type: "situation" },
      { icon: "⏰", displayText: "시간이 너무 부족해, 맨날 바빠", tags: ["시간 관리", "학업 부담", "과도한 스케줄"], type: "situation" }
    ],
    "친구와 관계": [ // 대부분 situation 또는 else
      { icon: "😔", displayText: "친구들이랑 멀어진 것 같아", tags: ["친구 관계 소원", "소외감", "따돌림 우려"], type: "emotion_intensity" }, // 이건 불안감이야. 따돌림에 대한 그런 느낌이 얼마나 되냐고 물어봐줘야 해
      { icon: "😠", displayText: "친구랑 크게 싸웠어, 어떡해?", tags: ["친구와 갈등", "화해의 어려움", "관계 회복"], type: "situation" },
      { icon: "🤫", displayText: "친구 비밀 때문에 고민이야", tags: ["비밀 유지", "친구 관계 윤리"], type: "situation" },
      { icon: "💔", displayText: "믿었던 친구한테 배신당했어", tags: ["배신감", "실망", "친구 관계 깨짐"], type: "situation" }, // 상황 후 감정 탐색
      { icon: "💻", displayText: "SNS에서 나만 빼고 다 재밌게 노는 것 같아", tags: ["SNS 소외감", "비교", "온라인 관계"], type: "situation" },
      { icon: "❓", displayText: "친한사이는 어떤거야?", tags: ["진정한 우정", "친구의 의미", "관계의 깊이"], type: "else" }
    ],
    "나와 내 마음": [ // 대부분 emotion_intensity 또는 else
      { icon: "😥", displayText: "요즘 너무 우울하고 하기 싫어", tags: ["우울감", "무기력", "청소년 우울"], type: "emotion_intensity" },
      { icon: "😟", displayText: "별것도 아닌 일에 자꾸 불안해", tags: ["불안감", "걱정 과다", "예민함"], type: "emotion_intensity" },
      { icon: "😡", displayText: "나도 모르게 욱하고 욕을 하게 돼", tags: ["분노 조절 어려움", "충동성", "사춘기 감정 변화"], type: "emotion_intensity" },
      { icon: "📉", displayText: "내가 너무 한심한 것 같아", tags: ["낮은 자존감", "자기 비하", "열등감"], type: "emotion_intensity" },
      { icon: "🎭", displayText: "다른 사람 앞에서 괜찮은 척하기 힘들어", tags: ["가면 우울", "감정 숨김"], type: "else" },
      { icon: "😕", displayText: "내 외모가 마음에 안 들어", tags: ["외모 콤플렉스", "신체 이미지", "자신감 부족"], type: "situation" }, // 왜 그런 생각이 들었어?
      { icon: "🤔", displayText: "나는 어떤 사람일까? 뭘 좋아하는지 모르겠어", tags: ["자아 정체성 혼란", "자기 탐색", "가치관"], type: "else" }
    ],
    "가족 관계": [ // 대부분 situation
      { icon: "😤", displayText: "엄마(아빠)랑 말이 안 통해, 답답해", tags: ["부모와의 소통 단절", "세대 차이", "잔소리"], type: "situation" },
      { icon: "⚖️", displayText: "부모님이 날 안 믿는 것 같아", tags: ["부모의 불신", "자율성 부족", "억압감"], type: "situation" },
      { icon: "💔", displayText: "부모님이 자주 싸워서 불안해", tags: ["가정 불화", "부모 갈등 목격", "정서적 불안"], type: "situation" },
      { icon: "🤫", displayText: "형제랑 비교당하는 게 너무 싫어", tags: ["형제자매 비교", "차별", "경쟁심"], type: "situation" },
      { icon: "🙄", displayText: "우리 가족은 왜 이럴까?", tags: ["가족 특이성", "가족에 대한 불만"], type: "situation" }
    ],
    "이성 및 기타 고민": [ // 상황 + 감정 복합, 대부분 situation으로 시작
      { icon: "💘", displayText: "좋아하는 사람 생겼는데 어떡해?", tags: ["첫사랑", "짝사랑", "이성 교제 시작"], type: "situation" }, // 지금 어떤 상태야?
      { icon: "💔", displayText: "헤어졌는데 너무 힘들어", tags: ["이별", "실연의 아픔"], type: "situation" }, // 상황 설명 후 감정 강도 질문 가능
      { icon: "📱", displayText: "스마트폰(게임) 너무 많이 하는 것 같아", tags: ["스마트폰 중독", "게임 중독", "자기 통제"], type: "situation" },
      { icon: "💤", displayText: "밤에 잠이 안 와, 생각이 많아", tags: ["수면 문제", "불면증", "과도한 생각"], type: "situation" }
    ]
  },
  '30+': { 
    "직장생활": [
        {icon: "💼", displayText: "직장 스트레스가 너무 심해요", tags: ["직무 스트레스", "번아웃", "직장 내 괴롭힘"], type: "emotion_intensity"},
        {icon: "⏳", displayText: "워라밸을 찾고 싶어요", tags: ["일과 삶의 균형", "시간 관리", "휴식 부족"], type: "situation"},
        {icon: "🤔", displayText: "이직이나 퇴사를 고민 중이에요", tags: ["커리어 전환", "진로 변경", "직업 만족도"], type: "situation"},
        {icon: "😠", displayText: "상사나 동료와의 관계가 힘들어요", tags: ["직장 내 대인관계", "갈등", "스트레스", "소통 문제"], type: "emotion_intensity" } // 요즘 받고 있는 스트레스 강도를 물어봐야해. 
    ],
    "가족 및 관계": [
        {icon: "💔", displayText: "이혼해야 하나", tags: ["부부 갈등", "이혼 위기", "결혼 생활"], type: "situation"},
        {icon: "👶", displayText: "육아 스트레스가 심해", tags: ["육아 스트레스", "산후 우울증", "양육 부담"], type: "emotion_intensity"},
        {icon: "🤬", displayText: "부모님/시부모님과의 관계가 어려워요", tags: ["고부갈등", "장서갈등", "가족 관계"], type: "situation"},
        {icon: "🧍", displayText: "친구 관계가 예전 같지 않아요", tags: ["우정 변화", "고립감", "인간관계 회의감"], type: "situation"},
        {icon: "💑", displayText: "연애가 잘 안 풀려요", tags: ["연애 어려움", "이성 관계", "결혼 압박"], type: "situation"}
    ],
    "개인적인 고민": [
        {icon: "💰", displayText: "경제적으로 너무 불안해요", tags: ["재정 문제", "빚", "생활고"], type: "emotion_intensity"},
        {icon: "💊", displayText: "건강이 예전 같지 않아서 걱정돼요", tags: ["건강 염려", "만성 질환", "체력 저하"], type: "else"}, 
        {icon: "⏳", displayText: "나이 드는 게 실감 나서 우울해요", tags: ["노화 불안", "중년의 위기", "상실감"], type: "emotion_intensity"},
        {icon: "❓", displayText: "내 삶의 의미를 잘 모르겠어요", tags: ["삶의 의미", "우울", "목표 상실"], type: "emotion_intensity"}, // 우울증 가능성 있으므로 우울에 대한 정도를 물어봐야 함
        {icon: "⚖️", displayText: "내 인생의 우선순위를 어떻게 정해야 할까요?", tags: ["우선순위 조정", "가치관 혼란"], type: "else"},
        {icon: "🛌", displayText: "밤에 잠을 잘 못 자요", tags: ["불면증", "수면 장애", "스트레스성 불면"], type: "situation"},
        {icon: "👤", displayText: "나 자신에 대한 확신이 없어요", tags: ["자아회의", "낮은 자존감", "자기 불신"], type: "emotion_intensity"}
    ]
  }
};