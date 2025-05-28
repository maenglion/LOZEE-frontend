// counseling_topics.js

// 상담실 주제: 사용자 유형 및 나이별 관리용 데이터
export const counselingTopicsByAge = {
  directUser: { // 당사자가 직접 상담받는 경우
    '10세미만': { // 7-10세 대상 (신경다양성 아동 포함)
      "감정 이야기": [
        { icon: "😡", displayText: "나 엄청 화나가!", tags: ["감정조절 어려움", "분노"], type: "emotion_intensity" },
        { icon: "😭", displayText: "뭐든지 참을 수는 없을까? 마음을 조절하기 어려워", tags: ["감정조절 어려움", "충동성"], type: "else" },
        { icon: "😢", displayText: "나 요즘 속상한 일이 있어.", tags: ["슬픔", "우울감"], type: "else" },
        { icon: "🎢", displayText: "내 기분은 이랬다 저랬다 해", tags: ["감정조절 어려움", "감정기복"], type: "else" },
        { icon: "😟", displayText: "무서워서 밤에 잠을 못자.", tags: ["불안감", "수면 문제", "악몽"], type: "situation" },
        { icon: "😥", displayText: "작은 일에도 쉽게 속상하고 울어", tags: ["예민함", "슬픔", "감정기복"], type: "else" },
        { icon: "🎉", displayText: "한번 화가나면 멈출 수 없어. 나중에 후회가 돼", tags: ["감정조절 어려움", "분노", "충동성", "후회"], type: "situation" },
        { icon: "😒", displayText: "자꾸 혼나니까 나쁜 마음이 생겨", tags: ["반항심", "분노", "억울함"], type: "emotion_intensity" },
        { icon: "🤫", displayText: "내 감정을 말로 하기 어려워", tags: ["감정표현 어려움", "소통"], type: "situation" },
        { icon: "💔", displayText: "내 마음 몰라줘서 속상해", tags: ["소외감", "서운함", "이해받고 싶은 마음"], type: "situation" },
        { icon: "💬", displayText: "거절을 받아들이기 어려워", tags: ["감정조절 어려움", "사회적 상호작용", "떼쓰기"], type: "emotion_intensity" }
      ],
      "친구 이야기": [
        { icon: "😔", displayText: "친구들이 날 피하는 것 같아", tags: ["친구 관계 어려움", "소외감", "따돌림 우려"], type: "situation" },
        { icon: "🥺", displayText: "친구를 사귀려면 어떻게 말 걸어?", tags: ["친구 관계 어려움", "사회성", "소심함"], type: "situation" },
        { icon: "😠", displayText: "내가 특이한 거야?", tags: ["친구 관계 어려움", "소외감", "자기 인식"], type: "situation" },
        { icon: "🤦", displayText: "친구들이 내 의도를 몰라줘", tags: ["친구 관계 어려움", "오해", "서운함"], type: "situation" },
        { icon: "🧐", displayText: "자꾸 나한테 눈치가 없대", tags: ["사회적 의사소통 어려움", "눈치", "비언어적 단서"], type: "situation" },
        { icon: "🤝", displayText: "친구랑 싸웠는데 누가 잘못한거야?", tags: ["친구 관계 어려움", "갈등 해결"], type: "situation" },
        { icon: "😨", displayText: "난 변화가 너무 불편해", tags: ["강박적 성향", "변화저항", "불안감"], type: "situation" },
        { icon: "😵", displayText: "다른 사람 표정/말투로 그 사람의 기분을 잘 모르겠어", tags: ["사회적 의사소통 어려움", "공감하기", "비언어적 단서"], type: "situation" },
        { icon: "👀", displayText: "눈 마주치기 너무 부담스러워", tags: ["사회적 의사소통 어려움", "시선 회피", "불안감"], type: "situation" },
        { icon: "😳", displayText: "사실을 말한 건데, 잘못된 걸까?", tags: ["사회적 의사소통 어려움", "상황 이해", "눈치"], type: "situation" },
        { icon: "⁉️", displayText: "농담인지 진담인지 헷갈려", tags: ["사회적 의사소통 어려움", "상황 이해", "유머 이해"], type: "situation" },
        { icon: "🥊", displayText: "친구가 놀릴 때 어떻게 해야 해?", tags: ["친구 관계 어려움", "괴롭힘 대처", "자기보호"], type: "situation" },
        { icon: "🫂", displayText: "다른 사람과 몸이 닿으면 너무 불편해", tags: ["감각 민감성", "촉각 방어"], type: "situation" },
        { icon: "👨‍👩‍👧‍👦", displayText: "여러명이 같이 하는 일은 너무 불편해", tags: ["사회성", "그룹 활동 어려움"], type: "situation" },
        { icon: "😤", displayText: "내 말을 오해해서 너무 억울해", tags: ["친구 관계 어려움", "오해", "억울함"], type: "situation" },
      ],
      "학교생활 이야기": [
        { icon: "😫", displayText: "학교(유치원) 가기 너무 싫어", tags: ["등교 거부", "학교 부적응", "분리 불안"], type: "situation" },
        { icon: "🤯", displayText: "재미없는 수업에 집중하기 힘들어", tags: ["학업 어려움", "주의력 부족", "산만함"], type: "emotion_intensity" },
        { icon: "🤸", displayText: "가만히 있기 너무 답답해", tags: ["과잉행동", "충동성", "감정조절 어려움"], type: "emotion_intensity" },
        { icon: "🧠", displayText: "자꾸 뭘 잃어버리거나 깜빡해", tags: ["부주의", "실행 기능 저하", "건망증"], type: "situation" },
        { icon: "🌪️", displayText: "주변이 바뀌면 너무 불안해", tags: ["강박적 성향", "변화저항", "불안감"], type: "emotion_intensity" },
        { icon: "📐", displayText: "규칙이 갑자기 바뀌거나 다르면 너무 화가 나", tags: ["강박적 성향", "규칙집착", "융통성 부족"], type: "situation" },
        { icon: "🙉", displayText: "소리/빛/냄새 같은 것에 남들보다 너무 예민해", tags: ["감각 민감성", "청각 민감", "시각 민감", "후각 민감"], type: "emotion_intensity" },
        { icon: "❓", displayText: "다른 애들은 괜찮은데, 왜 나만 불편할까?", tags: ["자기 인식", "감각 차이"], type: "situation" },
        { icon: "⏰", displayText: "시간 약속 못 지켜서 혼나거나 불안해", tags: ["시간 관리 어려움", "계획성 부족", "지각"], type: "situation" },
        { icon: "📚", displayText: "숙제나 공부가 너무 어렵고 하기 싫어", tags: ["학업 어려움", "학습 동기 저하", "학업 스트레스"], type: "situation" },
        { icon: "📉", displayText: "글씨 쓰기나 그림 그리기가 너무 힘들어", tags: ["소근육 발달 지연", "학습 어려움"], type: "situation" },
        { icon: "🚧", displayText: "내가 하려던 순서나 방식이 바뀌면 너무 화가 나", tags: ["강박적 성향", "계획 수정 어려움", "융통성 부족"], type: "situation" },
      ],
      "가족 이야기": [
        { icon: "😠", displayText: "엄마(아빠)랑 맨날 싸워", tags: ["가족 관계 어려움", "부모와 갈등"], type: "situation" },
        { icon: "😥", displayText: "부모님이 내 마음을 잘 몰라줘", tags: ["가족 관계 어려움", "이해받고 싶은 마음", "소외감"], type: "situation" },
        { icon: "😭", displayText: "우리 부모님은 이혼했어(별거 중이야)", tags: ["가족 변화", "슬픔", "불안감"], type: "situation" },
        { icon: "🤔", displayText: "새로운 가족(새아빠/새엄마/형제)이 생겼어", tags: ["가족 변화", "새 가족 적응", "혼란스러움"], type: "situation" },
        { icon: "😡", displayText: "형제랑 너무 많이 싸워서 힘들어", tags: ["가족 관계 어려움", "형제 갈등"], type: "situation" },
        { icon: "😔", displayText: "나만 혼나는 것 같아서 억울해", tags: ["가족 관계 어려움", "억울함", "차별 느낌"], type: "situation" },
        { icon: "🤫", displayText: "가족에게 말 못 할 비밀이 있어", tags: ["비밀", "가족 소통 어려움"], type: "situation" },
        { icon: "😟", displayText: "집에 있기 싫거나 불편할 때가 있어", tags: ["가정 불화", "불편함", "회피"], type: "situation" }
      ],
      "내 마음 이야기": [
        { icon: "👽", displayText: "친구들이 내가 특이하다고 해", tags: ["자기 인식", "소외감", "사회적 의사소통 어려움"], type: "else" },
        { icon: "❓", displayText: "나는 왜 다른 애들이랑 좀 다른 것 같지?", tags: ["자기 인식", "정체성 탐색", "다름"], type: "else" },
        { icon: "👎", displayText: "잘하는 게 하나도 없는 것 같아 슬퍼", tags: ["낮은 자존감", "무력감", "슬픔"], type: "emotion_intensity" },
        { icon: "🤡", displayText: "내가 너무 바보 같고 창피할 때가 있어", tags: ["낮은 자존감", "수치심", "자기비하"], type: "emotion_intensity" },
        { icon: "😨", displayText: "새로운 걸 하거나 실수할까 봐 너무 무서워", tags: ["불안감", "도전 회피", "완벽주의 성향"], type: "situation" },
        { icon: "⭐", displayText: "나도 잘하는 게 있거나 특별한 점이 있을까?", tags: ["강점 찾기", "자기 발견", "긍정적 자아상"], type: "else" },
        { icon: "💔", displayText: "가끔 내가 너무 싫어질 때가 있어", tags: ["낮은 자존감", "자기혐오", "부정적 자아상"], type: "emotion_intensity" },
        { icon: "🧍", displayText: "혼자 있고 싶은데, 또 외로운 건 싫어", tags: ["양가감정", "외로움", "친구 관계 어려움"], type: "emotion_intensity" },
        { icon: "❓", displayText: "내가 진짜 뭘 좋아하는지, 뭘 하고 싶은지 잘 모르겠어", tags: ["자기 탐색", "흥미 찾기", "진로 고민"], type: "else" }
      ]
    },
    '11-15세': { // 기존 '11-15' 내용 + 대표 태그 적용
      "학교와 공부": [
        { icon: "📚", displayText: "공부 때문에 너무 스트레스 받아", tags: ["학업 스트레스", "성적 고민", "시험 불안"], type: "emotion_intensity" },
        { icon: "🤔", displayText: "내가 뭘 잘하는지, 뭘 하고 싶은지 모르겠어", tags: ["진로 및 미래 불안", "적성 찾기", "자아 정체성 탐색"], type: "else" },
        { icon: "😫", displayText: "학교 가기 싫고, 모든 게 재미없어", tags: ["학교 부적응", "무기력", "우울감"], type: "situation" },
        { icon: "🤯", displayText: "수업 내용이 하나도 이해 안 돼서 답답해", tags: ["학업 어려움", "학습 부진", "좌절감"], type: "situation" },
        { icon: "⏰", displayText: "시간이 너무 부족하고, 해야 할 일이 너무 많아", tags: ["시간 관리 어려움", "학업 부담", "번아웃 우려"], type: "situation" },
        { icon: "😥", displayText: "시험만 생각하면 너무 떨리고 아무것도 못 하겠어", tags: ["시험 불안", "과도한 긴장", "수행 불안"], type: "emotion_intensity" },
        { icon: "😞", displayText: "학교에서 누가 날 괴롭히거나 은근히 따돌리는 것 같아", tags: ["친구 관계 어려움", "따돌림", "학교 폭력", "두려움"], type: "situation" },
        { icon: "🤯", displayText: "수업 시간에 집중하기가 너무 힘들어", tags: ["학업 어려움", "주의력 부족", "산만함"], type: "situation" },
        { icon: "😓", displayText: "성적이 잘 나와야 한다는 압박감 때문에 숨 막혀", tags: ["학업 스트레스", "성적 압박감", "기대 부담"], type: "emotion_intensity" },
        { icon: "🧐", displayText: "학교 규칙이나 선생님 말씀이 너무 불합리하게 느껴질 때가 있어", tags: ["학교생활 불만", "규칙", "권위적 관계 어려움"], type: "situation" }
      ],
      "친구와 관계": [
        { icon: "🗣️❓", displayText: "친구들과 대화할 때 가끔 내가 이상한 말을 하나 싶어.", tags: ["사회적 의사소통 어려움", "대화 기술", "오해", "눈치"], type: "situation" },
        { icon: "👤🆚👥", displayText: "혼자 있고 싶은데 친구들이 자꾸 같이 놀자고 해서 고민이야.", tags: ["친구 관계 어려움", "에너지 관리", "내향성"], type: "situation" },
        { icon: "😔", displayText: "친구들이랑 점점 멀어지는 것 같고, 혼자인 것 같아", tags: ["친구 관계 어려움", "소외감", "외로움"], type: "emotion_intensity" },
        { icon: "😠", displayText: "친구랑 크게 싸웠는데, 어떻게 화해해야 할지 모르겠어", tags: ["친구 관계 어려움", "갈등 해결", "화해 방법"], type: "situation" },
        { icon: "🤫", displayText: "친구가 나한테만 말한 비밀 때문에 마음이 너무 무거워", tags: ["비밀 유지 부담", "친구 관계 어려움", "책임감"], type: "situation" },
        { icon: "💔", displayText: "가장 믿었던 친구에게 배신당해서 너무 속상해", tags: ["친구 관계 어려움", "배신감", "실망", "상처"], type: "situation" },
        { icon: "💻", displayText: "SNS를 보면 나만 빼고 다들 행복해 보여서 우울해", tags: ["SNS 비교", "소외감", "상대적 박탈감", "낮은 자존감"], type: "situation" },
        { icon: "❓", displayText: "진짜 친한 친구란 어떤 걸까?", tags: ["친구 관계 어려움", "우정의 의미", "관계 깊이"], type: "else" },
        { icon: "🌟", displayText: "나도 친구들 사이에서 인기가 많았으면 좋겠어", tags: ["친구 관계 어려움", "인정욕구", "소속감", "낮은 자존감"], type: "else" },
        { icon: "🥺", displayText: "새로운 친구를 사귀는 게 너무 어렵고 두려워", tags: ["친구 관계 어려움", "사회성", "낯가림", "불안감"], type: "situation" },
        { icon: "🎭", displayText: "친구들 앞에서 솔직한 내 모습을 보여주기가 힘들어", tags: ["자기표현 어려움", "가면", "인정욕구", "또래 압력"], type: "else" },
        { icon: "🫂", displayText: "힘들어하는 친구를 어떻게 위로하고 도와줘야 할지 모르겠어", tags: ["친구 관계 어려움", "공감하기", "위로 방법"], type: "situation" }
      ],
      "나와 내 마음": [
        { icon: "📱", displayText: "내가 다른 애들이랑 좀 많이 다른 것 같은데, 혹시 나한테 특별한 점이 있는 걸까?", tags: ["자기 이해", "신경다양성 궁금증", "다름", "정체성 탐색"], type: "situation" },
        { icon: "🤷‍♀️", displayText: "가끔 내가 왜 이렇게 행동하는지 나도 잘 모르겠어.", tags: ["자기 이해", "행동 원인 궁금증", "감각 민감성", "주의력", "충동성"], type: "else" },
        { icon: "💻💡", displayText: "ADHD나 자폐 스펙트럼, 혹시 나도 해당될까?", tags: ["신경다양성 궁금증", "자기 진단 우려", "정보 탐색", "정체성 고민"], type: "else" },
        { icon: "🎢😥", displayText: "나는 왜 이렇게 감정 변화가 크고, 특정 느낌을 세게 받을까?", tags: ["감정조절 어려움", "감정 강도", "예민함", "자기 이해"], type: "emotion_intensity" },
        { icon: "😥", displayText: "요즘 너무 우울하고, 아무것도 하기 싫어", tags: ["우울감", "무기력", "흥미 상실"], type: "emotion_intensity" },
        { icon: "😟", displayText: "사소한 일에도 너무 걱정이 많고 불안해", tags: ["불안감", "과도한 걱정", "예민함"], type: "emotion_intensity" },
        { icon: "😡", displayText: "나도 모르게 욱하고 화를 내거나 욕을 하게 돼서 후회해", tags: ["감정조절 어려움", "분노", "충동성"], type: "emotion_intensity" },
        { icon: "📉", displayText: "내가 너무 못나고 한심하게 느껴질 때가 많아", tags: ["낮은 자존감", "자기 비하", "열등감"], type: "emotion_intensity" },
        { icon: "🎭", displayText: "힘들어도 다른 사람들 앞에서는 괜찮은 척하게 돼", tags: ["감정 숨김", "가면 우울", "솔직함 부족"], type: "else" },
        { icon: "😕", displayText: "내 외모가 너무 마음에 안 들고 자신감이 없어", tags: ["신체 이미지 고민", "외모 콤플렉스", "낮은 자존감"], type: "situation" },
        { icon: "🤔", displayText: "내가 진짜 어떤 사람인지, 뭘 좋아하고 뭘 해야 할지 모르겠어", tags: ["자아 정체성 탐색", "가치관 혼란", "진로 및 미래 불안"], type: "else" },
        { icon: "🧍", displayText: "요즘 내 몸이 변하는 게(2차 성징) 어색하고 신경 쓰여", tags: ["사춘기 변화", "신체 변화 수용", "성적 성숙"], type: "situation" },
        { icon: "😫", displayText: "스트레스 받을 때 건강하게 푸는 방법을 잘 모르겠어", tags: ["스트레스 관리", "감정 해소법", "정신 건강"], type: "else" },
        { icon: "📱", displayText: "스마트폰(게임)을 너무 많이 해서 시간 낭비하는 것 같고 죄책감이 들어", tags: ["미디어 사용 조절", "중독 우려", "자기 통제", "시간 관리"], type: "situation" },
        { icon: "💖", displayText: "나 자신을 좀 더 사랑하고 아껴주고 싶어", tags: ["자기 수용", "긍정적 자아상", "자존감 향상"], type: "else" },
        { icon: "😴", displayText: "밤에 잠이 잘 안 오거나 자도자도 피곤해", tags: ["수면 문제", "불면증", "만성 피로", "학업 스트레스"], type: "situation" },
        { icon: "🌍", displayText: "세상에서 일어나는 안 좋은 일들을 보면 너무 마음이 아프고 무서워", tags: ["사회적 이슈 스트레스", "공감 피로", "불안감"], type: "emotion_intensity" }
      ],
      "가족 관계": [
        { icon: "😤", displayText: "부모님이랑 말이 안 통해서 너무 답답하고 화가 나", tags: ["가족 관계 어려움", "부모와 갈등", "소통 단절"], type: "situation" },
        { icon: "⚖️", displayText: "부모님이 나를 믿어주지 않는 것 같아 속상해", tags: ["가족 관계 어려움", "신뢰 부족", "억압감"], type: "situation" },
        { icon: "💔", displayText: "부모님이 자주 싸우셔서 집이 불편하고 불안해", tags: ["가족 관계 어려움", "가정 불화", "정서적 불안"], type: "situation" },
        { icon: "📊", displayText: "형제자매랑 자꾸 비교당하는 게 너무 싫고 억울해", tags: ["가족 관계 어려움", "형제 비교", "차별 느낌", "억울함"], type: "situation" },
        { icon: "🙄", displayText: "우리 가족은 왜 이렇게 서로 이해를 못할까?", tags: ["가족 관계 어려움", "가족 불만", "소통 방식 문제"], type: "situation" },
        { icon: "🔒", displayText: "부모님이 내 사생활(일기, 톡 등)을 너무 간섭하는 것 같아", tags: ["가족 관계 어려움", "사생활 침해", "자율성 존중"], type: "situation" },
        { icon: "😠", displayText: "부모님이 내 성적이나 공부에만 관심 있는 것 같아 서운하고 화나", tags: ["가족 관계 어려움", "애정 부족 느낌", "학업 스트레스", "부모 기대 부담"], type: "emotion_intensity" }
      ],
      "이성 및 기타 고민": [
        { icon: "🥰", displayText: "좋아하는 사람이 생겼는데, 어떻게 다가가야 할지 모르겠어", tags: ["이성 관계", "짝사랑", "고백 고민"], type: "else" },
        { icon: "💔", displayText: "헤어졌는데 너무 힘들고 어떻게 해야 할지 모르겠어", tags: ["이성 관계", "이별 극복", "실연의 아픔"], type: "emotion_intensity" },
        { icon: "📱", displayText: "스마트폰(SNS) 때문에 친구와 나를 비교하게 되고 우울해져", tags: ["미디어 사용 조절", "SNS 부작용", "상대적 박탈감", "낮은 자존감"], type: "situation" },
        { icon: "💤", displayText: "밤에 잠이 안 오고 이런저런 생각이 너무 많아", tags: ["수면 문제", "불면증", "과도한 생각", "스트레스"], type: "situation" },
        { icon: "🤫", displayText: "성(性)에 대해 궁금한 게 많은데, 물어볼 곳이 없어서 답답해", tags: ["성적 호기심", "성교육 필요", "사춘기 변화"], type: "else" },
        { icon: "🏳️‍🌈", displayText: "내 성 정체성이나 성적 취향에 대해 혼란스럽고 고민돼", tags: ["자아 정체성 탐색", "성 정체성", "성적 지향"], type: "else" },
        { icon: "🍻🚬", displayText: "술이나 담배 같은 것에 호기심이 생기거나 친구들이 하자고 해서 고민이야", tags: ["유해물질 유혹", "또래 압력", "위험 행동 경계"], type: "situation" },
        { icon: "⚖️😥", displayText: "내 몸무게나 몸매 때문에 너무 스트레스 받고 위축돼", tags: ["신체 이미지 고민", "외모 스트레스", "다이어트 강박", "섭식 문제 우려"], type: "emotion_intensity" }
      ]
    },
    '16-29세': { // 청년층 (15세 이상)
      "학업 및 진로": [
        { icon: "🎓", displayText: "대학교나 전공 선택이 너무 어려워요", tags: ["진로 및 미래 불안", "진로 선택", "대학교", "전공 고민"], type: "else" },
        { icon: "💼", displayText: "취업 준비 때문에 스트레스가 너무 심해요", tags: ["학업 스트레스", "취업", "면접 불안", "경쟁"], type: "emotion_intensity" },
        { icon: "😟", displayText: "내 미래가 어떻게 될지 너무 불안하고 막막해요", tags: ["진로 및 미래 불안", "불확실성", "목표 상실"], type: "emotion_intensity" },
        { icon: "🤔", displayText: "내가 정말 하고 싶은 일이 뭔지 잘 모르겠어요", tags: ["자아 정체성 탐색", "적성 찾기", "직업"], type: "else" },
        { icon: "📚", displayText: "공부나 시험에 집중이 잘 안 돼요", tags: ["학업 어려움", "주의력 부족", "시험 스트레스"], type: "situation" }
      ],
      "친구 및 대인관계 (연애, 결혼 포함)": [
        { icon: "🗣️", displayText: "새로운 사람들을 만나는 게 어색하고 힘들어요", tags: ["대인관계 어려움", "사회성"], type: "situation" },
        { icon: "💔🤔", displayText: "다른 사람과 깊은 관계를 맺는 게 너무 어려워요. 왜 그럴까요?", tags: ["대인관계 어려움", "애착 문제", "신경다양성 연애", "소통 방식 차이"], type: "else"}, 
        { icon: "😍", displayText: "썸 타는 사람이 있는데, 어떻게 발전시켜야 할까요?", tags: ["이성 관계", "썸", "관계 발전"], type: "else" },
        { icon: "💔", displayText: "연애가 너무 어렵고 자꾸 실패하는 것 같아요", tags: ["이성 관계", "연애 실패", "관계 패턴"], type: "situation" },
        { icon: "😭", displayText: "이별 후 너무 힘들어서 아무것도 못 하겠어요", tags: ["이성 관계", "이별 극복", "상실감"], type: "emotion_intensity" },
        { icon: "💍", displayText: "결혼에 대해 현실적인 고민이 많아졌어요", tags: ["이성 관계", "결혼", "미래 설계"], type: "else" },
        { icon: "👥", displayText: "친구 관계가 예전 같지 않고 점점 소원해져요", tags: ["친구 관계 어려움", "우정 변화", "소외감"], type: "situation" },
        { icon: "📉", displayText: "주변 사람들과 나를 비교하며 자존감이 낮아져요", tags: ["낮은 자존감", "사회적 비교", "열등감"], type: "emotion_intensity" }
      ],
      "나와 내 마음 (정체성)": [
        { icon: "🧠❓", displayText: "어릴 때부터 내가 좀 독특하다고 느꼈는데, 이게 뭘까요?", tags: [ "우울증" , "자기 이해", "신경다양성 의심", "정체성 탐색", "과거 회상"], type: "else" },
        { icon: "🧑‍⚕️💡", displayText: "혹시 내가 성인 ADHD나 자폐 스펙트럼일 수 있을까요?", tags: [ "우울증", "신경다양성 의심", "자기 인식", "정보 탐색", "삶의 어려움 원인"], type: "emotion_intensity" },
        { icon: "🧩😟", displayText: "제 생각이나 감정 표현 방식이 남들과 다른 것 같아 힘들어요.", tags: ["🧩😟", displayText: "제 생각이나 감정 표현 방식이 남들과 다른 것 같아 힘들어요."], type: "situation" },
        { icon: "📚💼⚠️", displayText: "집중력이나 충동적인 면 때문에 일이 잘 안 풀릴 때가 많아요.", tags: [ "우울증" ,"성인 ADHD 의심", "신경다양성 의심", "업무/학업 어려움", "실행 기능 저하", "자기 관리"], type: "situation" },
        { icon: "👤", displayText: "내가 어떤 사람인지, 뭘 원하는지 혼란스러워요", tags: ["자아 정체성 탐색", "가치관 혼란", "자기 이해"], type: "else" },
        { icon: "👎", displayText: "자존감이 너무 낮아서 힘들어요", tags: ["낮은 자존감", "자기 수용 어려움"], type: "emotion_intensity" },
        { icon: "😔", displayText: "가끔 너무 우울하고 모든 게 무기력하게 느껴져요", tags: ["우울감", "무기력", "번아웃"], type: "emotion_intensity" },
        { icon: "😟", displayText: "불안감 때문에 새로운 시도를 하기가 두려워요", tags: ["불안감", "도전 회피", "사회 불안"], type: "situation" },
        { icon: "🤔", displayText: "내 성격에 어떤 문제가 있는 건 아닐까 걱정돼요", tags: ["성격 고민", "자기 인식", "대인관계 패턴"], type: "else" },
        { icon: "😕", displayText: "내 외모에 대한 불만이 커요", tags: ["신체 이미지 고민", "외모 콤플렉스"], type: "situation" }
      ],
      "독립 및 사회생활": [
        { icon: "🏠", displayText: "부모님으로부터 경제적/정서적으로 독립하고 싶어요", tags: ["독립", "자립", "경제적 자립", "정서적 독립"], type: "situation" },
        { icon: "👤🚶‍♀️", displayText: "혼자 사는 게 생각보다 외롭고 힘들 때가 많아요", tags: ["독립", "외로움", "고립감"], type: "emotion_intensity" },
        { icon: "💸", displayText: "돈 관리가 너무 어렵고 경제적으로 불안해요", tags: ["경제적 어려움", "재정 관리", "미래 불안"], type: "situation" },
        { icon: "🏢", displayText: "직장이나 사회생활에 적응하는 게 쉽지 않아요", tags: ["사회생활 어려움", "직장 적응", "업무 스트레스", "대인관계 어려움"], type: "situation" },
        { icon: "🌍😠", displayText: "세상 돌아가는 모습에 불만이 많고 화가 날 때가 있어요", tags: ["사회 불만", "분노", "무력감"], type: "emotion_intensity" }
      ]
    }
  },
  caregiver: { // 양육자 모드
    "육아 (일반 및 신경다양성 아동)": [
      { icon: "😩", displayText: "육아 스트레스가 너무 심해서 지쳐요", tags: ["양육 스트레스", "소진", "번아웃"], type: "emotion_intensity" },
      { icon: "👨‍👩‍👧‍👦💥", displayText: "아이 키우는 문제로 배우자와 자주 다퉈요", tags: ["양육관 차이", "부부 갈등", "소통 부족"], type: "situation" },
      { icon: "🧩", displayText: "우리 아이가 다른 아이들과 좀 다른 것 같아요, 어떻게 이해해야 할까요?", tags: ["신경다양성 이해", "자폐 스펙트럼", "ADHD", "발달 차이"], type: "else" },
      { icon: "💔", displayText: "아이의 진단(자폐, ADHD 등)을 받고 너무 힘들고 절망스러워요", tags: ["진단 수용 어려움", "충격", "슬픔", "미래 걱정"], type: "emotion_intensity" },
      { icon: "🔁🤔", displayText: "아이의 특정 행동(상동행동, 감각 문제 등)에 어떻게 대처해야 할지 막막해요", tags: ["행동 문제 대처", "상동행동", "감각 민감성", "전문가 도움"], type: "situation" },
      { icon: "🗣️😥", displayText: "아이가 말이 늦거나 의사소통이 어려워 답답하고 속상해요", tags: ["언어 발달 지연", "의사소통 장애", "사회성 기술", "치료 교육"], type: "emotion_intensity" },
      { icon: "🏃‍♂️💨", displayText: "ADHD 아이의 주의력 부족, 과잉행동, 충동성 때문에 너무 지쳐요", tags: ["ADHD 양육", "주의력 부족 관리", "과잉행동 중재", "충동성 조절"], type: "emotion_intensity" },
      { icon: "💸😟", displayText: "아이 치료와 교육 과정이 너무 길고 경제적으로도 부담이 커요", tags: ["경제적 부담", "장기 치료", "심리적 소진", "지원 정보"], type: "situation" },
      { icon: "👀😔", displayText: "주변 사람들의 시선이나 오해 때문에 상처받고 힘들어요", tags: ["사회적 편견", "낙인", "정서적 고립", "이해 부족"], type: "emotion_intensity" },
      { icon: "😥", displayText: "아이 훈육, 어떻게 해야 할지 정말 모르겠어요", tags: ["훈육 어려움", "일관성 부족", "행동 문제"], type: "else" },
      { icon: "❓", displayText: "내가 좋은 부모인지 자신이 없고, 죄책감이 들어요", tags: ["양육 효능감 저하", "죄책감", "부모 역할 부담"], type: "emotion_intensity" },
      { icon: "⏰😔", displayText: "육아로 내 시간이 사라져서 너무 우울해요", tags: ["자기 돌봄 부족", "정체성 상실감", "우울감"], type: "emotion_intensity" },
      { icon: "🏫😟", displayText: "아이가 학교(어린이집)에 잘 적응할 수 있을지 걱정돼요", tags: ["기관 적응", "사회성 발달 우려", "분리 불안"], type: "situation" },
      { icon: "🔮😥", displayText: "우리 아이의 미래를 생각하면 너무 불안하고, 무엇을 해줘야 할지 막막해요", tags: ["자녀 미래 설계", "자립 지원", "교육 계획", "불안감"], type: "emotion_intensity" },
      { icon: "👨‍👩‍👧", displayText: "신경다양성 아이 때문에 다른 형제자매가 힘들어하거나 소외감을 느끼는 것 같아요", tags: ["비장애 형제 지원", "가족 내 역동", "죄책감"], type: "situation" },
      { icon: "🌟💡", displayText: "우리 아이만의 특별한 강점을 찾아주고 키워주고 싶어요", tags: ["강점 중심 양육", "잠재력 발견", "긍정적 자아상"], type: "else" },
      { icon: "💧", displayText: "너무 지치고 외로워서 모든 걸 다 포기하고 싶을 때가 있어요", tags: ["양육 소진", "극심한 우울감", "정서적 지지 부족"], type: "emotion_intensity" },
      { icon: "💥😥", displayText: "아이의 공격적인 행동(때리기, 물건 던지기 등) 때문에 너무 힘들어요.", tags: ["행동 문제 대처", "공격성", "양육 스트레스", "안전 문제"], type: "situation" },
      { icon: "😨💔", displayText: "아이에게 너무 화가 나서 나쁜 생각(체벌 등)을 할까 봐 제 자신이 두려워요.", tags: ["감정조절 어려움", "분노", "죄책감", "부모 정신건강"], type: "emotion_intensity" },
      { icon: "😔💭", displayText: "아이의 어려움이 유전인 것 같아 죄책감이 들고 너무 속상해요.", tags: ["죄책감", "유전 걱정", "자책", "양육 부담"], type: "emotion_intensity" },
      { icon: "🤔❓", displayText: "내가 아이에게 정말 필요한 지원을 다 해주고 있는 건지 항상 불안해요.", tags: ["양육 불안", "정보 부족", "최선의 선택 고민"], type: "emotion_intensity" },
      { icon: "🗣️💬", displayText: "다른 사람들에게 우리 아이의 특별함에 대해 어떻게 이야기해야 할지 어려워요.", tags: ["사회적 소통", "신경다양성 설명", "이해 구하기"], type: "else" }
    ],
    "가족 관계 (양육자 관점)": [
      { icon: "夫婦😥", displayText: "아이 문제로 배우자와의 관계가 점점 힘들어져요.", tags: ["가족 관계 어려움", "부부 갈등", "양육 스트레스", "소통 단절"], type: "situation" },
      { icon: "👵🏻👴🏻❓", displayText: "부모님(시부모님)께 아이 문제로 지원받고 싶지만, 이해받기 어려워요.", tags: ["가족 관계 어려움", "조부모와 갈등", "세대 차이", "이해 부족"], type: "situation" },
      { icon: "🗣️💔", displayText: "친척이나 주변 사람들의 (아이 관련) 말에 상처받을 때가 많아요.", tags: ["가족 관계 어려움", "사회적 편견", "정서적 고립", "상처"], type: "emotion_intensity" },
      { icon: "👩‍❤️‍👨🚫", displayText: "육아 때문에 부부만의 시간이 거의 없어져서 소원해진 것 같아요.", tags: ["가족 관계 어려움", "부부 관계 소홀", "정서적 교류 부족"], type: "situation" },
      { icon: "😥📅", displayText: "명절이나 가족 모임이 아이 때문에 더 부담스럽고 피하고 싶어요.", tags: ["가족 관계 어려움", "가족 행사 스트레스", "사회적 시선"], type: "emotion_intensity" },
      { icon: "🧍‍♀️🚫", displayText: "아이를 돌보느라 친구 관계나 사회생활이 거의 단절되어 너무 외로워요.", tags: ["대인관계 어려움", "사회적 고립", "외로움", "우울감"], type: "situation" },
      { icon: "🚶‍♀️💭", displayText: "아이가 커갈수록 사람들을 만나거나 사회생활 하는 게 점점 더 두려워져요.", tags: ["대인관계 어려움", "사회적 고립", "불안감", "양육자의 어려움"], type: "emotion_intensity"}
    ],
    "직장생활과 양육 병행": [
      { icon: "💼😥", displayText: "아이 치료나 학교 문제로 직장과 육아를 병행하기가 너무 벅차요.", tags: ["워라밸", "경력 유지 어려움", "만성 피로", "죄책감"], type: "situation" },
      { icon: "👀😓", displayText: "아이 때문에 회사에 자주 빠져야 해서 직장 내 입지가 불안해요.", tags: ["워라밸", "직장 내 어려움", "경력 단절 우려"], type: "emotion_intensity" },
      { icon: "📉🧠", displayText: "아이 걱정으로 일에 집중이 안 되고, 내 능력이 떨어지는 것 같아요.", tags: ["워라밸", "업무 효율 저하", "성과 부담", "정신적 피로"], type: "emotion_intensity" },
      { icon: "⏳👩‍💼", displayText: "육아로 인한 경력 단절이나 직장 복귀가 너무 두렵고 막막해요.", tags: ["워라밸", "경력 공백", "재취업 어려움", "자신감 상실"], type: "situation" }
    ],
    "양육자 자신의 마음 돌봄": [
      { icon: "🧘‍♀️❤️", displayText: "나 자신을 돌볼 시간이 전혀 없어서 몸도 마음도 너무 지쳐가요.", tags: ["자기 돌봄", "소진", "건강 문제", "정서적 고갈"], type: "emotion_intensity" },
      { icon: "👤❓", displayText: "양육자로서의 역할에만 갇혀 내 본래의 모습을 잃어버린 것 같아요.", tags: ["자기 돌봄", "정체성 혼란", "자아실현 욕구", "상실감"], type: "else" },
      { icon: "😭💔", displayText: "가끔 너무 우울하고 모든 걸 다 내려놓고 싶어져요.", tags: ["자기 돌봄", "우울감", "절망감", "전문적 도움 필요"], type: "emotion_intensity" },
      { icon: "🤝🆘", displayText: "다른 비슷한 상황의 양육자들과 이야기 나누며 위로받고 싶어요.", tags: ["자기 돌봄", "지지 그룹", "공감대 형성", "정보 공유"], type: "else" },
      { icon: "🕰️🎨", displayText: "나만의 시간이나 취미를 갖고 싶은데, 아이에게 미안해서 죄책감이 들어요.", tags: ["자기 돌봄", "죄책감", "리프레시"], type: "emotion_intensity" },
      { icon: "😴😫", displayText: "밤낮없이 아이를 돌보느라 충분한 수면을 취하지 못해 항상 피곤해요.", tags: ["자기 돌봄", "수면 문제", "만성 피로", "건강 악화"], type: "situation" }
    ],
    "기타 현실적 문제 (경제, 건강 등)": [
      { icon: "💰😟", displayText: "아이 치료비나 특수 교육비 때문에 경제적으로 너무 불안하고 힘들어요.", tags: ["경제적 어려움", "재정 계획", "미래 자금 걱정"], type: "emotion_intensity" },
      { icon: "💊😥", displayText: "내 건강이 점점 나빠지는 것 같아서 아이를 계속 돌볼 수 있을지 걱정돼요.", tags: ["양육자 건강", "체력적 한계", "만성 질환"], type: "situation" },
      { icon: "⏳❓", displayText: "나이가 들면서 아이의 미래와 나의 노후를 생각하면 막막해요.", tags: ["노후 준비", "자녀 독립 후 삶", "장기적 계획"], type: "else" },
      { icon: "📄🤷‍♀️", displayText: "아이에게 필요한 정부나 기관의 지원 제도를 잘 모르겠고, 신청하기도 너무 복잡해요.", tags: ["복지 정보", "행정 절차 어려움", "정보 부족"], type: "situation" }
    ]
  }
};