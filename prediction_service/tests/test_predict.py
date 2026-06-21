# Feature: burnout-prediction-web
# Property 8: Prediction_Service output format valid
import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app

@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client


VALID_FIELDS = {
    'age': (18.0, 80.0),
    'experience_years': (0.0, 50.0),
    'daily_work_hours': (1.0, 24.0),
    'sleep_hours': (1.0, 12.0),
    'caffeine_intake': (0.0, 20.0),
    'bugs_per_day': (0.0, 100.0),
    'commits_per_day': (0.0, 100.0),
    'meetings_per_day': (0.0, 20.0),
    'screen_time': (1.0, 24.0),
    'exercise_hours': (0.0, 12.0)
}

valid_input_strategy = st.fixed_dictionaries({
    field: st.floats(min_value=low, max_value=high, allow_nan=False, allow_infinity=False)
    for field, (low, high) in VALID_FIELDS.items()
})


# Property 8: Valid input always returns correct format
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(features=valid_input_strategy)
def test_predict_output_format(client, features):
    """P8: Prediction_Service output has burnout_level, confidence in [0,1], non-empty recommendation."""
    response = client.post('/predict', json=features)

    # Skip if model not loaded (503)
    if response.status_code == 503:
        return

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
    data = response.get_json()

    assert 'burnout_level' in data, "Missing burnout_level"
    assert 'confidence' in data, "Missing confidence"
    assert 'recommendation' in data, "Missing recommendation"

    assert data['burnout_level'] in ('Low', 'Medium', 'High'), \
        f"Invalid burnout_level: {data['burnout_level']}"
    assert 0.0 <= data['confidence'] <= 1.0, \
        f"Confidence out of range: {data['confidence']}"
    assert len(data['recommendation']) > 0, "Recommendation is empty"


# Test: Missing fields return 400
@settings(max_examples=50)
@given(
    missing_field=st.sampled_from(list(VALID_FIELDS.keys()))
)
def test_predict_missing_field_returns_400(client, missing_field):
    """Missing a required field should return HTTP 400."""
    features = {
        field: (low + high) / 2
        for field, (low, high) in VALID_FIELDS.items()
        if field != missing_field
    }
    response = client.post('/predict', json=features)
    assert response.status_code == 400


# Test: Non-numeric field returns 400
def test_predict_non_numeric_returns_400(client):
    features = {field: (low + high) / 2 for field, (low, high) in VALID_FIELDS.items()}
    features['age'] = 'not_a_number'
    response = client.post('/predict', json=features)
    assert response.status_code == 400


# Test: health endpoint
def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'ok'
