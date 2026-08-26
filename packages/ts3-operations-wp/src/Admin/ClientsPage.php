<?php
/**
 * Clients page with kick actions (capability + nonce protected).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Agent\AgentException;
use Ts3Ops\Agent\Client;

final class ClientsPage {
	public function __construct( private readonly Client $client ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Clients</h1>';
		try {
			$clients = $this->client->request( 'GET', '/v1/ts3/clients' );
		} catch ( AgentException $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error->getMessage() ) . '</p></div></div>';
			return;
		}
		echo '<table class="widefat striped"><thead><tr><th>ID</th><th>Nickname</th><th>Channel</th><th>Away</th><th>Actions</th></tr></thead><tbody>';
		foreach ( $clients as $client ) {
			echo '<tr>';
			echo '<td>' . esc_html( (string) ( $client['clientId'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $client['nickname'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $client['channelId'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( ! empty( $client['away'] ) ? 'yes' : 'no' ) . '</td>';
			echo '<td>';
			$this->kick_form( (int) ( $client['clientId'] ?? 0 ), 'channel' );
			$this->kick_form( (int) ( $client['clientId'] ?? 0 ), 'server' );
			echo '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	private function kick_form( int $client_id, string $kick_from ): void {
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline" data-confirm="kick">';
		echo '<input type="hidden" name="action" value="ts3cops_kick" />';
		echo '<input type="hidden" name="client_id" value="' . esc_attr( (string) $client_id ) . '" />';
		echo '<input type="hidden" name="kick_from" value="' . esc_attr( $kick_from ) . '" />';
		wp_nonce_field( 'ts3cops_kick_' . $client_id, 'ts3cops_nonce' );
		echo '<button class="button button-small" type="submit">' . esc_html( 'kick' === $kick_from ? 'Kick (channel)' : 'Kick (server)' ) . '</button>';
		echo '</form> ';
	}
}
