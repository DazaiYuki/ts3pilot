<?php
/**
 * Boot the shipped plugin without the PHPUnit autoloader.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );
$GLOBALS['ts3pilot_boot_hooks'] = array();
function plugin_dir_path( string $file ): string {
	return dirname( $file ) . '/';
}
function plugin_dir_url( string $file ): string {
	return 'https://example.invalid/plugins/' . basename( dirname( $file ) ) . '/';
}
function register_activation_hook( string $file, callable $callback ): void {
	$GLOBALS['ts3pilot_boot_hooks']['activation'] = $callback;
}
function add_action( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
	unset( $priority, $accepted_args );
	$GLOBALS['ts3pilot_boot_hooks'][ $hook ] = $callback;
}
function add_filter( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
	unset( $priority, $accepted_args );
	$GLOBALS['ts3pilot_boot_hooks'][ $hook ] = $callback;
}
require __DIR__ . '/../ts3pilot-wp.php';
foreach ( array( 'activation', 'init', 'plugins_loaded', 'admin_post_ts3pilot_pair', 'pre_set_site_transient_update_plugins' ) as $hook ) {
	if ( ! isset( $GLOBALS['ts3pilot_boot_hooks'][ $hook ] ) ) {
		throw new RuntimeException( 'Plugin did not register a required hook.' );
	}
}
echo "Plugin production bootstrap: hooks and autoloading passed\n";
