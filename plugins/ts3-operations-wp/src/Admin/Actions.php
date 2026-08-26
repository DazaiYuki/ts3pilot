<?php
/**
 * admin-post action handlers (nonce + capability enforced server-side).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Agent\AgentException;
use Ts3Ops\Agent\Client;
use Ts3Ops\Agent\Pairing;
use Ts3Ops\Audit\AuditLog;
use Ts3Ops\Capabilities;
use Ts3Ops\Identity\Challenge;
use Ts3Ops\Identity\Mapping;
use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Settings\NodeRegistry;
use Ts3Ops\Settings\Repository;

final class Actions {
	public static function register(): void {
		add_action( 'admin_post_ts3cops_pair', array( self::class, 'pair' ) );
		add_action( 'admin_post_ts3cops_kick', array( self::class, 'kick' ) );
		add_action( 'admin_post_ts3cops_poke', array( self::class, 'poke' ) );
		add_action( 'admin_post_ts3cops_move', array( self::class, 'move' ) );
		add_action( 'admin_post_ts3cops_restart', array( self::class, 'restart' ) );
		add_action( 'admin_post_ts3cops_channel_create', array( self::class, 'channel_create' ) );
		add_action( 'admin_post_ts3cops_channel_edit', array( self::class, 'channel_edit' ) );
		add_action( 'admin_post_ts3cops_channel_delete', array( self::class, 'channel_delete' ) );
		add_action( 'admin_post_ts3cops_channel_move', array( self::class, 'channel_move' ) );
		add_action( 'admin_post_ts3cops_identity_challenge', array( self::class, 'identity_challenge' ) );
		add_action( 'admin_post_ts3cops_identity_status', array( self::class, 'identity_status' ) );
		add_action( 'admin_post_ts3cops_switch_node', array( self::class, 'switch_node' ) );
		add_action( 'admin_post_ts3cops_node_add', array( self::class, 'node_add' ) );
		add_action( 'admin_post_ts3cops_node_update', array( self::class, 'node_update' ) );
		add_action( 'admin_post_ts3cops_node_delete', array( self::class, 'node_delete' ) );
	}

	public static function switch_node(): void {
		self::require_capability( Capabilities::MANAGE_VIEW );
		check_admin_referer( 'ts3cops_switch_node', 'ts3cops_nonce' );
		$node_id  = sanitize_key( (string) ( $_POST['node_id'] ?? '' ) );
		$page     = sanitize_key( (string) ( $_POST['page'] ?? 'ts3-operations' ) );
		$registry = new NodeRegistry( new Repository() );
		if ( '' !== $node_id && ! $registry->is_valid_id( $node_id ) ) {
			wp_die( 'Unknown node.' );
		}
		$registry->set_active( $node_id );
		wp_safe_redirect( admin_url( 'admin.php?page=' . $page ) );
		exit;
	}

	public static function node_add(): void {
		self::require_capability( 'manage_options' );
		check_admin_referer( 'ts3cops_node_add', 'ts3cops_nonce' );
		$endpoint = Sanitizer::endpoint_url( (string) ( $_POST['endpoint'] ?? '' ) );
		if ( '' === $endpoint ) {
			wp_die( 'Invalid endpoint.' );
		}
		$registry = new NodeRegistry( new Repository() );
		$node_id  = NodeRegistry::generate_node_id();
		$registry->upsert(
			array(
				'node_id'      => $node_id,
				'display_name' => sanitize_text_field( wp_unslash( (string) ( $_POST['display_name'] ?? '' ) ) ),
				'endpoint'     => $endpoint,
				'credential'   => '',
				'timeout'      => Sanitizer::positive_int( $_POST['timeout'] ?? 8, 8 ),
				'is_active'    => true,
			)
		);
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-settings&ts3cops_result=node_added' ) );
		exit;
	}

	public static function node_update(): void {
		self::require_capability( 'manage_options' );
		$node_id = sanitize_key( (string) ( $_POST['node_id'] ?? '' ) );
		check_admin_referer( 'ts3cops_node_update_' . $node_id, 'ts3cops_nonce' );
		$registry = new NodeRegistry( new Repository() );
		$existing = $registry->get( $node_id );
		if ( null === $existing ) {
			wp_die( 'Unknown node.' );
		}
		$endpoint = Sanitizer::endpoint_url( (string) ( $_POST['endpoint'] ?? '' ) );
		if ( '' === $endpoint ) {
			wp_die( 'Invalid endpoint.' );
		}
		$credential = sanitize_text_field( wp_unslash( (string) ( $_POST['credential'] ?? '' ) ) );
		if ( '' === $credential ) {
			$credential = (string) ( $existing['credential'] ?? '' );
		}
		$registry->upsert(
			array(
				'node_id'      => $node_id,
				'display_name' => sanitize_text_field( wp_unslash( (string) ( $_POST['display_name'] ?? '' ) ) ),
				'endpoint'     => $endpoint,
				'credential'   => $credential,
				'timeout'      => Sanitizer::positive_int( $_POST['timeout'] ?? 8, 8 ),
				'is_active'    => (bool) ( $existing['is_active'] ?? false ),
			)
		);
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-settings&ts3cops_result=node_updated' ) );
		exit;
	}

	public static function node_delete(): void {
		self::require_capability( 'manage_options' );
		$node_id = sanitize_key( (string) ( $_POST['node_id'] ?? '' ) );
		check_admin_referer( 'ts3cops_node_delete_' . $node_id, 'ts3cops_nonce' );
		$registry = new NodeRegistry( new Repository() );
		$registry->remove( $node_id );
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-settings&ts3cops_result=node_deleted' ) );
		exit;
	}

	public static function pair(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Permission denied.' );
		}
		check_admin_referer( 'ts3cops_pair', 'ts3cops_nonce' );
		$repository   = new Repository();
		$pairing      = new Pairing( new Client( $repository ), $repository );
		$agent_url    = sanitize_text_field( wp_unslash( $_POST['pairing_agent_url'] ?? '' ) );
		$pairing_code = sanitize_text_field( wp_unslash( $_POST['pairing_code'] ?? '' ) );
		$result       = $pairing->pair( $agent_url, $pairing_code );
		$message      = true === ( $result['ok'] ?? false )
			? 'OK: paired with node ' . (string) ( $result['node_id'] ?? '' )
			: (string) ( $result['message'] ?? 'Pairing failed.' );
		AuditLog::append( 'agent.pair', 'node', true === ( $result['ok'] ?? false ) ? 'success' : 'failed' );
		wp_safe_redirect(
			add_query_arg(
				array( 'ts3cops_pair_result' => rawurlencode( $message ) ),
				admin_url( 'admin.php?page=ts3-operations-settings' )
			)
		);
		exit;
	}

	public static function kick(): void {
		self::require_capability( Capabilities::MANAGE_CLIENTS );
		$client_id = (int) ( $_POST['client_id'] ?? 0 );
		check_admin_referer( 'ts3cops_kick_' . $client_id, 'ts3cops_nonce' );
		$kick_from = in_array( $_POST['kick_from'] ?? '', array( 'channel', 'server' ), true ) ? sanitize_key( $_POST['kick_from'] ) : 'channel';
		$reason    = sanitize_text_field( wp_unslash( $_POST['reason'] ?? '' ) );
		try {
			( new Client( new Repository() ) )->kick_client( $client_id, $kick_from, $reason );
			AuditLog::append( 'kick', 'client:' . $client_id, 'success' );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=kick_ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'kick', 'client:' . $client_id, 'failed', $error->error_code );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=kick_failed';
		}
		wp_safe_redirect( admin_url( $redirect ) );
		exit;
	}

	public static function poke(): void {
		self::require_capability( Capabilities::MANAGE_CLIENTS );
		$client_id = (int) ( $_POST['client_id'] ?? 0 );
		check_admin_referer( 'ts3cops_poke_' . $client_id, 'ts3cops_nonce' );
		$message = sanitize_text_field( wp_unslash( $_POST['message'] ?? '' ) );
		if ( '' === $message || strlen( $message ) > 512 ) {
			wp_die( 'Invalid message.' );
		}
		try {
			( new Client( new Repository() ) )->poke_client( $client_id, $message );
			AuditLog::append( 'poke', 'client:' . $client_id, 'success' );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=poke_ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'poke', 'client:' . $client_id, 'failed', $error->error_code );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=poke_failed';
		}
		wp_safe_redirect( admin_url( $redirect ) );
		exit;
	}

	public static function move(): void {
		self::require_capability( Capabilities::MANAGE_CLIENTS );
		$client_id  = (int) ( $_POST['client_id'] ?? 0 );
		$channel_id = (int) ( $_POST['channel_id'] ?? 0 );
		check_admin_referer( 'ts3cops_move_' . $client_id, 'ts3cops_nonce' );
		if ( $client_id <= 0 || $channel_id < 0 ) {
			wp_die( 'Invalid parameters.' );
		}
		try {
			( new Client( new Repository() ) )->move_client( $client_id, $channel_id );
			AuditLog::append( 'move', 'client:' . $client_id, 'success' );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=move_ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'move', 'client:' . $client_id, 'failed', $error->error_code );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=move_failed';
		}
		wp_safe_redirect( admin_url( $redirect ) );
		exit;
	}

	public static function restart(): void {
		self::require_capability( Capabilities::MANAGE_MAINTENANCE );
		check_admin_referer( 'ts3cops_restart', 'ts3cops_nonce' );
		try {
			( new Client( new Repository() ) )->request( 'POST', '/v1/system/restart', array( 'action' => 'restart' ) );
			AuditLog::append( 'server.restart', 'node', 'success' );
			$result = 'success';
		} catch ( AgentException $error ) {
			AuditLog::append( 'server.restart', 'node', 'failed', $error->error_code );
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-maintenance&ts3cops_result=' . $result ) );
		exit;
	}

	public static function channel_create(): void {
		self::require_capability( Capabilities::MANAGE_CHANNELS );
		check_admin_referer( 'ts3cops_channel_create', 'ts3cops_nonce' );
		$name = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
		if ( '' === $name || strlen( $name ) > 100 ) {
			wp_die( 'Invalid channel name.' );
		}
		try {
			( new Client( new Repository() ) )->channel_create(
				array(
					'name'     => $name,
					'parentId' => (int) ( $_POST['parent_id'] ?? 0 ),
					'order'    => (int) ( $_POST['order'] ?? 0 ),
				)
			);
			AuditLog::append( 'channel.create', $name, 'success' );
			$result = 'ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.create', $name, 'failed', $error->error_code );
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-channels&ts3cops_result=' . $result ) );
		exit;
	}

	public static function channel_edit(): void {
		self::require_capability( Capabilities::MANAGE_CHANNELS );
		$channel_id = (int) ( $_POST['channel_id'] ?? 0 );
		check_admin_referer( 'ts3cops_channel_edit_' . $channel_id, 'ts3cops_nonce' );
		if ( $channel_id <= 0 ) {
			wp_die( 'Invalid channel id.' );
		}
		$input = array( 'channelId' => $channel_id );
		$name  = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
		$topic = sanitize_text_field( wp_unslash( $_POST['topic'] ?? '' ) );
		if ( '' !== $name ) {
			$input['name'] = $name;
		}
		if ( '' !== $topic ) {
			$input['topic'] = $topic;
		}
		try {
			( new Client( new Repository() ) )->channel_edit( $input );
			AuditLog::append( 'channel.edit', 'channel:' . $channel_id, 'success' );
			$result = 'ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.edit', 'channel:' . $channel_id, 'failed', $error->error_code );
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-channels&ts3cops_result=' . $result ) );
		exit;
	}

	public static function channel_delete(): void {
		self::require_capability( Capabilities::MANAGE_CHANNELS );
		$channel_id = (int) ( $_POST['channel_id'] ?? 0 );
		check_admin_referer( 'ts3cops_channel_delete_' . $channel_id, 'ts3cops_nonce' );
		if ( $channel_id <= 0 ) {
			wp_die( 'Invalid channel id.' );
		}
		try {
			( new Client( new Repository() ) )->channel_delete(
				array(
					'channelId' => $channel_id,
					'force'     => ! empty( $_POST['force'] ),
				)
			);
			AuditLog::append( 'channel.delete', 'channel:' . $channel_id, 'success' );
			$result = 'ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.delete', 'channel:' . $channel_id, 'failed', $error->error_code );
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-channels&ts3cops_result=' . $result ) );
		exit;
	}

	public static function channel_move(): void {
		self::require_capability( Capabilities::MANAGE_CHANNELS );
		$channel_id = (int) ( $_POST['channel_id'] ?? 0 );
		check_admin_referer( 'ts3cops_channel_move_' . $channel_id, 'ts3cops_nonce' );
		if ( $channel_id <= 0 ) {
			wp_die( 'Invalid channel id.' );
		}
		try {
			( new Client( new Repository() ) )->channel_move(
				array(
					'channelId' => $channel_id,
					'parentId'  => (int) ( $_POST['parent_id'] ?? 0 ),
					'order'     => (int) ( $_POST['order'] ?? 0 ),
				)
			);
			AuditLog::append( 'channel.move', 'channel:' . $channel_id, 'success' );
			$result = 'ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'channel.move', 'channel:' . $channel_id, 'failed', $error->error_code );
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-channels&ts3cops_result=' . $result ) );
		exit;
	}

	public static function identity_challenge(): void {
		self::require_capability( Capabilities::MANAGE_USERS );
		$user_id = (int) ( $_POST['user_id'] ?? 0 );
		check_admin_referer( 'ts3cops_identity_challenge_' . $user_id, 'ts3cops_nonce' );
		if ( $user_id <= 0 ) {
			wp_die( 'Invalid user id.' );
		}
		$code = Challenge::start( $user_id );
		AuditLog::append( 'identity.challenge', 'user:' . $user_id, 'success' );
		wp_safe_redirect(
			add_query_arg(
				array( 'ts3cops_code' => rawurlencode( $code ) ),
				admin_url( 'admin.php?page=ts3-operations-users' )
			)
		);
		exit;
	}

	public static function identity_status(): void {
		self::require_capability( Capabilities::MANAGE_USERS );
		$user_id = (int) ( $_POST['user_id'] ?? 0 );
		check_admin_referer( 'ts3cops_identity_status_' . $user_id, 'ts3cops_nonce' );
		$status = sanitize_key( (string) ( $_POST['status'] ?? '' ) );
		if ( $user_id <= 0 || ! in_array( $status, array( 'unbound', 'pending', 'verified', 'revoked' ), true ) ) {
			wp_die( 'Invalid parameters.' );
		}
		$data = array( 'status' => $status );
		if ( 'verified' === $status ) {
			$ts3_uid = sanitize_text_field( wp_unslash( $_POST['ts3_uid'] ?? '' ) );
			if ( '' === $ts3_uid || strlen( $ts3_uid ) > 128 ) {
				wp_die( 'TS3 UID is required for verified status.' );
			}
			$data['ts3_uid'] = $ts3_uid;
		}
		if ( Mapping::set( $user_id, $data ) ) {
			AuditLog::append( 'identity.status', 'user:' . $user_id . ':' . $status, 'success' );
			$result = 'ok';
		} else {
			$result = 'failed';
		}
		wp_safe_redirect( admin_url( 'admin.php?page=ts3-operations-users&ts3cops_result=' . $result ) );
		exit;
	}

	private static function require_capability( string $capability ): void {
		if ( ! current_user_can( $capability ) ) {
			wp_die( 'Permission denied.' );
		}
	}
}
