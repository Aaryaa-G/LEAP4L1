// SolarIS Application Controller (main.js)
import { createIcons, icons } from 'lucide';
import { SolarGlobe } from './solar3d.js';
import { initCharts } from './charts.js';
import { activeRegions, generateTelemetryFileContent } from './db.js';
import Chart from 'chart.js/auto';

// Global View & 3D Variables
let dashboardGlobe = null;
let nowcastChart = null;

// Telemetry state
let parsedNowcastData = null;
let currentNowcastTab = 'xray'; // 'xray' or 'magnetic'

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Icons
  initLucideIcons();

  // 2. Start Live UTC Clock
  startUTCClock();

  // 3. Initialize Landing 3D Sun Globe
  const heroContainer = document.getElementById('hero-section');
  if (heroContainer) {
    dashboardGlobe = new SolarGlobe(heroContainer, 'dashboard', (regionData) => {
      // Callback when clicking hotspot on Sun
      updateDashboardHUD(regionData);
    });
  }

  // 4. Initialize Landing Page Flux Charts
  try {
    initCharts();
  } catch (e) {
    console.error('Landing charts init error:', e);
  }

  // 5. Landing Slider Control: Adjust Sun Rotational Speed
  const rotSlider = document.getElementById('time-horizon-range');
  if (rotSlider) {
    rotSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      // Map 0-200 to 0 - 1.5 speed
      const mappedSpeed = (val / 100) * 0.8;
      if (dashboardGlobe) {
        dashboardGlobe.setRotationSpeed(mappedSpeed);
      }
    });
  }

  // 6. Setup Drag & Drop File Listeners for Nowcasting
  setupNowcastIngestion();

  // 7. Setup Chart Tabs for Nowcast
  setupNowcastChartTabs();

  // 8. Reticle HUD click navigation to cycle active regions
  setupHUDClickCycling();

  // Expose routing globally
  window.switchToView = switchToView;
  window.loadNowcastPreset = loadNowcastPreset;
  window.runForecastSimulation = runForecastSimulation;
  window.scrollToAnalysis = scrollToAnalysis;
});

// Switch view panels dynamically
function switchToView(viewName) {
  // Update sidebar buttons
  const navBtns = {
    dashboard: document.getElementById('nav-dashboard-btn'),
    nowcast: document.getElementById('nav-nowcast-btn'),
    forecast: document.getElementById('nav-forecast-btn')
  };

  Object.keys(navBtns).forEach(key => {
    if (navBtns[key]) {
      if (key === viewName) {
        navBtns[key].classList.add('active');
      } else {
        navBtns[key].classList.remove('active');
      }
    }
  });

  // Toggle View HTML visibility
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    nowcast: document.getElementById('view-nowcast'),
    forecast: document.getElementById('view-forecast')
  };

  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === viewName) {
        views[key].classList.add('active-view');
      } else {
        views[key].classList.remove('active-view');
      }
    }
  });

  // Manage 3D Globe States
  if (viewName === 'dashboard') {
    if (dashboardGlobe) {
      dashboardGlobe.setMode('dashboard');
    }
  } else if (viewName === 'nowcast') {
    if (dashboardGlobe) {
      dashboardGlobe.setMode('nowcast');
    }
  } else if (viewName === 'forecast') {
    if (dashboardGlobe) {
      dashboardGlobe.setMode('forecast');
    }
  }

  // Reinitialize icons in case new DOM elements became visible
  initLucideIcons();

  // Reset scroll to top of view
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Update the Landing Page Reticle HUD with DB info
function updateDashboardHUD(data) {
  const elArName = document.getElementById('hud-ar-name');
  const elClassBadge = document.getElementById('hud-class-badge');
  const elDesc = document.getElementById('hud-desc');

  const elStatusVal = document.getElementById('mission-status-val');
  const elProbVal = document.getElementById('flare-prob-val');
  const elEstClassVal = document.getElementById('est-class-val');

  if (elArName) elArName.textContent = data.name;
  if (elClassBadge) {
    elClassBadge.textContent = `CLASS ${data.estimatedClass}`;
    elClassBadge.className = `target-class-badge`;
    // Update badge color class based on status
    if (data.status === 'CRITICAL') elClassBadge.style.color = '#ff3344';
    else if (data.status === 'HIGH THREAT') elClassBadge.style.color = '#e67e22';
    else elClassBadge.style.color = '#00a8ff';
  }

  if (elDesc) {
    elDesc.innerHTML = `
      <div class="desc-row"><span class="desc-label">Event:</span><span class="desc-val">${data.details.event}</span></div>
      <div class="desc-row"><span class="desc-label">CME Speed:</span><span class="desc-val">${data.details.cmeSpeed}</span></div>
      <div class="desc-row"><span class="desc-label">Max Temp:</span><span class="desc-val">${data.details.temp}</span></div>
      <div class="desc-row"><span class="desc-label">Mag Shear:</span><span class="desc-val">${data.details.shear}</span></div>
    `;
  }

  // Update real-time db side preview metrics
  if (elStatusVal) {
    elStatusVal.textContent = `${data.status} ALERT`;
    elStatusVal.style.color = data.status === 'CRITICAL' ? '#ff3344' : (data.status === 'HIGH THREAT' ? '#e67e22' : '#00a8ff');
  }
  if (elProbVal) elProbVal.textContent = `${data.flareProbability}%`;
  if (elEstClassVal) elEstClassVal.textContent = data.name;

  // Pulse effect in 3D Sun
  if (dashboardGlobe) {
    dashboardGlobe.triggerFlareEffect(data.lat, data.lon, data.estimatedClass.charAt(0));
  }
}

