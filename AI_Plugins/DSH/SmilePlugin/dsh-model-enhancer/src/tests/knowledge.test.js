import { describe, it, expect } from 'vitest'
import { judgeModelVision, VERDICT } from '../client/knowledge.js'

describe('judgeModelVision', () => {
  it('已知多模态：glm-5 系列', () => {
    expect(judgeModelVision('glm-5.3-flash').verdict).toBe(VERDICT.MULTIMODAL)
    expect(judgeModelVision('GLM-5-Flash').verdict).toBe(VERDICT.MULTIMODAL)
  })
  it('已知多模态：其他厂商常见命名', () => {
    for (const id of ['qwen2.5-vl-72b', 'gpt-4o-mini', 'claude-sonnet-4-5', 'gemini-2.5-flash', 'doubao-seed-1-6-vision', 'deepseek-vl2']) {
      expect(judgeModelVision(id).verdict, id).toBe(VERDICT.MULTIMODAL)
    }
  })
  it('已知纯文本：deepseek 官方线', () => {
    for (const id of ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-1-flash-260910', 'DeepSeek-R1']) {
      expect(judgeModelVision(id).verdict, id).toBe(VERDICT.TEXT_ONLY)
    }
  })
  it('纯文本表优先于多模态表（glm-4-flash 不是 4V）', () => {
    expect(judgeModelVision('glm-4-flash').verdict).toBe(VERDICT.TEXT_ONLY)
    expect(judgeModelVision('glm-4v-flash').verdict).toBe(VERDICT.MULTIMODAL)
  })
  it('未知：方舟接入点与陌生 id', () => {
    expect(judgeModelVision('ep-20250916').verdict).toBe(VERDICT.UNKNOWN)
    expect(judgeModelVision('some-unknown-model').verdict).toBe(VERDICT.UNKNOWN)
    expect(judgeModelVision('').verdict).toBe(VERDICT.UNKNOWN)
    expect(judgeModelVision(undefined).verdict).toBe(VERDICT.UNKNOWN)
  })
  it('提示文案非空', () => {
    for (const id of ['glm-5.3-flash', 'deepseek-chat', 'ep-123']) {
      expect(judgeModelVision(id).hint.length).toBeGreaterThan(0)
    }
  })
})
