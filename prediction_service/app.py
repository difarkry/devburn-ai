import os
import pickle
import numpy as np
from flask import Flask, request, jsonify
from sklearn.base import BaseEstimator, TransformerMixin

# Custom transformer required by the saved model
class HandleIQR(BaseEstimator, TransformerMixin):
    def __init__(self, factor=1.5):
        self.factor = factor

    def fit(self, X, y=None):
        import pandas as pd
        df = pd.DataFrame(X) if not hasattr(X, 'columns') else X
        self.lower_bounds_ = {}
        self.upper_bounds_ = {}
        for col in df.columns:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            self.lower_bounds_[col] = Q1 - self.factor * IQR
            self.upper_bounds_[col] = Q3 + self.factor * IQR
        return self

    def transform(self, X, y=None):
        import pandas as pd
        import numpy as np
        lower = getattr(self, 'lower_bounds_', {})
        upper = getattr(self, 'upper_bounds_', {})
        if hasattr(X, 'columns'):
            df = X.copy()
            for col in df.columns:
                if col in lower:
                    df[col] = df[col].clip(lower=lower[col], upper=upper[col])
            return df.values
        else:
            arr = np.array(X, dtype=float)
            for i in range(arr.shape[1] if arr.ndim > 1 else 1):
                key = i
                if key in lower:
                    arr[:, i] = np.clip(arr[:, i], lower[key], upper[key])
            return arr

import __main__
__main__.HandleIQR = HandleIQR

app = Flask(__name__)

# Load model at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'Model_XGB_Burnout_V1.pkl')
model = None

def load_model():
    global model
    try:
        # Try loading with joblib first (more compatible with sklearn pipelines)
        try:
            import joblib
            model = joblib.load(MODEL_PATH)
            print(f"Model loaded via joblib from {MODEL_PATH}")
            return
        except Exception as e1:
            print(f"joblib failed: {e1}, trying pickle...")

        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print(f"Model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"Error loading model: {e}")
        model = None

load_model()

REQUIRED_FIELDS = [
    'age', 'experience_years', 'daily_work_hours', 'sleep_hours',
    'caffeine_intake', 'bugs_per_day', 'commits_per_day',
    'meetings_per_day', 'screen_time', 'exercise_hours'
]

FIELD_RANGES = {
    'age': (18, 80),
    'experience_years': (0, 50),
    'daily_work_hours': (1, 24),
    'sleep_hours': (1, 12),
    'caffeine_intake': (0, 20),
    'bugs_per_day': (0, 100),
    'commits_per_day': (0, 100),
    'meetings_per_day': (0, 20),
    'screen_time': (1, 24),
    'exercise_hours': (0, 12)
}

# Only these 5 features are used by the model (in this order)
MODEL_FEATURES = ['daily_work_hours', 'bugs_per_day', 'meetings_per_day', 'caffeine_intake', 'sleep_hours']

RECOMMENDATIONS = {
    'Low': 'Burnout Anda rendah. Pertahankan keseimbangan kerja-hidup yang baik, jaga pola tidur dan olahraga rutin.',
    'Medium': 'Burnout Anda sedang. Pertimbangkan untuk mengurangi jam kerja, tingkatkan waktu istirahat, dan bicarakan dengan tim tentang beban kerja.',
    'High': 'Burnout Anda tinggi. Segera kurangi beban kerja, ambil cuti jika memungkinkan, dan pertimbangkan konsultasi dengan profesional kesehatan mental.'
}

BURNOUT_LABELS = {0: 'Low', 1: 'Medium', 2: 'High'}


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 503

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request body must be JSON'}), 400

    # Validate all required fields present
    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    # Validate numeric and range
    features = []
    for field in REQUIRED_FIELDS:
        val = data[field]
        try:
            val = float(val)
        except (TypeError, ValueError):
            return jsonify({'error': f'Field "{field}" must be numeric'}), 400
        min_val, max_val = FIELD_RANGES[field]
        if not (min_val <= val <= max_val):
            return jsonify({'error': f'Field "{field}" must be between {min_val} and {max_val}'}), 400
        features.append(val)

    feature_array = np.array([features])

    # Build DataFrame with only the 5 features the model expects
    import pandas as pd
    feature_df = pd.DataFrame([{f: data[f] for f in MODEL_FEATURES}])

    try:
        prediction = model.predict(feature_df)[0]
        probabilities = model.predict_proba(feature_df)[0]
        pred_idx = int(prediction)
        confidence = float(probabilities[pred_idx])
        burnout_level = BURNOUT_LABELS.get(pred_idx, 'Medium')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

    return jsonify({
        'burnout_level': burnout_level,
        'confidence': round(confidence, 4),
        'recommendation': RECOMMENDATIONS[burnout_level]
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
