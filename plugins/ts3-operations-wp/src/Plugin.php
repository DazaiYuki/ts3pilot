<?php
/**
 * Plugin bootstrap.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops;

use Ts3Ops\Admin\Menu;
use Ts3Ops\Admin\Actions;
use Ts3Ops\Admin\Assets;
use Ts3Ops\Agent\Client;
use Ts3Ops\Frontend\Block;
use Ts3Ops\Frontend\IdentityShortcode;
use Ts3Ops\Frontend\Shortcode;
use Ts3Ops\Rest\Routes;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;
use Ts3Ops\Settings\Settings;

final class Plugin {
	private static ?Plugin $instance = null;

	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register(): void {
		register_activation_hook( TS3OPS_PLUGIN_FILE, array( Capabilities::class, 'grant_defaults' ) );
		Actions::register();
		Assets::register();

		add_action( 'init', array( Capabilities::class, 'register' ) );
		add_action( 'init', array( $this, 'register_services' ) );
		add_action( 'plugins_loaded', array( $this, 'init_components' ) );
	}

	public function register_services(): void {
		$repository = new Repository();
		$client     = new Client( $repository );
		$status     = new StatusService( $client, $repository );

		Shortcode::init( $status );
		IdentityShortcode::init();
		Block::init( $status );
		Routes::init( $client, $status, $repository );
	}

	public function init_components(): void {
		$repository = new Repository();
		Menu::init( new Client( $repository ), new StatusService( new Client( $repository ), $repository ), $repository );
		Settings::init( $repository );
	}
}
