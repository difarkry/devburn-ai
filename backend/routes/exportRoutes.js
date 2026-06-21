const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { exportCsv, exportPdf } = require('../controllers/exportController');

router.get('/csv', authMiddleware, exportCsv);
router.get('/pdf', authMiddleware, exportPdf);

module.exports = router;
