const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { placeRouter, bookmarkRouter, tagRouter, reportRouter } = require('./routes/placeRoutes');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const {
    globalApiLimiter,
    strictLimiter,
    readOnlyLimiter
} = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/places', placeRouter);
app.use('/api/bookmarks', bookmarkRouter);
app.use('/api/tags', tagRouter);
app.use('/api/reports', reportRouter);
app.use('/api/', globalApiLimiter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'place-service',
        rateLimit: {
            global: '5 request/menit per IP',
            sensitiveEndpoints: '3 request/menit per IP',
            readEndpoints: '20 request/menit per IP'
        },
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Place Service is running on port ${PORT}`);
    await connectRabbitMQ();
});

module.exports = app;