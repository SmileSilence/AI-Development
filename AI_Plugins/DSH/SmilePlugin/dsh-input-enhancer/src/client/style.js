/**
 * 单一全局样式注入。
 * 组件样式使用独立类名前缀（dsh-ie-*）与原生设计令牌（--dsw-*），
 * 跟随浅色/深色主题；重复注入由 style id 守卫。
 */

const STYLE_ID = 'dsh-input-enhancer-style'

const CSS = [
  // ── Codex 风格“调整方向”：折向箭头 + 文字，无常驻底色 ──────
  '.dsh-ie-direction-adjust{appearance:none;display:inline-flex;flex:none;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;height:28px;padding:4px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#737373);font:400 13px/20px inherit;white-space:nowrap;cursor:pointer;transition:color .12s ease,background-color .12s ease;}',
  '.dsh-ie-direction-adjust svg{display:block;flex:none;width:14px;height:14px;}',
  '.dsh-ie-direction-adjust:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#525252);}',
  '.dsh-ie-direction-adjust:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.1));}',
  '.dsh-ie-direction-adjust:focus-visible{outline:2px solid var(--dsw-alias-label-focus,#6b8afd);outline-offset:1px;}',
  '.dsh-ie-direction-adjust:disabled{opacity:.4;cursor:default;}',
  // ── Plan 按钮 ──────────────────────────────────────────────
  '.dsh-ie-plan-wrap{display:inline-flex;align-items:center;gap:6px;position:relative;}',
  '.dsh-ie-plan-chip{display:inline-flex;align-items:center;gap:4px;min-width:34px;padding:2px 8px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:13px;font-weight:500;line-height:20px;cursor:pointer;font-family:inherit;}',
  '.dsh-ie-plan-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.06));color:var(--dsw-alias-label-primary,#1a1a1a);}',
  '.dsh-ie-plan-chip:focus-visible{outline:2px solid var(--dsw-alias-label-focus,#4a78f0);outline-offset:2px;}',
  '.dsh-ie-plan-chip:disabled{opacity:0.6;cursor:default;}',
  // 激活态沿用原生 PlanChip：warn 态圆角、尺寸、关闭图标与主题令牌
  '.dsh-ie-plan-on{background:var(--dsw-alias-state-warn-tertiary,#fff3d1);color:var(--dsw-alias-state-warn-label,#8a5a00);}',
  '.dsh-ie-plan-on:hover:not(:disabled){color:var(--dsw-alias-state-warn-primary,#b45309);background:var(--dsw-alias-state-warn-tertiary,#fff3d1);}',
  '.dsh-ie-plan-on:focus-visible{outline-color:var(--dsw-alias-state-warn-label,#8a5a00);}',
  '.dsh-ie-plan-close{display:inline-flex;align-items:center;color:currentColor;}',
  '.dsh-ie-plan-error{color:var(--dsw-alias-state-error-primary,#d03050);font-size:12px;line-height:18px;}',
  '.dsh-ie-plan-notice{color:var(--dsw-alias-state-warn-primary,#b45309);font-size:12px;line-height:18px;}',
  // ── Plan 右键菜单：方框勾选 + 固定文本 ──────────────
  '.dsh-ie-plan-checkbox{display:inline-grid;place-items:center;width:14px;height:14px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-primary);background:transparent;}',
  '.dsh-ie-plan-checkbox[data-checked="true"]{border-color:var(--dsw-alias-label-primary);}',
  // ── 命令菜单表面（原生 MenuView 视觉基线）──────────────
  '.dsh-ie-menu{position:absolute;bottom:calc(100% + 4px);left:0;right:0;z-index:100;max-height:320px;overflow:hidden;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);padding:4px;display:flex;flex-direction:column;border:0;border-radius:20px;background:var(--dsw-specific-menu);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);}',
  '.dsh-ie-menu-viewport{display:flex;flex-direction:column;min-height:0;overflow-y:auto;overflow-anchor:none;}',
  '.dsh-ie-menu-item{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 10px;border:none;border-radius:10px;background:transparent;cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);text-align:left;font-family:inherit;}',
  '.dsh-ie-menu-item.dsh-ie-active{background:var(--dsw-alias-interactive-bg-hover);}',
  '.dsh-ie-menu-section{flex:none;min-height:26px;padding:6px 10px 2px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;line-height:18px;}',
  '.dsh-ie-menu-name{flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dsh-ie-menu-desc{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);}',
  '.dsh-ie-menu-trailing{flex:none;display:inline-flex;align-items:center;gap:4px;margin-left:auto;}',
  '.dsh-ie-menu-hint{display:none;padding:0 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-caption);font-size:11px;line-height:18px;font-family:inherit;}',
  '.dsh-ie-menu-item.dsh-ie-active .dsh-ie-menu-hint{display:inline-flex;}',
  '.dsh-ie-menu-drill{flex:none;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:4px;color:var(--dsw-alias-label-caption);}',
  '.dsh-ie-menu-drill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}',
  '.dsh-ie-menu-group-title{padding:8px 10px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary);}',
  '.dsh-ie-menu-skeleton-row{display:flex;align-items:center;box-sizing:border-box;min-height:40px;padding:8px 10px;}',
  '.dsh-ie-menu-skeleton-bar{height:20px;border-radius:4px;background:var(--dsw-alias-bg-skeleton);animation:dsh-ie-menu-skeleton 2s cubic-bezier(0.36,0,0.64,1) infinite;}',
  '@keyframes dsh-ie-menu-skeleton{0%{opacity:1}40%{opacity:0.6}80%,100%{opacity:1}}',
  '.dsh-ie-menu-crumbs{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:4px 4px 6px;margin-bottom:2px;border-bottom:0.5px solid var(--dsw-alias-border-l1);}',
  '.dsh-ie-menu-crumb{flex:0 1 auto;max-width:40%;overflow:hidden;padding:2px 6px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:inherit;font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap;}',
  '.dsh-ie-menu-crumb:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}',
  '.dsh-ie-menu-crumb-current,.dsh-ie-menu-crumb-current:hover{background:transparent;color:var(--dsw-alias-label-primary);cursor:default;}',
  '.dsh-ie-menu-crumb-sep{flex:none;display:inline-flex;color:var(--dsw-alias-label-caption);}',
  // 分类标题（模式/模型/权限/会话/其他）
  '.dsh-ie-cat-title{padding:8px 10px 4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary);}',
  '.dsh-ie-cat-title:not(:first-child){margin-top:4px;}',
].join('\n')

/** 注入一次全局样式；幂等。 */
export function injectStylesOnce() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
