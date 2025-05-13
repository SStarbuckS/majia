const reloadCurrentTab = () => {
	chrome.tabs.query({active: true, currentWindow: true}, tabs => {
		chrome.tabs.reload(tabs[0].id);
	});
};

const reloadPopup = () => {
	window.location.reload();
};

const callApi = (op, params = {}) => {
	return new Promise((fulfill, reject) => {
		chrome.tabs.query({active: true, currentWindow: true}, tabs => {
			const urlParseRE = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
			const matches = urlParseRE.exec(tabs[0].url);
			params.host = matches[11];

			chrome.runtime.sendMessage({op, params}, fulfill);
		});
	});
};

const selectProfile = async (id) => {
	await callApi('selectProfile', {id});
	reloadCurrentTab();
	reloadPopup();
};

const newProfile = async () => {
	await callApi('newProfile');
	reloadCurrentTab();
	reloadPopup();
};

const deleteCurrentProfile = async () => {
	await callApi('deleteCurrentProfile');
	reloadCurrentTab();
	reloadPopup();
};

const deleteAllProfiles = async () => {
	if (confirm('确定要删除当前网站的所有账号数据吗？此操作不可恢复！')) {
		await callApi('deleteAllProfiles');
		reloadCurrentTab();
		reloadPopup();
	}
};

const updateProfile = async (id, set) => {
	await callApi('updateProfile', {id, $set: set});
	reloadPopup();
};

document.addEventListener('DOMContentLoaded', async () => {
	const data = await callApi('getProfiles');
	const profiles = Object.entries(data.profiles).map(([id, profile]) => ({
		...profile,
		id
	})).sort((a, b) => a.id - b.id);

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

	// 添加重命名功能
	if (profiles.length > 1) {
		const currentProfile = profiles.find(p => p.id == data.currentProfileId);
		const renameButton = document.createElement('button');
		renameButton.textContent = '重命名';
		renameButton.onclick = () => {
			const input = document.createElement('input');
			input.value = currentProfile.title;
			renameButton.parentNode.replaceChild(input, renameButton);
			input.focus();
			input.onkeypress = (e) => {
				if (e.keyCode == 13) {
					updateProfile(data.currentProfileId, {
						title: input.value,
					});
					return false;
				}
				return true;
			};
		};
		document.querySelector('.toolbox').appendChild(renameButton);
	}
});

