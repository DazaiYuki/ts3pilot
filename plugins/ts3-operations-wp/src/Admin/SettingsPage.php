<?php
/**
 * Settings page including the pairing wizard.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Agent\Client;
use Ts3Ops\Agent\Pairing;
use Ts3Ops\Settings\Repository;
use Ts3Ops\Settings\Settings;

final class SettingsPage {
	public function __construct(
		private readonly Client $client,
		private readonly Repository $repository,
	) {}

	public function render(): void {
		echo '<div class="wrap"><h1>TS3 Operations Settings</h1>';
		$this->render_pairing_wizard();
		echo '<form method="post" action="options.php">';
		settings_fields( Settings::GROUP );
		$settings = $this->repository->all();
		$this->field( 'agent_url', 'Agent URL', esc_attr( (string) $settings['agent_url'] ) );
		$this->field( 'agent_credential', 'Agent credential (leave blank to keep)', esc_attr( (string) $settings['agent_credential'] ), 'password' );
		$this->field( 'agent_node_id', 'Agent node ID', esc_attr( (string) $settings['agent_node_id'] ) );
		$this->field( 'status_cache_ttl', 'Status cache TTL (seconds)', esc_attr( (string) $settings['status_cache_ttl'] ) );
		$this->field( 'join_url', 'Join URL (optional, e.g. ts3server://)', esc_attr( (string) $settings['join_url'] ) );
		echo '<p><label><input type="checkbox" name="ts3cops_settings[show_channels]" value="1" '
			. checked( ! empty( $settings['show_channels'] ), true, false ) . ' /> Show public channel tree</label></p>';
		echo '<p><label>Theme: <select name="ts3cops_settings[theme]">';
		foreach ( array(
			'auto'  => 'Auto (system)',
			'light' => 'Light',
			'dark'  => 'Dark',
		) as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '" ' . selected( (string) $settings['theme'], $value, false ) . '>'
				. esc_html( $label ) . '</option>';
		}
		echo '</select></label></p>';
		echo '<p><label><input type="checkbox" name="ts3cops_settings[delete_data_on_uninstall]" value="1" '
			. checked( ! empty( $settings['delete_data_on_uninstall'] ), true, false ) . ' /> Delete plugin data on uninstall</label></p>';
		submit_button();
		echo '</form></div>';
	}

	private function render_pairing_wizard(): void {
		$message = '';
		if ( isset( $_GET['ts3cops_pair_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$message = sanitize_text_field( wp_unslash( $_GET['ts3cops_pair_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}
		echo '<h2>Pair with the ts3-manager agent</h2>';
		if ( '' !== $message ) {
			echo '<div class="notice notice-' . esc_attr( str_starts_with( $message, 'OK' ) ? 'success' : 'error' ) . '"><p>' . esc_html( $message ) . '</p></div>';
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="ts3cops_pair" />';
		wp_nonce_field( 'ts3cops_pair', 'ts3cops_nonce' );
		echo '<p><input type="text" name="pairing_agent_url" placeholder="http://127.0.0.1:17880" class="regular-text" /></p>';
		echo '<p><input type="text" name="pairing_code" placeholder="Pairing code (8 characters)" class="regular-text" maxlength="64" /></p>';
		echo '<button class="button button-primary" type="submit">Complete pairing</button>';
		echo '</form>';
	}

	private function field( string $name, string $label, string $value, string $type = 'text' ): void {
		echo '<p><label for="ts3cops_' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label><br />';
		echo '<input type="' . esc_attr( $type ) . '" id="ts3cops_' . esc_attr( $name ) . '" name="ts3cops_settings[' . esc_attr( $name ) . ']" value="' . esc_attr( $value ) . '" class="regular-text" /></p>';
	}
}
