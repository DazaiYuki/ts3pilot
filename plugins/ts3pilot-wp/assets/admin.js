(function () {
	'use strict';

	var cfg = window.ts3PilotAdmin;
	if (!cfg) {
		return;
	}

	document.querySelectorAll('form[data-confirm]').forEach(function (form) {
		form.addEventListener('submit', function (event) {
			var message = form.getAttribute('data-confirm-msg') || cfg.i18n.confirmDefault;
			if (!window.confirm(message)) {
				event.preventDefault();
			}
		});
	});

	var table = document.getElementById('ts3pilot-clients');
	if (!table) {
		return;
	}
	var tbody = table.querySelector('tbody');
	if (!tbody) {
		return;
	}

	function request(method, path, body) {
		return fetch(cfg.restUrl + path, {
			method: method,
			headers: {
				'X-WP-Nonce': cfg.nonce,
				'Content-Type': 'application/json'
			},
			body: body === null ? undefined : JSON.stringify(body)
		}).then(function (response) {
			return response.json();
		}).then(function (json) {
			if (json && json.error) {
				throw new Error(json.error.message || cfg.i18n.requestFailed);
			}
			return json;
		});
	}

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (text !== undefined) {
			node.textContent = text;
		}
		return node;
	}

	function actionButton(label, handler) {
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'button button-small';
		button.textContent = label;
		button.addEventListener('click', handler);
		return button;
	}

	function showError(error) {
		window.alert(error.message || cfg.i18n.requestFailed);
	}

	function renderClients(clients) {
		tbody.textContent = '';
		clients.forEach(function (client) {
			var row = document.createElement('tr');
			row.appendChild(el('td', '', String(client.clientId)));
			row.appendChild(el('td', '', client.nickname));
			row.appendChild(el('td', '', String(client.channelId)));
			row.appendChild(el('td', '', client.away ? 'yes' : 'no'));
			var actions = el('td', '', '');
			actions.appendChild(actionButton(cfg.i18n.kickChannel, function () {
				kick(client.clientId, 'channel');
			}));
			actions.appendChild(actionButton(cfg.i18n.kickServer, function () {
				kick(client.clientId, 'server');
			}));
			actions.appendChild(actionButton(cfg.i18n.poke, function () {
				poke(client.clientId);
			}));
			actions.appendChild(actionButton(cfg.i18n.move, function () {
				move(client.clientId);
			}));
			row.appendChild(actions);
			tbody.appendChild(row);
		});
	}

	function loadClients() {
		request('GET', 'clients', null).then(function (json) {
			renderClients(json.clients || []);
		}).catch(showError);
	}

	function kick(clientId, kickFrom) {
		var message = kickFrom === 'server' ? cfg.i18n.confirmKickServer : cfg.i18n.confirmKickChannel;
		if (!window.confirm(message)) {
			return;
		}
		request('POST', 'clients/kick', { client_id: clientId, kick_from: kickFrom })
			.then(loadClients)
			.catch(showError);
	}

	function poke(clientId) {
		var message = window.prompt(cfg.i18n.promptPoke);
		if (message === null || message === '') {
			return;
		}
		request('POST', 'clients/poke', { client_id: clientId, message: message })
			.then(loadClients)
			.catch(showError);
	}

	function move(clientId) {
		var input = window.prompt(cfg.i18n.promptMove);
		if (input === null) {
			return;
		}
		var channelId = parseInt(input, 10);
		if (!Number.isInteger(channelId) || channelId < 0) {
			return;
		}
		request('POST', 'clients/move', { client_id: clientId, channel_id: channelId })
			.then(loadClients)
			.catch(showError);
	}

	loadClients();
	window.setInterval(loadClients, 15000);
})();
