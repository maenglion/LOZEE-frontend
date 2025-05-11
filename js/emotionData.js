// js/emotionData.js

export const lozeeEmotions = [
  // 기쁨 (Joy/Happiness)
  { sub: "행복해", main: "기쁨" }, 
  { sub: "신나", main: "기쁨" }, 
  { sub: "뿌듯해", main: "기쁨" }, 
  { sub: "고마워", main: "기쁨" },
  { sub: "좋아", main: "기쁨" },
  { sub: "기대감", main: "기쁨" }, 
  { sub: "편안해", main: "기쁨" }, 
  { sub: "웃겨", main: "기쁨" },
  
  // 슬픔 (Sadness)
  { sub: "외로워", main: "슬픔" }, 
  { sub: "우울해", main: "슬픔" },
  { sub: "서운해", main: "슬픔" }, 
  { sub: "속상해", main: "슬픔" },
  { sub: "허전해", main: "슬픔" }, 
  { sub: "슬퍼", main: "슬픔" },
  { sub: "실망스러워", main: "슬픔" }, 
  { sub: "무기력해", main: "슬픔" },
  
  // 분노 (Anger)
  { sub: "화가나", main: "분노" }, 
  { sub: "짜증나", main: "분노" },
  { sub: "억울해", main: "분노" }, 
  { sub: "답답해", main: "분노" },
  { sub: "싫어", main: "분노" }, 
  { sub: "부당해", main: "분노" }, 
  { sub: "열받아", main: "분노" },
  
  // 불안 (Anxiety)
  { sub: "걱정돼", main: "불안" }, 
  { sub: "무서워", main: "불안" },
  { sub: "불안해", main: "불안" }, 
  { sub: "두려워", main: "불안" },
  { sub: "긴장돼", main: "불안" }, 
  { sub: "당황스러워", main: "불안" }, 
  { sub: "혼란스러워", main: "불안" },

  // 중립 또는 기타 감정 (새로 추가)
  { sub: "특별한 느낌 없어", main: "중립" },
  { sub: "부끄러워", main: "수치" },
  { sub: "챙피해", main: "수치" }  // 사용자님 요청 반영
];

// 단어 클라우드에 표시할 소분류 단어 목록만 추출하는 헬퍼 (필요시 사용)
export const allEmotionWordsForCloud = lozeeEmotions.map(emotion => emotion.sub);
