import pickle
import re

with open('models/Model_XGB_Burnout_V1.pkl', 'rb') as f:
    data = f.read()

text = data.decode('latin-1')
matches = re.findall(r'c__main__\n(\w+)', text)
print('Custom classes needed:', matches)

# Load and inspect the model
import joblib
import warnings
warnings.filterwarnings('ignore')

# Define HandleIQR before loading
from sklearn.base import BaseEstimator, TransformerMixin
class HandleIQR(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None): return self
    def transform(self, X, y=None): return X

import __main__
__main__.HandleIQR = HandleIQR

model = joblib.load('models/Model_XGB_Burnout_V1.pkl')
print('Model type:', type(model))
print('Model:', model)

# Try to get feature names
if hasattr(model, 'feature_names_in_'):
    print('Feature names:', model.feature_names_in_)
if hasattr(model, 'n_features_in_'):
    print('N features:', model.n_features_in_)

# If pipeline, check steps
if hasattr(model, 'steps'):
    for name, step in model.steps:
        print(f'Step: {name} -> {type(step).__name__}')
        if hasattr(step, 'feature_names_in_'):
            print(f'  Features: {step.feature_names_in_}')
        if hasattr(step, 'n_features_in_'):
            print(f'  N features: {step.n_features_in_}')
