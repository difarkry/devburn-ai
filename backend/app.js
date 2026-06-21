const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend static files
app.use(express.static('../frontend'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/predict', require('./routes/predictRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
