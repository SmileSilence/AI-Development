/**
 * smilexx-input-enhancer 宿主端入口（2.3.1）
 *
 * 宿主端提供调整方向的原子队列操作；其余界面逻辑位于客户端。
 *
 * @author AI Development Team
 * @license MIT
 */

import { DirectionAdjustGateway, DIRECTION_ADJUST_MANIFEST } from './host/directionAdjust.js'

/** 插件名：同时是 cordis.patch.yml 中的稳定配置行 id。 */
export const name = 'smilexx-input-enhancer'

/** 插件描述：供插件列表与诊断界面展示。 */
export const description = '增强 DSH Web GUI 输入栏：分类命令菜单、Plan 模式按钮与实时调整方向'

export const inject = ['typert', 'agents']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis 上下文。
 */
export function apply(ctx) {
  new DirectionAdjustGateway(ctx)
  ctx.effect(
    () => ctx.typert.register(DIRECTION_ADJUST_MANIFEST),
    'smilexx-input-enhancer: 调整方向远程接口',
  )
}

export default { name, description, inject, apply }
