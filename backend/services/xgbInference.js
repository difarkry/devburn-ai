/**
 * Pure JS XGBoost inference — reads model_xgb.json exported from Python.
 * Supports multi-class softprob (3 classes: Low/Medium/High).
 * No native bindings needed — works on Vercel serverless.
 */

const path = require('path');
let modelData = null;

function loadModel() {
  if (modelData) return modelData;
  modelData = require(path.join(__dirname, '../data/model_xgb.json'));
  return modelData;
}

/**
 * Traverse a single tree for one sample.
 * @param {object} tree - tree object from model JSON
 * @param {number[]} features - feature values
 * @returns {number} leaf value
 */
function traverseTree(tree, features) {
  let node = 0;
  const { left_children, right_children, split_indices, split_conditions, default_left, base_weights } = tree;

  while (left_children[node] !== -1) {
    const featureIdx = split_indices[node];
    const threshold = split_conditions[node];
    const featureVal = features[featureIdx];

    if (isNaN(featureVal) || featureVal === null) {
      node = default_left[node] ? left_children[node] : right_children[node];
    } else if (featureVal < threshold) {
      node = left_children[node];
    } else {
      node = right_children[node];
    }
  }

  return base_weights[node];
}

/**
 * Softmax over array of raw scores.
 */
function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/**
 * Run prediction on one sample.
 * @param {number[]} features - feature values in model's expected order
 * @param {number} numClasses - number of output classes (3)
 * @returns {{ classIndex: number, probabilities: number[] }}
 */
function predict(features, numClasses = 3) {
  const model = loadModel();
  const trees = model.learner.gradient_booster.model.trees;
  const treeInfo = model.learner.gradient_booster.model.tree_info;

  // Accumulate scores per class
  const rawScores = new Array(numClasses).fill(0);

  // Base score from learner
  const baseScore = parseFloat(model.learner.learner_model_param?.base_score ?? 0.5);

  for (let i = 0; i < trees.length; i++) {
    const classIdx = treeInfo[i]; // which class this tree belongs to
    rawScores[classIdx] += traverseTree(trees[i], features);
  }

  // Add base score (in log-odds space — XGBoost already handles this internally in JSON weights)
  const probs = softmax(rawScores);

  let maxIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[maxIdx]) maxIdx = i;
  }

  return { classIndex: maxIdx, probabilities: probs };
}

module.exports = { predict };
