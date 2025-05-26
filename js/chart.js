<canvas id="emotionChart" width="320" height="200"></canvas>

<script type="module">
  // Chart.js ESM 빌드 경로
  import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.esm.js';
  // 필요한 컴포넌트 등록
  Chart.register(...registerables);

  // 예시: 감정 키워드 → 카테고리 매핑 결과
  const emotionCounts = {
    '기쁨': 3,
    '슬픔': 1,
    '분노': 2,
    '불안': 1
  };

  const ctx = document.getElementById('emotionChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(emotionCounts),
      datasets: [{
        label: '감정 빈도',
        data: Object.values(emotionCounts),
        backgroundColor: ['#FFD700', '#87CEEB', '#FF6B6B', '#A9A9A9'] // 색상 배열
      }]
    },
    options: {
      responsive: false, // 반응형 비활성화
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 } // y축 눈금 정밀도
        }
      }
    }
  });
</script>