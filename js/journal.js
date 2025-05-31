// journal.js (이미 Firestore 초기화와 getDoc import 등이 되어 있다고 가정)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URL 쿼리 파라미터: journalId 가져오기
const urlParams = new URLSearchParams(window.location.search);
const journalId = urlParams.get("journalId");

async function renderPageWithData() {
  if (!journalId) {
    document.getElementById("mainContainer").innerText = "잘못된 접근: journalId가 없습니다.";
    return;
  }

  const journalRef = doc(db, "journals", journalId);
  const journalSnap = await getDoc(journalRef);
  if (!journalSnap.exists()) {
    document.getElementById("mainContainer").innerText = "해당 저널을 찾을 수 없습니다.";
    return;
  }

  const data = journalSnap.data();
  // → data.userId, data.topic, data.title, data.summary, data.detailedAnalysis 등

  // (1) 기존: 제목(title) 렌더
  document.getElementById("journalTitle").innerText = data.title;

  // (2) 기존: 요약(summary) 렌더
  document.getElementById("journalSummary").innerText = data.summary;

  // (3) 기존: 분석 차트, 키워드 등 렌더…
  // 예: renderKeywordCloud(data.keywords), renderEmotionChart(data.detailedAnalysis.emotionToneData), ...

  // (4) **새로 추가:** 인물-감정 태깅 결과 렌더
  const tags = (data.detailedAnalysis && data.detailedAnalysis.entityEmotionTags) || [];
  const section = document.getElementById("entityEmotionSection");
  const container = document.getElementById("entityEmotionContainer");

  if (tags.length > 0) {
    section.style.display = "block";  // 보이게 하기
    // 각 태그를 badge 형태로 렌더
    container.innerHTML = tags
      .map(t => `<span style="
                       background:#FFECB3; 
                       color:#BF360C; 
                       padding:4px 8px; 
                       border-radius:12px; 
                       font-size:0.9em;
                       box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                   ">
                   ${t.entity} – ${t.emotion}
                 </span>`)  
      .join("");
  } else {
    // 태깅 정보가 없으면 안내 문구만 띄움
    section.style.display = "block";
    container.innerHTML = `<p style="color:#666; font-style:italic;">인물-감정 태깅 정보가 없습니다.</p>`;
  }
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
  renderPageWithData().catch(err => console.error(err));
});