<?php
/**
 * Channels management page: full tree, create/edit/move/delete with
 * capability + nonce protection and front-end confirmation.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Agent\AgentException;
use Ts3Pilot\Agent\Client;

final class ChannelsPage {
	public function __construct( private readonly Client $client ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Channels</h1>';
		$this->render_notice();
		try {
			$channels = $this->client->channels();
		} catch ( AgentException $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error->getMessage() ) . '</p></div></div>';
			return;
		}

		$this->render_create_form( $channels );
		$by_parent = array();
		foreach ( $channels as $channel ) {
			$by_parent[ (int) ( $channel['parentId'] ?? 0 ) ][] = $channel;
		}
		echo '<h2>Channel tree</h2>';
		$tree = $this->render_tree( $by_parent, 0, $channels );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- HTML built from escaped fragments only.
		echo '<ul class="ts3pilot-tree">' . $tree . '</ul>';
		echo '</div>';
	}

	private function render_notice(): void {
		if ( ! isset( $_GET['ts3pilot_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$result = sanitize_text_field( wp_unslash( $_GET['ts3pilot_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$ok     = str_starts_with( $result, 'ok' );
		echo '<div class="notice notice-' . esc_attr( $ok ? 'success' : 'error' ) . '"><p>'
			. esc_html( $ok ? 'Channel operation completed.' : 'Channel operation failed.' )
			. '</p></div>';
	}

	/**
	 * @param array<int, array<string, mixed>> $channels
	 */
	private function render_create_form( array $channels ): void {
		echo '<h2>Create channel</h2>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="ts3pilot_channel_create" />';
		wp_nonce_field( 'ts3pilot_channel_create', 'ts3pilot_nonce' );
		echo '<p><label>Name: <input type="text" name="name" required maxlength="100" /></label></p>';
		echo '<p><label>Parent: <select name="parent_id"><option value="0">Root</option>';
		foreach ( $channels as $channel ) {
			echo '<option value="' . esc_attr( (string) ( $channel['channelId'] ?? 0 ) ) . '">'
				. esc_html( (string) ( $channel['name'] ?? '' ) ) . '</option>';
		}
		echo '</select></label></p>';
		echo '<p><label>Order: <input type="number" name="order" min="0" value="0" /></label></p>';
		echo '<button class="button button-primary" type="submit">Create</button>';
		echo '</form>';
	}

	/**
	 * @param array<int, array<int, array<string, mixed>>> $by_parent
	 * @param array<int, array<string, mixed>>              $all
	 */
	private function render_tree( array $by_parent, int $parent_id, array $all ): string {
		$html = '';
		foreach ( $by_parent[ $parent_id ] ?? array() as $channel ) {
			$id       = (int) ( $channel['channelId'] ?? 0 );
			$name     = (string) ( $channel['name'] ?? '' );
			$clients  = (int) ( $channel['totalClients'] ?? 0 );
			$html    .= '<li>';
			$html    .= '<div class="ts3pilot-channel-row"><strong>' . esc_html( $name ) . '</strong>'
				. '<span class="ts3pilot-channel-meta">id=' . esc_html( (string) $id ) . ' clients=' . esc_html( (string) $clients ) . '</span></div>';
			$html    .= $this->edit_form( $id, $all );
			$html    .= $this->move_form( $id, $all );
			$html    .= $this->delete_form( $id );
			$children = $this->render_tree( $by_parent, $id, $all );
			if ( '' !== $children ) {
				$html .= '<ul>' . $children . '</ul>';
			}
			$html .= '</li>';
		}
		return $html;
	}

	/**
	 * @param array<int, array<string, mixed>> $all
	 */
	private function edit_form( int $channel_id, array $all ): string {
		$name  = '';
		$topic = '';
		foreach ( $all as $channel ) {
			if ( (int) ( $channel['channelId'] ?? 0 ) === $channel_id ) {
				$name  = (string) ( $channel['name'] ?? '' );
				$topic = (string) ( $channel['topic'] ?? '' );
				break;
			}
		}
		$html  = '<details class="ts3pilot-inline-form"><summary>Edit</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_channel_edit" />';
		$html .= '<input type="hidden" name="channel_id" value="' . esc_attr( (string) $channel_id ) . '" />';
		wp_nonce_field( 'ts3pilot_channel_edit_' . $channel_id, 'ts3pilot_nonce' );
		$html .= '<p><label>Name: <input type="text" name="name" value="' . esc_attr( $name ) . '" maxlength="100" /></label></p>';
		$html .= '<p><label>Topic: <input type="text" name="topic" value="' . esc_attr( $topic ) . '" maxlength="255" /></label></p>';
		$html .= '<button class="button button-small" type="submit">Save</button></form></details>';
		return $html;
	}

	/**
	 * @param array<int, array<string, mixed>> $all
	 */
	private function move_form( int $channel_id, array $all ): string {
		$html  = '<details class="ts3pilot-inline-form"><summary>Move</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_channel_move" />';
		$html .= '<input type="hidden" name="channel_id" value="' . esc_attr( (string) $channel_id ) . '" />';
		wp_nonce_field( 'ts3pilot_channel_move_' . $channel_id, 'ts3pilot_nonce' );
		$html .= '<p><label>Parent: <select name="parent_id"><option value="0">Root</option>';
		foreach ( $all as $channel ) {
			if ( (int) ( $channel['channelId'] ?? 0 ) === $channel_id ) {
				continue;
			}
			$html .= '<option value="' . esc_attr( (string) ( $channel['channelId'] ?? 0 ) ) . '">'
				. esc_html( (string) ( $channel['name'] ?? '' ) ) . '</option>';
		}
		$html .= '</select></label></p>';
		$html .= '<p><label>Order: <input type="number" name="order" min="0" value="0" /></label></p>';
		$html .= '<button class="button button-small" type="submit">Move</button></form></details>';
		return $html;
	}

	private function delete_form( int $channel_id ): string {
		$html  = '<details class="ts3pilot-inline-form"><summary>Delete</summary>';
		$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" data-confirm data-confirm-msg="'
			. esc_attr__( '确定删除该频道？此操作不可撤销。', 'ts3pilot' ) . '">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_channel_delete" />';
		$html .= '<input type="hidden" name="channel_id" value="' . esc_attr( (string) $channel_id ) . '" />';
		wp_nonce_field( 'ts3pilot_channel_delete_' . $channel_id, 'ts3pilot_nonce' );
		$html .= '<p><label><input type="checkbox" name="force" value="1" /> Force delete (move clients)</label></p>';
		$html .= '<button class="button button-link-delete" type="submit">Delete</button></form></details>';
		return $html;
	}
}
