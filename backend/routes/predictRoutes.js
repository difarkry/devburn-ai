const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { predict, getHistory, deleteHistory } = require('../controllers/predictController');

router.post('/', authMiddleware, predict);
router.get('/history', authMiddleware, getHistory);
router.delete('/history/:id', authMiddleware, deleteHistory);

module.exports = router;
