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
	private const TRANSIENT          = 'ts3cops_status_snapshot';
	private const CHANNELS_TRANSIENT = 'ts3cops_channels_snapshot';

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

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function get_channels_snapshot( bool $force = false ): array {
		$ttl      = Sanitizer::positive_int( $this->repository->get( 'status_cache_ttl' ), 10 );
		$snapshot = get_transient( self::CHANNELS_TRANSIENT );
		if ( is_array( $snapshot ) && ! $force ) {
			return $snapshot;
		}
		try {
			$channels = $this->client->request( 'GET', '/v1/ts3/channels' );
		} catch ( AgentException $error ) {
			return array( 'error' => true );
		}
		$projected = array();
		foreach ( $channels as $channel ) {
			$projected[] = array(
				'channelId' => Sanitizer::positive_int( $channel['channelId'] ?? 0, 0 ),
				'name'      => sanitize_text_field( (string) ( $channel['name'] ?? '' ) ),
				'parentId'  => Sanitizer::positive_int( $channel['parentId'] ?? 0, 0 ),
				'clients'   => Sanitizer::positive_int( $channel['totalClients'] ?? 0, 0 ),
			);
		}
		set_transient( self::CHANNELS_TRANSIENT, $projected, $ttl );
		return $projected;
	}

	public function show_channels_enabled(): bool {
		return Sanitizer::boolish( $this->repository->get( 'show_channels' ) );
	}

	public function theme_name(): string {
		$theme = (string) $this->repository->get( 'theme' );
		return in_array( $theme, array( 'auto', 'light', 'dark' ), true ) ? $theme : 'auto';
	}
}
