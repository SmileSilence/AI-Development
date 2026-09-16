/**
 * 注入复选框与提示的界面样式。全部类名以 `smilexx-model-enhancer-` 前缀
 * 隔离；颜色走 DSH 的 CSS 变量（--dsw-alias-*），亮暗主题自动适配。
 */

export const STYLE_ID = 'smilexx-model-enhancer-styles'

export const STYLE_TEXT = `
.smilexx-model-enhancer-capability {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.smilexx-model-enhancer-capability-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.smilexx-model-enhancer-checkbox {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary, #4b6bfb);
  cursor: pointer;
}

.smilexx-model-enhancer-checkbox:disabled {
  cursor: default;
}

.smilexx-model-enhancer-label {
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  user-select: none;
}

.smilexx-model-enhancer-hint {
  color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 12px;
  line-height: 18px;
}

.smilexx-model-enhancer-hint-multimodal {
  color: var(--dsw-alias-state-success-primary, #2e9e5b);
}

.smilexx-model-enhancer-hint-text-only {
  color: var(--dsw-alias-label-tertiary, inherit);
}

.smilexx-model-enhancer-hint-unknown {
  color: var(--dsw-alias-label-tertiary, inherit);
}

.smilexx-model-enhancer-error {
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: 12px;
  line-height: 18px;
  grid-column: 1 / -1;
}
`

/**
 * 幂等注入样式表（<style>，重复激活只装一次）。
 * @returns {void}
 */
export function injectStylesOnce() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.append(style)
}
