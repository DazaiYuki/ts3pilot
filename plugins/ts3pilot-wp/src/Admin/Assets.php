<?php
/**
 * Front-end styles and admin JavaScript registration.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

final class Assets {
	public static function register(): void {
		add_action( 'admin_enqueue_scripts', array( self::class, 'admin' ) );
		add_action( 'wp_enqueue_scripts', array( self::class, 'frontend' ) );
	}

	public static function admin(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( null === $screen || false === strpos( (string) $screen->id, 'ts3pilot' ) ) {
			return;
		}
		wp_enqueue_script( 'ts3pilot-admin', TS3PILOT_PLUGIN_URL . 'assets/admin.js', array(), TS3PILOT_VERSION, true );
		wp_localize_script(
			'ts3pilot-admin',
			'ts3PilotAdmin',
			array(
				'restUrl' => esc_url_raw( rest_url( 'ts3pilot/v1/' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'i18n'    => array(
					'confirmDefault'     => __( '确定执行该操作？', 'ts3pilot' ),
					'confirmKickChannel' => __( '确定将该用户移出当前频道？', 'ts3pilot' ),
					'confirmKickServer'  => __( '确定将用户从服务器踢出？', 'ts3pilot' ),
					'confirmDelete'      => __( '确定删除该频道？此操作不可撤销。', 'ts3pilot' ),
					'promptPoke'         => __( '输入私聊消息：', 'ts3pilot' ),
					'promptMove'         => __( '输入目标频道 ID：', 'ts3pilot' ),
					'requestFailed'      => __( '请求失败', 'ts3pilot' ),
					'kickChannel'        => __( 'Kick (channel)', 'ts3pilot' ),
					'kickServer'         => __( 'Kick (server)', 'ts3pilot' ),
					'poke'               => __( 'Poke', 'ts3pilot' ),
					'move'               => __( 'Move', 'ts3pilot' ),
				),
			)
		);
	}

	public static function frontend(): void {
		wp_enqueue_style( 'ts3pilot-frontend', TS3PILOT_PLUGIN_URL . 'assets/frontend.css', array(), TS3PILOT_VERSION );
		wp_enqueue_script( 'ts3pilot-identity', TS3PILOT_PLUGIN_URL . 'assets/identity.js', array(), TS3PILOT_VERSION, true );
		wp_localize_script(
			'ts3pilot-identity',
			'ts3PilotIdentity',
			array(
				'restUrl' => esc_url_raw( rest_url( 'ts3pilot/v1/' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'i18n'    => array(
					'requestFailed'      => __( '请求失败', 'ts3pilot' ),
					'currentStatus'      => __( '当前状态：', 'ts3pilot' ),
					'verified'           => __( '绑定成功', 'ts3pilot' ),
					'waiting'            => __( '等待自动核验…', 'ts3pilot' ),
					'instructionsPrefix' => __( '验证码', 'ts3pilot' ),
					'instructionsSuffix' => __( '：请在 TeamSpeak 客户端中，把验证码填入「个人描述（Description）」或「离开消息（Away Message）」（昵称为最后手段），等待自动核验。', 'ts3pilot' ),
				),
			)
		);
	}
}
