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
use Ts3Ops\Settings\Repository;

final class Menu {
	public static function init( Client $client, StatusService $status, Repository $repository ): void {
		add_action(
			'admin_menu',
			static function () use ( $client, $status, $repository ): void {
				add_menu_page(
					'TS3 Operations',
					'TS3 Operations',
					Capabilities::MANAGE_VIEW,
					'ts3-operations',
					static function () use ( $status, $repository ): void {
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
					static function () use ( $client ): void {
						( new ClientsPage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Channels',
					'Channels',
					Capabilities::MANAGE_CHANNELS,
					'ts3-operations-channels',
					static function (): void {
						echo '<div class="wrap"><h1>Channels</h1><p>频道树与管理操作将在下一迭代提供（Agent 能力模型已预留）。</p></div>';
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Maintenance',
					'Maintenance',
					Capabilities::MANAGE_MAINTENANCE,
					'ts3-operations-maintenance',
					static function () use ( $client ): void {
						( new MaintenancePage( $client ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Users / Identity',
					'Users / Identity',
					Capabilities::MANAGE_USERS,
					'ts3-operations-users',
					static function (): void {
						echo '<div class="wrap"><h1>Users / Identity</h1><p>身份绑定与挑战流程（unbound/pending/verified/revoked）将在后续迭代提供；状态模型与 Challenge 服务已实现。</p></div>';
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Settings',
					'Settings',
					'manage_options',
					'ts3-operations-settings',
					static function () use ( $client, $repository ): void {
						( new SettingsPage( $client, $repository ) )->render();
					}
				);
				add_submenu_page(
					'ts3-operations',
					'Diagnostics',
					'Diagnostics',
					'manage_options',
					'ts3-operations-diagnostics',
					static function () use ( $repository ): void {
						( new DiagnosticsPage( $repository ) )->render();
					}
				);
			}
		);
	}
}
