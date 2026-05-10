<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Exception\AMQPTimeoutException;

class RabbitMQConsumer extends BaseCommand
{
    protected $group       = 'Queues';
    protected $name        = 'rabbitmq:consume';
    protected $description = 'Consumes RabbitMQ messages for Notification Service.';

    public function run(array $params)
    {
        CLI::write("Starting RabbitMQ Consumer...", "green");

        $host = getenv('RABBITMQ_HOST') ?: 'localhost';
        $port = getenv('RABBITMQ_PORT') ?: 5672;
        $user = getenv('RABBITMQ_USER') ?: 'guest';
        $pass = getenv('RABBITMQ_PASS') ?: 'guest';

        while (true) {
            try {
                $connection = new AMQPStreamConnection(
                    $host,
                    $port,
                    $user,
                    $pass,
                    '/',
                    false,
                    'AMQPLAIN',
                    null,
                    'en_US',
                    5.0,
                    60.0,
                    null,
                    true,
                    30
                );
                $channel = $connection->channel();

                // Listen to auth events
                $channel->queue_declare('user_events', false, true, false, false);
                $channel->basic_consume('user_events', '', false, true, false, false, [$this, 'processMessage']);

                // Listen to place events
                $channel->queue_declare('place_events', false, true, false, false);
                $channel->basic_consume('place_events', '', false, true, false, false, [$this, 'processMessage']);

                CLI::write("Waiting for messages. To exit press CTRL+C", "yellow");

                while (count($channel->callbacks)) {
                    try {
                        $channel->wait(null, false, 10);
                    } catch (AMQPTimeoutException $e) {
                        continue;
                    }
                }

                $channel->close();
                $connection->close();
            } catch (\Exception $e) {
                CLI::error("RabbitMQ Error: " . $e->getMessage());
                sleep(5);
            }
        }
    }

    public function processMessage($msg)
    {
        $payload = json_decode($msg->body, true);
        CLI::write("Received Event: " . $payload['event_type'], 'cyan');

        $db = \Config\Database::connect();
        
        // Log event
        $db->table('event_logs')->ignore(true)->insert([
            'event_id' => $payload['event_id'],
            'event_type' => $payload['event_type'],
            'source_service' => $payload['source_service'],
            'payload' => json_encode($payload['payload']),
            'status' => 'processed',
            'received_at' => date('Y-m-d H:i:s'),
            'processed_at' => date('Y-m-d H:i:s')
        ]);

        // If duplicate was ignored (idempotency check), exit early
        if ($db->affectedRows() === 0) {
            CLI::write("Duplicate event ignored: " . $payload['event_id'], 'yellow');
            return;
        }

        // Generate notifications based on event type
        if ($payload['event_type'] === 'user.registered') {
            $this->createNotification($db, 'user.welcome', $payload, $payload['payload']['user_id']);
        } elseif ($payload['event_type'] === 'report.submitted') {
            // Let's notify admin or place owner, for simplicity we notify the reporter themselves just to test it
            $this->createNotification($db, 'report.submitted', $payload, $payload['payload']['user_id']);
        }
    }

    private function createNotification($db, $typeCode, $event, $recipientId)
    {
        $type = $db->table('notification_types')->where('code', $typeCode)->get()->getRowArray();
        
        if ($type) {
            $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );

            $db->table('notifications')->insert([
                'id' => $uuid,
                'notification_type_id' => $type['id'],
                'recipient_user_id' => $recipientId,
                'title' => 'New Event: ' . $type['label'],
                'body' => 'Event ' . $event['event_type'] . ' processed successfully.',
                'created_at' => date('Y-m-d H:i:s')
            ]);
        }
    }
}
