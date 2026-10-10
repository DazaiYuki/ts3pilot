(function (wp) {
 'use strict';
 var el = wp.element.createElement, __ = wp.i18n.__, c = wp.components;
 var SSR = wp.serverSideRender.default || wp.serverSideRender;
 wp.blocks.registerBlockType('ts3pilot/status', {
  title: __('TS3 Status', 'ts3pilot'), icon: 'format-status', category: 'widgets',
  edit: function (props) {
   var a = props.attributes;
   function set(key) { return function (value) { var change = {}; change[key] = value; props.setAttributes(change); }; }
   var fields = [
    el(c.TextControl, { key: 'node', label: __('Node ID (empty uses active node)', 'ts3pilot'), value: a.node, onChange: set('node') }),
    el(c.SelectControl, { key: 'theme', label: __('Theme', 'ts3pilot'), value: a.theme, options: ['auto', 'light', 'dark'].map(function (v) { return { value: v, label: v }; }), onChange: set('theme') })
   ];
   [['showName', 'Server name'], ['showOnline', 'Online status'], ['showMax', 'Player count'], ['showVersion', 'Server version'], ['showChannels', 'Channels'], ['collapsible', 'Collapsible channels']].forEach(function (f) {
    fields.push(el(c.ToggleControl, { key: f[0], label: __(f[1], 'ts3pilot'), checked: a[f[0]], onChange: set(f[0]) }));
   });
   return el(wp.element.Fragment, null,
    el(wp.blockEditor.InspectorControls, null,
     el(c.PanelBody, { title: __('Server display', 'ts3pilot') }, fields),
     el(c.PanelBody, { title: __('Join button', 'ts3pilot') },
      el(c.SelectControl, { label: __('Visibility', 'ts3pilot'), value: a.joinPolicy, options: [
       { value: 'inherit', label: __('Use plugin settings', 'ts3pilot') }, { value: 'hidden', label: __('Hidden', 'ts3pilot') },
       { value: 'public', label: __('Everyone', 'ts3pilot') }, { value: 'logged_in', label: __('Logged-in users', 'ts3pilot') },
       { value: 'verified_ts_user', label: __('Verified TS3 users', 'ts3pilot') }, { value: 'role', label: __('Specific WordPress role', 'ts3pilot') }
      ], onChange: set('joinPolicy') }),
      a.joinPolicy === 'role' ? el(c.TextControl, { label: __('Role slug', 'ts3pilot'), value: a.joinRole, onChange: set('joinRole') }) : null,
      el(c.TextControl, { label: __('Join URL (empty uses settings)', 'ts3pilot'), value: a.joinUrl, placeholder: 'ts3server://voice.example.com?port=9987', onChange: set('joinUrl') }),
      el(c.TextControl, { label: __('Button label', 'ts3pilot'), value: a.joinLabel, onChange: set('joinLabel') })
     )
    ),
    el('div', wp.blockEditor.useBlockProps(), el(SSR, { block: 'ts3pilot/status', attributes: a }))
   );
  },
  save: function () { return null; }
 });
})(window.wp);
