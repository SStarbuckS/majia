const denodify = (fn) => {
	return function () {
		const args = Array.prototype.slice.call(arguments);
		return new Promise((fulfill, reject) => {
			fn.apply(null, args.concat([fulfill]));
		});
	};
};

const sendMessageToCurrentTab = async (message) => {
	const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
	return chrome.tabs.sendMessage(tab.id, message);
};

const resetLocalStorageByDomain = async (domain, content) => {
	return sendMessageToCurrentTab({
		op: 'resetLocalStorageByDomain',
		params: {domain: domain, content: content},
	});
};

const getLocalStorageByDomain = async (domain) => {
	return sendMessageToCurrentTab({
		op: 'getLocalStorageByDomain',
		params: {domain: domain},
	});
};

const hostToDomain = (host) => {
	let a = host.split('.');
	if (a.length > 2) {
		a = a.slice(a.length-2);
	}
	return a.join('.');
};

const cookieUrl = (c) => {
	return (c.secure?'https':'http')+'://'+c.domain.replace(/^\./, '');
};

// cookies={cookies,localStorage}

const getAllCookiesByDomain = async (domain) => {
	const res = {};
	const cookies = await chrome.cookies.getAll({domain: domain});
		res.cookies = cookies;
	res.localStorage = await getLocalStorageByDomain(domain);
		return res;
};

const removeAllCookiesByDomain = async (domain) => {
	const cookies = await getAllCookiesByDomain(domain);
	await Promise.all([
			removeAllChromeCookies(cookies.cookies),
			resetLocalStorageByDomain(domain, {}),
		]);
};

const resetAllCookiesByDomain = async (domain, cookies) => {
	await removeAllCookiesByDomain(domain);
	await Promise.all([
			setAllChromeCookies(cookies.cookies),
			resetLocalStorageByDomain(domain, cookies.localStorage),
	]);
};

const removeAllChromeCookies = async (cookies) => {
	await Promise.all(cookies.map(c => 
		chrome.cookies.remove({
			url: cookieUrl(c),
			name: c.name,
			storeId: c.storeId,
		})
	));
};

const setAllChromeCookies = async (cookies) => {
	await Promise.all(cookies.map(c => {
		const set = {
			url: cookieUrl(c),
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: c.path,
			secure: c.secure,
			httpOnly: c.httpOnly,
			expirationDate: c.expirationDate,
			storeId: c.storeId,
		};
		return chrome.cookies.set(set);
	}));
};

const storageGet = async (k, v) => {
	const result = await chrome.storage.local.get(k);
	return result[k] || v;
};

const storageSet = async (k, v) => {
	const p = {};
	p[k] = v;
	await chrome.storage.local.set(p);
};

const defaultDomainData = () => {
	return {profiles: {1: {title: '默认'}}, currentProfileId: 1};
};

// API 实现
const api = {
	async deleteCurrentProfile(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		if (!data || Object.keys(data.profiles).length <= 1) return;
		
		delete data.profiles[data.currentProfileId];
		data.currentProfileId = Object.keys(data.profiles)[0];
		await storageSet(domain, data);
			return resetAllCookiesByDomain(domain, data.profiles[data.currentProfileId].cookies);
	},

	async newProfile(params) {
		const domain = hostToDomain(params.host);
		let data = await storageGet(domain);
		if (!data) data = defaultDomainData();

		const oldProfile = data.profiles[data.currentProfileId];
		const cookies = await getAllCookiesByDomain(domain);
			oldProfile.cookies = cookies;

		const newProfile = {title: '马甲'+Object.keys(data.profiles).length};
		const newProfileId = Date.now();
			data.profiles[newProfileId] = newProfile;
			data.currentProfileId = newProfileId;

		await removeAllCookiesByDomain(domain);
		await storageSet(domain, data);
	},

	async updateProfile(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		if (!data) return;

		const id = params.id || data.currentProfileId;
		const profile = data.profiles[id];
		if (!profile) return;

		if (params.$set) {
			Object.assign(profile, params.$set);
		}
		await storageSet(domain, data);
	},

	async selectProfile(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		if (!data || params.id === data.currentProfileId) return;

		const oldProfile = data.profiles[data.currentProfileId];
		const newProfile = data.profiles[params.id];
		if (!oldProfile || !newProfile) return;

		const cookies = await getAllCookiesByDomain(domain);
			oldProfile.cookies = cookies;
			data.currentProfileId = params.id;
		await storageSet(domain, data);
		await resetAllCookiesByDomain(domain, newProfile.cookies);
	},

	async getProfiles(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		return data || defaultDomainData();
	},

	async updateUserInfo(params) {
		const domain = hostToDomain(params.host);
		let data = await storageGet(domain);
		if (!data) data = defaultDomainData();
		
		const profile = data.profiles[data.currentProfileId];
		profile.title = params.username;
		await storageSet(domain, data);
	},

	async deleteAllProfiles(params) {
		const domain = hostToDomain(params.host);
		// 删除存储的数据
		await chrome.storage.local.remove(domain);
		// 删除所有 cookies
		const cookies = await chrome.cookies.getAll({ domain });
		await Promise.all(cookies.map(cookie => 
			chrome.cookies.remove({
				url: cookieUrl(cookie),
				name: cookie.name,
				storeId: cookie.storeId
			})
		));
		// 清除 localStorage
		await resetLocalStorageByDomain(domain, {});
		return true;
	}
};

// 消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (api[message.op]) {
		api[message.op](message.params)
			.then(sendResponse)
			.catch(error => sendResponse({ error: error.message }));
		return true; // 保持消息通道开放
	}
});

// 导出需要的函数
export {
	denodify,
	sendMessageToCurrentTab,
	resetLocalStorageByDomain,
	getLocalStorageByDomain,
	hostToDomain,
	cookieUrl,
	getAllCookiesByDomain,
	removeAllCookiesByDomain,
	resetAllCookiesByDomain,
	removeAllChromeCookies,
	setAllChromeCookies,
	storageGet,
	storageSet,
	defaultDomainData
};

