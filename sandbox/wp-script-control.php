<?php
// Isolated acceptance: only the freshly created native script test instance.
try {
    wp_set_current_user(1);
    $client = new Ts3Pilot\Agent\Client(new Ts3Pilot\Settings\Repository());
    $info = $client->info();
    if ($info['systemProvider'] !== 'script') throw new RuntimeException('Expected native script provider');
    foreach (array('stop' => 'stopped', 'start' => 'running', 'restart' => 'running') as $action => $expected) {
        $result = $client->request('POST', '/v1/system/' . $action, array('action' => $action));
        if ($result['state'] !== $expected) throw new RuntimeException('Wrong state after ' . $action);
        $status = $client->request('GET', '/v1/system/status');
        if ($status['state'] !== $expected) throw new RuntimeException('Wrong script status after ' . $action);
        echo 'PASS WordPress native script ', $action, "\n";
    }
    $repo = new Ts3Pilot\Settings\Repository();
    $status = new Ts3Pilot\Services\StatusService($client, $repo);
    ob_start(); (new Ts3Pilot\Admin\MaintenancePage($client))->render(); $html = ob_get_clean();
    foreach (array('Start server', 'Stop server', 'Restart server', 'ts3pilot_nonce') as $text) {
        if (!str_contains($html, $text)) throw new RuntimeException('Missing maintenance control');
    }
    echo "PASS native script maintenance UI and signed service status\n";
} catch (Throwable $error) { echo 'FAIL ', $error->getMessage(), "\n"; exit(1); }
