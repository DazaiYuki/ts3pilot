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
		// Called by register_services during init; register now, not on a later init callback.
		register_block_type(
			TS3PILOT_PLUGIN_DIR . 'assets/block',
			array(
				'render_callback' => static function ( array $attributes ) use ( $status ): string {
					$mapped = array();
					foreach ( array(
						'node'         => 'node',
						'showName'     => 'show_name',
						'showOnline'   => 'show_online',
						'showMax'      => 'show_max',
						'showVersion'  => 'show_version',
						'showChannels' => 'show_channels',
						'collapsible'  => 'collapsible',
						'theme'        => 'theme',
						'joinPolicy'   => 'join_policy',
						'joinRole'     => 'join_role',
						'joinUrl'      => 'join_url',
						'joinLabel'    => 'join_label',
					) as $source => $target ) {
						if ( isset( $attributes[ $source ] ) && 'inherit' !== $attributes[ $source ] && '' !== $attributes[ $source ] ) {
							$mapped[ $target ] = is_bool( $attributes[ $source ] ) ? ( $attributes[ $source ] ? 'true' : 'false' ) : (string) $attributes[ $source ];
						}
					}
					return Shortcode::render( $mapped );
				},
			)
		);
	}
}
