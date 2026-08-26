<?php
/**
 * Clients page: server-rendered fallback table enhanced by admin.js into a
 * live, REST-driven list with kick / poke / move actions.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Agent\AgentException;
use Ts3Pilot\Agent\Client;

final class ClientsPage {
	public function __construct( private readonly Client $client ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Clients <span class="ts3pilot-live-badge">live</span></h1>';
		try {
			$clients = $this->client->clients();
		} catch ( AgentException $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error->getMessage() ) . '</p></div></div>';
			return;
		}
		echo '<table class="widefat striped" id="ts3pilot-clients"><thead><tr>'
			. '<th>ID</th><th>Nickname</th><th>Channel</th><th>Away</th><th>Actions</th>'
			. '</tr></thead><tbody>';
		foreach ( $clients as $client ) {
			echo '<tr>';
			echo '<td>' . esc_html( (string) ( $client['clientId'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $client['nickname'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $client['channelId'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( ! empty( $client['away'] ) ? 'yes' : 'no' ) . '</td>';
			echo '<td>';
			$this->action_forms( (int) ( $client['clientId'] ?? 0 ) );
			echo '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	private function action_forms( int $client_id ): void {
		$this->simple_form( 'ts3pilot_kick', $client_id, 'Kick (channel)', 'ts3pilot_kick_' . $client_id, array( 'kick_from' => 'channel' ), false );
		$this->simple_form( 'ts3pilot_kick', $client_id, 'Kick (server)', 'ts3pilot_kick_' . $client_id, array( 'kick_from' => 'server' ), true );
		$this->simple_form( 'ts3pilot_poke', $client_id, 'Poke', 'ts3pilot_poke_' . $client_id, array(), false );
		$this->simple_form( 'ts3pilot_move', $client_id, 'Move', 'ts3pilot_move_' . $client_id, array(), false );
	}

	/**
	 * @param array<string, string> $extra
	 */
	private function simple_form( string $action, int $client_id, string $label, string $nonce_action, array $extra, bool $confirm ): void {
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline"'
			. ( $confirm ? ' data-confirm' : '' ) . '>';
		echo '<input type="hidden" name="action" value="' . esc_attr( $action ) . '" />';
		echo '<input type="hidden" name="client_id" value="' . esc_attr( (string) $client_id ) . '" />';
		foreach ( $extra as $key => $value ) {
			echo '<input type="hidden" name="' . esc_attr( $key ) . '" value="' . esc_attr( $value ) . '" />';
		}
		if ( 'ts3pilot_poke' === $action ) {
			echo '<input type="text" name="message" placeholder="' . esc_attr__( 'Message', 'ts3pilot' ) . '" maxlength="512" />';
		}
		if ( 'ts3pilot_move' === $action ) {
			echo '<input type="number" name="channel_id" placeholder="' . esc_attr__( 'Channel ID', 'ts3pilot' ) . '" min="0" />';
		}
		wp_nonce_field( $nonce_action, 'ts3pilot_nonce' );
		echo '<button class="button button-small" type="submit">' . esc_html( $label ) . '</button></form> ';
	}
}
