<?php
/**
 * Gutenberg block registration (server-side rendered dynamic block).
 *
 * The front end never calls the agent directly; the PHP render callback is the
 * only data path and applies the same escaping as the shortcode.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Frontend;

use Ts3Pilot\Services\StatusService;

final class Block {
	public static function init( StatusService $status ): void {
		add_action(
			'init',
			static function () use ( $status ): void {
				register_block_type(
					TS3PILOT_PLUGIN_DIR . 'assets/block',
					array(
						'render_callback' => static function ( array $attributes ) use ( $status ): string {
							return Shortcode::render(
								array(
									'node'          => (string) ( $attributes['node'] ?? '' ),
									'show_name'     => $attributes['showName'] ? 'true' : 'false',
									'show_online'   => $attributes['showOnline'] ? 'true' : 'false',
									'show_max'      => $attributes['showMax'] ? 'true' : 'false',
									'show_version'  => $attributes['showVersion'] ? 'true' : 'false',
									'show_channels' => $attributes['showChannels'] ? 'true' : 'false',
									'collapsible'   => $attributes['collapsible'] ? 'true' : 'false',
									'theme'         => $attributes['theme'] ?? 'auto',
									'join_policy'   => $attributes['joinPolicy'] ?? 'hidden',
									'join_role'     => $attributes['joinRole'] ?? '',
								)
							);
						},
					)
				);
			}
		);
	}
}
