<?php
/**
 * WordPress HTTP client for the ts3-manager agent.
 *
 * All requests go through the WordPress HTTP API with explicit timeouts and
 * TLS verification. The long-term credential never leaves server-side PHP.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Agent;

use Ts3Ops\Settings\Repository;

final class Client {
	private const TIMEOUT = 8;

	public function __construct( private readonly Repository $repository ) {}

	/**
	 * @param array<string, mixed> $body
	 * @return array<string, mixed>
	 */
	public function request( string $method, string $path, array $body = array() ): array {
		$endpoint   = rtrim( (string) $this->repository->get( 'agent_url' ), '/' );
		$credential = (string) $this->repository->get( 'agent_credential' );
		if ( '' === $endpoint || '' === $credential ) {
			throw new AgentException( 'AGENT_NOT_CONFIGURED', 'Agent endpoint or credential is not configured.' );
		}
		return $this->do_request( $method, $path, $body, $credential );
	}

	/**
	 * Pair with the agent using the single-use pairing code as the signing secret.
	 *
	 * @return array<string, mixed>
	 */
	public function pair( string $pairing_code ): array {
		$endpoint = rtrim( (string) $this->repository->get( 'agent_url' ), '/' );
		if ( '' === $endpoint ) {
			throw new AgentException( 'AGENT_NOT_CONFIGURED', 'Agent endpoint is not configured.' );
		}
		return $this->do_request( 'POST', '/v1/agent/pair', array( 'pairingCode' => $pairing_code ), $pairing_code );
	}

	/**
	 * @param array<string, mixed> $body
	 * @return array<string, mixed>
	 */
	private function do_request( string $method, string $path, array $body, string $secret ): array {
		$endpoint = rtrim( (string) $this->repository->get( 'agent_url' ), '/' );
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
				'timeout'     => self::TIMEOUT,
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
