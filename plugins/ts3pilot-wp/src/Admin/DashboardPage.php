<?php
/**
 * Dashboard page.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\Repository;

final class DashboardPage {
	public function __construct(
		private readonly StatusService $status,
		private readonly Repository $repository,
	) {}

	public function render(): void {
		$snapshot = $this->status->get_snapshot( true );
		echo '<div class="wrap"><h1>TS3Pilot Dashboard</h1>';
		if ( ! empty( $snapshot['error'] ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'Unable to reach the server. Check the active node, Agent and Query login in Diagnostics.', 'ts3pilot' ) . '</p></div>';
		}
		echo '<div class="ts3pilot-summary">';
		foreach ( array(
			'Server'  => (string) ( $snapshot['name'] ?? '—' ),
			'Status'  => ! empty( $snapshot['error'] ) ? 'Unavailable' : ( ! empty( $snapshot['online'] ) ? 'Online' : 'Offline' ),
			'Players' => (string) ( $snapshot['clients'] ?? 0 ) . ' / ' . (string) ( $snapshot['max_clients'] ?? 0 ),
		) as $label => $value ) {
			echo '<section><h2>' . esc_html( $label ) . '</h2><p>' . esc_html( $value ) . '</p></section>';
		}
		echo '</div><p class="ts3pilot-actions">';
		foreach ( array(
			'ts3pilot-clients'     => array( 'Clients', 'manage_ts3_clients' ),
			'ts3pilot-channels'    => array( 'Channels', 'manage_ts3_channels' ),
			'ts3pilot-maintenance' => array( 'Service controls', 'manage_ts3_maintenance' ),
			'ts3pilot-settings'    => array( 'Display & join settings', 'manage_options' ),
			'ts3pilot-diagnostics' => array( 'Diagnostics', 'manage_options' ),
		) as $page => $item ) {
			if ( current_user_can( $item[1] ) ) {
				echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=' . $page ) ) . '">' . esc_html( $item[0] ) . '</a> ';
			}
		}
		echo '</p><table class="widefat striped">';
		$this->row( 'Agent node', esc_html( (string) $this->repository->get( 'agent_node_id' ) ) );
		$this->row( 'Agent URL', esc_html( (string) $this->repository->get( 'agent_url' ) ) );
		$this->row( 'Server online', ! empty( $snapshot['error'] ) ? 'Unavailable' : ( ! empty( $snapshot['online'] ) ? 'Online' : 'Offline' ) );
		$this->row( 'Online / max', esc_html( (string) ( $snapshot['clients'] ?? 0 ) . ' / ' . (string) ( $snapshot['max_clients'] ?? 0 ) ) );
		$this->row( 'Version', esc_html( (string) ( $snapshot['version'] ?? '' ) ) );
		$this->row( 'Last sync', esc_html( gmdate( 'Y-m-d H:i:s', (int) ( $snapshot['updated'] ?? 0 ) ) ) );
		echo '</table></div>';
	}

	private function row( string $label, string $value ): void {
		echo '<tr><th>' . esc_html( $label ) . '</th><td>' . esc_html( $value ) . '</td></tr>';
	}
}
