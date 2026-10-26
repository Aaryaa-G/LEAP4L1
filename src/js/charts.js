// SolarIS Chart.js Telemetry Engine & Synchronized X-Ray Spectrometers
import Chart from 'chart.js/auto';

let solexsChart, heliosChart, confChart;
const maxPoints = 30;

// Initial synthetic time labels
const labels = Array.from({ length: maxPoints }, (_, i) => {
  const d = new Date(Date.now() - (maxPoints - 1 - i) * 2000);
  return d.toTimeString().split(' ')[0];
});

// Initial synthetic flux datasets
const solexsData = Array.from({ length: maxPoints }, (_, i) => 1e-6 * (1 + Math.sin(i * 0.3) * 0.4 + (i > 22 ? Math.pow(i - 22, 2) * 0.08 : 0)));
const heliosData = Array.from({ length: maxPoints }, (_, i) => 500 + Math.floor(Math.random() * 200) + (i > 22 ? (i - 22) * 600 : 0));

export function initCharts() {
  const ctxSolexs = document.getElementById('solexs-chart')?.getContext('2d');
  const ctxHelios = document.getElementById('helios-chart')?.getContext('2d');
  const ctxConf = document.getElementById('mini-conf-chart')?.getContext('2d');

  if (!ctxSolexs || !ctxHelios) return;

  // Global Chart Defaults
  Chart.defaults.color = '#8a99ad';
  Chart.defaults.font.family = 'JetBrains Mono';

  // 1. SoLEXS Soft X-Ray Chart
  solexsChart = new Chart(ctxSolexs, {
    type: 'line',
    data: {
      labels: [...labels],
      datasets: [{
        label: 'Soft X-Ray Flux (W/m²)',
        data: [...solexsData],
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#00f0ff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { maxTicksLimit: 6 } },
        y: {
          type: 'logarithmic',
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: 'Watts / m²', color: '#52627a' }
        }
      },
      plugins: { legend: { display: false } },
      interaction: { mode: 'index', intersect: false }
    }
  });

  // 2. HEL1OS Hard X-Ray Chart
  heliosChart = new Chart(ctxHelios, {
    type: 'line',
    data: {
      labels: [...labels],
      datasets: [{
        label: 'Hard X-Ray Photon Count (cts/s)',
        data: [...heliosData],
        borderColor: '#ff9d00',
        backgroundColor: 'rgba(255, 157, 0, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#ff9d00'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { maxTicksLimit: 6 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Photons / sec', color: '#52627a' } }
      },
      plugins: { legend: { display: false } },
      interaction: { mode: 'index', intersect: false }
    }
  });

  // 3. Mini AI Confidence Chart
  if (ctxConf) {
    confChart = new Chart(ctxConf, {
      type: 'line',
      data: {
        labels: labels.slice(-15),
        datasets: [{
          data: [95, 96, 96.5, 96.2, 97, 96.8, 97.2, 97.4, 97.1, 97.3, 97.5, 97.2, 97.6, 97.4, 97.2],
          borderColor: '#00ff88',
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { display: false }, y: { min: 90, max: 100, grid: { color: 'rgba(255,255,255,0.03)' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Start Real-time Data Streaming Simulation
  startStreamingEngine();
}

// Stream new live simulated data point every 2 seconds
function startStreamingEngine() {
  setInterval(() => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    
    // Calculate simulated next flux values
    const lastSoft = solexsChart.data.datasets[0].data[solexsChart.data.datasets[0].data.length - 1];
    const lastHard = heliosChart.data.datasets[0].data[heliosChart.data.datasets[0].data.length - 1];

    const nextSoft = lastSoft * (1 + (Math.random() - 0.48) * 0.05);
    const nextHard = Math.max(400, lastHard + Math.floor((Math.random() - 0.45) * 150));

    // Shift arrays
    solexsChart.data.labels.shift();
    solexsChart.data.labels.push(timeStr);
    solexsChart.data.datasets[0].data.shift();
    solexsChart.data.datasets[0].data.push(nextSoft);

    heliosChart.data.labels.shift();
    heliosChart.data.labels.push(timeStr);
    heliosChart.data.datasets[0].data.shift();
    heliosChart.data.datasets[0].data.push(nextHard);

    solexsChart.update('none');
    heliosChart.update('none');

    // Update Hover Inspector default bar values
    const inspTime = document.getElementById('insp-time');
    const inspSoft = document.getElementById('insp-soft');
    const inspHard = document.getElementById('insp-hard');
    if (inspTime) inspTime.textContent = `${timeStr} UTC`;
    if (inspSoft) inspSoft.textContent = `${nextSoft.toExponential(2)} W/m²`;
    if (inspHard) inspHard.textContent = `${nextHard.toLocaleString()} cts/s`;
  }, 2000);
}
