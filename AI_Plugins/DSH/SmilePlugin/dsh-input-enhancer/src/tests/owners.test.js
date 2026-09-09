/**
 * 命令归属解析测试：三层优先级、运行时捕获、用户配置、fiber 链 entry 解析。
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_COMMAND_OWNERS,
  OWNERS_STORAGE_KEY,
  capturedOwners,
  entryLabelOf,
  noteCommandOwner,
  ownerOf,
  readConfiguredOwners,
} from '../client/menu/owners.js'

describe('ownerOf 三层优先级', () => {
  it('L2 内置默认表：rewind/undo 归 dsh-rewind-plugin', () => {
    expect(ownerOf('rewind')).toBe('dsh-rewind-plugin')
    expect(ownerOf('undo')).toBe('dsh-rewind-plugin')
  })
  it('L1 运行时捕获优先于 L2', () => {
    const captured = new Map([['undo', 'another-plugin']])
    expect(ownerOf('undo', { capturedOwners: captured })).toBe('another-plugin')
    expect(ownerOf('rewind', { capturedOwners: captured })).toBe('dsh-rewind-plugin')
  })
  it('L3 用户配置优先于 L1 与 L2', () => {
    const captured = new Map([['rewind', 'runtime-plugin']])
    expect(ownerOf('rewind', { configOwners: { rewind: 'user-plugin' }, capturedOwners: captured })).toBe('user-plugin')
  })
  it('未命中返回 null；非法输入返回 null', () => {
    expect(ownerOf('mystery')).toBe(null)
    expect(ownerOf('')).toBe(null)
    expect(ownerOf(undefined)).toBe(null)
  })
  it('默认表冻结（防意外篡改）', () => {
    expect(Object.isFrozen(DEFAULT_COMMAND_OWNERS)).toBe(true)
  })
})

describe('noteCommandOwner 运行时捕获', () => {
  it('先到先得：同名命令只记第一个来源', () => {
    noteCommandOwner('test-first-wins', 'plugin-a')
    noteCommandOwner('test-first-wins', 'plugin-b')
    expect(capturedOwners().get('test-first-wins')).toBe('plugin-a')
  })
  it('空名或空来源不记录', () => {
    noteCommandOwner('', 'plugin-a')
    noteCommandOwner('test-empty-owner', '')
    noteCommandOwner(undefined, 'plugin-a')
    expect(capturedOwners().has('test-empty-owner')).toBe(false)
    expect(capturedOwners().get('')).toBeUndefined()
  })
})

describe('readConfiguredOwners 用户配置', () => {
  function fakeStorage(raw) {
    return { getItem: () => raw }
  }
  it('解析合法 JSON 对象', () => {
    const owners = readConfiguredOwners(fakeStorage(JSON.stringify({ foo: '插件A', bar: '插件B' })))
    expect(owners).toEqual({ foo: '插件A', bar: '插件B' })
  })
  it('空值/非法 JSON/非对象一律回空表', () => {
    expect(readConfiguredOwners(fakeStorage(null))).toEqual({})
    expect(readConfiguredOwners(fakeStorage(''))).toEqual({})
    expect(readConfiguredOwners(fakeStorage('not-json'))).toEqual({})
    expect(readConfiguredOwners(fakeStorage('[1,2]'))).toEqual({})
    expect(readConfiguredOwners(fakeStorage('null'))).toEqual({})
  })
  it('非法键值对被过滤', () => {
    const owners = readConfiguredOwners(fakeStorage(JSON.stringify({ good: '插件', bad: 42, '': 'x' })))
    expect(owners).toEqual({ good: '插件' })
  })
  it('存储键名稳定', () => {
    expect(OWNERS_STORAGE_KEY).toBe('dsh-input-enhancer:commandOwners')
  })
})

describe('entryLabelOf fiber 链解析', () => {
  it('直接命中 fiber.entry.options.name', () => {
    const ctx = { fiber: { entry: { options: { name: 'dsh-some-plugin', id: 'e1' } }, parent: {} } }
    expect(entryLabelOf(ctx)).toBe('dsh-some-plugin')
  })
  it('name 缺失时回退 entry.options.id', () => {
    const ctx = { fiber: { entry: { options: { id: 'entry-9' } }, parent: {} } }
    expect(entryLabelOf(ctx)).toBe('entry-9')
  })
  it('影子 ctx：沿 parent.fiber 上溯找到 entry', () => {
    const ownerFiber = { entry: { options: { name: 'dsh-caller' } }, parent: {} }
    const childFiber = { entry: undefined, parent: { fiber: ownerFiber } }
    expect(entryLabelOf({ fiber: childFiber })).toBe('dsh-caller')
  })
  it('链上无 entry 返回 null', () => {
    const root = { entry: undefined, parent: {} }
    root.parent.fiber = root
    expect(entryLabelOf({ fiber: { entry: undefined, parent: { fiber: root } } })).toBe(null)
    expect(entryLabelOf({ fiber: undefined })).toBe(null)
    expect(entryLabelOf(undefined)).toBe(null)
  })
  it('entry 异常不抛出', () => {
    const hostile = { get entry() { throw new Error('boom') }, parent: {} }
    expect(entryLabelOf({ fiber: hostile })).toBe(null)
  })
})
