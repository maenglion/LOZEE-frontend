
// interjection-helper.js

const casualInterjections = [
  "응~", "그래~", "음~ 그렇구나", "그랬어?", "계속 말해봐~", "아~ 진짜?", "맞아맞아~", "아하~", "헐~", "음~ 그래"
];

const politeInterjections = [
  "아~ 그러셨군요", "음~ 그렇군요", "계속 말씀해주세요", "그렇습니까?", "정말요?", "아하~ 그러시군요", "네네~", "들어보고 있어요", "계속 듣고 있어요"
];

export function getIsPoliteByAge() {
  const age = parseInt(localStorage.getItem('lozee_userage') || "0", 10);
  return age >= 56;
}

export function speakInterjection(isPolite = false) {
  const list = isPolite ? politeInterjections : casualInterjections;
  const text = list[Math.floor(Math.random() * list.length)];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.volume = 0.6;
  utterance.rate = 0.95;
  utterance.pitch = 1.1;
  speechSynthesis.speak(utterance);
}
