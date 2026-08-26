<?php
/**
 * Multi-node registry: independent endpoints, credentials and timeouts for
 * every managed TS3 instance.
 *
 * Credentials are stored per node and are never shared; every Agent request is
 * signed with the selected node's credential only.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Settings;

final class NodeRegistry {
	public const OPTION                = 'ts3pilot_nodes';
	public const ACTIVE_OPTION         = 'ts3pilot_active_node';
	private const LEGACY_OPTION        = 'ts3cops_nodes';
	private const LEGACY_ACTIVE_OPTION = 'ts3cops_active_node';

	public function __construct( private readonly Repository $repository ) {}

	/**
	 * @return array<string, array<string, mixed>>
	 */
	public function all(): array {
		$this->migrate_legacy();
		$nodes = get_option( self::OPTION, array() );
		if ( ! is_array( $nodes ) || count( $nodes ) === 0 ) {
			$legacy = get_option( self::LEGACY_OPTION, array() );
			if ( is_array( $legacy ) && count( $legacy ) > 0 ) {
				$nodes = $legacy;
			}
		}
		return is_array( $nodes ) ? $nodes : array();
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( string $node_id ): ?array {
		$nodes = $this->all();
		return isset( $nodes[ $node_id ] ) && is_array( $nodes[ $node_id ] ) ? $nodes[ $node_id ] : null;
	}

	public function is_valid_id( string $node_id ): bool {
		return null !== $this->get( $node_id );
	}

	/**
	 * @param array<string, mixed> $node
	 */
	public function upsert( array $node ): bool {
		$node_id = (string) ( $node['node_id'] ?? '' );
		if ( '' === $node_id ) {
			return false;
		}
		$nodes             = $this->all();
		$nodes[ $node_id ] = array_merge( self::defaults(), $node );
		return (bool) update_option( self::OPTION, $nodes );
	}

	public function remove( string $node_id ): bool {
		$nodes = $this->all();
		if ( ! isset( $nodes[ $node_id ] ) ) {
			return true;
		}
		unset( $nodes[ $node_id ] );
		update_option( self::OPTION, $nodes );
		if ( $node_id === $this->active_id() ) {
			$first = array_key_first( $nodes );
			$this->set_active( is_string( $first ) ? $first : '' );
		}
		return true;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function active(): array {
		$this->migrate_legacy();
		$active_id = $this->active_id();
		if ( '' !== $active_id ) {
			$node = $this->get( $active_id );
			if ( null !== $node ) {
				return $node;
			}
		}
		$nodes = $this->all();
		$first = reset( $nodes );
		return is_array( $first ) ? $first : self::defaults();
	}

	public function active_id(): string {
		$active = (string) get_option( self::ACTIVE_OPTION, '' );
		if ( '' === $active ) {
			$active = (string) get_option( self::LEGACY_ACTIVE_OPTION, '' );
		}
		return $active;
	}

	public function set_active( string $node_id ): bool {
		if ( '' !== $node_id && ! $this->is_valid_id( $node_id ) ) {
			return false;
		}
		return (bool) update_option( self::ACTIVE_OPTION, $node_id );
	}

	public function migrate_legacy(): void {
		$existing = get_option( self::OPTION, array() );
		if ( is_array( $existing ) && count( $existing ) > 0 ) {
			return;
		}
		$endpoint = (string) $this->repository->get( 'agent_url' );
		if ( '' === $endpoint ) {
			return;
		}
		$node_id = (string) $this->repository->get( 'agent_node_id' );
		if ( '' === $node_id ) {
			$node_id = self::generate_node_id();
		}
		$nodes             = is_array( $existing ) ? $existing : array();
		$nodes[ $node_id ] = array_merge(
			self::defaults(),
			array(
				'node_id'      => $node_id,
				'display_name' => 'Legacy Node',
				'endpoint'     => $endpoint,
				'credential'   => (string) $this->repository->get( 'agent_credential' ),
				'timeout'      => 8,
				'is_active'    => true,
			)
		);
		update_option( self::OPTION, $nodes );
		update_option( self::ACTIVE_OPTION, $node_id );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		return array(
			'node_id'      => '',
			'display_name' => '',
			'endpoint'     => '',
			'credential'   => '',
			'timeout'      => 8,
			'is_active'    => true,
		);
	}

	public static function generate_node_id(): string {
		return function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : bin2hex( random_bytes( 16 ) );
	}
}
