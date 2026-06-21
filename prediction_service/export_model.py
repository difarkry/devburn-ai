"""
Jalankan script ini SEKALI untuk export model ke format JSON.
Output: prediction_service/models/model_xgb.json
        prediction_service/models/iqr_bounds.json

Usage:
    cd prediction_service
    python export_model.py
"""

import json
import pickle
import joblib
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

# ── Definisi custom class yang dibutuhkan saat load pickle ──────────────────
class HandleIQR(BaseEstimator, TransformerMixin):
    def __init__(self, factor=1.5):
        self.factor = factor
    def fit(self, X, y=None):
        return self
    def transform(self, X, y=None):
        return X

import __main__
__main__.HandleIQR = HandleIQR

# ── Load pipeline ────────────────────────────────────────────────────────────
pipeline = joblib.load('models/Model_XGB_Burnout_V1.pkl')
print('Pipeline loaded:', type(pipeline))
print('Steps:', [(n, type(s).__name__) for n, s in pipeline.steps])

# ── Cari XGBoost classifier di dalam pipeline ────────────────────────────────
xgb_model = None
iqr_step = None

for name, step in pipeline.steps:
    class_name = type(step).__name__
    if 'XGB' in class_name or 'xgb' in class_name.lower():
        xgb_model = step
        print(f'Found XGBoost step: {name} -> {class_name}')
    if 'HandleIQR' in class_name or 'IQR' in class_name:
        iqr_step = step
        print(f'Found IQR step: {name} -> {class_name}')

if xgb_model is None:
    raise RuntimeError('XGBoost model tidak ditemukan di pipeline. Cek steps di atas.')

# ── Export XGBoost ke JSON ────────────────────────────────────────────────────
xgb_model.save_model('models/model_xgb.json')
print('Model exported ke models/model_xgb.json')

# ── Export IQR bounds kalau ada ───────────────────────────────────────────────
if iqr_step and hasattr(iqr_step, 'lower_bounds_'):
    iqr_data = {
        'lower_bounds': {str(k): v for k, v in iqr_step.lower_bounds_.items()},
        'upper_bounds': {str(k): v for k, v in iqr_step.upper_bounds_.items()},
    }
    with open('models/iqr_bounds.json', 'w') as f:
        json.dump(iqr_data, f, indent=2)
    print('IQR bounds exported ke models/iqr_bounds.json')
else:
    # Buat file kosong supaya Node.js tidak error
    with open('models/iqr_bounds.json', 'w') as f:
        json.dump({'lower_bounds': {}, 'upper_bounds': {}}, f)
    print('IQR bounds: tidak ada / kosong')

print('\nDone! Sekarang jalankan backend Node.js tanpa prediction_service.')
