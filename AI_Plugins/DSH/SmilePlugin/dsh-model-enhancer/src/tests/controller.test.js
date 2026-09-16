import { describe, it, expect } from 'vitest'
import { ModelEnhancerController } from '../client/controller.js'
import { judgeModelVision, VERDICT } from '../client/knowledge.js'
import {
  providerIdOfCard, modelIdOfEntry, entryOfAdvanced, declaredImageInput, createCapabilityNode,
} from '../client/dom.js'

/** 按官方 ModelListEditor 的 DOM 结构搭一棵最小树。 */
function buildSettingsDom() {
  document.body.innerHTML = ''
  const card = document.createElement('div')
  card.className = 'abcd1234_editor'
  const title = document.createElement('span')
  title.className = 'abcd1234_editorTitle'
  title.textContent = '火山CP（Pro）'
  const route = document.createElement('span')
  route.className = 'abcd1234_editorRoute'
  route.textContent = 'ark-code'
  const advanced = document.createElement('div')
  advanced.className = 'abcd1234_modelAdvanced'
  const contextLabel = document.createElement('label')
  contextLabel.className = 'abcd1234_modelField'
  const contextInput = document.createElement('input')
  contextInput.type = 'text'
  contextLabel.append(contextInput)
  advanced.append(contextLabel)
  const entry = document.createElement('div')
  entry.className = 'abcd1234_modelEntry'
  const row = document.createElement('div')
  row.className = 'abcd1234_modelRow'
  const idInput = document.createElement('input')
  idInput.type = 'text'
  idInput.value = 'glm-5.3-flash'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  const toggle = document.createElement('button')
  toggle.setAttribute('aria-label', '容量 1')
  toggle.setAttribute('aria-expanded', 'true')
  row.append(idInput, nameInput, toggle)
  entry.append(row, advanced)
  card.append(title, route, entry)
  document.body.append(card)
  return { card, entry, advanced, idInput }
}

const NAMESPACE = {
  ns: 'llm-pi-ai',
  revision: 3,
  user: { providers: { 'ark-code': { models: [{ id: 'glm-5.3-flash', name: 'x' }] } } },
}

describe('controller：扫描注入与状态', () => {
  it('扫描后展开区出现勾选节点，初始状态读自声明', () => {
    const { advanced } = buildSettingsDom()
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => ({ ok: true, value: { revision: 4 } }),
    })
    controller.scan(document.body)
    const node = advanced.querySelector('.smilexx-model-enhancer-capability')
    expect(node).not.toBeNull()
    const checkbox = node.querySelector('input[type="checkbox"]')
    expect(checkbox.checked).toBe(false)
    // 重复扫描不重复注入
    controller.scan(document.body)
    expect(advanced.querySelectorAll('.smilexx-model-enhancer-capability')).toHaveLength(1)
  })
  it('勾选进 pending，保存提交 mutate，pending 清空', async () => {
    buildSettingsDom()
    const mutations = []
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async (ns, ops, revision) => {
        mutations.push({ ns, ops, revision })
        return { ok: true, value: { revision: 4 } }
      },
    })
    controller.scan(document.body)
    const node = document.querySelector('.smilexx-model-enhancer-capability')
    node.querySelector('input[type="checkbox"]').click()
    expect(controller.pending.size).toBe(1)
    const failure = await controller.commitPending()
    expect(failure).toBeUndefined()
    expect(mutations).toHaveLength(1)
    expect(mutations[0].ns).toBe('llm-pi-ai')
    expect(mutations[0].revision).toBe(3)
    expect(mutations[0].ops[0].op).toBe('set')
    expect(mutations[0].ops[0].path).toEqual(['providers', 'ark-code', 'models'])
    expect(mutations[0].ops[0].value[0].input).toEqual(['text', 'image'])
    expect(controller.pending.size).toBe(0)
  })
  it('取消丢弃 pending', () => {
    buildSettingsDom()
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => ({ ok: true, value: { revision: 4 } }),
    })
    controller.setPending('ark-code', 'glm-5.3-flash', true)
    controller.discardPending()
    expect(controller.pending.size).toBe(0)
    expect(controller.effectiveChecked('ark-code', 'glm-5.3-flash')).toBe(false)
  })
  it('冲突时重读重试一次', async () => {
    buildSettingsDom()
    let calls = 0
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => {
        calls += 1
        return calls === 1
          ? { ok: false, error: { code: 'settings/conflict', message: 'stale' } }
          : { ok: true, value: { revision: 9 } }
      },
    })
    controller.setPending('ark-code', 'glm-5.3-flash', true)
    const failure = await controller.commitPending()
    expect(failure).toBeUndefined()
    expect(calls).toBe(2)
  })
  it('模型不在用户层时报错且不静默', async () => {
    buildSettingsDom()
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => ({ ok: true, value: { revision: 4 } }),
    })
    controller.setPending('ark-code', 'ghost-model', true)
    const failure = await controller.commitPending()
    expect(failure).toContain('ghost-model')
  })
  it('dispose 移除注入节点并断开观察', () => {
    const { advanced } = buildSettingsDom()
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => ({ ok: true, value: { revision: 4 } }),
    })
    controller.scan(document.body)
    controller.dispose()
    expect(advanced.querySelector('.smilexx-model-enhancer-capability')).toBeNull()
  })
})

describe('dom 定位', () => {
  it('providerIdOfCard 优先路由 id，兜底标题', () => {
    const { card } = buildSettingsDom()
    expect(providerIdOfCard(card)).toBe('ark-code')
    const route = card.querySelector('[class*="_editorRoute"]')
    route.remove()
    expect(providerIdOfCard(card)).toBe('火山CP（Pro）')
  })
  it('modelIdOfEntry 取行首输入框', () => {
    const { entry } = buildSettingsDom()
    expect(modelIdOfEntry(entry)).toBe('glm-5.3-flash')
  })
  it('entryOfAdvanced 向上找 modelEntry', () => {
    const { entry, advanced } = buildSettingsDom()
    expect(entryOfAdvanced(advanced)).toBe(entry)
  })
  it('declaredImageInput 判定声明值', () => {
    const models = [{ id: 'a', input: ['text', 'image'] }, { id: 'b' }]
    expect(declaredImageInput(models, 'a')).toBe(true)
    expect(declaredImageInput(models, 'b')).toBe(false)
    expect(declaredImageInput(undefined, 'a')).toBe(false)
  })
  it('createCapabilityNode 交互回调', () => {
    let next
    const node = createCapabilityNode({
      checked: false, hint: '已知多模态', hintVerdict: VERDICT.MULTIMODAL,
      onChange: (checked) => { next = checked },
    })
    const checkbox = node.querySelector('input[type="checkbox"]')
    // jsdom 中 change 事件在 click 处理器返回后才派发，同步断言走直接翻转。
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    expect(next).toBe(true)
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    expect(next).toBe(false)
  })
})

describe('knowledge 与注入联动', () => {
  it('注入节点显示知识库提示', () => {
    const { advanced, idInput } = buildSettingsDom()
    idInput.value = 'deepseek-chat'
    const controller = new ModelEnhancerController({
      readNamespace: () => NAMESPACE,
      mutate: async () => ({ ok: true, value: { revision: 4 } }),
    })
    controller.scan(document.body)
    const hint = advanced.querySelector('[class*="smilexx-model-enhancer-hint-"]')
    expect(hint.textContent).toBe(judgeModelVision('deepseek-chat').hint)
  })
})
