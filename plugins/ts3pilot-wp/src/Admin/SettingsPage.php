<?php
/**
 * Settings page including the pairing wizard.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Agent\Client;
use Ts3Pilot\Agent\Pairing;
use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;
use Ts3Pilot\Settings\Settings;

final class SettingsPage {
	public function __construct(
		private readonly Client $client,
		private readonly Repository $repository,
	) {}

	public function render(): void {
		echo '<div class="wrap"><h1>TS3Pilot Settings</h1>';
		$this->render_node_registry();
		$this->render_pairing_wizard();
		echo '<form method="post" action="options.php">';
		settings_fields( Settings::GROUP );
		$settings = $this->repository->all();
		$this->field( 'agent_url', 'Agent URL', esc_attr( (string) $settings['agent_url'] ) );
		$this->field( 'agent_credential', 'Agent credential (leave blank to keep)', esc_attr( (string) $settings['agent_credential'] ), 'password' );
		$this->field( 'agent_node_id', 'Agent node ID', esc_attr( (string) $settings['agent_node_id'] ) );
		$this->field( 'status_cache_ttl', 'Status cache TTL (seconds)', esc_attr( (string) $settings['status_cache_ttl'] ) );
		$this->field( 'join_url', 'Join URL (optional, e.g. ts3server://)', esc_attr( (string) $settings['join_url'] ) );
		echo '<p><label><input type="checkbox" name="ts3pilot_settings[show_channels]" value="1" '
			. checked( ! empty( $settings['show_channels'] ), true, false ) . ' /> Show public channel tree</label></p>';
		echo '<p><label>Theme: <select name="ts3pilot_settings[theme]">';
		foreach ( array(
			'auto'  => 'Auto (system)',
			'light' => 'Light',
			'dark'  => 'Dark',
		) as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '" ' . selected( (string) $settings['theme'], $value, false ) . '>'
				. esc_html( $label ) . '</option>';
		}
		echo '</select></label></p>';
		echo '<p><label><input type="checkbox" name="ts3pilot_settings[delete_data_on_uninstall]" value="1" '
			. checked( ! empty( $settings['delete_data_on_uninstall'] ), true, false ) . ' /> Delete plugin data on uninstall</label></p>';
		submit_button();
		echo '</form></div>';
	}

	private function render_node_registry(): void {
		$this->render_registry_notice();
		$registry = new NodeRegistry( $this->repository );
		$nodes    = $registry->all();
		$active   = $registry->active_id();
		echo '<h2>Node Registry</h2>';
		if ( count( $nodes ) === 0 ) {
			echo '<p>' . esc_html__( 'No nodes configured yet. Pair a new agent below or add a node manually.', 'ts3pilot' ) . '</p>';
		} else {
			echo '<table class="widefat striped"><thead><tr>'
				. '<th>Display name</th><th>Node ID</th><th>Endpoint</th><th>Timeout</th><th>Active</th><th>Actions</th>'
				. '</tr></thead><tbody>';
			foreach ( $nodes as $node_id => $node ) {
				echo '<tr>';
				echo '<td>' . esc_html( (string) ( $node['display_name'] ?? '' ) ) . '</td>';
				echo '<td>' . esc_html( (string) $node_id ) . '</td>';
				echo '<td>' . esc_html( (string) ( $node['endpoint'] ?? '' ) ) . '</td>';
				echo '<td>' . esc_html( (string) ( $node['timeout'] ?? 8 ) ) . '</td>';
				echo '<td>' . esc_html( (string) $node_id === $active ? 'yes' : 'no' ) . '</td>';
				$actions = $this->node_edit_form( (string) $node_id, $node ) . $this->node_delete_form( (string) $node_id );
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- HTML built from escaped fragments only.
				echo '<td>' . $actions . '</td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
		}
		$this->node_add_form();
	}

	private function render_registry_notice(): void {
		if ( ! isset( $_GET['ts3pilot_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$result   = sanitize_text_field( wp_unslash( $_GET['ts3pilot_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$messages = array(
			'node_added'   => 'Node added.',
			'node_updated' => 'Node updated.',
			'node_deleted' => 'Node deleted.',
			'test_failed'  => 'Connection test failed (check endpoint, credential and Agent status).',
		);
		if ( isset( $messages[ $result ] ) ) {
			echo '<div class="notice notice-success"><p>' . esc_html( $messages[ $result ] ) . '</p></div>';
		} elseif ( 'test_ok' === $result ) {
			$node_id = sanitize_key( (string) ( $_GET['node'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$info    = '' === $node_id ? array() : get_transient( 'ts3pilot_node_test_' . $node_id );
			if ( is_array( $info ) && count( $info ) > 0 ) {
				$detail = sprintf(
					'Connection OK — node %s, TS3 provider %s, system provider %s, deployment %s, remote mode %s.',
					(string) ( $info['nodeId'] ?? $node_id ),
					(string) ( $info['ts3Provider'] ?? 'unknown' ),
					(string) ( $info['systemProvider'] ?? 'unknown' ),
					(string) ( $info['deployment'] ?? 'unknown' ),
					! empty( $info['remoteMode'] ) ? 'yes' : 'no'
				);
				echo '<div class="notice notice-success"><p>' . esc_html( $detail ) . '</p></div>';
			} else {
				echo '<div class="notice notice-success"><p>' . esc_html__( 'Connection test succeeded.', 'ts3pilot' ) . '</p></div>';
			}
		}
	}

	/**
	 * @param array<string, mixed> $node
	 */
	private function node_edit_form( string $node_id, array $node ): string {
		$html  = '<details class="ts3pilot-inline-form"><summary>Edit</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_node_update" />';
		$html .= '<input type="hidden" name="node_id" value="' . esc_attr( $node_id ) . '" />';
		wp_nonce_field( 'ts3pilot_node_update_' . $node_id, 'ts3pilot_nonce' );
		$html .= '<p><label>Display name: <input type="text" name="display_name" value="' . esc_attr( (string) ( $node['display_name'] ?? '' ) ) . '" maxlength="128" /></label></p>';
		$html .= '<p><label>Endpoint: <input type="text" name="endpoint" value="' . esc_attr( (string) ( $node['endpoint'] ?? '' ) ) . '" class="regular-text" /></label></p>';
		$html .= '<p><label>Credential (leave blank to keep): <input type="password" name="credential" class="regular-text" /></label></p>';
		$html .= '<p><label>Timeout: <input type="number" name="timeout" min="1" max="60" value="' . esc_attr( (string) ( $node['timeout'] ?? 8 ) ) . '" /></label></p>';
		$html .= '<button class="button button-small" type="submit">Save</button></form></details>';
		$html .= '<details class="ts3pilot-inline-form"><summary>Test connection</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_node_test" />';
		$html .= '<input type="hidden" name="node_id" value="' . esc_attr( $node_id ) . '" />';
		wp_nonce_field( 'ts3pilot_node_test_' . $node_id, 'ts3pilot_nonce' );
		$html .= '<p class="description">' . esc_html__( 'Requests /v1/info with this node credential to verify connectivity and authentication.', 'ts3pilot' ) . '</p>';
		$html .= '<button class="button button-small" type="submit">' . esc_html__( 'Run test', 'ts3pilot' ) . '</button></form></details>';
		return $html;
	}

	private function node_delete_form( string $node_id ): string {
		$html  = '<details class="ts3pilot-inline-form"><summary>Delete</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" data-confirm data-confirm-msg="'
			. esc_attr__( '确定删除该节点？', 'ts3pilot' ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_node_delete" />';
		$html .= '<input type="hidden" name="node_id" value="' . esc_attr( $node_id ) . '" />';
		wp_nonce_field( 'ts3pilot_node_delete_' . $node_id, 'ts3pilot_nonce' );
		$html .= '<button class="button button-link-delete" type="submit">Delete</button></form></details>';
		return $html;
	}

	private function node_add_form(): void {
		echo '<h3>' . esc_html__( 'Add node manually', 'ts3pilot' ) . '</h3>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="ts3pilot_node_add" />';
		wp_nonce_field( 'ts3pilot_node_add', 'ts3pilot_nonce' );
		echo '<p><label>Display name: <input type="text" name="display_name" maxlength="128" /></label></p>';
		echo '<p><label>Endpoint: <input type="text" name="endpoint" class="regular-text" placeholder="http://127.0.0.1:17880" /></label></p>';
		echo '<p><label>Timeout: <input type="number" name="timeout" min="1" max="60" value="8" /></label></p>';
		echo '<button class="button button-secondary" type="submit">Add node</button>';
		echo '</form>';
	}

	private function render_pairing_wizard(): void {
		$message = '';
		if ( isset( $_GET['ts3pilot_pair_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$message = sanitize_text_field( wp_unslash( $_GET['ts3pilot_pair_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}
		echo '<h2>Pair with the ts3-manager agent</h2>';
		if ( '' !== $message ) {
			echo '<div class="notice notice-' . esc_attr( str_starts_with( $message, 'OK' ) ? 'success' : 'error' ) . '"><p>' . esc_html( $message ) . '</p></div>';
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="ts3pilot_pair" />';
		wp_nonce_field( 'ts3pilot_pair', 'ts3pilot_nonce' );
		echo '<p><input type="text" name="pairing_agent_url" placeholder="http://127.0.0.1:17880" class="regular-text" /></p>';
		echo '<p><input type="text" name="pairing_code" placeholder="Pairing code (8 characters)" class="regular-text" maxlength="64" /></p>';
		echo '<button class="button button-primary" type="submit">Complete pairing</button>';
		echo '</form>';
	}

	private function field( string $name, string $label, string $value, string $type = 'text' ): void {
		echo '<p><label for="ts3pilot_' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label><br />';
		echo '<input type="' . esc_attr( $type ) . '" id="ts3pilot_' . esc_attr( $name ) . '" name="ts3pilot_settings[' . esc_attr( $name ) . ']" value="' . esc_attr( $value ) . '" class="regular-text" /></p>';
	}
}
