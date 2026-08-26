<?php
/**
 * Simple CLI syntax linter for the plugin (used by scripts/verify.mjs).
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

$root = dirname( __DIR__ );
$iterator = new RecursiveIteratorIterator(
	new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS )
);
$failed = 0;
$count  = 0;

foreach ( $iterator as $file ) {
	if ( 'php' !== $file->getExtension() ) {
		continue;
	}
	$path = $file->getPathname();
	if ( str_contains( $path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR ) ) {
		continue;
	}
	$count++;
	$output = array();
	$code   = 0;
	exec( escapeshellarg( PHP_BINARY ) . ' -l ' . escapeshellarg( $path ) . ' 2>&1', $output, $code );
	if ( 0 !== $code ) {
		$failed++;
		echo implode( PHP_EOL, $output ), PHP_EOL;
	}
}

echo sprintf( 'PHP lint: %d file(s) checked, %d failed', $count, $failed ), PHP_EOL;
exit( $failed > 0 ? 1 : 0 );
