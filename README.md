# Solar Flare Forecasting and Nowcasting

**Team:** Leap4L1

Forecasting and/or nowcasting solar flares using combined soft and hard X-ray data from Aditya-L1.

## Overview
This project proposes a pipeline to detect solar flare activity and estimate near-term flare probability by combining observations from Aditya-L1's SoLEXS and HEL1OS instruments.

## Data Sources
- **SoLEXS:** Soft X-ray light curves and spectra.
- **HEL1OS:** Hard X-ray light curves.

## Workflow
1. Preprocess, calibrate, denoise, and time-align the instrument data.
2. Detect candidate flares using temporal features and adaptive thresholds.
3. Extract temporal and spectral features, including gradients, energy bands, hardness ratio, and spectral entropy.
4. Fuse features from both instruments for machine-learning analysis.
5. Generate flare classifications, probabilities, and a proposed 10-minute-ahead forecast.
6. Present results through a dashboard, flare catalogue, and alerts.

## Technology Stack
Python, NumPy, SciPy, Pandas, Astropy, Scikit-learn, TensorFlow/PyTorch, FastAPI, React, Vite, Chart.js, PostgreSQL, and Docker.

## Dashboard
Live prototype: https://isro-bah15.vercel.app/

## Status
This repository supports a proposed research and development project. Forecasting accuracy and real-time operation depend on data availability, implementation, and validation.

## Team
- Aryan Ilake — Team Leader
- Aarya Gojare
- Trushali Phatak
- Aayush Punekar
