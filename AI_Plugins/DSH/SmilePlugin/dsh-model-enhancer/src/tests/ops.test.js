import { describe, it, expect } from 'vitest'
import { readProviderModels, buildModelInputOp, foldWriteResponse } from '../client/ops.js'

const NAMESPACE = {
  ns: 'llm-pi-ai',
  revision: 7,
  value: { providers: { 'ark-code': { baseURL: 'https://ark.example/v3' } } },
  user: {
    providers: {
      'ark-code': {
        displayName: '火山CP',
        models: [
          { id: 'glm-5.3-flash', name: 'glm-5.3-flash' },
          { id: 'deepseek-v4-1-flash-260910', name: 'deepseek-v4-1-flash', contextWindow: 262144 },
        ],
      },
    },
  },
}

describe('readProviderModels', () => {
  it('读用户层 models 与 revision', () => {
    const { models, revision } = readProviderModels(NAMESPACE, 'ark-code')
    expect(revision).toBe(7)
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('glm-5.3-flash')
  })
  it('provider 不存在或无 models 时 models 为 undefined', () => {
    expect(readProviderModels(NAMESPACE, 'nope').models).toBeUndefined()
    expect(readProviderModels({ user: { providers: { a: {} } } }, 'a').models).toBeUndefined()
    expect(readProviderModels(undefined, 'a').models).toBeUndefined()
    expect(readProviderModels({ user: {} }, 'a').models).toBeUndefined()
  })
})

describe('buildModelInputOp', () => {
  it('勾选：目标条目置 input [text,image]，其余原样保留', () => {
    const op = buildModelInputOp(NAMESPACE.user.providers['ark-code'].models, 'ark-code', 'glm-5.3-flash', true)
    expect(op.op).toBe('set')
    expect(op.path).toEqual(['providers', 'ark-code', 'models'])
    expect(op.value[0]).toEqual({ id: 'glm-5.3-flash', name: 'glm-5.3-flash', input: ['text', 'image'] })
    expect(op.value[1]).toBe(NAMESPACE.user.providers['ark-code'].models[1])
  })
  it('取消：删除 input 字段，其他字段保留', () => {
    const models = [{ id: 'a', input: ['text', 'image'], contextWindow: 1000 }]
    const op = buildModelInputOp(models, 'p', 'a', false)
    expect(op.value[0]).toEqual({ id: 'a', contextWindow: 1000 })
    expect('input' in op.value[0]).toBe(false)
  })
  it('找不到目标模型返回 undefined', () => {
    expect(buildModelInputOp(NAMESPACE.user.providers['ark-code'].models, 'ark-code', 'nope', true)).toBeUndefined()
  })
  it('不改入参数组（浅拷贝目标条目）', () => {
    const models = NAMESPACE.user.providers['ark-code'].models
    buildModelInputOp(models, 'ark-code', 'glm-5.3-flash', true)
    expect('input' in models[0]).toBe(false)
  })
})

describe('foldWriteResponse', () => {
  it('成功折叠出新 revision', () => {
    expect(foldWriteResponse({ ok: true, value: { revision: 8 } })).toEqual({ kind: 'written', revision: 8 })
    expect(foldWriteResponse({ ok: true })).toEqual({ kind: 'written', revision: undefined })
  })
  it('冲突单独归类', () => {
    expect(foldWriteResponse({ ok: false, error: { code: 'settings/conflict', message: 'x' } }).kind).toBe('conflict')
  })
  it('其他拒绝透传宿主诊断', () => {
    const outcome = foldWriteResponse({ ok: false, error: { code: 'settings/rejected', message: 'bad' } })
    expect(outcome).toEqual({ kind: 'refused', message: 'bad' })
  })
})
