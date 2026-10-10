<?php
// Isolated acceptance: only the freshly created native script test instance.
try {
    wp_set_current_user(1);
    $client = new Ts3Pilot\Agent\Client(new Ts3Pilot\Settings\Repository());
    $info = $client->info();
    if ($info['systemProvider'] !== 'script') throw new RuntimeException('Expected native script provider');
    $beforeChannels = $client->request('GET', '/v1/ts3/channels');
    $expires = time() + 600;
    $token = WP_Session_Tokens::get_instance(1)->create($expires);
    $loggedCookie = wp_generate_auth_cookie(1, $expires, 'logged_in', $token);
    $_COOKIE[LOGGED_IN_COOKIE] = $loggedCookie;
    $nonce = wp_create_nonce('ts3pilot_service');
    $submit = static function ($action, $nonceValue) use ($expires, $token, $loggedCookie) {
        return wp_remote_post(home_url('/wp-admin/admin-post.php'), array(
            'timeout' => 90, 'redirection' => 0,
            'cookies' => array(
                new WP_Http_Cookie(array('name' => AUTH_COOKIE, 'value' => wp_generate_auth_cookie(1, $expires, 'auth', $token))),
                new WP_Http_Cookie(array('name' => LOGGED_IN_COOKIE, 'value' => $loggedCookie)),
            ),
            'body' => array('action' => 'ts3pilot_service', 'service_action' => $action, 'ts3pilot_nonce' => $nonceValue),
        ));
    };
    $denied = $submit('stop', 'invalid-nonce');
    if (wp_remote_retrieve_response_code($denied) !== 403) throw new RuntimeException('Service form accepted an invalid nonce');
    if ($client->request('GET', '/v1/system/status')['state'] !== 'running') throw new RuntimeException('Denied form changed service state');
    echo "PASS WordPress service form CSRF denial\n";
    foreach (array('stop' => 'stopped', 'start' => 'running', 'restart' => 'running') as $action => $expected) {
        $result = $submit($action, $nonce);
        if (wp_remote_retrieve_response_code($result) !== 302 || !str_contains(wp_remote_retrieve_header($result, 'location'), 'ts3pilot_result=success')) throw new RuntimeException('Service form failed: ' . $action);
        $status = $client->request('GET', '/v1/system/status');
        if ($status['state'] !== $expected) throw new RuntimeException('Wrong script status after ' . $action);
        echo 'PASS WordPress native script ', $action, "\n";
    }
    $afterChannels = $client->request('GET', '/v1/ts3/channels');
    if (array_column($beforeChannels, 'name') !== array_column($afterChannels, 'name')) throw new RuntimeException('Existing channels changed across restart');
    echo "PASS ServerQuery reconnect and existing channel preservation after restart\n";
    $repo = new Ts3Pilot\Settings\Repository();
    $status = new Ts3Pilot\Services\StatusService($client, $repo);
    ob_start(); (new Ts3Pilot\Admin\MaintenancePage($client))->render(); $html = ob_get_clean();
    foreach (array('Start server', 'Stop server', 'Restart server', 'ts3pilot_nonce') as $text) {
        if (!str_contains($html, $text)) throw new RuntimeException('Missing maintenance control');
    }
    echo "PASS native script maintenance UI and signed service status\n";
} catch (Throwable $error) { echo 'FAIL ', $error->getMessage(), "\n"; exit(1); }
