import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUGIN_ID, SETTINGS_NAMESPACE } from '../src/shared/settings-types.ts'
import { name } from '../src/index.ts'

const root = join(import.meta.dirname, '..')

describe('SmileXX 插件命名规范', () => {
  it('包、Host、Cordis 实例与设置命名空间统一使用 smilexx- 前缀', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }
    const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
    expect(pkg.name).toBe(PLUGIN_ID)
    expect(name).toBe(PLUGIN_ID)
    expect(patch).toContain(`- id: ${PLUGIN_ID}`)
    expect(SETTINGS_NAMESPACE).toBe(`${PLUGIN_ID}-settings`)
  })

  it('页签和样式派生标识继续使用完整插件 ID 前缀', () => {
    const client = readFileSync(join(root, 'src/client/index.ts'), 'utf8')
    const styles = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
    expect(client).toContain('`${PLUGIN_ID}-settings-tab`')
    expect(styles).toContain('[data-smilexx-notification-manager]')
    expect(styles).not.toContain('.nm-')
  })
})
