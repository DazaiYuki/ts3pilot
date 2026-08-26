(function () {
	'use strict';

	var cfg = window.ts3OpsIdentity;
	if (!cfg) {
		return;
	}
	var root = document.getElementById('ts3-identity-root');
	if (!root) {
		return;
	}

	var button = root.querySelector('button[data-action="start"]');
	var statusNode = root.querySelector('.ts3-identity-status');
	var instructionsNode = root.querySelector('.ts3-identity-instructions');
	if (!button || !statusNode || !instructionsNode) {
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

	function showError(error) {
		statusNode.textContent = error.message || cfg.i18n.requestFailed;
		button.disabled = false;
	}

	function poll() {
		var attempts = 0;
		var timer = window.setInterval(function () {
			attempts += 1;
			request('GET', 'identity/me', null).then(function (json) {
				var mapping = json.mapping || {};
				var state = mapping.status || 'unbound';
				statusNode.textContent = cfg.i18n.currentStatus + state;
				if (state === 'verified') {
					window.clearInterval(timer);
					instructionsNode.hidden = true;
					button.hidden = true;
					statusNode.textContent = cfg.i18n.verified;
				} else if (attempts >= 24) {
					window.clearInterval(timer);
					button.disabled = false;
				}
			}).catch(function () {
				if (attempts >= 24) {
					window.clearInterval(timer);
					button.disabled = false;
				}
			});
		}, 5000);
	}

	button.addEventListener('click', function () {
		button.disabled = true;
		request('POST', 'identity/me/challenge', null).then(function (json) {
			instructionsNode.hidden = false;
			instructionsNode.textContent = cfg.i18n.instructionsPrefix + ' ' + json.code + ' ' + cfg.i18n.instructionsSuffix;
			statusNode.textContent = cfg.i18n.waiting;
			poll();
		}).catch(showError);
	});
})();
