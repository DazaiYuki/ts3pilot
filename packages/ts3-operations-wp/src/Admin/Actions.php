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
use Ts3Ops\Settings\Repository;

final class Actions {
	public static function register(): void {
		add_action( 'admin_post_ts3cops_pair', array( self::class, 'pair' ) );
		add_action( 'admin_post_ts3cops_kick', array( self::class, 'kick' ) );
		add_action( 'admin_post_ts3cops_restart', array( self::class, 'restart' ) );
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
		if ( ! current_user_can( Capabilities::MANAGE_CLIENTS ) ) {
			wp_die( 'Permission denied.' );
		}
		$client_id = (int) ( $_POST['client_id'] ?? 0 );
		check_admin_referer( 'ts3cops_kick_' . $client_id, 'ts3cops_nonce' );
		$kick_from = in_array( $_POST['kick_from'] ?? '', array( 'channel', 'server' ), true ) ? sanitize_key( $_POST['kick_from'] ) : 'channel';
		$reason    = sanitize_text_field( wp_unslash( $_POST['reason'] ?? '' ) );
		try {
			( new Client( new Repository() ) )->request(
				'POST',
				'/v1/ts3/clients/kick',
				array(
					'clientId' => $client_id,
					'reason'   => $reason,
					'kickFrom' => $kick_from,
				)
			);
			AuditLog::append( 'kick', 'client:' . $client_id, 'success' );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=kick_ok';
		} catch ( AgentException $error ) {
			AuditLog::append( 'kick', 'client:' . $client_id, 'failed', $error->error_code );
			$redirect = 'admin.php?page=ts3-operations-clients&ts3cops_result=kick_failed';
		}
		wp_safe_redirect( admin_url( $redirect ) );
		exit;
	}

	public static function restart(): void {
		if ( ! current_user_can( Capabilities::MANAGE_MAINTENANCE ) ) {
			wp_die( 'Permission denied.' );
		}
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
}
