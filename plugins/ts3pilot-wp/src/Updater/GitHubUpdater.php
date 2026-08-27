<?php
/**
 * GitHub Releases based update checker.
 *
 * The plugin does not need to be listed on wordpress.org: WordPress looks for
 * updates through the standard plugin-update transients and we feed it with
 * the latest release asset from the project's GitHub Releases page. The
 * release metadata is cached for 6 hours and the package URL is restricted to
 * HTTPS GitHub asset URLs.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Updater;

final class GitHubUpdater {
	private const REPO         = 'DazaiYuki/ts3pilot';
	private const API_URL      = 'https://api.github.com/repos/DazaiYuki/ts3pilot/releases/latest';
	private const TRANSIENT    = 'ts3pilot_gh_release';
	private const CACHE_TTL    = 21600; // 6 hours
	private const PLUGIN_SLUG  = 'ts3pilot-wp';
	private const PLUGIN_FILE  = 'ts3pilot-wp/ts3pilot-wp.php';
	private const TESTED_WP    = '6.7';
	private const REQUIRES_PHP = '8.1';

	public static function register(): void {
		add_filter( 'pre_set_site_transient_update_plugins', array( self::class, 'inject_update' ) );
		add_filter( 'plugins_api', array( self::class, 'plugin_info' ), 10, 3 );
	}

	/**
	 * @param object|mixed $transient
	 * @return object
	 */
	public static function inject_update( $transient ): object {
		if ( ! is_object( $transient ) ) {
			return (object) array();
		}
		$release = self::fetch_release();
		if ( null === $release || ! self::is_newer_version( $release['version'], TS3PILOT_VERSION ) ) {
			return $transient;
		}
		$transient->response[ self::PLUGIN_FILE ] = (object) array(
			'slug'         => self::PLUGIN_SLUG,
			'plugin'       => self::PLUGIN_FILE,
			'new_version'  => $release['version'],
			'url'          => $release['html_url'],
			'package'      => $release['asset_url'],
			'tested'       => self::TESTED_WP,
			'requires_php' => self::REQUIRES_PHP,
		);
		return $transient;
	}

	/**
	 * @param mixed $result
	 * @param mixed $action
	 * @param mixed $args
	 * @return object|mixed
	 */
	public static function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || ! is_object( $args ) || self::PLUGIN_SLUG !== (string) ( $args->slug ?? '' ) ) {
			return $result;
		}
		$release = self::fetch_release();
		if ( null === $release ) {
			return $result;
		}
		return (object) array(
			'name'          => 'TS3Pilot',
			'slug'          => self::PLUGIN_SLUG,
			'version'       => $release['version'],
			'author'        => 'TS3Pilot Team',
			'download_link' => $release['asset_url'],
			'requires_php'  => self::REQUIRES_PHP,
			'tested'        => self::TESTED_WP,
			'sections'      => array(
				'description' => 'Optional WordPress control plane for TeamSpeak 3 servers managed by the ts3-manager agent.',
				'changelog'   => 'See https://github.com/DazaiYuki/ts3pilot/releases',
			),
		);
	}

	/**
	 * @return array{version:string,asset_url:string,html_url:string}|null
	 */
	public static function fetch_release(): ?array {
		$cached = get_transient( self::TRANSIENT );
		if ( is_array( $cached ) && isset( $cached['version'], $cached['asset_url'] ) ) {
			return $cached;
		}
		$response = wp_remote_get(
			self::API_URL,
			array(
				'timeout' => 10,
				'headers' => array( 'User-Agent' => 'ts3pilot-wp-updater' ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return null;
		}
		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}
		$payload = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $payload ) ) {
			return null;
		}
		$release = self::release_from_payload( $payload );
		if ( null !== $release ) {
			set_transient( self::TRANSIENT, $release, self::CACHE_TTL );
		}
		return $release;
	}

	/**
	 * @param array<string, mixed> $payload
	 * @return array{version:string,asset_url:string,html_url:string}|null
	 */
	public static function release_from_payload( array $payload ): ?array {
		$tag     = (string) ( $payload['tag_name'] ?? '' );
		$version = ltrim( $tag, 'v' );
		if ( ! preg_match( '/^\d+\.\d+\.\d+$/', $version ) ) {
			return null;
		}
		$asset_url = '';
		$assets    = is_array( $payload['assets'] ?? null ) ? $payload['assets'] : array();
		foreach ( $assets as $asset ) {
			$url = (string) ( is_array( $asset ) ? ( $asset['browser_download_url'] ?? '' ) : '' );
			if ( preg_match( '#/ts3pilot-wp-v\d+\.\d+\.\d+\.zip$#', $url ) && str_starts_with( $url, 'https://github.com/' ) ) {
				$asset_url = $url;
				break;
			}
		}
		if ( '' === $asset_url ) {
			return null;
		}
		$html_url = (string) ( $payload['html_url'] ?? 'https://github.com/' . self::REPO . '/releases' );
		return array(
			'version'   => $version,
			'asset_url' => $asset_url,
			'html_url'  => $html_url,
		);
	}

	public static function is_newer_version( string $candidate, string $current ): bool {
		$candidate_parts = array_map( 'intval', explode( '.', $candidate ) );
		$current_parts   = array_map( 'intval', explode( '.', $current ) );
		$length          = max( count( $candidate_parts ), count( $current_parts ) );
		for ( $index = 0; $index < $length; $index++ ) {
			$left  = $candidate_parts[ $index ] ?? 0;
			$right = $current_parts[ $index ] ?? 0;
			if ( $left > $right ) {
				return true;
			}
			if ( $left < $right ) {
				return false;
			}
		}
		return false;
	}
}
