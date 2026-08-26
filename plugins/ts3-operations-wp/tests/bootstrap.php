<?php
/**
 * PHPUnit bootstrap with minimal WordPress function stubs.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

error_reporting( E_ALL );

define( 'ABSPATH', __DIR__ . '/../' );
define( 'WPINC', 'wp-includes' );
define( 'WP_DEBUG', true );

spl_autoload_register(
	static function ( string $class ): void {
		if ( ! str_starts_with( $class, 'Ts3Ops\\' ) ) {
			return;
		}
		$path = __DIR__ . '/../src/' . str_replace( '\\', '/', substr( $class, 7 ) ) . '.php';
		if ( is_file( $path ) ) {
			require_once $path;
		}
	}
);

$GLOBALS['__ts3cops_options']      = array();
$GLOBALS['__ts3cops_usermeta']     = array();
$GLOBALS['__ts3cops_transients']   = array();
$GLOBALS['__ts3cops_http_queue']   = array();
$GLOBALS['__ts3cops_roles']        = array();
$GLOBALS['__ts3cops_current_user'] = 0;

/**
 * @param mixed $default
 * @return mixed
 */
function get_option( string $option, $default = false ) {
	return $GLOBALS['__ts3cops_options'][ $option ] ?? $default;
}

/**
 * @param mixed $value
 */
function update_option( string $option, $value ): bool {
	$GLOBALS['__ts3cops_options'][ $option ] = $value;
	return true;
}

function delete_option( string $option ): bool {
	unset( $GLOBALS['__ts3cops_options'][ $option ] );
	return true;
}

/**
 * @param mixed $value
 */
function set_transient( string $key, $value, int $expiration ): bool {
	$GLOBALS['__ts3cops_transients'][ $key ] = array( 'value' => $value, 'expiration' => $expiration );
	return true;
}

/**
 * @return mixed
 */
function get_transient( string $key ) {
	return $GLOBALS['__ts3cops_transients'][ $key ]['value'] ?? false;
}

/**
 * @return mixed
 */
function get_user_meta( int $user_id, string $key, bool $single = false ) {
	$value = $GLOBALS['__ts3cops_usermeta'][ $user_id ][ $key ] ?? '';
	return $single ? $value : ( '' === $value ? array() : array( $value ) );
}

/**
 * @param mixed $value
 */
function update_user_meta( int $user_id, string $key, $value ): bool {
	$GLOBALS['__ts3cops_usermeta'][ $user_id ][ $key ] = $value;
	return true;
}

function current_user_can( string ...$capabilities ): bool {
	return $GLOBALS['__ts3cops_current_user_can'] ?? false;
}

function get_current_user_id(): int {
	return $GLOBALS['__ts3cops_current_user'];
}

function is_user_logged_in(): bool {
	return $GLOBALS['__ts3cops_current_user'] > 0;
}

function sanitize_text_field( string $value ): string {
	return trim( wp_strip_all_tags( $value ) );
}

function sanitize_key( string $value ): string {
	return strtolower( (string) preg_replace( '/[^a-z0-9_-]/i', '', $value ) );
}

function sanitize_html_class( string $value ): string {
	return (string) preg_replace( '/[^a-zA-Z0-9_-]/', '', $value );
}

