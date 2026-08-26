<?php
/**
 * Plugin Name: TS3 Operations
 * Plugin URI: https://github.com/ts3-community-ops/ts3-operations-wp
 * Description: Optional WordPress control plane for TeamSpeak 3 servers managed by the ts3-manager agent (status cards, client management, safe pairing).
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author: TS3 Community Operations Suite
 * License: Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: ts3-operations
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

define( 'TS3OPS_VERSION', '0.1.0' );
define( 'TS3OPS_PLUGIN_FILE', __FILE__ );
define( 'TS3OPS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once TS3OPS_PLUGIN_DIR . 'src/Plugin.php';

Ts3Ops\Plugin::instance()->register();
