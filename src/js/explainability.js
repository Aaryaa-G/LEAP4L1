// SolarIS AI Explainability & Model Validation Studio
import Chart from 'chart.js/auto';

export function initExplainability() {
  initShapChart();
  initAttentionHeatmap();
  initValidationCharts();
}

function initShapChart() {
  const ctx = document.getElementById('shap-chart')?.getContext('2d');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [
        'Hard X-Ray Spike (HEL1OS)',
        'Soft X-Ray Flux Derivative',
        'Magnetic Shear Angle (AR13652)',
        'Precursor Decay Constant',
        '10m Moving Avg Ratio',
        'Historical Flaring Index'
      ],
      datasets: [{
        label: 'SHAP Value (Impact on Flare Output)',
        data: [0.42, 0.28, 0.19, 0.14, -0.08, 0.05],
        backgroundColor: (context) => {
          const val = context.raw;
          return val >= 0 ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 51, 68, 0.7)';
        },
        borderColor: (context) => {
          const val = context.raw;
          return val >= 0 ? '#00f0ff' : '#ff3344';
        },
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'SHAP Value (+ Eruptive Risk / - Quiet)', color: '#52627a' } },
        y: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function initAttentionHeatmap() {
  const container = document.getElementById('attention-grid');
  if (!container) return;

  container.innerHTML = '';
  // Generate a 12x4 grid of temporal attention weights
  for (let i = 0; i < 48; i++) {
    const cell = document.createElement('div');
    cell.className = 'hm-cell';
    
    // Higher attention weights near the end (representing precursor time window)
    const weight = Math.min(1, Math.pow(i / 48, 2) + Math.random() * 0.25);
    
    // Color map from deep cyan to glowing yellow/red
    let color;
    if (weight < 0.3) color = `rgba(0, 119, 255, ${weight * 2})`;
    else if (weight < 0.7) color = `rgba(0, 240, 255, ${weight})`;
    else if (weight < 0.85) color = `rgba(255, 157, 0, ${weight})`;
    else color = `rgba(255, 51, 68, ${weight})`;

    cell.style.backgroundColor = color;
    cell.title = `Time-step t-${48 - i}: Attention Weight ${(weight * 100).toFixed(1)}%`;
    container.appendChild(cell);
  }
}

function initValidationCharts() {
  const ctxRoc = document.getElementById('roc-chart')?.getContext('2d');
  const ctxPr = document.getElementById('pr-chart')?.getContext('2d');

  if (ctxRoc) {
    new Chart(ctxRoc, {
      type: 'line',
      data: {
        labels: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        datasets: [
          { label: 'DeepSolarNet (AUC=0.982)', data: [0, 0.72, 0.88, 0.94, 0.97, 0.985, 0.99, 0.995, 0.998, 1.0, 1.0], borderColor: '#00f0ff', borderWidth: 2, tension: 0.2 },
          { label: 'Baseline Logistic', data: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], borderColor: '#52627a', borderDash: [4, 4], borderWidth: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { size: 10 } } } } }
    });
  }

  if (ctxPr) {
    new Chart(ctxPr, {
      type: 'line',
      data: {
        labels: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
        datasets: [{ label: 'Precision-Recall', data: [1.0, 0.98, 0.96, 0.94, 0.91, 0.85], borderColor: '#ff9d00', borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }
}
