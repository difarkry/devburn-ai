const https = require('https');
const fs = require('fs');
const path = require('path');
const ChatMessage = require('../models/ChatMessage');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { findRelevantContext } = require('../services/ragService');

const FALLBACK_MESSAGE = 'Maaf, saya tidak menemukan informasi yang cukup relevan. Silakan konsultasikan dengan profesional kesehatan.';

// Load system prompt from file
const SYSTEM_PROMPT_PATH = path.join(__dirname, '../data/system_prompt.txt');
let BASE_SYSTEM_PROMPT = '';
try {
  BASE_SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8').trim();
} catch (e) {
  BASE_SYSTEM_PROMPT = 'Anda adalah asisten kesehatan mental untuk programmer. Jawab dalam Bahasa Indonesia tanpa markdown.';
}

function callGroqApi(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(new Error(parsed.error?.message || 'Groq API error'));
          }
          const content = parsed.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error('Invalid Groq API response'));
        }
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Groq API timeout'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMessage(req, res, next) {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong', code: 'VALIDATION_ERROR' });
    }

    const { context, confidence, source } = findRelevantContext(message);

    // Fetch all predictions with nama for LLM name-aware context
    const user = await User.findById(req.user.userId).select('name');
    const allPredictions = await Prediction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(20);
    // Extract unique names from data
    const namedPredictions = allPredictions.filter(p => p.nama && p.nama.trim());
    const availableNames = [...new Set(namedPredictions.map(p => p.nama.trim().toLowerCase()))];

    // Detect if user is asking about a specific person
    const msgLower = message.toLowerCase();
    const mentionedName = availableNames.find(n => msgLower.includes(n));

    let predictionContext = '';
    if (namedPredictions.length > 0) {
      if (mentionedName) {
        // Only show data for the mentioned person
        const filtered = namedPredictions.filter(p => p.nama.trim().toLowerCase() === mentionedName);
        const lines = filtered.map((p, i) =>
          `${i + 1}. Tanggal: ${new Date(p.createdAt).toLocaleDateString('id-ID')}, Nama: ${p.nama}, Level: ${p.burnout_level}, Confidence: ${(p.confidence * 100).toFixed(1)}%, Jam kerja: ${p.inputs.daily_work_hours}, Tidur: ${p.inputs.sleep_hours}, Kafein: ${p.inputs.caffeine_intake}, Bug/hari: ${p.inputs.bugs_per_day}, Rapat/hari: ${p.inputs.meetings_per_day}`
        );
        predictionContext = `\n\nData prediksi untuk ${filtered[0].nama}:\n${lines.join('\n')}`;
      } else if (availableNames.length > 0) {
        // User asked about someone not in data — tell LLM to list available names
        const nameSummary = availableNames.map((n, i) => {
          const last = namedPredictions.find(p => p.nama.trim().toLowerCase() === n);
          return `${i + 1}. ${last.nama} dengan burnout level ${last.burnout_level}`;
        }).join(', ');
        predictionContext = `\n\nPerintah: Jika user bertanya tentang nama yang tidak ada di data, jawab: "Siapa yang Anda maksud? Di data hanya ada: ${nameSummary}." Jangan mengarang data orang yang tidak ada.\n\nDaftar nama yang tersedia: ${nameSummary}`;
      } else {
        // No named predictions, show all
        const lines = allPredictions.slice(0, 5).map((p, i) =>
          `${i + 1}. Tanggal: ${new Date(p.createdAt).toLocaleDateString('id-ID')}, Level: ${p.burnout_level}, Jam kerja: ${p.inputs.daily_work_hours}, Tidur: ${p.inputs.sleep_hours}`
        );
        predictionContext = `\n\nData prediksi terbaru:\n${lines.join('\n')}`;
      }
    }

    let assistantResponse;
    let finalConfidence = confidence;
    let finalSource = source;

    // Build conversation history for context-aware responses
    const recentHistory = await ChatMessage.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const historyMessages = recentHistory.reverse().flatMap(m => [
      { role: 'user', content: m.userMessage },
      { role: 'assistant', content: m.assistantResponse }
    ]);

    const systemPrompt = context
      ? `${BASE_SYSTEM_PROMPT}\n\nNama user yang sedang chat: ${user?.name || 'pengguna'}.\n\nKonteks relevan:\n${context}${predictionContext}`
      : `${BASE_SYSTEM_PROMPT}\n\nNama user yang sedang chat: ${user?.name || 'pengguna'}.${predictionContext}`;

    try {
      assistantResponse = await callGroqApi([
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ]);
      assistantResponse = assistantResponse.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    } catch (err) {
      console.error('Groq API error:', err.message);
      return res.status(503).json({ success: false, message: 'Layanan chat sedang tidak tersedia. Coba lagi nanti.', code: 'SERVICE_UNAVAILABLE' });
    }

    await ChatMessage.create({
      userId: req.user.userId,
      userMessage: message,
      assistantResponse,
      ragConfidence: finalConfidence,
      ragSource: finalSource
    });

    return res.status(200).json({
      success: true,
      data: { response: assistantResponse, ragConfidence: finalConfidence, ragSource: finalSource }
    });
  } catch (err) {
    next(err);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const messages = await ChatMessage.find({ userId: req.user.userId }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

async function clearChatHistory(req, res, next) {
  try {
    await ChatMessage.deleteMany({ userId: req.user.userId });
    return res.status(200).json({ success: true, message: 'Riwayat chat berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getChatHistory, clearChatHistory };
