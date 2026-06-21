const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userMessage: { type: String, required: true },
  assistantResponse: { type: String, required: true },
  ragConfidence: { type: Number, default: 0 },
  ragSource: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
