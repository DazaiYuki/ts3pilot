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
			'/channels',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'channels' ),
				'permission_callback' => array( $this, 'can_channels' ),
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
}
