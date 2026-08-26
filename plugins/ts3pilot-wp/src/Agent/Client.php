<?php
/**
 * WordPress HTTP client for the ts3-manager agent.
 *
 * All requests go through the WordPress HTTP API with explicit timeouts and
 * TLS verification. Requests are always signed with the selected node's own
 * credential; node credentials are never mixed.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Agent;

use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;

final class Client {
	public function __construct(
		private readonly Repository $repository,
		private readonly ?string $node_id = null,
	) {}

	public function for_node( ?string $node_id ): self {
		return new self( $this->repository, $node_id );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function node(): array {
		$registry = new NodeRegistry( $this->repository );
		if ( null !== $this->node_id ) {
			$node = $registry->get( $this->node_id );
			if ( null === $node ) {
				throw new AgentException( 'NODE_NOT_FOUND', 'Unknown node: ' . esc_html( $this->node_id ) );
			}
			return $node;
		}
		$node = $registry->active();
		if ( '' === (string) ( $node['endpoint'] ?? '' ) ) {
			throw new AgentException( 'AGENT_NOT_CONFIGURED', 'No active agent node is configured.' );
		}
		return $node;
	}

	/**
	 * @param array<string, mixed> $body
	 * @return array<string, mixed>
	 */
	public function request( string $method, string $path, array $body = array() ): array {
		$node       = $this->node();
		$endpoint   = rtrim( (string) ( $node['endpoint'] ?? '' ), '/' );
		$credential = (string) ( $node['credential'] ?? '' );
		if ( '' === $endpoint || '' === $credential ) {
			throw new AgentException( 'AGENT_NOT_CONFIGURED', 'Agent endpoint or credential is not configured for the selected node.' );
		}
		return $this->do_request( $method, $path, $body, $credential, (int) ( $node['timeout'] ?? 8 ) );
	}

	/**
	 * Pair with the agent using the single-use pairing code as the signing secret.
	 *
	 * @return array<string, mixed>
	 */
	public function pair( string $pairing_code ): array {
		$endpoint = rtrim( (string) ( $this->node()['endpoint'] ?? '' ), '/' );
		if ( '' === $endpoint ) {
			throw new AgentException( 'AGENT_NOT_CONFIGURED', 'Agent endpoint is not configured.' );
		}
		return $this->do_request( 'POST', '/v1/agent/pair', array( 'pairingCode' => $pairing_code ), $pairing_code, (int) ( $this->node()['timeout'] ?? 8 ) );
	}

	/**
	 * @return array<string, mixed>
	 */
	public function status(): array {
		return $this->request( 'GET', '/v1/ts3/status' );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function clients(): array {
		$data = $this->request( 'GET', '/v1/ts3/clients' );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function channels(): array {
		$data = $this->request( 'GET', '/v1/ts3/channels' );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @return array<string, mixed>
	 */
	public function kick_client( int $client_id, string $kick_from, string $reason = '' ): array {
		return $this->request(
			'POST',
			'/v1/ts3/clients/kick',
			array(
				'clientId' => $client_id,
				'kickFrom' => $kick_from,
				'reason'   => $reason,
			)
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public function poke_client( int $client_id, string $message ): array {
		return $this->request(
			'POST',
			'/v1/ts3/clients/poke',
			array(
				'clientId' => $client_id,
				'message'  => $message,
			)
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public function move_client( int $client_id, int $channel_id ): array {
		return $this->request(
			'POST',
			'/v1/ts3/clients/move',
			array(
				'clientId'  => $client_id,
				'channelId' => $channel_id,
			)
		);
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function channel_create( array $input ): array {
		return $this->request( 'POST', '/v1/ts3/channels/create', $input );
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function channel_edit( array $input ): array {
		return $this->request( 'POST', '/v1/ts3/channels/edit', $input );
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function channel_delete( array $input ): array {
		return $this->request( 'POST', '/v1/ts3/channels/delete', $input );
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function channel_move( array $input ): array {
		return $this->request( 'POST', '/v1/ts3/channels/move', $input );
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function register_identity_challenge( array $input ): array {
		return $this->request( 'POST', '/v1/identity/challenge', $input );
	}

	/**
	 * @param array<string, mixed> $body
	 * @return array<string, mixed>
	 */
	private function do_request( string $method, string $path, array $body, string $secret, int $timeout ): array {
		$endpoint = rtrim( (string) ( $this->node()['endpoint'] ?? '' ), '/' );
		$json     = wp_json_encode( $body );
		if ( false === $json ) {
			throw new AgentException( 'INVALID_BODY', 'Request body could not be encoded.' );
		}
		$headers                 = Protocol::headers( $secret, $method, $path, $json );
		$headers['Content-Type'] = 'application/json';

		$response = wp_remote_request(
			$endpoint . $path,
			array(
				'method'      => $method,
				'timeout'     => $timeout,
				'redirection' => 0,
				'sslverify'   => true,
				'headers'     => $headers,
				'body'        => $json,
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new AgentException( 'AGENT_NETWORK_ERROR', esc_html( $response->get_error_message() ) );
		}
		$code    = (int) wp_remote_retrieve_response_code( $response );
		$raw     = (string) wp_remote_retrieve_body( $response );
		$decoded = json_decode( $raw, true );
		if ( ! is_array( $decoded ) || ! isset( $decoded['ok'] ) ) {
			throw new AgentException( 'INVALID_AGENT_RESPONSE', 'Agent returned an invalid response (HTTP ' . esc_html( (string) $code ) . ').' );
		}
		if ( true !== $decoded['ok'] ) {
			$error = is_array( $decoded['error'] ?? null ) ? $decoded['error'] : array();
			throw new AgentException(
				esc_html( (string) ( $error['code'] ?? 'AGENT_ERROR' ) ),
				esc_html( (string) ( $error['message'] ?? 'Agent request failed.' ) )
			);
		}
		return is_array( $decoded['data'] ?? null ) ? $decoded['data'] : array();
	}
}
