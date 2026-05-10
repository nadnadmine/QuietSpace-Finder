const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { placeRouter, bookmarkRouter, tagRouter, reportRouter } = require('./routes/placeRoutes');
const { connectRabbitMQ } = require('./utils/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount routes without /api prefixes as the gateway strips them? No, gateway Proxy doesn't strip unless configured.
// Assuming proxy passes path as is, we mount on /api/*
app.use('/api/places', placeRouter);
app.use('/api/bookmarks', bookmarkRouter);
app.use('/api/tags', tagRouter);
app.use('/api/reports', reportRouter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'place-service' });
});

app.listen(PORT, async () => {
    console.log(`🚀 Place Service is running on port ${PORT}`);
    await connectRabbitMQ();
});
