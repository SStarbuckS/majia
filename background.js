/**
 * 马甲扩展 - Service Worker
 * 处理 Cookie 和 Profile 管理
 */

import { DEFAULT_PROFILE_TITLE, NEW_PROFILE_PREFIX, hostToDomain } from './utils.js';

/**
 * 向当前标签页发送消息
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} 响应结果
 */
const sendMessageToCurrentTab = async (message) => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return chrome.tabs.sendMessage(tab.id, message);
};

/**
 * 重置指定域名的 localStorage
 * @param {string} domain - 域名
 * @param {Object} content - 新内容
 */
const resetLocalStorageByDomain = async (domain, content) => {
	return sendMessageToCurrentTab({
		op: 'resetLocalStorageByDomain',
		params: { domain, content },
	});
};

/**
 * 获取指定域名的 localStorage
 * @param {string} domain - 域名
 * @returns {Promise<Object>} localStorage 内容
 */
const getLocalStorageByDomain = async (domain) => {
	return sendMessageToCurrentTab({
		op: 'getLocalStorageByDomain',
		params: { domain },
	});
};

/**
 * 生成 Cookie 的 URL
 * @param {Object} c - Cookie 对象
 * @returns {string} URL
 */
const cookieUrl = (c) => {
	return (c.secure ? 'https' : 'http') + '://' + c.domain.replace(/^\./, '');
};

/**
 * 获取指定域名的所有 Cookie 和 localStorage
 * @param {string} domain - 域名
 * @returns {Promise<{cookies: Array, localStorage: Object}>}
 */
const getAllCookiesByDomain = async (domain) => {
	const cookies = await chrome.cookies.getAll({ domain });
	const localStorage = await getLocalStorageByDomain(domain);
	return { cookies, localStorage };
};

/**
 * 删除所有 Chrome cookies
 * @param {Array} cookies - Cookie 数组
 */
const removeAllChromeCookies = async (cookies) => {
	await Promise.all(cookies.map(c =>
		chrome.cookies.remove({
			url: cookieUrl(c),
			name: c.name,
			storeId: c.storeId,
		})
	));
};

/**
 * 设置所有 Chrome cookies
 * @param {Array} cookies - Cookie 数组
 */
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

/**
 * 删除指定域名的所有 Cookie 和 localStorage
 * @param {string} domain - 域名
 */
const removeAllCookiesByDomain = async (domain) => {
	const cookies = await getAllCookiesByDomain(domain);
	await Promise.all([
		removeAllChromeCookies(cookies.cookies),
		resetLocalStorageByDomain(domain, {}),
	]);
};

/**
 * 重置指定域名的所有 Cookie 和 localStorage
 * @param {string} domain - 域名
 * @param {Object} cookies - 包含 cookies 和 localStorage 的对象
 */
const resetAllCookiesByDomain = async (domain, cookies) => {
	await removeAllCookiesByDomain(domain);
	await Promise.all([
		setAllChromeCookies(cookies.cookies),
		resetLocalStorageByDomain(domain, cookies.localStorage),
	]);
};

/**
 * 从 storage 获取数据
 * @param {string} k - 键名
 * @param {any} defaultValue - 默认值
 * @returns {Promise<any>}
 */
const storageGet = async (k, defaultValue) => {
	const result = await chrome.storage.local.get(k);
	return result[k] || defaultValue;
};

/**
 * 向 storage 写入数据
 * @param {string} k - 键名
 * @param {any} v - 值
 */
const storageSet = async (k, v) => {
	await chrome.storage.local.set({ [k]: v });
};

/**
 * 生成默认域名数据
 * @returns {Object} 默认数据结构
 */
const defaultDomainData = () => {
	return {
		profiles: { 1: { title: DEFAULT_PROFILE_TITLE } },
		currentProfileId: 1
	};
};

// API 实现
const api = {
	/**
	 * 删除当前 Profile
	 */
	async deleteCurrentProfile(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		if (!data || Object.keys(data.profiles).length <= 1) return;

		delete data.profiles[data.currentProfileId];
		data.currentProfileId = Object.keys(data.profiles)[0];
		await storageSet(domain, data);
		return resetAllCookiesByDomain(domain, data.profiles[data.currentProfileId].cookies);
	},

	/**
	 * 新建 Profile
	 */
	async newProfile(params) {
		const domain = hostToDomain(params.host);
		let data = await storageGet(domain);
		if (!data) data = defaultDomainData();

		const oldProfile = data.profiles[data.currentProfileId];
		const cookies = await getAllCookiesByDomain(domain);
		oldProfile.cookies = cookies;

		const newProfile = { title: NEW_PROFILE_PREFIX + Object.keys(data.profiles).length };
		const newProfileId = Date.now();
		data.profiles[newProfileId] = newProfile;
		data.currentProfileId = newProfileId;

		await removeAllCookiesByDomain(domain);
		await storageSet(domain, data);
	},

	/**
	 * 更新 Profile 信息
	 */
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

	/**
	 * 切换到指定 Profile
	 */
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

	/**
	 * 获取所有 Profiles
	 */
	async getProfiles(params) {
		const domain = hostToDomain(params.host);
		const data = await storageGet(domain);
		return data || defaultDomainData();
	},

	/**
	 * 删除所有 Profiles 和相关数据
	 */
	async deleteAllProfiles(params) {
		const domain = hostToDomain(params.host);
		await chrome.storage.local.remove(domain);
		const cookies = await chrome.cookies.getAll({ domain });
		await Promise.all(cookies.map(cookie =>
			chrome.cookies.remove({
				url: cookieUrl(cookie),
				name: cookie.name,
				storeId: cookie.storeId
			})
		));
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
		return true;
	}
});
