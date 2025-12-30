/**
 * 马甲扩展 - 公共工具函数
 */

/** 默认 Profile 名称 */
const DEFAULT_PROFILE_TITLE = '默认';

/** 新建 Profile 名称前缀 */
const NEW_PROFILE_PREFIX = '马甲';

/**
 * 从主机名提取根域名
 * @param {string} host - 主机名，如 www.example.com
 * @returns {string} 根域名，如 example.com
 */
const hostToDomain = (host) => {
    const parts = host.split('.');
    if (parts.length > 2) {
        return parts.slice(-2).join('.');
    }
    return parts.join('.');
};

export {
    DEFAULT_PROFILE_TITLE,
    NEW_PROFILE_PREFIX,
    hostToDomain
};
