<?php
/**
 * GitHub Releases update checker tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Updater\GitHubUpdater;

final class GitHubUpdaterTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']    = array();
		$GLOBALS['__ts3pilot_transients'] = array();
		$GLOBALS['__ts3pilot_http_queue'] = array();
		$GLOBALS['__ts3pilot_http_calls'] = array();
	}

	public function test_release_from_payload_extracts_the_wp_zip_asset(): void {
		$release = GitHubUpdater::release_from_payload(
			array(
				'tag_name' => 'v0.4.0',
				'html_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.4.0',
				'assets'   => array(
					array( 'browser_download_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/download/v0.4.0/ts3pilot-linux-x64-v0.4.0.tar.gz' ),
					array( 'browser_download_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/download/v0.4.0/ts3pilot-wp-v0.4.0.zip' ),
				),
			)
		);
		$this->assertNotNull( $release );
		$this->assertSame( '0.4.0', (string) ( $release['version'] ?? '' ) );
		$this->assertStringContainsString( 'ts3pilot-wp-v0.4.0.zip', (string) ( $release['asset_url'] ?? '' ) );
	}

	public function test_release_from_payload_rejects_foreign_urls(): void {
		$this->assertNull(
			GitHubUpdater::release_from_payload(
				array(
					'tag_name' => 'v0.4.0',
					'assets'   => array(
						array( 'browser_download_url' => 'https://evil.example/ts3pilot-wp-v0.4.0.zip' ),
					),
				)
			)
		);
		$this->assertNull(
			GitHubUpdater::release_from_payload(
				array(
					'tag_name' => 'not-a-version',
					'assets'   => array(),
				)
			)
		);
	}

	public function test_is_newer_version_compares_semver(): void {
		$this->assertTrue( GitHubUpdater::is_newer_version( '0.4.0', '0.3.0' ) );
		$this->assertTrue( GitHubUpdater::is_newer_version( '0.3.10', '0.3.9' ) );
		$this->assertFalse( GitHubUpdater::is_newer_version( '0.3.0', '0.3.0' ) );
		$this->assertFalse( GitHubUpdater::is_newer_version( '0.2.0', '0.3.0' ) );
	}

	public function test_inject_update_adds_response_when_newer(): void {
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'tag_name' => 'v0.4.0',
					'html_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.4.0',
					'assets'   => array(
						array( 'browser_download_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/download/v0.4.0/ts3pilot-wp-v0.4.0.zip' ),
					),
				)
			),
		);
		$transient                          = GitHubUpdater::inject_update( (object) array() );
		$this->assertTrue( isset( $transient->response['ts3pilot-wp/ts3pilot-wp.php'] ) );
		$this->assertSame( '0.4.0', (string) ( $transient->response['ts3pilot-wp/ts3pilot-wp.php']->new_version ?? '' ) );
		$this->assertStringContainsString( 'ts3pilot-wp-v0.4.0.zip', (string) ( $transient->response['ts3pilot-wp/ts3pilot-wp.php']->package ?? '' ) );
	}

	public function test_inject_update_keeps_transient_when_up_to_date(): void {
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'tag_name' => 'v0.3.0',
					'assets'   => array(
						array( 'browser_download_url' => 'https://github.com/DazaiYuki/ts3pilot/releases/download/v0.3.0/ts3pilot-wp-v0.3.0.zip' ),
					),
				)
			),
		);
		$transient                          = GitHubUpdater::inject_update( (object) array() );
		$this->assertFalse( isset( $transient->response['ts3pilot-wp/ts3pilot-wp.php'] ) );
	}
}
