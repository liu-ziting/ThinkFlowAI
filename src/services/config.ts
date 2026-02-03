/**
 * 默认模式下的 API Key（当前不使用环境变量注入）。
 * - 如需鉴权，请通过 Settings 的 Custom 模式填写 apiKey
 */
export const API_KEY = ''

/**
 * 默认接口配置（当用户选择默认模式时使用）
 * - apiKey 允许为空：会回退到 API_KEY（环境变量）
 */
export const DEFAULT_CONFIG = {
    chat: {
        baseUrl: 'https://thinkflow.lz-t.top/chat/completions',
        model: 'glm-4.7-flash',
        apiKey: ''
    },
    image: {
        baseUrl: 'https://thinkflow.lz-t.top/images/generations',
        model: 'cogview-3-flash',
        apiKey: ''
    }
}

/**
 * 获取当前配置
 * 可以从这里扩展读取环境变量或其他配置源的逻辑
 */
export const getConfig = () => {
    return DEFAULT_CONFIG
}
