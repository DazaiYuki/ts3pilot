(function (wp) {
	'use strict';

	var el = wp.element && wp.element.createElement;
	var registerBlockType = wp.blocks && wp.blocks.registerBlockType;
	if (!el || !registerBlockType) {
		return;
	}

	registerBlockType('ts3-operations/status', {
		title: 'TS3 Status',
		icon: 'format-status',
		category: 'widgets',
		attributes: {
			node: { type: 'string', default: '' },
			showName: { type: 'boolean', default: true },
			showOnline: { type: 'boolean', default: true },
			showMax: { type: 'boolean', default: true },
			showVersion: { type: 'boolean', default: false },
			showChannels: { type: 'boolean', default: false },
			collapsible: { type: 'boolean', default: false },
			theme: { type: 'string', default: 'auto' },
			joinPolicy: { type: 'string', default: 'hidden' },
			joinRole: { type: 'string', default: '' }
		},
		edit: function () {
			return el(
				'div',
				{ className: 'ts3-block-placeholder' },
				'TS3 Status — rendered on the front end (server-side)'
			);
		},
		save: function () {
			return null;
		}
	});
})(window.wp);
