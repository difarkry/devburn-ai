const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { sendMessage, getChatHistory, clearChatHistory } = require('../controllers/chatController');

router.post('/', authMiddleware, sendMessage);
router.get('/history', authMiddleware, getChatHistory);
router.delete('/history', authMiddleware, clearChatHistory);

module.exports = router;
