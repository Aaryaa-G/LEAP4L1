// SolarIS Simulated Database (db.js)
// Stores active regions (with spherical coordinates for 3D mapping), historical flares, and sample telemetry datasets.

export const activeRegions = [
  {
    id: 'AR13562',
    name: 'AR13562',
    complexity: 'Beta-Gamma-Delta',
    lat: 18,   // Latitude on Sun (degrees)
    lon: -25,  // Longitude on Sun (degrees)
    flareProbability: 91,
    estimatedClass: 'X2.4',
    status: 'CRITICAL',
    statusColor: 'status-critical',
    details: {
      event: 'Aug 31, 2012 Corona Filament Eruption',
      cmeSpeed: '>900 mi/s (Glancing Magnetosphere Blow)',
      impact: 'Strong Auroral Display (Sept 3)',
      temp: '12.5M Kelvin',
      shear: '78.2 deg'
    }
  },
  {
    id: 'AR13647',
    name: 'AR13647',
    complexity: 'Beta-Gamma',
    lat: -12,
    lon: 15,
    flareProbability: 62,
    estimatedClass: 'M7.3',
    status: 'HIGH THREAT',
    statusColor: 'text-warning',
    details: {
      event: 'June 20, 2013 Earth-Directed CME',
      cmeSpeed: '>750 mi/s (Moderate Magnetic Impact)',
      impact: 'Moderate Geomagnetic Storm (G2)',
      temp: '8.4M Kelvin',
      shear: '52.1 deg'
    }
  },
  {
    id: 'AR13639',
    name: 'AR13639',
    complexity: 'Alpha',
    lat: 5,
    lon: 60,
    flareProbability: 24,
    estimatedClass: 'M7.3',
    status: 'MODERATE',
    statusColor: 'text-cyan',
    details: {
      event: 'Oct 2, 2014 Mid-Level Solar Flare',
      cmeSpeed: '420 mi/s (Non Earth-Directed)',
      impact: 'Minimal Auroral Activity',
      temp: '4.8M Kelvin',
      shear: '21.5 deg'
    }
  },
  {
    id: 'AR13658',
    name: 'AR13658',
    complexity: 'Beta-Delta',
    lat: -28,
    lon: -45,
    flareProbability: 11,
    estimatedClass: 'M2.0',
    status: 'ACTIVE MONITORING',
    statusColor: 'text-green',
    details: {
      event: 'June 7, 2011 Major M-2 CME Eruption',
      cmeSpeed: '550 mi/s (Deflected CME Path)',
      impact: 'No Earth Impact Expected',
      temp: '2.1M Kelvin',
      shear: '34.8 deg'
    }
  }
];

// Generates synthetic telemetry data points to feed file parsing simulations
export function generateTelemetryFileContent(type = 'quiet') {
  const points = 50;
  const data = [];
  const now = Date.now();
  
  for (let i = 0; i < points; i++) {
    const time = new Date(now - (points - 1 - i) * 60000).toISOString();
    let softXRay = 1e-7 + Math.random() * 2e-7;
    let hardXRay = 100 + Math.random() * 50;
    let magneticShear = 15.0 + Math.random() * 2.0;

    if (type === 'm_class') {
      // Create a medium flare event around index 35
      if (i > 30 && i <= 36) {
        const factor = (i - 30) / 6;
        softXRay += factor * 5e-5;
        hardXRay += factor * 4000;
        magneticShear += factor * 15;
      } else if (i > 36) {
        // Decay phase
        const decay = Math.exp(-(i - 36) * 0.2);
        softXRay += decay * 5e-5;
        hardXRay += decay * 4000;
        magneticShear += 15 + decay * 15;
      }
    } else if (type === 'x_class') {
      // Create a massive flare event starting at index 25, peaking at 28
      if (i >= 20 && i <= 28) {
        const factor = (i - 20) / 8;
        softXRay += factor * 2.5e-4;
        hardXRay += factor * 15000;
        magneticShear += factor * 35;
      } else if (i > 28) {
        // Slow decay
        const decay = Math.exp(-(i - 28) * 0.1);
        softXRay += decay * 2.5e-4;
        hardXRay += decay * 15000;
        magneticShear += 35 + decay * 35;
      }
    }
    
    data.push({
      timestamp: time,
      soft_xray_flux: parseFloat(softXRay.toExponential(4)),
      hard_xray_counts: Math.round(hardXRay),
      magnetic_shear_angle: parseFloat(magneticShear.toFixed(2))
    });
  }

  return JSON.stringify(data, null, 2);
}
