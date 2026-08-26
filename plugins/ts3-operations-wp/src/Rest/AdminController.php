<?php
/**
 * REST controllers for admin actions and public status.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Rest;

use Ts3Ops\Agent\AgentException;
use Ts3Ops\Agent\Client;
use Ts3Ops\Audit\AuditLog;
use Ts3Ops\Capabilities;
use Ts3Ops\Identity\Mapping;
use Ts3Ops\Identity\Callback;
use Ts3Ops\Identity\Challenge;
use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

final class AdminController {
	public function __construct(
		private readonly Client $client,
		private readonly StatusService $status,
		private readonly Repository $repository,
	) {}

	public function register_routes(): void {
		register_rest_route(
			Routes::NAMESPACE,
			'/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'public_status' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/dashboard',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'dashboard' ),
				'permission_callback' => array( $this, 'can_view' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/clients',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'clients' ),
				'permission_callback' => array( $this, 'can_clients' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/clients/kick',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'kick_client' ),
				'permission_callback' => array( $this, 'can_clients' ),
				'args'                => array(
					'client_id' => array( 'required' => true ),
					'reason'    => array( 'required' => false ),
					'kick_from' => array(
						'required' => false,
						'default'  => 'channel',
					),
				),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/clients/poke',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'poke_client' ),
				'permission_callback' => array( $this, 'can_clients' ),
				'args'                => array(
					'client_id' => array( 'required' => true ),
					'message'   => array( 'required' => true ),
				),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/clients/move',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'move_client' ),
				'permission_callback' => array( $this, 'can_clients' ),
				'args'                => array(
					'client_id'  => array( 'required' => true ),
					'channel_id' => array( 'required' => true ),
				),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/channels',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'channels' ),
				'permission_callback' => array( $this, 'can_channels' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/channels/create',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'channel_create' ),
				'permission_callback' => array( $this, 'can_channels' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/channels/edit',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'channel_edit' ),
				'permission_callback' => array( $this, 'can_channels' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/channels/delete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'channel_delete' ),
				'permission_callback' => array( $this, 'can_channels' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/channels/move',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'channel_move' ),
				'permission_callback' => array( $this, 'can_channels' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/users',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'identity_users' ),
				'permission_callback' => array( $this, 'can_users' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/challenge',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'identity_challenge' ),
				'permission_callback' => array( $this, 'can_users' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/status',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'identity_status' ),
				'permission_callback' => array( $this, 'can_users' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/me',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'identity_me' ),
				'permission_callback' => array( $this, 'can_self_service' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/me/challenge',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'identity_me_challenge' ),
				'permission_callback' => array( $this, 'can_self_service' ),
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/identity/callback',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'identity_callback' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			Routes::NAMESPACE,
			'/maintenance/restart',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'restart_server' ),
				'permission_callback' => array( $this, 'can_maintenance' ),
			)
		);
	}

	public function public_status(): WP_REST_Response {
		$snapshot = $this->status->get_snapshot();
		return new WP_REST_Response(
			array(
				'online'      => (bool) ( $snapshot['online'] ?? false ),
				'name'        => (string) ( $snapshot['name'] ?? '' ),
				'clients'     => (int) ( $snapshot['clients'] ?? 0 ),
				'max_clients' => (int) ( $snapshot['max_clients'] ?? 0 ),
				'version'     => (string) ( $snapshot['version'] ?? '' ),
				'updated'     => (int) ( $snapshot['updated'] ?? 0 ),
			)
		);
	}

	public function dashboard(): WP_REST_Response {
		$snapshot = $this->status->get_snapshot( true );
		$info     = array();
		try {
			$info = $this->client->request( 'GET', '/v1/info' );
		} catch ( AgentException $error ) {
			$info = array( 'error' => $error->getMessage() );
		}
		return new WP_REST_Response(
			array(
				'status'    => $snapshot,
				'agent'     => $info,
				'node_id'   => (string) $this->repository->get( 'agent_node_id' ),
				'last_sync' => (int) ( $snapshot['updated'] ?? 0 ),
			)
		);
	}

	public function clients(): WP_REST_Response {
		try {
			$clients = $this->client->request( 'GET', '/v1/ts3/clients' );
			foreach ( $clients as &$client ) {
				$client = array(
					'clientId'  => (int) ( $client['clientId'] ?? 0 ),
					'nickname'  => sanitize_text_field( (string) ( $client['nickname'] ?? '' ) ),
					'channelId' => (int) ( $client['channelId'] ?? 0 ),
					'away'      => (bool) ( $client['away'] ?? false ),
				);
			}
			unset( $client );
			return new WP_REST_Response( array( 'clients' => $clients ) );
		} catch ( AgentException $error ) {
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
	}

	public function kick_client( WP_REST_Request $request ): WP_REST_Response {
		$client_id = (int) $request->get_param( 'client_id' );
		$kick_from = $request->get_param( 'kick_from' );
		if ( $client_id <= 0 || ! in_array( $kick_from, array( 'channel', 'server' ), true ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid parameters.' ), 400 );
		}
		$reason = sanitize_text_field( (string) $request->get_param( 'reason' ) );
		try {
			$this->client->request(
				'POST',
				'/v1/ts3/clients/kick',
				array(
					'clientId' => $client_id,
					'reason'   => $reason,
					'kickFrom' => $kick_from,
				)
			);
		} catch ( AgentException $error ) {
			AuditLog::append( 'kick', 'client:' . $client_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'kick', 'client:' . $client_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function poke_client( WP_REST_Request $request ): WP_REST_Response {
		$client_id = (int) $request->get_param( 'client_id' );
		$message   = sanitize_text_field( (string) $request->get_param( 'message' ) );
		if ( $client_id <= 0 || '' === $message || strlen( $message ) > 512 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid parameters.' ), 400 );
		}
		try {
			$this->client->poke_client( $client_id, $message );
		} catch ( AgentException $error ) {
			AuditLog::append( 'poke', 'client:' . $client_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'poke', 'client:' . $client_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function move_client( WP_REST_Request $request ): WP_REST_Response {
		$client_id  = (int) $request->get_param( 'client_id' );
		$channel_id = (int) $request->get_param( 'channel_id' );
		if ( $client_id <= 0 || $channel_id < 0 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid parameters.' ), 400 );
		}
		try {
			$this->client->move_client( $client_id, $channel_id );
		} catch ( AgentException $error ) {
			AuditLog::append( 'move', 'client:' . $client_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'move', 'client:' . $client_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function channels(): WP_REST_Response {
		try {
			return new WP_REST_Response( array( 'channels' => $this->client->request( 'GET', '/v1/ts3/channels' ) ) );
		} catch ( AgentException $error ) {
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
	}

	public function restart_server(): WP_REST_Response {
		try {
			$this->client->request( 'POST', '/v1/system/restart', array( 'action' => 'restart' ) );
		} catch ( AgentException $error ) {
			AuditLog::append( 'server.restart', 'node', 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'server.restart', 'node', 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function channel_create( WP_REST_Request $request ): WP_REST_Response {
		$name = sanitize_text_field( (string) $request->get_param( 'name' ) );
		if ( '' === $name || strlen( $name ) > 100 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid channel name.' ), 400 );
		}
		try {
			$result = $this->client->channel_create(
				array(
					'name'     => $name,
					'parentId' => Sanitizer::positive_int( $request->get_param( 'parent_id' ), 0 ),
					'order'    => Sanitizer::positive_int( $request->get_param( 'order' ), 0 ),
				)
			);
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.create', $name, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'channel.create', $name, 'success' );
		return new WP_REST_Response(
			array(
				'ok'        => true,
				'channelId' => (int) ( $result['channelId'] ?? 0 ),
			)
		);
	}

	public function channel_edit( WP_REST_Request $request ): WP_REST_Response {
		$channel_id = (int) $request->get_param( 'channel_id' );
		if ( $channel_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid channel id.' ), 400 );
		}
		$input = array( 'channelId' => $channel_id );
		$name  = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$topic = sanitize_text_field( (string) $request->get_param( 'topic' ) );
		if ( '' !== $name ) {
			$input['name'] = $name;
		}
		if ( '' !== $topic ) {
			$input['topic'] = $topic;
		}
		try {
			$this->client->channel_edit( $input );
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.edit', 'channel:' . $channel_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'channel.edit', 'channel:' . $channel_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function channel_delete( WP_REST_Request $request ): WP_REST_Response {
		$channel_id = (int) $request->get_param( 'channel_id' );
		if ( $channel_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid channel id.' ), 400 );
		}
		try {
			$this->client->channel_delete(
				array(
					'channelId' => $channel_id,
					'force'     => Sanitizer::boolish( $request->get_param( 'force' ) ),
				)
			);
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.delete', 'channel:' . $channel_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'channel.delete', 'channel:' . $channel_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function channel_move( WP_REST_Request $request ): WP_REST_Response {
		$channel_id = (int) $request->get_param( 'channel_id' );
		if ( $channel_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid channel id.' ), 400 );
		}
		try {
			$this->client->channel_move(
				array(
					'channelId' => $channel_id,
					'parentId'  => Sanitizer::positive_int( $request->get_param( 'parent_id' ), 0 ),
					'order'     => Sanitizer::positive_int( $request->get_param( 'order' ), 0 ),
				)
			);
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.move', 'channel:' . $channel_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'channel.move', 'channel:' . $channel_id, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function identity_users(): WP_REST_Response {
		$users = get_users(
			array(
				'number' => 200,
				'fields' => array( 'ID', 'user_login', 'display_name' ),
			)
		);
		$rows  = array();
		foreach ( $users as $user ) {
			$id     = (int) $user->ID;
			$rows[] = array(
				'id'           => $id,
				'login'        => sanitize_text_field( (string) $user->user_login ),
				'display_name' => sanitize_text_field( (string) $user->display_name ),
				'mapping'      => Mapping::get( $id ),
			);
		}
		return new WP_REST_Response( array( 'users' => $rows ) );
	}

	public function identity_challenge( WP_REST_Request $request ): WP_REST_Response {
		$user_id = (int) $request->get_param( 'user_id' );
		if ( $user_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid user id.' ), 400 );
		}
		$code = \Ts3Ops\Identity\Challenge::start( $user_id );
		AuditLog::append( 'identity.challenge', 'user:' . $user_id, 'success' );
		return new WP_REST_Response(
			array(
				'ok'   => true,
				'code' => $code,
				'ttl'  => 600,
			)
		);
	}

	public function identity_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = (int) $request->get_param( 'user_id' );
		$status  = (string) $request->get_param( 'status' );
		$allowed = array( 'unbound', 'pending', 'verified', 'revoked' );
		if ( $user_id <= 0 || ! in_array( $status, $allowed, true ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid parameters.' ), 400 );
		}
		$data = array( 'status' => $status );
		if ( 'verified' === $status ) {
			$ts3_uid = sanitize_text_field( (string) $request->get_param( 'ts3_uid' ) );
			if ( '' === $ts3_uid || strlen( $ts3_uid ) > 128 ) {
				return new WP_REST_Response( array( 'error' => 'TS3 UID is required for verified status.' ), 400 );
			}
			$data['ts3_uid'] = $ts3_uid;
		}
		if ( ! Mapping::set( $user_id, $data ) ) {
			return new WP_REST_Response( array( 'error' => 'Could not update mapping.' ), 500 );
		}
		AuditLog::append( 'identity.status', 'user:' . $user_id . ':' . $status, 'success' );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function identity_me(): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Not logged in.' ), 401 );
		}
		return new WP_REST_Response( array( 'mapping' => Mapping::get( $user_id ) ) );
	}

	public function identity_me_challenge(): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return new WP_REST_Response( array( 'error' => 'Not logged in.' ), 401 );
		}
		$mapping = Mapping::get( $user_id );
		if ( ! in_array( $mapping['status'], array( 'unbound', 'pending' ), true ) ) {
			return new WP_REST_Response( array( 'error' => 'Binding already resolved.' ), 409 );
		}
		$code = Challenge::start( $user_id );
		Mapping::set(
			$user_id,
			array(
				'status'   => 'pending',
				'method'   => 'challenge',
				'bound_at' => time(),
			)
		);
		try {
			$this->client->register_identity_challenge(
				array(
					'wpUserId'      => $user_id,
					'code'          => $code,
					'expiresAt'     => ( time() + 600 ) * 1000,
					'webhookUrl'    => rest_url( 'ts3-operations/v1/identity/callback' ),
					'webhookSecret' => (string) $this->repository->get( 'agent_credential' ),
				)
			);
		} catch ( AgentException $error ) {
			AuditLog::append( 'identity.me.challenge', 'user:' . $user_id, 'failed', $error->error_code );
			return new WP_REST_Response( array( 'error' => $error->getMessage() ), 502 );
		}
		AuditLog::append( 'identity.me.challenge', 'user:' . $user_id, 'success' );
		return new WP_REST_Response(
			array(
				'ok'           => true,
				'code'         => $code,
				'expires_at'   => time() + 600,
				'instructions' => '在 TeamSpeak 中把昵称改为包含验证码的文本（例如："Player CODE"），等待自动核验。',
			)
		);
	}

	public function identity_callback( WP_REST_Request $request ): WP_REST_Response {
		$headers  = array(
			'x-ts3cops-timestamp' => $request->get_header( 'x-ts3cops-timestamp' ),
			'x-ts3cops-nonce'     => $request->get_header( 'x-ts3cops-nonce' ),
			'x-ts3cops-signature' => $request->get_header( 'x-ts3cops-signature' ),
		);
		$raw_body = (string) $request->get_body();
		$path     = (string) wp_parse_url( (string) ( $_SERVER['REQUEST_URI'] ?? '/' ), PHP_URL_PATH );
		if ( ! Callback::verify( $this->repository, $headers, $raw_body, $path ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid signature.' ), 401 );
		}
		$payload = json_decode( $raw_body, true );
		if ( ! is_array( $payload ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid payload.' ), 400 );
		}
		$wp_user_id = (int) ( $payload['wpUserId'] ?? 0 );
		$ts3_uid    = sanitize_text_field( (string) ( $payload['ts3Uid'] ?? '' ) );
		$node_id    = sanitize_text_field( (string) ( $payload['nodeId'] ?? '' ) );
		if ( $wp_user_id <= 0 || '' === $ts3_uid || strlen( $ts3_uid ) > 128 ) {
			return new WP_REST_Response( array( 'error' => 'Invalid payload.' ), 400 );
		}
		$configured_node = (string) $this->repository->get( 'agent_node_id' );
		if ( '' !== $configured_node && $node_id !== $configured_node ) {
			return new WP_REST_Response( array( 'error' => 'Unknown node.' ), 403 );
		}
		if ( false === get_userdata( $wp_user_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Unknown user.' ), 404 );
		}
		$mapping = Mapping::get( $wp_user_id );
		if ( 'verified' === $mapping['status'] && $mapping['ts3_uid'] === $ts3_uid ) {
			return new WP_REST_Response(
				array(
					'ok'         => true,
					'idempotent' => true,
				)
			);
		}
		if ( ! in_array( $mapping['status'], array( 'unbound', 'pending' ), true ) ) {
			return new WP_REST_Response( array( 'error' => 'Mapping state does not allow verification.' ), 409 );
		}
		Mapping::mark_verified( $wp_user_id, $ts3_uid, 'agent-auto', $node_id );
		AuditLog::append( 'identity.verified', 'user:' . $wp_user_id, 'success', '', $node_id );
		return new WP_REST_Response( array( 'ok' => true ) );
	}

	public function can_view(): bool {
		return current_user_can( Capabilities::MANAGE_VIEW );
	}

	public function can_clients(): bool {
		return current_user_can( Capabilities::MANAGE_CLIENTS );
	}

	public function can_channels(): bool {
		return current_user_can( Capabilities::MANAGE_CHANNELS );
	}

	public function can_maintenance(): bool {
		return current_user_can( Capabilities::MANAGE_MAINTENANCE ) && current_user_can( Capabilities::MANAGE_SERVER );
	}

	public function can_users(): bool {
		return current_user_can( Capabilities::MANAGE_USERS );
	}

	public function can_self_service(): bool {
		return is_user_logged_in();
	}
}
