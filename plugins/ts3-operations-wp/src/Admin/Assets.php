<?php
/**
 * Front-end styles and admin JavaScript registration.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

final class Assets {
	public static function register(): void {
		add_action( 'admin_enqueue_scripts', array( self::class, 'admin' ) );
		add_action( 'wp_enqueue_scripts', array( self::class, 'frontend' ) );
	}

	public static function admin(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( null === $screen || false === strpos( (string) $screen->id, 'ts3-operations' ) ) {
			return;
		}
		wp_enqueue_script( 'ts3ops-admin', TS3OPS_PLUGIN_URL . 'assets/admin.js', array(), TS3OPS_VERSION, true );
		wp_localize_script(
			'ts3ops-admin',
			'ts3OpsAdmin',
			array(
				'restUrl' => esc_url_raw( rest_url( 'ts3-operations/v1/' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'i18n'    => array(
					'confirmDefault'     => __( '确定执行该操作？', 'ts3-operations' ),
					'confirmKickChannel' => __( '确定将该用户移出当前频道？', 'ts3-operations' ),
					'confirmKickServer'  => __( '确定将用户从服务器踢出？', 'ts3-operations' ),
					'confirmDelete'      => __( '确定删除该频道？此操作不可撤销。', 'ts3-operations' ),
					'promptPoke'         => __( '输入私聊消息：', 'ts3-operations' ),
					'promptMove'         => __( '输入目标频道 ID：', 'ts3-operations' ),
					'requestFailed'      => __( '请求失败', 'ts3-operations' ),
					'kickChannel'        => __( 'Kick (channel)', 'ts3-operations' ),
					'kickServer'         => __( 'Kick (server)', 'ts3-operations' ),
					'poke'               => __( 'Poke', 'ts3-operations' ),
					'move'               => __( 'Move', 'ts3-operations' ),
				),
			)
		);
	}

	public static function frontend(): void {
		wp_enqueue_style( 'ts3ops-frontend', TS3OPS_PLUGIN_URL . 'assets/frontend.css', array(), TS3OPS_VERSION );
	}
}
