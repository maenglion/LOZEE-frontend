// js/literacyPatternCheckRenderer.js

export function renderLiteracyAnalysis(result, containerEl) {
  if (!result || (!result.literacyFlags && !result.recommendations)) {
    containerEl.innerHTML = '<p class="placeholder-note">문해력/표현력 분석 결과가 없습니다.</p>';
    return;
  }

  let html = '<div class="analysis-section">'; // 기존 스타일과 일관성을 위해 클래스 추가
  html += '<h4>📘 문해력/표현력 분석 (AI Beta)</h4>'; // 제목 추가

  if (result.literacyFlags && result.literacyFlags.length > 0) {
    html += '<p><strong>AI가 감지한 표현상 특징:</strong></p>';
    html += '<ul>';
    result.literacyFlags.forEach(flag => {
      // XSS 방지를 위해 간단한 텍스트 이스케이프 처리
      const safeFlag = flag.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<li>${safeFlag}</li>`;
    });
    html += '</ul>';
  }

  if (result.recommendations && result.recommendations.length > 0) {
    html += '<p style="margin-top: 15px;"><strong>더 자연스러운 표현 제안:</strong></p>';
    html += '<ul>';
    result.recommendations.forEach(rec => {
      const safeRec = rec.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<li>💬 ${safeRec}</li>`;
    });
    html += '</ul>';
  }

  html += '</div>';
  containerEl.innerHTML = html;
}
