const path = require('path');
const fs = require('fs');

const RAG_PATH = process.env.RAG_PATH
  ? path.resolve(process.env.RAG_PATH)
  : path.join(__dirname, '../data/data.json');

let knowledgeBase = [];

try {
  const raw = fs.readFileSync(RAG_PATH, 'utf-8');
  knowledgeBase = JSON.parse(raw);
} catch (e) {
  console.error('Failed to load RAG data:', e.message);
}

/**
 * Find relevant context from knowledge base using keyword overlap scoring.
 * @param {string} query
 * @returns {{ context: string|null, confidence: number, source: string|null }}
 */
function findRelevantContext(query) {
  if (!query || knowledgeBase.length === 0) {
    return { context: null, confidence: 0, source: null };
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  let bestScore = 0;
  let bestEntry = null;

  for (const entry of knowledgeBase) {
    const keywords = entry.keywords || [];
    if (keywords.length === 0) continue;

    const matches = keywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      return queryLower.includes(kwLower) || queryWords.some(w => kwLower.includes(w));
    });

    const score = (matches.length / keywords.length) * 100;
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore === 0) {
    return { context: null, confidence: 0, source: null };
  }

  return {
    context: bestEntry.content,
    confidence: Math.round(bestScore),
    source: bestEntry.section
  };
}

module.exports = { findRelevantContext };