function esc_html( string $value ): string {
	return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function esc_attr( string $value ): string {
	return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function esc_url( string $value ): string {
	return $value;
}

function esc_url_raw( string $value ): string {
	return $value;
}

/**
 * @param mixed $value
 */
function wp_json_encode( $value, int $flags = 0 ): string|false {
	return json_encode( $value, $flags );
}

/**
 * @return array<string, string>|string|int|false|null
 */
function wp_parse_url( string $url, int $component = -1 ) {
	return parse_url( $url, $component );
}

function wp_strip_all_tags( string $value ): string {
	return trim( (string) preg_replace( '/<[^>]*>/', '', $value ) );
}

function is_wp_error( $value ): bool {
	return $value instanceof WP_Error;
}

/**
 * @param array<string, mixed> $response
 */
function wp_remote_retrieve_response_code( array $response ): int {
	return (int) ( $response['response']['code'] ?? 0 );
}

/**
 * @param array<string, mixed> $response
 */
function wp_remote_retrieve_body( array $response ): string {
	return (string) ( $response['body'] ?? '' );
}

/**
 * @param array<string, mixed> $args
 * @return array<string, mixed>|WP_Error
 */
function wp_remote_request( string $url, array $args = array() ) {
	$queued = array_shift( $GLOBALS['__ts3cops_http_queue'] );
	if ( null === $queued ) {
		return new WP_Error( 'http_request_failed', 'No queued HTTP response in test.' );
	}
	if ( $queued instanceof WP_Error ) {
		return $queued;
	}
	return $queued;
}

/**
 * @param mixed ...$args
 */
function register_rest_route( string $namespace, string $route, array $args = array() ): bool {
	return true;
}

function wp_verify_nonce( string $nonce, string|int $action = -1 ): int|false {
	return true;
}

function wp_create_nonce( string|int $action = -1 ): string {
	return 'test-nonce';
}

function wp_nonce_field( string|int $action = -1, string $name = '_wpnonce', bool $referer = true, bool $echo = true ): string {
	return '';
}

function check_admin_referer( string|int $action = -1, string $query_arg = '_wpnonce' ): void {
}

function wp_die( string $message = '' ): never {
	throw new \RuntimeException( 'wp_die: ' . $message );
}

function add_action( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
}

function add_filter( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
}

function register_activation_hook( string $file, callable $callback ): void {
}

function register_setting( string $group, string $option, array $args = array() ): void {
}

function settings_fields( string $group ): void {
}

function submit_button( string $text = '', string $type = 'primary', string $name = 'submit', bool $wrap = true, array $other_attributes = null ): void {
}

function add_menu_page( string $page_title, string $menu_title, string $capability, string $menu_slug, callable $callback = null, string $icon_url = '', int $position = null ): string {
	return '';
}

function add_submenu_page( string $parent_slug, string $page_title, string $menu_title, string $capability, string $menu_slug, callable $callback = null ): string|false {
	return '';
}

function add_shortcode( string $tag, callable $callback ): void {
}

function shortcode_atts( array $defaults, array $attributes, string $shortcode = '' ): array {
	return array_merge( $defaults, $attributes );
}

function register_block_type( string $path, array $args = array() ): void {
}

/**
 * @return object|null
 */
function get_role( string $role ) {
	return $GLOBALS['__ts3cops_roles'][ $role ] ?? null;
}

function admin_url( string $path = '' ): string {
	return 'http://example.test/wp-admin/' . $path;
}

function add_query_arg( array $args, string $url ): string {
	return $url . '?' . http_build_query( $args );
}

function wp_safe_redirect( string $location, int $status = 302 ): void {
}

function __( string $text, string $domain = 'default' ): string {
	return $text;
}

function esc_html__( string $text, string $domain = 'default' ): string {
	return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' );
}

function wp_unslash( string $value ): string {
	return $value;
}

function checked( $checked, $current = true, bool $echo = true ): string {
	$result = $checked == $current ? 'checked="checked"' : '';
	if ( $echo ) {
		echo $result;
	}
	return $result;
}

function selected( $selected, $current = true, bool $echo = true ): string {
	$result = $selected == $current ? 'selected="selected"' : '';
	if ( $echo ) {
		echo $result;
	}
	return $result;
}

class WP_Error {
	public function __construct(
		public readonly string $code = '',
		public readonly string $message = '',
	) {}

	public function get_error_message(): string {
		return $this->message;
	}
}

class WP_REST_Request {
	/**
	 * @var array<string, mixed>
	 */
	private array $params = array();

	/**
	 * @var array<string, string>
	 */
	private array $headers = array();

	private string $body = '';

	/**
	 * @param array<string, mixed> $params
	 */
	public function __construct( array $params = array(), array $headers = array(), string $body = '' ) {
		$this->params = $params;
		$this->body   = $body;
		foreach ( $headers as $key => $value ) {
			$this->headers[ strtolower( (string) $key ) ] = (string) $value;
		}
	}

	/**
	 * @return mixed
	 */
	public function get_param( string $key ) {
		return $this->params[ $key ] ?? null;
	}

	/**
	 * @param mixed $value
	 */
	public function set_param( string $key, $value ): void {
		$this->params[ $key ] = $value;
	}

	public function get_header( string $name ): ?string {
		return $this->headers[ strtolower( $name ) ] ?? null;
	}

	public function set_header( string $name, string $value ): void {
		$this->headers[ strtolower( $name ) ] = $value;
	}

	public function get_body(): string {
		return $this->body;
	}

	public function set_body( string $body ): void {
		$this->body = $body;
	}
}

class WP_REST_Response {
	/**
	 * @param array<string, mixed> $data
	 */
	public function __construct(
		private readonly array $data,
		private readonly int $status = 200,
	) {}

	/**
	 * @return array<string, mixed>
	 */
	public function get_data(): array {
		return $this->data;
	}

	public function get_status(): int {
		return $this->status;
	}
}

class WP_REST_Server {
	public const READABLE  = 'GET';
	public const CREATABLE = 'POST';
	public const EDITABLE  = 'POST, PUT, PATCH';
	public const DELETABLE = 'DELETE';
	public const ALLMETHODS = '*';
}

/**
 * @param array<string, mixed> $args
 * @return array<int, object>
 */
function get_users( array $args = array() ): array {
	return $GLOBALS['__ts3cops_users'] ?? array();
}

function wp_enqueue_script( string $handle, string $src = '', array $deps = array(), string $ver = '', bool $in_footer = false ): void {
}

function wp_localize_script( string $handle, string $object_name, array $data ): void {
}

function wp_enqueue_style( string $handle, string $src = '', array $deps = array(), string $ver = '', string $media = 'all' ): void {
}

function get_current_screen(): ?object {
	return $GLOBALS['__ts3cops_current_screen'] ?? null;
}

function rest_url( string $path = '' ): string {
	return 'http://example.test/wp-json/' . $path;
}

/**
 * @return object|false
 */
function get_userdata( int $user_id ) {
	return $GLOBALS['__ts3cops_userdata'][ $user_id ] ?? false;
}
