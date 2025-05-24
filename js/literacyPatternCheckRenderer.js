// js/literacyPatternCheckRenderer.js

// 전역 LOZEE_ANALYSIS 객체 생성 또는 사용 (basic-features.js와 공유 가능)
// 또는 별도의 LOZEE_LITERACY 객체를 사용해도 됩니다. 여기서는 LOZEE_ANALYSIS를 사용합니다.
window.LOZEE_ANALYSIS = window.LOZEE_ANALYSIS || {};

window.LOZEE_ANALYSIS.renderLiteracyAnalysis = function(analysisResult, containerElId) {
  console.log("[LOZEE_ANALYSIS.literacy] renderLiteracyAnalysis 호출됨. 대상 컨테이너 ID:", containerElId, "데이터:", analysisResult);
  const containerEl = document.getElementById(containerElId);

  if (!containerEl) {
    console.error(`[LOZEE_ANALYSIS.literacy] 컨테이너 ID '${containerElId}'를 찾을 수 없습니다.`);
    return;
  }

  // analysisResult 객체 내에 문해력 관련 데이터가 있는지 확인합니다.
  // 서버 응답의 analysis 객체 내에 'literacy'라는 키로 관련 데이터가 온다고 가정합니다.
  // 예: result = { literacy: { literacyFlags: [...], recommendations: [...] } }
  // 또는 result 자체가 literacyFlags와 recommendations를 직접 포함할 수도 있습니다.
  // 여기서는 result가 literacyFlags와 recommendations를 직접 포함한다고 가정하고 코드를 유지합니다.
  // 만약 서버 응답이 result.literacy.literacyFlags 형태라면 아래 코드에서 result 대신 result.literacy를 사용해야 합니다.

  if (!analysisResult || (!analysisResult.literacyFlags && !analysisResult.recommendations)) {
    containerEl.innerHTML = '<p class="placeholder-note" style="padding: 10px; text-align: center; color: #888;">문해력/표현력 분석 결과가 아직 없습니다.</p>';
    // containerEl.style.display = 'none'; // 내용 없으면 숨길 수도 있음
    return;
  }

  let html = '<div class="analysis-section" style="padding: 10px; border-top: 1px solid #444; margin-top: 10px;">';
  html += '<h4 style="margin-top: 0; margin-bottom: 8px; font-size: 0.9em; color: #eee;">📘 문해력/표현력 분석 (AI Beta)</h4>';

  if (analysisResult.literacyFlags && analysisResult.literacyFlags.length > 0) {
    html += '<p style="margin: 5px 0; font-size: 0.85em; color: #ddd;"><strong>AI가 감지한 표현상 특징:</strong></p>';
    html += '<ul style="margin: 5px 0 10px; padding-left: 20px; font-size: 0.8em; list-style-type: disc;">';
    analysisResult.literacyFlags.forEach(flag => {
      const safeFlag = String(flag).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<li style="margin-bottom: 3px;">${safeFlag}</li>`;
    });
    html += '</ul>';
  }

  if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
    html += '<p style="margin: 10px 0 5px; font-size: 0.85em; color: #ddd;"><strong>더 자연스러운 표현 제안:</strong></p>';
    html += '<ul style="margin: 5px 0 0; padding-left: 20px; font-size: 0.8em; list-style-type: disc;">';
    analysisResult.recommendations.forEach(rec => {
      const safeRec = String(rec).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<li style="margin-bottom: 3px;">💬 ${safeRec}</li>`;
    });
    html += '</ul>';
  }

  html += '</div>';
  containerEl.innerHTML = html;
  if (containerEl.innerHTML.trim() !== "") { // 내용이 있을 때만 보이도록
      containerEl.style.display = 'block';
  } else {
      containerEl.style.display = 'none';
  }
};
