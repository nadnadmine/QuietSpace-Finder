const amqp = require('amqplib');
require('dotenv').config();

let channel = null;

const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
        channel = await connection.createChannel();
        console.log('✅ Connected to RabbitMQ');
    } catch (error) {
        console.error('❌ Failed to connect to RabbitMQ:', error);
        setTimeout(connectRabbitMQ, 5000); // Retry
    }
};

const publishEvent = async (queue, message) => {
    try {
        if (!channel) {
            console.warn('RabbitMQ channel not established. Reconnecting...');
            await connectRabbitMQ();
        }
        await channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
        console.log(`📤 Published event to queue: ${queue}`);
    } catch (error) {
        console.error('❌ Failed to publish event:', error);
    }
};

module.exports = { connectRabbitMQ, publishEvent };
