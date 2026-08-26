<?php
/**
 * Agent API exception with a stable error code.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Agent;

final class AgentException extends \RuntimeException {
	public function __construct( public readonly string $error_code, string $message ) {
		parent::__construct( $message );
	}
}
