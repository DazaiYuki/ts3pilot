<?php
/**
 * Dashboard page.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;

final class DashboardPage {
	public function __construct(
		private readonly StatusService $status,
		private readonly Repository $repository,
	) {}

	public function render(): void {
		$snapshot = $this->status->get_snapshot( true );
		echo '<div class="wrap"><h1>TS3 Operations Dashboard</h1>';
		echo '<table class="widefat striped">';
		$this->row( 'Agent node', esc_html( (string) $this->repository->get( 'agent_node_id' ) ) );
		$this->row( 'Agent URL', esc_html( (string) $this->repository->get( 'agent_url' ) ) );
		$this->row( 'Server online', ! empty( $snapshot['online'] ) ? 'Online' : 'Offline' );
		$this->row( 'Online / max', esc_html( (string) ( $snapshot['clients'] ?? 0 ) . ' / ' . (string) ( $snapshot['max_clients'] ?? 0 ) ) );
		$this->row( 'Version', esc_html( (string) ( $snapshot['version'] ?? '' ) ) );
		$this->row( 'Last sync', esc_html( gmdate( 'Y-m-d H:i:s', (int) ( $snapshot['updated'] ?? 0 ) ) ) );
		echo '</table></div>';
	}

	private function row( string $label, string $value ): void {
		echo '<tr><th>' . esc_html( $label ) . '</th><td>' . esc_html( $value ) . '</td></tr>';
	}
}
