<?php
/**
 * Classic sidebar status and join widget.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Frontend;

use Ts3Pilot\Security\Sanitizer;

final class StatusWidget extends \WP_Widget {
	public function __construct() {
		parent::__construct( 'ts3pilot_status', 'TS3 Status & Join', array( 'description' => 'TeamSpeak server status and configurable join button.' ) );
	}

	public function widget( $args, $instance ): void {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted wrapper HTML supplied by the WordPress theme.
		echo $args['before_widget'] ?? '';
		if ( ! empty( $instance['title'] ) ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted theme wrappers; widget title is escaped.
			echo ( $args['before_title'] ?? '<h2>' ) . esc_html( (string) $instance['title'] ) . ( $args['after_title'] ?? '</h2>' );
		}
		$attributes = array();
		foreach ( array( 'node', 'join_policy', 'join_role', 'join_url', 'join_label', 'theme' ) as $key ) {
			if ( ! empty( $instance[ $key ] ) && 'inherit' !== $instance[ $key ] ) {
				$attributes[ $key ] = (string) $instance[ $key ];
			}
		}
		$html = 'join' === ( $instance['display'] ?? 'status' ) ? Shortcode::render_join( $attributes ) : Shortcode::render( $attributes );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- The renderer escapes all display fields and validates links.
		echo $html;
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted wrapper HTML supplied by the WordPress theme.
		echo $args['after_widget'] ?? '';
	}

	public function form( $instance ): void {
		foreach ( array(
			'title'      => 'Title',
			'node'       => 'Node ID (empty uses active node)',
			'join_url'   => 'Join URL (empty uses settings)',
			'join_label' => 'Button label',
			'join_role'  => 'Role slug',
		) as $key => $label ) {
			echo '<p><label for="' . esc_attr( $this->get_field_id( $key ) ) . '">' . esc_html( $label ) . '</label><input class="widefat" id="' . esc_attr( $this->get_field_id( $key ) ) . '" name="' . esc_attr( $this->get_field_name( $key ) ) . '" value="' . esc_attr( (string) ( $instance[ $key ] ?? '' ) ) . '" /></p>';
		}
		foreach ( array(
			'display'     => array(
				'status' => 'Status card with join button',
				'join'   => 'Join button only',
			),
			'theme'       => array(
				'inherit' => 'Use settings',
				'auto'    => 'Auto',
				'light'   => 'Light',
				'dark'    => 'Dark',
			),
			'join_policy' => array(
				'inherit'          => 'Use settings',
				'hidden'           => 'Hidden',
				'public'           => 'Everyone',
				'logged_in'        => 'Logged-in users',
				'verified_ts_user' => 'Verified TS3 users',
				'role'             => 'Specific WordPress role',
			),
		) as $key => $options ) {
			echo '<p><label>' . esc_html( $key ) . '<select class="widefat" name="' . esc_attr( $this->get_field_name( $key ) ) . '">';
			foreach ( $options as $value => $label ) {
				echo '<option value="' . esc_attr( $value ) . '" ' . selected( (string) ( $instance[ $key ] ?? array_key_first( $options ) ), $value, false ) . '>' . esc_html( $label ) . '</option>';
			}
			echo '</select></label></p>';
		}
	}

	public function update( $new_instance, $old_instance ): array {
		unset( $old_instance );
		return array(
			'title'       => sanitize_text_field( (string) ( $new_instance['title'] ?? '' ) ),
			'node'        => sanitize_key( (string) ( $new_instance['node'] ?? '' ) ),
			'join_url'    => Sanitizer::join_url( (string) ( $new_instance['join_url'] ?? '' ) ),
			'join_label'  => sanitize_text_field( (string) ( $new_instance['join_label'] ?? '' ) ),
			'join_role'   => Sanitizer::role_name( (string) ( $new_instance['join_role'] ?? '' ) ),
			'join_policy' => 'inherit' === ( $new_instance['join_policy'] ?? 'inherit' ) ? 'inherit' : Sanitizer::join_policy( (string) $new_instance['join_policy'] ),
			'display'     => 'join' === ( $new_instance['display'] ?? '' ) ? 'join' : 'status',
			'theme'       => in_array( $new_instance['theme'] ?? '', array( 'auto', 'light', 'dark' ), true ) ? $new_instance['theme'] : 'inherit',
		);
	}
}
