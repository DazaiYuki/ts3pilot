<?php
/**
 * Plugin Name: TS3Pilot
 * Plugin URI: https://github.com/ts3pilot/ts3pilot-wp
 * Description: Optional WordPress control plane for TeamSpeak 3 servers managed by the ts3-manager agent (status cards, client management, safe pairing).
 * Version: 0.3.0
 * Requires at least: 6.0
 * Requires PHP: 8.1
 * Author: TS3 Community Operations Suite
 * License: Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Update URI: https://github.com/DazaiYuki/ts3pilot
 * Text Domain: ts3pilot
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

define( 'TS3PILOT_VERSION', '0.3.0' );
define( 'TS3PILOT_PLUGIN_FILE', __FILE__ );
define( 'TS3PILOT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TS3PILOT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once TS3PILOT_PLUGIN_DIR . 'src/Plugin.php';

Ts3Pilot\Plugin::instance()->register();
