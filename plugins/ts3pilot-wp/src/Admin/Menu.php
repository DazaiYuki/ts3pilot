<?php
/**
 * Admin menu registration.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Agent\Client;
use Ts3Pilot\Capabilities;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;

final class Menu {
	public static function init( Client $client, StatusService $status, Repository $repository ): void {
		add_action(
			'admin_menu',
			static function () use ( $client, $status, $repository ): void {
				$registry = new NodeRegistry( $repository );
				add_menu_page(
					'TS3Pilot',
					'TS3Pilot',
					Capabilities::MANAGE_VIEW,
					'ts3pilot',
					static function () use ( $status, $repository ): void {
						NodeSwitcher::render( new NodeRegistry( $repository ), 'ts3pilot' );
						( new DashboardPage( $status, $repository ) )->render();
					},
					'dashicons-format-status',
					26
				);
				add_submenu_page(
					'ts3pilot',
					'Clients',
					'Clients',
					Capabilities::MANAGE_CLIENTS,
					'ts3pilot-clients',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-clients' );
						( new ClientsPage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Channels',
					'Channels',
					Capabilities::MANAGE_CHANNELS,
					'ts3pilot-channels',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-channels' );
						( new ChannelsPage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Maintenance',
					'Maintenance',
					Capabilities::MANAGE_MAINTENANCE,
					'ts3pilot-maintenance',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-maintenance' );
						( new MaintenancePage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Users / Identity',
					'Users / Identity',
					Capabilities::MANAGE_USERS,
					'ts3pilot-users',
					static function () use ( $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-users' );
						( new UsersPage() )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Settings',
					'Settings',
					'manage_options',
					'ts3pilot-settings',
					static function () use ( $client, $repository, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-settings' );
						( new SettingsPage( $client, $repository ) )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Diagnostics',
					'Diagnostics',
					'manage_options',
					'ts3pilot-diagnostics',
					static function () use ( $repository, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3pilot-diagnostics' );
						( new DiagnosticsPage( $repository ) )->render();
					}
				);
				add_submenu_page(
					'ts3pilot',
					'Audit Log',
					'Audit Log',
					'manage_options',
					'ts3pilot-audit',
					static function (): void {
						( new AuditLogPage() )->render();
					}
				);
			}
		);
	}
}
