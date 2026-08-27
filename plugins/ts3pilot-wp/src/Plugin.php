<?php
/**
 * Plugin bootstrap.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot;

use Ts3Pilot\Admin\Menu;
use Ts3Pilot\Admin\Actions;
use Ts3Pilot\Admin\Assets;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Frontend\Block;
use Ts3Pilot\Frontend\IdentityShortcode;
use Ts3Pilot\Frontend\Shortcode;
use Ts3Pilot\Rest\Routes;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\Repository;
use Ts3Pilot\Settings\Settings;
use Ts3Pilot\Updater\GitHubUpdater;

final class Plugin {
	private static ?Plugin $instance = null;

	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register(): void {
		register_activation_hook( TS3PILOT_PLUGIN_FILE, array( Capabilities::class, 'grant_defaults' ) );
		Actions::register();
		Assets::register();
		GitHubUpdater::register();

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
