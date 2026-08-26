<?php
/**
 * Server-side status service with transient caching.
 *
 * The public projection intentionally contains only safe display fields and
 * never credentials, agent addresses or query ports.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Services;

use Ts3Ops\Agent\AgentException;
use Ts3Ops\Agent\Client;
use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Settings\Repository;

final class StatusService {
	private const TRANSIENT = 'ts3cops_status_snapshot';

	public function __construct(
		private readonly Client $client,
		private readonly Repository $repository,
	) {}

	/**
	 * @return array<string, mixed>
	 */
	public function get_snapshot( bool $force = false ): array {
		$ttl      = Sanitizer::positive_int( $this->repository->get( 'status_cache_ttl' ), 10 );
		$snapshot = get_transient( self::TRANSIENT );
		if ( false !== $snapshot && is_array( $snapshot ) && ! $force ) {
			return $snapshot;
		}
		try {
			$status = $this->client->request( 'GET', '/v1/ts3/status' );
		} catch ( AgentException $error ) {
			$snapshot = array(
				'online'  => false,
				'error'   => true,
				'cached'  => false,
				'updated' => time(),
			);
			set_transient( self::TRANSIENT, $snapshot, min( $ttl, 30 ) );
			return $snapshot;
		}

		$snapshot = array(
			'online'      => true === ( $status['online'] ?? false ),
			'name'        => sanitize_text_field( (string) ( $status['name'] ?? '' ) ),
			'clients'     => Sanitizer::positive_int( $status['clientsOnline'] ?? 0, 0 ),
			'max_clients' => Sanitizer::positive_int( $status['maxClients'] ?? 0, 0 ),
			'version'     => sanitize_text_field( (string) ( $status['version'] ?? '' ) ),
			'error'       => false,
			'cached'      => true,
			'updated'     => time(),
		);
		set_transient( self::TRANSIENT, $snapshot, $ttl );
		return $snapshot;
	}
}
