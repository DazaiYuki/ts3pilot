<?php
/**
 * Admin node switcher: routes Dashboard/Clients/Channels/Maintenance requests
 * to the currently selected agent node.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Settings\NodeRegistry;

final class NodeSwitcher {
	public static function render( NodeRegistry $registry, string $current_page ): void {
		$nodes = $registry->all();
		if ( count( $nodes ) <= 1 ) {
			return;
		}
		$active = $registry->active_id();
		echo '<div class="ts3ops-node-switcher">';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="ts3cops_switch_node" />';
		echo '<input type="hidden" name="page" value="' . esc_attr( $current_page ) . '" />';
		wp_nonce_field( 'ts3cops_switch_node', 'ts3cops_nonce' );
		echo '<label>' . esc_html__( 'Node:', 'ts3-operations' ) . ' <select name="node_id">';
		foreach ( $nodes as $node_id => $node ) {
			echo '<option value="' . esc_attr( (string) $node_id ) . '" ' . selected( (string) $node_id, $active, false ) . '>'
				. esc_html( (string) ( $node['display_name'] ?? $node_id ) )
				. ( (string) $node_id === $active ? ' (active)' : '' )
				. '</option>';
		}
		echo '</select></label> ';
		echo '<button class="button button-small" type="submit">' . esc_html__( 'Switch', 'ts3-operations' ) . '</button>';
		echo '</form></div>';
	}
}