// Setup Drag & Drop File Listeners for Nowcasting
function setupNowcastIngestion() {
  const dropzone = document.getElementById('nowcast-dropzone');
  const fileInput = document.getElementById('nowcast-file-input');

  if (!dropzone || !fileInput) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processNowcastFile(files[0]);
    }
  });

  // Handle selected files
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processNowcastFile(e.target.files[0]);
    }
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Load a sample telemetry preset directly
function loadNowcastPreset(presetType) {
  const jsonContent = generateTelemetryFileContent(presetType);
  const data = JSON.parse(jsonContent);
  
  // Show file upload simulation
  const dropzoneText = document.querySelector('#nowcast-dropzone .upload-text');
  if (dropzoneText) {
    dropzoneText.textContent = `Loaded Preset: ${presetType.toUpperCase()} SUN PROFILE`;
  }
  
  analyzeNowcastTelemetry(data);
}

// Parse file content
function processNowcastFile(file) {
  const reader = new FileReader();
  
  // Show file name
  const dropzoneText = document.querySelector('#nowcast-dropzone .upload-text');
  if (dropzoneText) {
    dropzoneText.textContent = `File Ingested: ${file.name}`;
  }

  reader.onload = (e) => {
    try {
      let data = [];
      const text = e.target.result;
      
      if (file.name.endsWith('.csv')) {
        // CSV Parsing
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = lines[i].split(',');
          const obj = {};
          headers.forEach((header, index) => {
            let val = cols[index]?.trim();
            if (header.includes('flux') || header.includes('counts') || header.includes('angle')) {
              obj[header] = parseFloat(val);
            } else {
              obj[header] = val;
            }
          });
          // map headers to expected names
          data.push({
            timestamp: obj.timestamp || obj.time || new Date().toISOString(),
            soft_xray_flux: obj.soft_xray_flux || obj.soft_flux || obj.flux || 0,
            hard_xray_counts: obj.hard_xray_counts || obj.hard_flux || obj.photon_counts || 0,
            magnetic_shear_angle: obj.magnetic_shear_angle || obj.shear || 0
          });
        }
      } else {
        // JSON Parsing
        data = JSON.parse(text);
      }

      analyzeNowcastTelemetry(data);
    } catch (err) {
      console.error(err);
      alert('Error parsing telemetry file. Ensure it is a valid SolarIS JSON/CSV schema.');
    }
  };

  reader.readAsText(file);
}

