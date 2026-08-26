<?php
/**
 * Uninstall handler for TS3Pilot.
 *
 * Deactivation never deletes data. Uninstall removes options only when the
 * operator explicitly opted in via the settings page.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$delete_on_uninstall = (array) get_option( 'ts3pilot_settings', array() );

if ( ! empty( $delete_on_uninstall['delete_data_on_uninstall'] ) ) {
	delete_option( 'ts3pilot_settings' );
	delete_option( 'ts3pilot_audit' );
	delete_option( 'ts3pilot_status_snapshot' );
	delete_option( 'ts3pilot_nodes' );
	delete_option( 'ts3pilot_active_node' );
	delete_option( 'ts3pilot_channels_snapshot' );
	// Legacy ts3cops_* options from earlier versions.
	delete_option( 'ts3cops_settings' );
	delete_option( 'ts3cops_audit' );
	delete_option( 'ts3cops_status_snapshot' );
	delete_option( 'ts3cops_nodes' );
	delete_option( 'ts3cops_active_node' );
	delete_option( 'ts3cops_channels_snapshot' );
}
