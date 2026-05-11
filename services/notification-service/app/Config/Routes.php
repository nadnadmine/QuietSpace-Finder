<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

$routes->get('ping', function() {
    return "pong";
});

$routes->get('health', function() {
    return response()->setJSON([
        'message' => 'Notification Service is up and running',
        'data' => [
            'status' => 'healthy',
            'timestamp' => date('c'),
            'php_version' => PHP_VERSION,
            'environment' => env('CI_ENVIRONMENT', 'production')
        ],
        'error' => null
    ]);
});

$routes->group('api', ['filter' => \App\Filters\JWTAuthFilter::class], static function ($routes) {
    $routes->get('notifications', 'Notifications::index');
    $routes->get('notifications/preferences', 'Notifications::getPreferences');
    $routes->patch('notifications/preferences', 'Notifications::updatePreferences');
    $routes->patch('notifications/read-all', 'Notifications::markAllAsRead');
    $routes->get('notifications/event-logs', 'Notifications::getEventLogs');
    $routes->get('notifications/(:segment)', 'Notifications::show/$1');
    $routes->patch('notifications/(:segment)/read', 'Notifications::markAsRead/$1');
    $routes->delete('notifications/(:segment)', 'Notifications::delete/$1');
});
