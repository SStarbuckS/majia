/**
 * 马甲扩展 - 弹窗脚本
 * 处理用户界面交互
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

/** 刷新当前标签页 */
const reloadCurrentTab = () => {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.reload(tabs[0].id);
	});
};

/** 刷新弹窗 */
const reloadPopup = () => {
	window.location.reload();
};

/**
 * 调用后台 API
 * @param {string} op - 操作名称
 * @param {Object} params - 参数
 * @returns {Promise<any>} 响应结果
 */
const callApi = (op, params = {}) => {
	return new Promise((resolve) => {
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			const url = new URL(tabs[0].url);
			params.host = url.hostname;
			chrome.runtime.sendMessage({ op, params }, resolve);
		});
	});
};

/**
 * 切换到指定 Profile
 * @param {string} id - Profile ID
 */
const selectProfile = async (id) => {
	await callApi('selectProfile', { id });
	reloadCurrentTab();
	reloadPopup();
};

/** 新建 Profile */
const newProfile = async () => {
	await callApi('newProfile');
	reloadCurrentTab();
	reloadPopup();
};

/** 删除当前 Profile */
const deleteCurrentProfile = async () => {
	await callApi('deleteCurrentProfile');
	reloadCurrentTab();
	reloadPopup();
};

/** 删除所有 Profiles */
const deleteAllProfiles = async () => {
	if (confirm('确定要删除当前网站的所有账号数据吗？此操作不可恢复！')) {
		await callApi('deleteAllProfiles');
		reloadCurrentTab();
		reloadPopup();
	}
};

/**
 * 更新 Profile 信息
 * @param {string} id - Profile ID
 * @param {Object} set - 要更新的属性
 */
const updateProfile = async (id, set) => {
	await callApi('updateProfile', { id, $set: set });
	reloadPopup();
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
	const data = await callApi('getProfiles');
	const profiles = Object.entries(data.profiles)
		.map(([id, profile]) => ({ ...profile, id }))
		.sort((a, b) => a.id - b.id);

	const profilesDiv = document.querySelector('.profiles');
	profiles.forEach(profile => {
		const div = document.createElement('div');
		div.className = `profile-item ${profile.id == data.currentProfileId ? 'active' : ''}`;
		div.textContent = profile.title;

		if (profile.id != data.currentProfileId) {
			div.onclick = () => selectProfile(profile.id);
		}

		profilesDiv.appendChild(div);
	});

	document.getElementById('new').onclick = newProfile;
	document.getElementById('delete').onclick = deleteCurrentProfile;
	document.getElementById('deleteAll').onclick = deleteAllProfiles;

	// 重命名功能
	if (profiles.length > 1) {
		const currentProfile = profiles.find(p => p.id == data.currentProfileId);
		const renameButton = document.createElement('button');
		renameButton.textContent = '重命名';
		renameButton.onclick = () => {
			const input = document.createElement('input');
			input.value = currentProfile.title;
			renameButton.parentNode.replaceChild(input, renameButton);
			input.focus();
			input.onkeydown = (e) => {
				if (e.key === 'Enter') {
					updateProfile(data.currentProfileId, { title: input.value });
					e.preventDefault();
				}
			};
		};
		document.querySelector('.toolbox').appendChild(renameButton);
	}
});