// Analyze Nowcasting Telemetry using a slope-based flare detection algorithm
function analyzeNowcastTelemetry(data) {
  parsedNowcastData = data;
  
  let peakSoft = 0;
  let peakHard = 0;
  let peakTime = '';
  let flareDetected = false;
  let flareStartIndex = -1;
  let flarePeakIndex = -1;

  // 1. Scan for flare event: derivative of Soft X-Ray rises steeply
  for (let i = 1; i < data.length; i++) {
    const prevSoft = data[i-1].soft_xray_flux;
    const currSoft = data[i].soft_xray_flux;
    const diff = currSoft - prevSoft;

    // Detect sudden anomaly threshold
    if (diff > 4e-6 && currSoft > 1e-5 && !flareDetected) {
      flareDetected = true;
      flareStartIndex = i;
    }

    if (currSoft > peakSoft) {
      peakSoft = currSoft;
      peakTime = data[i].timestamp;
      flarePeakIndex = i;
    }
    if (data[i].hard_xray_counts > peakHard) {
      peakHard = data[i].hard_xray_counts;
    }
  }

  // 2. Classify flare based on peak flux
  let classification = 'A/B (Baseline)';
  if (peakSoft >= 1e-4) classification = 'X Class (Severe Eruption)';
  else if (peakSoft >= 1e-5) classification = 'M Class (Medium Eruption)';
  else if (peakSoft >= 1e-6) classification = 'C Class (Minor Eruption)';

  // 3. Update UI Banner
  const banner = document.getElementById('nowcast-result-banner');
  const title = document.getElementById('nowcast-status-title');
  const desc = document.getElementById('nowcast-status-desc');

  if (banner) {
    banner.className = 'detection-status-wrapper';
    if (flareDetected) {
      banner.classList.add('alarm-state');
      title.textContent = `ALERT: SOLAR FLARE DETECTED [${classification.split(' ')[0]}]`;
      const timeStr = new Date(peakTime).toLocaleTimeString();
      desc.textContent = `Eruption detected starting at UTC step. Peak Soft X-ray flux reached ${peakSoft.toExponential(2)} W/m² at ${timeStr}. Payload shielding advised.`;
    } else {
      banner.classList.add('quiet-state');
      title.textContent = 'NO FLARE DETECTED (QUIET STATE)';
      desc.textContent = 'Telemetry curves indicate baseline solar activity. X-ray spectrometers are reading within normal background parameters.';
    }
  }

  // 4. Update Stats Box Metrics
  const dateObj = new Date(peakTime);
  document.getElementById('stat-timestamp').textContent = peakTime ? dateObj.toLocaleTimeString() + ' UTC' : 'N/A';
  document.getElementById('stat-peak-soft').textContent = `${peakSoft.toExponential(2)} W/m²`;
  document.getElementById('stat-peak-hard').textContent = `${peakHard.toLocaleString()} cts/s`;
  document.getElementById('stat-class').textContent = classification;

  // 5. Render Nowcast Graphs
  updateNowcastChart(flareStartIndex, flarePeakIndex);
}

// Chart tab switcher
function setupNowcastChartTabs() {
  const btnXray = document.getElementById('btn-tab-xray');
  const btnMag = document.getElementById('btn-tab-magnetic');

  if (!btnXray || !btnMag) return;

  btnXray.addEventListener('click', () => {
    btnXray.classList.add('active');
    btnMag.classList.remove('active');
    currentNowcastTab = 'xray';
    updateNowcastChart();
  });

  btnMag.addEventListener('click', () => {
    btnMag.classList.add('active');
    btnXray.classList.remove('active');
    currentNowcastTab = 'magnetic';
    updateNowcastChart();
  });
}

// Redraw chart with active loaded data
function updateNowcastChart(startIndex = -1, peakIndex = -1) {
  const ctx = document.getElementById('nowcast-telemetry-chart')?.getContext('2d');
  if (!ctx || !parsedNowcastData) return;

  if (nowcastChart) {
    nowcastChart.destroy();
  }

  const timestamps = parsedNowcastData.map(d => {
    const time = new Date(d.timestamp);
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  let datasets = [];

  if (currentNowcastTab === 'xray') {
    datasets = [
      {
        label: 'Soft X-Ray Flux (W/m²)',
        data: parsedNowcastData.map(d => d.soft_xray_flux),
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
        borderWidth: 2,
        fill: true,
        yAxisID: 'y1',
        tension: 0.25,
        pointRadius: (ctx) => (ctx.dataIndex === peakIndex ? 6 : 0),
        pointBackgroundColor: '#00f0ff'
      },
      {
        label: 'Hard X-Ray Count (cts/s)',
        data: parsedNowcastData.map(d => d.hard_xray_counts),
        borderColor: '#ff9d00',
        backgroundColor: 'rgba(255, 157, 0, 0.05)',
        borderWidth: 1.5,
        fill: false,
        yAxisID: 'y2',
        tension: 0.2,
        pointRadius: 0
      }
    ];
  } else {
    // Magnetic Shear Tab
    datasets = [
      {
        label: 'Magnetic Shear Angle (degrees)',
        data: parsedNowcastData.map(d => d.magnetic_shear_angle),
        borderColor: '#b554e6',
        backgroundColor: 'rgba(181, 84, 230, 0.08)',
        borderWidth: 2.5,
        fill: true,
        yAxisID: 'y1',
        tension: 0.15,
        pointRadius: 0
      }
    ];
  }

  // Create chart
  nowcastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { maxTicksLimit: 10, color: '#8a99ad', font: { family: 'JetBrains Mono', size: 9 } }
        },
        y1: {
          type: currentNowcastTab === 'xray' ? 'logarithmic' : 'linear',
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8a99ad', font: { family: 'JetBrains Mono', size: 9 } },
          title: {
            display: true,
            text: currentNowcastTab === 'xray' ? 'Watts / m² (Soft)' : 'Degrees Angle',
            color: '#52627a',
            font: { family: 'JetBrains Mono', size: 10 }
          }
        },
        y2: currentNowcastTab === 'xray' ? {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#8a99ad', font: { family: 'JetBrains Mono', size: 9 } },
          title: {
            display: true,
            text: 'Counts / sec (Hard)',
            color: '#52627a',
            font: { family: 'JetBrains Mono', size: 10 }
          }
        } : { display: false }
      },
      plugins: {
        legend: { display: false }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  });
}

