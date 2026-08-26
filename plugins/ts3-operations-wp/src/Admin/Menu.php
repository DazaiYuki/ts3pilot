<?php
/**
 * Admin menu registration.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Agent\Client;
use Ts3Ops\Capabilities;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\NodeRegistry;
use Ts3Ops\Settings\Repository;

final class Menu {
	public static function init( Client $client, StatusService $status, Repository $repository ): void {
		add_action(
			'admin_menu',
			static function () use ( $client, $status, $repository ): void {
				$registry = new NodeRegistry( $repository );
				add_menu_page(
					'TS3 Operations',
					'TS3 Operations',
					Capabilities::MANAGE_VIEW,
					'ts3-operations',
					static function () use ( $status, $repository ): void {
						NodeSwitcher::render( new NodeRegistry( $repository ), 'ts3-operations' );
						( new DashboardPage( $status, $repository ) )->render();
					},
					'dashicons-format-status',
					26
				);
				add_submenu_page(
					'ts3-operations',
					'Clients',
					'Clients',
					Capabilities::MANAGE_CLIENTS,
					'ts3-operations-clients',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-clients' );
						( new ClientsPage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Channels',
					'Channels',
					Capabilities::MANAGE_CHANNELS,
					'ts3-operations-channels',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-channels' );
						( new ChannelsPage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Maintenance',
					'Maintenance',
					Capabilities::MANAGE_MAINTENANCE,
					'ts3-operations-maintenance',
					static function () use ( $client, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-maintenance' );
						( new MaintenancePage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Users / Identity',
					'Users / Identity',
					Capabilities::MANAGE_USERS,
					'ts3-operations-users',
					static function () use ( $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-users' );
						( new UsersPage() )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Settings',
					'Settings',
					'manage_options',
					'ts3-operations-settings',
					static function () use ( $client, $repository, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-settings' );
						( new SettingsPage( $client, $repository ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Diagnostics',
					'Diagnostics',
					'manage_options',
					'ts3-operations-diagnostics',
					static function () use ( $repository, $registry ): void {
						NodeSwitcher::render( $registry, 'ts3-operations-diagnostics' );
						( new DiagnosticsPage( $repository ) )->render();
					}
				);
			}
		);
	}
}
