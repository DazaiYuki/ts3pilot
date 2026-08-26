<?php
/**
 * Pairing flow helper.
 *
 * Pairing always targets the freshly registered node; on success the long-term
 * credential is stored on that node only.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Agent;

use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Settings\NodeRegistry;
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

		$registry = new NodeRegistry( $this->repository );
		$node_id  = NodeRegistry::generate_node_id();
		$registry->upsert(
			array(
				'node_id'      => $node_id,
				'display_name' => 'Node ' . substr( $node_id, 0, 8 ),
				'endpoint'     => $agent_url,
				'credential'   => '',
				'timeout'      => 8,
				'is_active'    => true,
			)
		);
		$registry->set_active( $node_id );

		try {
			$data       = $this->client->for_node( $node_id )->pair( $pairing_code );
			$agent_id   = sanitize_text_field( (string) ( $data['nodeId'] ?? $node_id ) );
			$credential = sanitize_text_field( (string) ( $data['credential'] ?? '' ) );
			if ( $agent_id !== $node_id ) {
				$registry->remove( $node_id );
				$node_id = $agent_id;
			}
			$registry->upsert(
				array(
					'node_id'      => $node_id,
					'display_name' => 'Node ' . substr( $node_id, 0, 8 ),
					'endpoint'     => $agent_url,
					'credential'   => $credential,
					'timeout'      => 8,
					'is_active'    => true,
				)
			);
			$registry->set_active( $node_id );
			$this->repository->set_many(
				array(
					'agent_url'        => $agent_url,
					'agent_credential' => $credential,
					'agent_node_id'    => $node_id,
				)
			);
			return array(
				'ok'         => true,
				'credential' => $credential,
				'node_id'    => $node_id,
			);
		} catch ( AgentException $error ) {
			return array(
				'ok'      => false,
				'message' => $error->getMessage(),
			);
		}
	}
}
