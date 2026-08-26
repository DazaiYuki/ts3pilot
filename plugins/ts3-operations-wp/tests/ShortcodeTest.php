<?php
/**
 * Front-end shortcode rendering tests.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Agent\Client;
use Ts3Ops\Frontend\Shortcode;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\NodeRegistry;
use Ts3Ops\Settings\Repository;

final class ShortcodeTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3cops_options']      = array();
		$GLOBALS['__ts3cops_transients']   = array();
		$GLOBALS['__ts3cops_http_queue']   = array();
		$GLOBALS['__ts3cops_http_calls']   = array();
		$GLOBALS['__ts3cops_usermeta']     = array();
		$GLOBALS['__ts3cops_current_user'] = 0;
	}

	private function init( array $settings = array() ): void {
		$repository = new Repository();
		$repository->set_many(
			array_merge(
				array(
					'agent_url'        => 'http://127.0.0.1:17880',
					'agent_credential' => 'secret-credential',
				),
				$settings
			)
		);
		$status = new StatusService( new Client( $repository ), $repository );
		Shortcode::init( $status );
	}

	public function test_render_escapes_ts3_names(): void {
		$this->init();
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => '<script>alert(1)</script> Server',
						'clientsOnline' => 3,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$html                              = Shortcode::render( array() );
		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( 'data-ts3-theme="auto"', $html );
		$this->assertStringContainsString( '3 / 32', $html );
	}

	public function test_render_offline_fallback(): void {
		$this->init();
		$GLOBALS['__ts3cops_http_queue'][] = new \WP_Error( 'http_request_failed', 'connection refused' );
		$html                              = Shortcode::render( array() );
		$this->assertStringContainsString( '暂时无法获取状态', $html );
		$this->assertStringNotContainsString( 'credential', $html );
	}

	public function test_render_channel_tree(): void {
		$this->init( array( 'show_channels' => true ) );
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'Server',
						'clientsOnline' => 3,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						array(
							'channelId'    => 1,
							'name'         => 'Lobby <b>bold</b>',
							'parentId'     => 0,
							'totalClients' => 2,
						),
						array(
							'channelId'    => 2,
							'name'         => 'General',
							'parentId'     => 1,
							'totalClients' => 1,
						),
					),
				)
			),
		);
		$html                              = Shortcode::render( array( 'collapsible' => 'true' ) );
		$this->assertStringContainsString( 'ts3-status-channels', $html );
		$this->assertStringContainsString( '<details', $html );
		$this->assertStringContainsString( 'Lobby bold', $html );
		$this->assertStringNotContainsString( '<b>', $html );
	}

	public function test_join_button_respects_policy(): void {
		$this->init( array( 'join_url' => 'ts3server://127.0.0.1?port=9987' ) );
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'Server',
						'clientsOnline' => 1,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$hidden                            = Shortcode::render( array( 'join_policy' => 'hidden' ) );
		$this->assertStringNotContainsString( 'ts3-status-join', $hidden );

		$GLOBALS['__ts3cops_transients']   = array();
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'Server',
						'clientsOnline' => 1,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$public                            = Shortcode::render( array( 'join_policy' => 'public' ) );
		$this->assertStringContainsString( 'ts3-status-join', $public );
		$this->assertStringContainsString( 'ts3server://127.0.0.1', $public );
	}

	public function test_node_attribute_routes_to_the_selected_node(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-a',
			)
		);
		$registry = new NodeRegistry( $repository );
		$registry->upsert(
			array(
				'node_id'      => 'node-b',
				'display_name' => 'Singapore',
				'endpoint'     => 'http://127.0.0.1:17881',
				'credential'   => 'secret-b',
				'timeout'      => 8,
				'is_active'    => false,
			)
		);
		$status = new StatusService( new Client( $repository ), $repository );
		Shortcode::init( $status );

		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'SG Server',
						'clientsOnline' => 1,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$html                              = Shortcode::render( array( 'node' => 'node-b' ) );
		$this->assertStringContainsString( 'SG Server', $html );
		$call = $GLOBALS['__ts3cops_http_calls'][0] ?? array();
		$this->assertSame( 'http://127.0.0.1:17881/v1/ts3/status', (string) ( $call['url'] ?? '' ) );

		// Invalid node falls back to the active node without error.
		$GLOBALS['__ts3cops_transients']   = array();
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'Legacy Server',
						'clientsOnline' => 2,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);
		$html2                             = Shortcode::render( array( 'node' => 'does-not-exist' ) );
		$this->assertStringContainsString( 'Legacy Server', $html2 );
	}
}
