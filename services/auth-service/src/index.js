const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const passport = require('./config/passport');
const { connectRabbitMQ } = require('./utils/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check inside the service
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'auth-service' });
});

app.listen(PORT, async () => {
    console.log(`🚀 Auth Service is running on port ${PORT}`);
    await connectRabbitMQ();
});
