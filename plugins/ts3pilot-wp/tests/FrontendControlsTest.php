<?php
/**
 * Frontend controls and safe join-link regression tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Frontend\Shortcode;
use Ts3Pilot\Frontend\StatusWidget;
use Ts3Pilot\Security\Sanitizer;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\Repository;
use Ts3Pilot\Settings\Settings;

final class FrontendControlsTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']       = array();
		$GLOBALS['__ts3pilot_transients']    = array();
		$GLOBALS['__ts3pilot_http_queue']    = array();
		$GLOBALS['__ts3pilot_current_user']  = 0;
		$GLOBALS['__ts3pilot_current_roles'] = array();
	}

	private function setup_display(): Repository {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'never-public',
				'join_url'         => 'ts3server://voice.example.com?port=9987',
				'join_label'       => 'Join <voice>',
				'join_policy'      => 'public',
				'show_name'        => false,
			)
		);
		Shortcode::init( new StatusService( new Client( $repository ), $repository ) );
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => false,
						'name'          => 'Private name',
						'clientsOnline' => 0,
						'maxClients'    => 32,
					),
				)
			),
		);
		return $repository;
	}

	public function test_inherited_settings_and_native_join_protocol_are_rendered_safely(): void {
		$this->setup_display();
		$html = Shortcode::render();
		$this->assertStringNotContainsString( 'Private name', $html );
		$this->assertStringContainsString( 'data-ts3-state="offline"', $html );
		$this->assertStringContainsString( 'href="ts3server://voice.example.com?port=9987"', $html );
		$this->assertStringContainsString( 'Join &lt;voice&gt;', $html );
		$this->assertStringNotContainsString( 'never-public', $html );
		$this->assertStringNotContainsString( '127.0.0.1:17880', $html );
		$this->assertStringContainsString( 'ts3-status-join', Shortcode::render_join() );
		$this->assertSame( '', Shortcode::render_join( array( 'join_url' => 'javascript:alert(1)' ) ) );
	}

	public function test_join_visibility_checks_login_and_actual_role_membership(): void {
		$this->setup_display();
		$this->assertSame( '', Shortcode::render_join( array( 'join_policy' => 'logged_in' ) ) );
		$GLOBALS['__ts3pilot_current_user'] = 1;
		$this->assertStringContainsString( 'ts3-status-join', Shortcode::render_join( array( 'join_policy' => 'logged_in' ) ) );
		$GLOBALS['__ts3pilot_current_user_can'] = true;
		$this->assertSame(
			'',
			Shortcode::render_join(
				array(
					'join_policy' => 'role',
					'join_role'   => 'subscriber',
				)
			)
		);
		$GLOBALS['__ts3pilot_current_roles'] = array( 'subscriber' );
		$this->assertStringContainsString(
			'ts3-status-join',
			Shortcode::render_join(
				array(
					'join_policy' => 'role',
					'join_role'   => 'subscriber',
				)
			)
		);
	}

	public function test_settings_and_widget_reject_unsafe_links_and_preserve_credentials(): void {
		$repository = $this->setup_display();
		$settings   = Settings::sanitize(
			array(
				'join_url'         => 'ts3server://voice.example.com?port=9987',
				'show_name'        => '0',
				'agent_credential' => '',
			),
			$repository
		);
		$this->assertSame( 'never-public', $settings['agent_credential'] );
		$this->assertFalse( $settings['show_name'] );
		$this->assertSame( 'ts3server://voice.example.com?port=9987', $settings['join_url'] );
		$this->assertSame( '', Sanitizer::join_url( 'https://user:password@example.com' ) );
		$this->assertSame( '', Sanitizer::join_url( 'data:text/html,test' ) );
		$widget   = new StatusWidget();
		$instance = $widget->update(
			array(
				'title'       => '<b>Server</b>',
				'display'     => 'join',
				'join_policy' => 'public',
				'join_url'    => 'javascript:alert(1)',
			),
			array()
		);
		$this->assertSame( '', $instance['join_url'] );
		$this->assertSame( 'Server', $instance['title'] );
		$instance['join_url'] = 'ts3server://widget.example.com?port=9987';
		ob_start();
		$widget->widget( array(), $instance );
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'widget.example.com', $html );
	}
}
