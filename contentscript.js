/**
 * 马甲扩展 - 内容脚本
 * 处理 localStorage 的获取和重置
 */

/**
 * 从主机名提取根域名
 * @param {string} host - 主机名
 * @returns {string} 根域名
 */
const hostToDomain = (host) => {
	const parts = host.split('.');
	if (parts.length > 2) {
		return parts.slice(-2).join('.');
	}
	return parts.join('.');
};

/**
 * 重置 localStorage
 * @param {Object} content - 新的 localStorage 内容
 */
const resetLocalStorage = (content) => {
	sessionStorage.clear();
	localStorage.clear();
	for (const k in content) {
		localStorage.setItem(k, content[k]);
	}
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
