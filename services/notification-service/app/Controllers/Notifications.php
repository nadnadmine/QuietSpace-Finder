<?php

namespace App\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Notifications extends ResourceController
{
    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

    public function index()
    {
        $user = $this->request->user;
        $page = (int)$this->request->getGet('page') ?: 1;
        $limit = (int)$this->request->getGet('limit') ?: 20;
        $offset = ($page - 1) * $limit;

        $builder = $this->db->table('notifications n')
            ->select('n.*, t.code as type_code, t.label as type_label, t.channel')
            ->join('notification_types t', 'n.notification_type_id = t.id')
            ->where('n.recipient_user_id', $user['sub'])
            ->orderBy('n.created_at', 'DESC')
            ->limit($limit, $offset);

        // Filters
        $isRead = $this->request->getGet('is_read');
        if ($isRead !== null) {
            $builder->where('n.is_read', $isRead === 'true' ? 1 : 0);
        }

        $type = $this->request->getGet('type');
        if ($type !== null) {
            $builder->where('t.code', $type);
        }

        $notifications = $builder->get()->getResultArray();

        // Count unread
        $unreadCount = $this->db->table('notifications')
            ->where('recipient_user_id', $user['sub'])
            ->where('is_read', 0)
            ->countAllResults();

        // Format response
        $data = array_map(function($n) {
            return [
                'id' => $n['id'],
                'type' => [
                    'code' => $n['type_code'],
                    'label' => $n['type_label'],
                    'channel' => $n['channel']
                ],
                'title' => $n['title'],
                'body' => $n['body'],
                'action_url' => $n['action_url'],
                'is_read' => (bool)$n['is_read'],
                'sent_at' => $n['sent_at'],
                'created_at' => $n['created_at']
            ];
        }, $notifications);

        return $this->respond([
            'message' => 'Success',
            'data' => [
                'notifications' => $data,
                'unread_count' => $unreadCount,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit
                ]
            ],
            'error' => null
        ]);
    }

    public function show($id = null)
    {
        $user = $this->request->user;

        $notification = $this->db->table('notifications n')
            ->select('n.*, t.code as type_code, t.label as type_label, t.channel')
            ->join('notification_types t', 'n.notification_type_id = t.id')
            ->where('n.id', $id)
            ->get()->getRowArray();

        if (!$notification) {
            return $this->failNotFound('Notification not found');
        }

        if ($notification['recipient_user_id'] !== $user['sub']) {
            return $this->failForbidden('Forbidden');
        }

        // Mark as read
        if (!$notification['is_read']) {
            $this->db->table('notifications')
                ->where('id', $id)
                ->update(['is_read' => 1, 'read_at' => date('Y-m-d H:i:s')]);
            $notification['is_read'] = 1;
            $notification['read_at'] = date('Y-m-d H:i:s');
        }

        return $this->respond([
            'message' => 'Success',
            'data' => [
                'notification' => [
                    'id' => $notification['id'],
                    'type' => [
                        'code' => $notification['type_code'],
                        'label' => $notification['type_label'],
                        'channel' => $notification['channel']
                    ],
                    'title' => $notification['title'],
                    'body' => $notification['body'],
                    'action_url' => $notification['action_url'],
                    'metadata' => json_decode($notification['metadata']),
                    'is_read' => true,
                    'read_at' => $notification['read_at'],
                    'sent_at' => $notification['sent_at'],
                    'created_at' => $notification['created_at']
                ]
            ],
            'error' => null
        ]);
    }

    public function markAsRead($id = null)
    {
        $user = $this->request->user;

        $notification = $this->db->table('notifications')->where('id', $id)->get()->getRowArray();
        
        if (!$notification) {
            return $this->failNotFound('Notification not found');
        }

        if ($notification['recipient_user_id'] !== $user['sub']) {
            return $this->failForbidden('Forbidden');
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('notifications')->where('id', $id)->update(['is_read' => 1, 'read_at' => $now]);

        return $this->respond([
            'message' => 'Notification marked as read',
            'data' => [
                'notification_id' => $id,
                'read_at' => $now
            ],
            'error' => null
        ]);
    }

    public function markAllAsRead()
    {
        $user = $this->request->user;
        $now = date('Y-m-d H:i:s');
        
        $this->db->table('notifications')
            ->where('recipient_user_id', $user['sub'])
            ->where('is_read', 0)
            ->update(['is_read' => 1, 'read_at' => $now]);

        $affected = $this->db->affectedRows();

        return $this->respond([
            'message' => 'All notifications marked as read',
            'data' => [
                'updated_count' => $affected
            ],
            'error' => null
        ]);
    }

    public function delete($id = null)
    {
        $user = $this->request->user;

        $notification = $this->db->table('notifications')->where('id', $id)->get()->getRowArray();
        
        if (!$notification) {
            return $this->failNotFound('Notification not found');
        }

        if ($notification['recipient_user_id'] !== $user['sub']) {
            return $this->failForbidden('Forbidden');
        }

        $this->db->table('notifications')->where('id', $id)->delete();

        return $this->respondDeleted([
            'message' => 'Notification deleted',
            'data' => null,
            'error' => null
        ]);
    }

    public function getPreferences()
    {
        $user = $this->request->user;
        
        $types = $this->db->table('notification_types')->get()->getResultArray();
        $userPrefs = $this->db->table('user_notification_preferences')
            ->where('user_id', $user['sub'])
            ->get()->getResultArray();
            
        $prefsMap = [];
        foreach ($userPrefs as $pref) {
            $prefsMap[$pref['notification_type_id']] = $pref;
        }
        
        $result = [];
        foreach ($types as $type) {
            $pref = $prefsMap[$type['id']] ?? null;
            $result[] = [
                'notification_type' => [
                    'id' => (int)$type['id'],
                    'code' => $type['code'],
                    'label' => $type['label'],
                    'channel' => $type['channel']
                ],
                'is_enabled' => $pref !== null ? (bool)$pref['is_enabled'] : true,
                'preferred_channel' => $pref !== null ? $pref['preferred_channel'] : $type['channel']
            ];
        }

        return $this->respond([
            'message' => 'Success',
            'data' => [
                'preferences' => $result
            ],
            'error' => null
        ]);
    }

    public function updatePreferences()
    {
        $user = $this->request->user;
        $json = $this->request->getJSON(true);
        
        if (!isset($json['preferences']) || !is_array($json['preferences'])) {
            return $this->failValidationErrors('Invalid preferences format');
        }

        foreach ($json['preferences'] as $pref) {
            if (!isset($pref['notification_type_id']) || !is_numeric($pref['notification_type_id']) || (int)$pref['notification_type_id'] <= 0) {
                return $this->failValidationErrors('notification_type_id must be a valid positive integer.');
            }
            $typeId = (int)$pref['notification_type_id'];
            $isEnabled = isset($pref['is_enabled']) ? (int)$pref['is_enabled'] : 1;
            $channel = isset($pref['preferred_channel']) ? $pref['preferred_channel'] : 'in_app';
            
            $sql = "INSERT INTO user_notification_preferences (user_id, notification_type_id, is_enabled, preferred_channel) 
                    VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE is_enabled = ?, preferred_channel = ?";
            
            $this->db->query($sql, [$user['sub'], $typeId, $isEnabled, $channel, $isEnabled, $channel]);
        }

        return $this->respond([
            'message' => 'Preferences updated successfully',
            'data' => null,
            'error' => null
        ]);
    }

    public function getEventLogs()
    {
        $user = $this->request->user;
        if ($user['role'] !== 'admin') {
            return $this->failForbidden('Admin access required');
        }

        $logs = $this->db->table('event_logs')->orderBy('received_at', 'DESC')->limit(50)->get()->getResultArray();
        
        return $this->respond([
            'message' => 'Success',
            'data' => [
                'event_logs' => $logs
            ],
            'error' => null
        ]);
    }
}
