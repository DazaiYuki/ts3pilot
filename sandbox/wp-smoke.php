<?php
function smoke_check($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
try {
wp_set_current_user(1);
$repository = new Ts3Pilot\Settings\Repository();
$client = new Ts3Pilot\Agent\Client($repository);
$pairingText = file_get_contents('/state/pairing.txt');
smoke_check(preg_match('/single use\): ([A-Z0-9]+)/', $pairingText, $matches) === 1, 'No private pairing code available');
$result = (new Ts3Pilot\Agent\Pairing($client, $repository))->pair($args[0] ?? 'http://127.0.0.1:17880', $matches[1]);
smoke_check($result['ok'] === true, 'Pairing failed: ' . ($result['message'] ?? 'unknown'));
echo "PASS WordPress real pairing\n";
$info = $client->info();
smoke_check($info['mode'] === 'production' && $info['ts3Provider'] === 'serverquery' && $info['cliVersion'] === TS3PILOT_VERSION, 'Agent info mismatch');
echo "PASS WordPress authenticated Agent info\n";
$status = $client->status();
smoke_check($status['online'] === true, 'Real TS3 is offline');
$channels = $client->channels(); smoke_check(count($channels) > 0, 'No real channels returned');
echo "PASS WordPress real status/channels\n";
$created = $client->channel_create(array('name' => 'WP regression 中文 | /', 'parentId' => 0));
smoke_check($created['channelId'] > 0, 'Channel creation failed');
$client->channel_edit(array('channelId' => $created['channelId'], 'name' => 'WP updated'));
$client->channel_delete(array('channelId' => $created['channelId'], 'force' => true));
echo "PASS WordPress channel create/edit/delete\n";
$html = do_shortcode('[ts3_status show_channels="true"]');
smoke_check(str_contains($html, 'ts3-status-card') && str_contains($html, 'Online'), 'Status shortcode did not render online data');
smoke_check(!str_contains($html, $result['credential']), 'Credential leaked in frontend');
echo "PASS WordPress frontend status and credential redaction\n";
$repository->set_many(array('join_policy' => 'public', 'join_url' => 'ts3server://voice.example.invalid?port=9987', 'join_label' => 'Join our server'));
$html = do_shortcode('[ts3_status]');
smoke_check(str_contains($html, 'href="ts3server://voice.example.invalid?port=9987"') && str_contains($html, 'Join our server'), 'Native TS3 join URL filtered or label missing');
smoke_check(str_contains(do_shortcode('[ts3_join]'), 'ts3-status-join'), 'Standalone join shortcode missing');
$block = render_block(array('blockName' => 'ts3pilot/status', 'attrs' => array('joinPolicy' => 'public', 'joinLabel' => 'Block join'), 'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array()));
smoke_check(str_contains($block, 'Block join') && str_contains($block, 'ts3server://'), 'Dynamic status block not configured');
ob_start(); (new Ts3Pilot\Frontend\StatusWidget())->widget(array(), array('display' => 'join')); $widget = ob_get_clean();
smoke_check(str_contains($widget, 'ts3server://'), 'Classic join widget missing');
smoke_check(isset($GLOBALS['wp_widget_factory']->widgets[Ts3Pilot\Frontend\StatusWidget::class]), 'Widget not registered');
ob_start(); (new Ts3Pilot\Admin\SettingsPage($client, $repository))->render(); $settingsHtml = ob_get_clean();
smoke_check(str_contains($settingsHtml, 'ts3pilot_settings[join_policy]') && str_contains($settingsHtml, 'ts3pilot_settings[join_label]'), 'Join settings controls missing');
smoke_check(!str_contains($settingsHtml, $result['credential']), 'Settings page exposed credential');
echo "PASS WordPress native join protocol, configured block/widget and backend settings\n";
$request = new WP_REST_Request('GET', '/ts3pilot/v1/status');
$response = rest_do_request($request);
smoke_check($response->get_status() === 200, 'Admin status REST failed');
echo "PASS WordPress administrator REST\n";
wp_set_current_user(0);
$response = rest_do_request(new WP_REST_Request('GET', '/ts3pilot/v1/clients'));
smoke_check(in_array($response->get_status(), array(401,403), true), 'Anonymous admin access was not denied');
echo "PASS WordPress anonymous authorization denied\n";

} catch (Throwable $error) { echo "FAIL ", $error->getMessage(), "\n"; exit(1); }
