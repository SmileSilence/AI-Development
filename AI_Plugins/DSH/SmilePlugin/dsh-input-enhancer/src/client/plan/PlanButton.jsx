/**
 * Plan 模式按钮：位于权限选择器右侧的 conversation.input.plan 席位。
 *
 * 状态机（界面跟随原生 plan 投影，本地只记录提交中/错误/自动应用控制信息）：
 * - 未启用：中性色 Plan，透明背景，无关闭图标；左键开启当前会话 Plan。
 * - 单次启用：原生黄色 Plan ×；左键退出当前会话 Plan。
 * - 常驻启用：与单次启用相同外观；左键退出当前会话 Plan 并关闭常驻。
 *
 * 右键菜单复用原生 Menu（side=top / align=start / portal=true），仅一个开关项
 * 「默认 Plan」：icon 槽渲染方框勾选（勾选态显示 √，未勾选空框），右侧文本位置固定。
 * 常驻值持久化到同源 LocalStorage：本页写入经 preference 本地通知即时回填状态，
 * 跨标签页走 storage 事件。
 *
 * 防竞态：locked / 原生 pending / 请求在途期间阻止相反请求；命令失败保留真实状态
 * 并显示中文错误，可重试且不无限重试；会话切换与卸载通过代次与活标记隔离旧回调。
 */