// Run Forecasting Console Logs & Alerts Simulation
function runForecastSimulation(type = 'stormy') {
  const consoleEl = document.getElementById('forecast-console');
  if (!consoleEl) return;

  // Reset console
  consoleEl.innerHTML = '';
  const consolePulse = document.querySelector('.console-pulse');
  if (consolePulse) {
    consolePulse.textContent = '● COMPUTING';
    consolePulse.className = 'console-pulse active';
  }

  // Mock logging logs sequence
  const logs = [
    { text: '> [0.0s] Ingesting time-range active region magnetograms...', delay: 400, type: 'muted' },
    { text: '> [0.8s] Initializing DeepSolarNet Multi-Headed CNN model config...', delay: 1000, type: 'muted' },
    { text: '> [1.5s] Computing spatial magnetic shear angles & gradient ratios...', delay: 1800, type: 'muted' },
    { text: '> [2.3s] Running temporal convolutional recurrence layers...', delay: 2600, type: 'muted' },
    { text: `> [3.2s] AI simulation complete. Horizon check: ${document.getElementById('forecast-horizon').value} Hrs.`, delay: 3200, type: 'success' }
  ];

  logs.forEach(log => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = `console-line ${log.type === 'success' ? 'text-success' : 'text-muted'}`;
      line.textContent = log.text;
      consoleEl.appendChild(line);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }, log.delay);
  });

  // Render Alerts & Hotspots after completion
  setTimeout(() => {
    if (consolePulse) {
      consolePulse.textContent = '● FINISHED';
      consolePulse.className = 'console-pulse';
    }

    let forecastedAlerts = [];
    
    if (type === 'stormy') {
      forecastedAlerts = [
        {
          id: 'FL-2026A',
          regionId: 'AR13562',
          time: '2026-07-01 02:40 UTC',
          class: 'X2.4',
          probability: '91%',
          lat: 18,
          lon: -25,
          desc: 'Sudden magnetic shear instability expected. High probability of CME eruption.'
        },
        {
          id: 'FL-2026B',
          regionId: 'AR13647',
          time: '2026-07-01 14:15 UTC',
          class: 'M7.3',
          probability: '68%',
          lat: -12,
          lon: 15,
          desc: 'Precursor flux build-up identified. Hard X-ray signature rising.'
        },
        {
          id: 'FL-2026C',
          regionId: 'AR13639',
          time: '2026-07-02 08:05 UTC',
          class: 'M1.8',
          probability: '52%',
          lat: 5,
          lon: 60,
          desc: 'Weak magnetic reconnection loops. Low-level flaring probable.'
        }
      ];

      // Console summary lines
      const lineSummary = document.createElement('div');
      lineSummary.className = 'console-line text-warn';
      lineSummary.textContent = '> [ALERT] 3 imminent solar eruptions forecasted. Core localized on AR13562.';
      consoleEl.appendChild(lineSummary);
    } else {
      // Quiet Forecast
      forecastedAlerts = [];
      const lineSummary = document.createElement('div');
      lineSummary.className = 'console-line text-success';
      lineSummary.textContent = '> [REPORT] Solar activity quiet. No flare eruptions predicted above class C1.0.';
      consoleEl.appendChild(lineSummary);
    }

    renderForecastAlertsList(forecastedAlerts);
    


  }, 3500);
}

