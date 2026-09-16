/**
 * smilexx-model-enhancer 宿主端入口（0.1.0）
 *
 * 功能全部位于客户端（设置页 DOM 注入 + settings Remote 读写），
 * 宿主端仅提供插件身份，不注册任何服务。
 *
 * @author AI Development Team
 * @license MIT
 */

/** 插件名：同时是 cordis.patch.yml 中的稳定配置行 id。 */
export const name = 'smilexx-model-enhancer'

/** 插件描述：供插件列表与诊断界面展示。 */
export const description = '增强 DSH 模型设置页：在模型行展开区注入图片输入能力勾选与知识库建议'

/** 无宿主依赖。 */
export const inject = []

/**
 * @param {import('@deepseek-ai/cordis').Context} _ctx - Cordis 上下文。
 */
export function apply(_ctx) {
  // 客户端型插件：宿主端无服务、无工具、无事件监听。
}

export default { name, description, inject, apply }
