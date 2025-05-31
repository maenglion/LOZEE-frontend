// Front/js/keywordCloud.js

/**
 * renderKeywordCloud
 * @param {string[]} keywords - 키워드 문자열 배열
 *
 * id="keywordCloudContainer" 요소를 찾아서,
 * 키워드마다 뱃지 형태로 화면에 그려줍니다.
 */
export function renderKeywordCloud(keywords) {
  const container = document.getElementById("keywordCloudContainer");
  if (!container) return;

  // 기존 내용 초기화
  container.innerHTML = "";

  // 키워드가 없으면 안내 문구 표시
  if (!Array.isArray(keywords) || keywords.length === 0) {
    container.innerHTML = `<p style="color:#666; font-style:italic;">키워드 정보가 없습니다.</p>`;
    return;
  }

  // 각 키워드를 span 태그로 만들어서 추가
  keywords.forEach(word => {
    const span = document.createElement("span");
    span.innerText = word;
    span.style.margin = "4px";
    span.style.padding = "4px 8px";
    span.style.background = "#E8F5E9";
    span.style.borderRadius = "8px";
    span.style.display = "inline-block";
    span.style.fontSize = "0.9em";
    span.style.color = "#333";
    span.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
    container.appendChild(span);
  });
}
