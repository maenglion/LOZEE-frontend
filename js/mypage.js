// ✅ 탭 전환 로직
const tabs = document.querySelectorAll('.tab-item');
const sections = document.querySelectorAll('.content-section');

function activateTab(targetId) {
  sections.forEach(section => {
    section.style.display = section.id === targetId ? 'block' : 'none';
  });
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('href') === `#${targetId}`);
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = tab.getAttribute('href').replace('#', '');
    activateTab(targetId);
  });
});

// ✅ 최초 탭 활성화
window.addEventListener('DOMContentLoaded', () => {
  const defaultTab = document.querySelector('.tab-item.active');
  if (defaultTab) {
    const targetId = defaultTab.getAttribute('href').replace('#', '');
    activateTab(targetId);
  }
});

// ✅ 정렬 기능 (로지와의 약속)
document.getElementById('sortSelect')?.addEventListener('change', (e) => {
  const value = e.target.value;
  const container = document.querySelector('#appointments-section');
  const cards = Array.from(container.querySelectorAll('.appointment-category-card'));

  const sorted = cards.sort((a, b) => {
    if (value === 'date') {
      const dateA = new Date(a.querySelector('.detail-item span:nth-child(2)').textContent.trim());
      const dateB = new Date(b.querySelector('.detail-item span:nth-child(2)').textContent.trim());
      return dateA - dateB;
    } else if (value === 'priority') {
      const ratioA = parseRatio(a.querySelector('.detail-item:nth-child(3)').textContent);
      const ratioB = parseRatio(b.querySelector('.detail-item:nth-child(3)').textContent);
      return ratioB - ratioA;
    }
  });

  sorted.forEach(card => container.appendChild(card));
});

function parseRatio(text) {
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return 0;
  const completed = parseInt(match[1]);
  const total = parseInt(match[2]);
  return total > 0 ? completed / total : 0;
}

// ✅ 자녀 추가 버튼 처리 (예시 - 실제 구현은 서버 연결 필요)
document.getElementById('addChildBtn')?.addEventListener('click', () => {
  alert('자녀 추가 기능은 곧 제공됩니다.');
});
