<?php
/**
 * Uninstall handler for TS3 Operations.
 *
 * Deactivation never deletes data. Uninstall removes options only when the
 * operator explicitly opted in via the settings page.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$delete_on_uninstall = (array) get_option( 'ts3cops_settings', array() );

if ( ! empty( $delete_on_uninstall['delete_data_on_uninstall'] ) ) {
	delete_option( 'ts3cops_settings' );
	delete_option( 'ts3cops_audit' );
	delete_option( 'ts3cops_status_snapshot' );
}
