// 使用 ES 模块格式
const callApi = async (op, params = {}) => {
			params.host = window.location.hostname;
	return chrome.runtime.sendMessage({ op, params });
};

const resetLocalStorage = (content) => {
	sessionStorage.clear();
	localStorage.clear();
	for (const k in content) {
		localStorage.setItem(k, content[k]);
	}
};

const gotUsername = async (name) => {
	if (localStorage.getItem('majia.username') === name) return;
	localStorage.setItem('majia.username', name);
	await callApi('updateUserInfo', { username: name });
};

const hostToDomain = (host) => {
	let a = host.split('.');
	if (a.length > 2) {
		a = a.slice(a.length - 2);
	}
	return a.join('.');
	};

const domain = hostToDomain(window.location.hostname);

// 消息监听器
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.op === 'resetLocalStorageByDomain') {
		if (msg.params.domain === domain) {
				resetLocalStorage(msg.params.content);
			sendResponse(true);
			}
	} else if (msg.op === 'getLocalStorageByDomain') {
		if (msg.params.domain === domain) {
			const res = {};
			for (const k in localStorage) {
					res[k] = localStorage.getItem(k);
			}
			sendResponse(res);
			}
		}
		return true;
	});

// 网站特定的用户名检测
const siteHandlers = {
	'douban.com': () => {
		const span = document.querySelector('.nav-user-account span');
			if (span) {
			const m = span.innerHTML.match(/(.*)的帐号/);
				m && m[1] && gotUsername(m[1]);
			}
		},

	'zhihu.com': () => {
		const span = document.querySelector('.top-nav-profile .name');
		if (span && span.innerHTML) {
				gotUsername(span.innerHTML);
		}
		},

	'weibo.com': () => {
		const em = document.querySelector('[nm="name"] .S_txt1');
			if (em && em.innerHTML) {
				gotUsername(em.innerHTML);
				return;
			}
		const m = document.cookie.match(/un=([^;]+);/);
			m && m[1] && gotUsername(m[1]);
		},

	'twitter.com': () => {
		const span = document.querySelector('.DashboardProfileCard-screennameLink span');
		if (span && span.innerHTML) {
				gotUsername(span.innerHTML);
		}
		},

	'facebook.com': () => {
		const span = document.querySelector('[data-click="profile_icon"] span');
		if (span && span.innerHTML) {
				gotUsername(span.innerHTML);
		}
	}
};

// 执行对应网站的处理器
(siteHandlers[domain] || (() => {}))();

