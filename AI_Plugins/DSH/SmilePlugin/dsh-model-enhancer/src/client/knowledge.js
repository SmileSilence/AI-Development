/**
 * 多模态知识库：按模型 id 匹配已知的图片输入能力，仅用于界面建议，
 * 不参与任何自动写配置。
 */

/** 能力判定结论。 */
export const VERDICT = {
  /** 知识库判定支持图片输入。 */
  MULTIMODAL: 'multimodal',
  /** 知识库判定纯文本。 */
  TEXT_ONLY: 'text-only',
  /** 知识库未收录。 */
  UNKNOWN: 'unknown',
}

/**
 * 已知多模态模型 id 片段（大小写不敏感）。片段按"特征够独特"取舍：
 * 避免过宽误报（如裸 `glm` 会命中纯文本变体），避免过窄漏报。
 * 命中即建议勾选；各厂商命名规则见各条目注释。
 */
const MULTIMODAL_PATTERNS = [
  'glm-4v', // 智谱 4V 系列
  'glm-5', // 智谱 5 系列（含 flash 变体）全系多模态
  'qwen-vl', // 通义千问视觉
  'qwen2-vl',
  'qwen2.5-vl',
  'qvq', // 千问推理视觉
  'gpt-4o', // OpenAI 4o 全系
  'gpt-4.1', // OpenAI 4.1 全系
  'gpt-5', // OpenAI 5 全系
  'chatgpt-4o',
  'o3', // OpenAI o3 视觉推理
  'o4-mini',
  'claude-3', // Anthropic 3 全系（3/3.5/3.7）
  'claude-4', // Anthropic 4 全系
  'claude-opus',
  'claude-sonnet',
  'claude-haiku',
  'gemini-1.5',
  'gemini-2', // gemini-2.x 全系
  'gemini-exp',
  'gemini-flash',
  'gemini-pro',
  'doubao-1.5-vision',
  'doubao-seed-1.6', // 豆包 1.6 全系多模态
  'doubao-seed-1-6', // 方舟命名横线变体
  'doubao-vision',
  'deepseek-vl', // DeepSeek 视觉线
  'kimi-vision',
  'moonshot-v1-8k-vision',
  'moonshot-v1-32k-vision',
  'moonshot-v1-128k-vision',
  'pixtral',
  'llama-3.2-11b-vision',
  'llama-3.2-90b-vision',
  'llama-4', // Llama 4 全系原生多模态
  'internvl',
  'grok-4', // Grok 4 多模态
  'grok-2-vision',
  'step-1v', // 阶跃星辰视觉
  'step-3', // 阶跃 3 多模态
  'hunyuan-vision',
  'ERNIE-4.5', // 文心 4.5 多模态（含 ERNIE-4.5-VL）
]

/**
 * 已知纯文本模型 id 片段。命中即建议不勾选；优先级高于多模态表，
 * 防止宽片段误伤窄反例。
 */
const TEXT_ONLY_PATTERNS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-r1',
  'deepseek-v3',
  'deepseek-v4', // DeepSeek 4 系纯文本（含 v4-1 变体；VL 线归多模态表）
  'glm-4-flash', // 智谱 4 系纯文本变体（4V 才多模态）
  'glm-4-air',
  'glm-4-long',
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
  'minimax-text',
  'kimi-k2', // Kimi K2 纯文本
]

/**
 * 判定一个模型 id 的已知图片输入能力。
 * @param {string} modelId - 模型 id（如 `glm-5.3-flash`、`ep-2025xxx`）。
 * @returns {{ verdict: string, hint: string }} 结论与界面提示文案（中文）。
 */
export function judgeModelVision(modelId) {
  const id = typeof modelId === 'string' ? modelId.toLowerCase() : ''
  if (id.length === 0) return { verdict: VERDICT.UNKNOWN, hint: '未知' }
  // 纯文本表优先：窄反例压过宽命中。
  if (TEXT_ONLY_PATTERNS.some(pattern => id.includes(pattern.toLowerCase()))) {
    return { verdict: VERDICT.TEXT_ONLY, hint: '已知纯文本' }
  }
  if (MULTIMODAL_PATTERNS.some(pattern => id.includes(pattern.toLowerCase()))) {
    return { verdict: VERDICT.MULTIMODAL, hint: '已知多模态' }
  }
  // 方舟接入点 id（ep-）不透露模型身份，只能标未知。
  return { verdict: VERDICT.UNKNOWN, hint: '未知' }
}
