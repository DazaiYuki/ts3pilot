<?php
/**
 * REST admin controller tests (poke/move/channel/identity).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Agent\Client;
use Ts3Ops\Agent\Protocol;
use Ts3Ops\Capabilities;
use Ts3Ops\Identity\Mapping;
use Ts3Ops\Rest\AdminController;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;
use WP_REST_Request;

final class AdminControllerTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3cops_options']          = array();
		$GLOBALS['__ts3cops_usermeta']         = array();
		$GLOBALS['__ts3cops_transients']       = array();
		$GLOBALS['__ts3cops_http_queue']       = array();
		$GLOBALS['__ts3cops_users']            = array();
		$GLOBALS['__ts3cops_userdata']         = array();
		$GLOBALS['__ts3cops_current_user_can'] = true;
		$GLOBALS['__ts3cops_current_user']     = 1;
		$repository                            = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
	}

	private function controller(): AdminController {
		$repository = new Repository();
		$client     = new Client( $repository );
		return new AdminController( $client, new StatusService( $client, $repository ), $repository );
	}

	private function queue_success( array $data = array() ): void {
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => $data,
				)
			),
		);
	}

	public function test_poke_client_success_and_validation(): void {
		$this->queue_success();
		$response = $this->controller()->poke_client(
			new WP_REST_Request(
				array(
					'client_id' => 1,
					'message'   => 'hello',
				)
			)
		);
		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );

		$bad = $this->controller()->poke_client(
			new WP_REST_Request(
				array(
					'client_id' => 1,
					'message'   => '',
				)
			)
		);
		$this->assertSame( 400, $bad->get_status() );
	}

	public function test_move_client_success_and_validation(): void {
		$this->queue_success();
		$response = $this->controller()->move_client(
			new WP_REST_Request(
				array(
					'client_id'  => 1,
					'channel_id' => 2,
				)
			)
		);
		$this->assertSame( 200, $response->get_status() );

		$bad = $this->controller()->move_client(
			new WP_REST_Request(
				array(
					'client_id'  => 0,
					'channel_id' => 2,
				)
			)
		);
		$this->assertSame( 400, $bad->get_status() );
	}

	public function test_kick_client_success(): void {
		$this->queue_success();
		$response = $this->controller()->kick_client(
			new WP_REST_Request(
				array(
					'client_id' => 3,
					'kick_from' => 'server',
				)
			)
		);
		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );
	}

	public function test_channel_create_returns_channel_id(): void {
		$this->queue_success( array( 'channelId' => 10 ) );
		$response = $this->controller()->channel_create(
			new WP_REST_Request(
				array(
					'name'      => 'New Lobby',
					'parent_id' => 1,
				)
			)
		);
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 10, $response->get_data()['channelId'] );

		$bad = $this->controller()->channel_create( new WP_REST_Request( array( 'name' => '' ) ) );
		$this->assertSame( 400, $bad->get_status() );
	}

	public function test_channel_edit_and_delete(): void {
		$this->queue_success();
		$edit = $this->controller()->channel_edit(
			new WP_REST_Request(
				array(
					'channel_id' => 5,
					'name'       => 'Renamed',
				)
			)
		);
		$this->assertSame( 200, $edit->get_status() );

		$this->queue_success();
		$delete = $this->controller()->channel_delete(
			new WP_REST_Request(
				array(
					'channel_id' => 5,
					'force'      => true,
				)
			)
		);
		$this->assertSame( 200, $delete->get_status() );

		$bad = $this->controller()->channel_delete( new WP_REST_Request( array( 'channel_id' => 0 ) ) );
		$this->assertSame( 400, $bad->get_status() );
	}

	public function test_channel_move(): void {
		$this->queue_success();
		$response = $this->controller()->channel_move(
			new WP_REST_Request(
				array(
					'channel_id' => 5,
					'parent_id'  => 2,
					'order'      => 1,
				)
			)
		);
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_identity_challenge_returns_code(): void {
		$response = $this->controller()->identity_challenge( new WP_REST_Request( array( 'user_id' => 7 ) ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertMatchesRegularExpression( '/^[A-F0-9]{8}$/', (string) $response->get_data()['code'] );
	}

	public function test_identity_status_requires_uid_for_verified(): void {
		$bad = $this->controller()->identity_status(
			new WP_REST_Request(
				array(
					'user_id' => 7,
					'status'  => 'verified',
				)
			)
		);
		$this->assertSame( 400, $bad->get_status() );

		$ok = $this->controller()->identity_status(
			new WP_REST_Request(
				array(
					'user_id' => 7,
					'status'  => 'verified',
					'ts3_uid' => 'TS3UID123',
				)
			)
		);
		$this->assertSame( 200, $ok->get_status() );
		$this->assertSame( 'verified', Mapping::get( 7 )['status'] );
		$this->assertSame( 'TS3UID123', Mapping::get( 7 )['ts3_uid'] );
	}

	public function test_permission_callbacks_reflect_capabilities(): void {
		$controller = $this->controller();
		$this->assertTrue( $controller->can_clients() );
		$GLOBALS['__ts3cops_current_user_can'] = false;
		$this->assertFalse( $controller->can_clients() );
		$this->assertFalse( $controller->can_users() );
	}

	public function test_identity_me_challenge_creates_pending_mapping_and_registers(): void {
		$GLOBALS['__ts3cops_current_user'] = 5;
		$this->queue_success( array( 'ok' => true ) );
		$response = $this->controller()->identity_me_challenge();
		$this->assertSame( 200, $response->get_status() );
		$this->assertMatchesRegularExpression( '/^[A-F0-9]{8}$/', (string) $response->get_data()['code'] );
		$this->assertSame( 'pending', Mapping::get( 5 )['status'] );
	}

	public function test_identity_me_returns_mapping(): void {
		$GLOBALS['__ts3cops_current_user'] = 5;
		$response                          = $this->controller()->identity_me();
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'unbound', $response->get_data()['mapping']['status'] );
	}

	public function test_identity_callback_verifies_mapping(): void {
		$GLOBALS['__ts3cops_userdata'][7] = (object) array( 'ID' => 7 );
		Mapping::set( 7, array( 'status' => 'pending' ) );
		$path                   = '/wp-json/ts3-operations/v1/identity/callback';
		$body                   = wp_json_encode(
			array(
				'wpUserId'   => 7,
				'ts3Uid'     => 'TS3UID123',
				'verifiedAt' => 1700000000000,
				'nodeId'     => 'node-1',
			)
		);
		$headers                = Protocol::headers( 'secret-credential', 'POST', $path, $body );
		$_SERVER['REQUEST_URI'] = $path;
		$response               = $this->controller()->identity_callback( new WP_REST_Request( array(), $headers, $body ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'verified', Mapping::get( 7 )['status'] );
		$this->assertSame( 'TS3UID123', Mapping::get( 7 )['ts3_uid'] );
	}

	public function test_identity_callback_rejects_bad_signature(): void {
		$GLOBALS['__ts3cops_userdata'][7] = (object) array( 'ID' => 7 );
		Mapping::set( 7, array( 'status' => 'pending' ) );
		$path                   = '/wp-json/ts3-operations/v1/identity/callback';
		$body                   = wp_json_encode(
			array(
				'wpUserId'   => 7,
				'ts3Uid'     => 'TS3UID123',
				'verifiedAt' => 1700000000000,
				'nodeId'     => 'node-1',
			)
		);
		$headers                = Protocol::headers( 'wrong-secret', 'POST', $path, $body );
		$_SERVER['REQUEST_URI'] = $path;
		$response               = $this->controller()->identity_callback( new WP_REST_Request( array(), $headers, $body ) );
		$this->assertSame( 401, $response->get_status() );
		$this->assertSame( 'pending', Mapping::get( 7 )['status'] );
	}
}
