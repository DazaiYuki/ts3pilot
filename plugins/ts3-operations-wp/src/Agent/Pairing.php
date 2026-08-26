<?php
/**
 * Pairing flow helper.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Agent;

use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Settings\Repository;

final class Pairing {
	public function __construct(
		private readonly Client $client,
		private readonly Repository $repository,
	) {}

	/**
	 * @return array{ok: bool, message?: string, credential?: string, node_id?: string}
	 */
	public function pair( string $agent_url, string $pairing_code ): array {
		$agent_url = Sanitizer::endpoint_url( $agent_url );
		if ( '' === $agent_url ) {
			return array(
				'ok'      => false,
				'message' => 'Invalid agent URL.',
			);
		}
		if ( ! preg_match( '/^[A-Z0-9]{6,64}$/', $pairing_code ) ) {
			return array(
				'ok'      => false,
				'message' => 'Invalid pairing code format.',
			);
		}
		$this->repository->set( 'agent_url', $agent_url );
		try {
			$data = $this->client->pair( $pairing_code );
			$this->repository->set_many(
				array(
					'agent_credential' => sanitize_text_field( (string) ( $data['credential'] ?? '' ) ),
					'agent_node_id'    => sanitize_text_field( (string) ( $data['nodeId'] ?? '' ) ),
				)
			);
			return array(
				'ok'         => true,
				'credential' => (string) ( $data['credential'] ?? '' ),
				'node_id'    => (string) ( $data['nodeId'] ?? '' ),
			);
		} catch ( AgentException $error ) {
			return array(
				'ok'      => false,
				'message' => $error->getMessage(),
			);
		}
	}
}