import { useEffect, useRef, useState } from 'react'
import { IconCheckOutline16, IconCloseFill14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { PREFERENCE_KEY, readPreference, subscribePreferenceSync, writePreference } from './preference.js'

/** 右键菜单中常驻选项的行 id。 */
const PERSISTENT_ITEM_ID = 'default-plan'

/** 描述一次 /plan 命令提交的结果（由组件持有，不属于原生状态）。 */
function describeFailure(result) {
  if (result && !result.ok) {
    const error = result.error || {}
    const message = error.message || error.code || '未知错误'
    return error.code && error.code !== message ? `命令失败：${message} (${error.code})` : `命令失败：${message}`
  }
  if (result && result.value === undefined) return '未知命令：/plan 未返回有效结果'
  return null
}

/**
 * Plan 按钮组件。组合属性：标准套件（sessionId/useProjection/useSession）+ 所有者 locked
 * + 注入面 execute（按会话绑定 remote.commands.execute 闭包）。
 */
export function PlanButton({ useProjection, useSession, sessionId, locked, execute }) {
  // 原生有效目标：pending 时以目标为准（native PlanChip 算法）
  const plan = useProjection('plan')
  const session = useSession ? useSession((snap) => snap) : undefined
  const effective = plan !== undefined ? (plan.pending ? !plan.active : plan.active) : false
  const nativePending = plan !== undefined && plan.pending === true

  const [persistent, setPersistent] = useState(() => readPreference())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)          // 命令失败（手动/自动共用）
  const [autoError, setAutoError] = useState(null)  // 自动开启失败提示
  const [notice, setNotice] = useState(null)        // 存储失败等非命令提示
  const [menuOpen, setMenuOpen] = useState(false)

  // 隔离旧异步回调：会话代次 + 卸载标记
  const aliveRef = useRef(true)
  const epochRef = useRef(0)

  // 自动应用控制：按会话记录已发起/本停留不重开
  const appliedRef = useRef(new Set())
  const noReapplyRef = useRef(new Set())
  const cancelAutoRef = useRef(false)
  const prevEffectiveRef = useRef(false)
  const lastSessionRef = useRef(sessionId)

  useEffect(() => {
    aliveRef.current = true
    const unsub = subscribePreferenceSync(() => setPersistent(readPreference()))
    return () => {
      aliveRef.current = false
      unsub()
    }
  }, [])

  // 会话切换：提升代次，清理本会话相关 UI 状态
  useEffect(() => {
    if (lastSessionRef.current !== sessionId) {
      epochRef.current += 1
      lastSessionRef.current = sessionId
      cancelAutoRef.current = true
      setError(null)
      setAutoError(null)
      setMenuOpen(false)
    }
  }, [sessionId])

  // 观察有效目标：一旦本会话内 Plan 被任何入口关闭，本次停留不自动重开
  useEffect(() => {
    const prev = prevEffectiveRef.current
    prevEffectiveRef.current = effective
    if (prev === true && effective === false && sessionId !== undefined) {
      noReapplyRef.current.add(sessionId)
    }
  }, [effective, sessionId])

  /**
   * 提交一行 /plan 命令；提交中锁定按钮，竞态由 run 内部代次守卫。
   * @param {'/plan'|'/plan off'} line - 命令行。
   * @param {{auto?: boolean}} [options] - auto=true 时失败进入自动错误提示。
   */
  const run = async (line, options = {}) => {
    if (!execute || sessionId === undefined) return
    const epoch = epochRef.current
    if (!options.auto) setBusy(true)
    setError(null)
    if (options.auto) setAutoError(null)
    try {
      const result = await execute(line)
      if (!aliveRef.current || epochRef.current !== epoch) return
      const failure = describeFailure(result)
      if (failure !== null) {
        if (options.auto) setAutoError(failure)
        else setError(failure)
      }
    } catch (reason) {
      if (!aliveRef.current || epochRef.current !== epoch) return
      const message = reason instanceof Error ? reason.message : String(reason)
      if (options.auto) setAutoError(message)
      else setError(message)
    } finally {
      if (aliveRef.current && epochRef.current === epoch && !options.auto) setBusy(false)
    }
  }

  // 自动应用：常驻开启、加载完成、未锁定、无 pending、无在途请求时，每会话最多发起一次。
  // 先记录意图，随后在微任务中复核（可撤销尚未发送的自动任务）。
  useEffect(() => {
    if (!persistent) return
    if (sessionId === undefined) return
    if (plan === undefined) return            // 会话未加载完成
    if (locked) return
    if (nativePending) return
    if (session !== undefined && session.running) return  // 有在途请求
    if (effective) { appliedRef.current.add(sessionId); return }
    if (appliedRef.current.has(sessionId)) return      // 本激活周期已发起
    if (noReapplyRef.current.has(sessionId)) return    // 本停留用户已关闭过
    appliedRef.current.add(sessionId)
    const epoch = epochRef.current
    const mySession = sessionId
    cancelAutoRef.current = false
    queueMicrotask(() => {
      if (!aliveRef.current) return
      if (epochRef.current !== epoch) return
      if (cancelAutoRef.current || noReapplyRef.current.has(mySession)) {
        appliedRef.current.delete(mySession)
        return
      }
      void run('/plan', { auto: true })
    })
  }, [
    persistent, locked, nativePending,
    plan !== undefined, plan ? plan.active : undefined, plan ? plan.pending : undefined,
    session ? session.running : undefined,
    sessionId,
  ])

  /** 左键：切换当前会话 Plan（常驻启用时先关闭常驻并撤销未发送的自动任务，再提交退出）。 */
  const handleToggle = () => {
    if (locked || busy) return
    setMenuOpen(false)
    cancelAutoRef.current = true
    if (effective) {
      if (persistent) {
        if (!writePreference(false)) setNotice('常驻偏好未持久化（浏览器存储不可用）')
      }
      if (sessionId !== undefined) noReapplyRef.current.add(sessionId)
      void run('/plan off')
    } else {
      setError(null)
      void run('/plan')
    }
  }

  /** 右键：阻止浏览器默认菜单并弹出常驻设置（锁定时不打开）。打开前从存储兜底刷新状态。 */
  const handleContextMenu = (event) => {
    event.preventDefault()
    if (locked || busy) { setMenuOpen(false); return }
    setPersistent(readPreference())
    setMenuOpen(value => !value)
  }

  /** 勾选/取消勾选“√ 默认 Plan”。写入成功后显式回填状态（preference 本地通知为双保险）。 */
  const handlePersistentSelect = () => {
    const next = !persistent
    setMenuOpen(false)
    if (next) {
      const ok = writePreference(true)
      if (!ok) {
        setNotice('常驻偏好未持久化（浏览器存储不可用）')
        return
      }
      setPersistent(true)
      setNotice(null)
      // 勾选即保存偏好，并在允许操作时开启当前会话（保持用户意图）
      if (!effective && !locked && !busy && sessionId !== undefined) void run('/plan')
    } else {
      // 取消勾选只关闭后续自动开启，保留当前会话模式
      writePreference(false)
      setPersistent(false)
      cancelAutoRef.current = true
      noReapplyRef.current.add(sessionId)
      setNotice(null)
    }
  }

  const disabled = locked || busy || nativePending
  const title = error || notice || autoError
    || (effective ? '退出当前会话 Plan 模式（关闭常驻时同时取消常驻）' : '开启当前会话 Plan 模式（等同 /plan）')

  return (
    <span className="dsh-ie-plan-wrap" onContextMenu={handleContextMenu}>
      <Menu
        open={menuOpen}
        side="top"
        align="start"
        portal
        items={[{
          id: PERSISTENT_ITEM_ID,
          label: '默认 Plan',
          // 方框勾选：icon 槽固定 16px，两态都渲染，文本位置恒定
          icon: (
            <span className="dsh-ie-plan-checkbox" data-testid="plan-checkbox" data-checked={persistent ? 'true' : 'false'} aria-hidden>
              {persistent && <IconCheckOutline16 size={12} />}
            </span>
          ),
        }]}
        onSelect={handlePersistentSelect}
        onClose={() => setMenuOpen(false)}
        anchor={(
          <button
            type="button"
            className={'dsh-ie-plan-chip' + (effective ? ' dsh-ie-plan-on' : '')}
            disabled={disabled}
            onClick={handleToggle}
            aria-label={title}
            aria-expanded={menuOpen}
            title={title}
            data-plan-button=""
          >
            <span>Plan</span>
            {effective && (
              <span className="dsh-ie-plan-close" aria-hidden>
                <IconCloseFill14 size={12} />
              </span>
            )}
          </button>
        )}
      />
      {error !== null && <span className="dsh-ie-plan-error" role="status" title={error}>{error}</span>}
      {autoError !== null && (
        <span className="dsh-ie-plan-error" role="status">
          自动开启失败：{autoError}（点击 Plan 手动重试）
        </span>
      )}
      {notice !== null && <span className="dsh-ie-plan-notice" role="status" title={notice}>{notice}</span>}
    </span>
  )
}