// Populate forecast list UI
function renderForecastAlertsList(alerts) {
  const container = document.getElementById('forecast-alerts-list');
  if (!container) return;

  container.innerHTML = '';

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="alerts-empty-state">
        <i data-lucide="sun" class="text-green size-32 mb-8" style="color: var(--color-green)"></i>
        <p style="color: var(--color-green)">Sun is in Quiet Mode</p>
        <span>AI models predict no major flaring hazards for the selected horizon.</span>
      </div>
    `;
    initLucideIcons();
    return;
  }

  alerts.forEach(alert => {
    const isX = alert.class.startsWith('X');
    
    const card = document.createElement('div');
    card.className = `alert-card ${isX ? 'critical-alert' : ''}`;
    card.id = `alert-card-${alert.id}`;
    
    card.innerHTML = `
      <div class="ac-left">
        <div class="ac-tag-row">
          <span class="ac-class-badge ${isX ? 'ac-class-x' : 'ac-class-m'}">CLASS ${alert.class}</span>
          <span class="ac-region">${alert.regionId}</span>
        </div>
        <span class="ac-time"><i data-lucide="clock" class="size-10" style="display:inline-block; margin-right:4px;"></i>${alert.time}</span>
      </div>
      <div class="ac-right">
        <span class="ac-prob">${alert.probability} Risk</span>
        <button class="ac-btn-focus" onclick="focusForecastAlert('${alert.id}', '${alert.regionId}', ${alert.lat}, ${alert.lon}, '${alert.class.charAt(0)}')">
          <i data-lucide="focus" class="size-10"></i> Map Location
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  initLucideIcons();
}

// Highlight forecast card and map location on 3D Sun
window.focusForecastAlert = function(alertId, regionId, lat, lon, flareClass) {
  // Highlight active alert card
  const cards = document.querySelectorAll('.alert-card');
  cards.forEach(c => c.classList.remove('active-alert'));

  const activeCard = document.getElementById(`alert-card-${alertId}`);
  if (activeCard) {
    activeCard.classList.add('active-alert');
  }

  // Print info on the console log
  const consoleEl = document.getElementById('forecast-console');
  if (consoleEl) {
    const line = document.createElement('div');
    line.className = 'console-line text-warn';
    line.textContent = `> [HUD] Interactive Targeting focused on region ${regionId} (Coordinates: Lat ${lat}°, Lon ${lon}°). Instigating flare particle simulation...`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }


};

// Start UTC Clock in Header
function startUTCClock() {
  const clockEl = document.getElementById('live-utc-time');
  if (!clockEl) return;

  setInterval(() => {
    const now = new Date();
    const timeStr = now.toISOString().split('T')[1].slice(0, 8);
    clockEl.textContent = `${timeStr} UTC`;
  }, 1000);
}

function initLucideIcons() {
  try {
    createIcons({ icons });
  } catch (e) {
    console.warn('Lucide icon build warning:', e);
  }
}

// Smooth scroll implementation
function scrollToAnalysis() {
  document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' });
}

// Enable HUD click navigation to cycle active regions
function setupHUDClickCycling() {
  const hudElement = document.getElementById('ar-target-hud');
  if (!hudElement) return;

  const reticleBox = hudElement.querySelector('.reticle-box');
  const infoPointer = hudElement.querySelector('.target-info-pointer');
  
  if (reticleBox) {
    reticleBox.style.pointerEvents = 'auto';
    reticleBox.style.cursor = 'pointer';
  }
  if (infoPointer) {
    infoPointer.style.pointerEvents = 'auto';
    infoPointer.style.cursor = 'pointer';
  }

  hudElement.addEventListener('click', (e) => {
    e.stopPropagation();

    if (dashboardGlobe && dashboardGlobe.selectedRegionGroup) {
      const currentRegionId = dashboardGlobe.selectedRegionGroup.children[0].userData.regionId;
      const currentIndex = activeRegions.findIndex(r => r.id === currentRegionId);
      
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % activeRegions.length;
        const nextRegion = activeRegions[nextIndex];
        
        dashboardGlobe.focusOnRegion(nextRegion.id);
        updateDashboardHUD(nextRegion);
      }
    }
  });
}
