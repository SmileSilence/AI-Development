/**
 * AutoContextHandler - 自动上下文分段处理器
 * 用于检测上下文超限并智能分段处理长文本任务
 */

class AutoContextHandler {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 4000;
    this.chunkSize = options.chunkSize || 1500;
    this.verbose = options.verbose || false;
  }

  /**
   * 估算文本 token 数量
   */
  estimateTokens(text) {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    const chineseTokens = chineseChars * 0.15;
    const englishTokens = englishWords * 1.25;
    const otherTokens = otherChars * 0.25;
    
    return Math.round(chineseTokens + englishTokens + otherTokens);
  }

  /**
   * 检测内容是否超限
   */
  detectOverflow(content) {
    const estimatedTokens = this.estimateTokens(content);
    const ratio = estimatedTokens / this.maxTokens;
    
    let severity = 'none';
    if (ratio > 1) severity = 'mild';
    if (ratio > 1.5) severity = 'moderate';
    if (ratio > 2) severity = 'severe';
    if (ratio > 3) severity = 'critical';
    
    return {
      overflow: estimatedTokens > this.maxTokens,
      currentTokens: estimatedTokens,
      maxTokens: this.maxTokens,
      overflowRatio: ratio,
      safe: estimatedTokens <= this.maxTokens * 0.8,
      needsSplit: estimatedTokens > this.maxTokens,
      severity
    };
  }

  /**
   * 检测内容类型
   */
  detectContentType(content) {
    if (this.isCode(content)) return 'code';
    if (this.isMarkdown(content)) return 'markdown';
    if (this.isDocumentation(content)) return 'documentation';
    if (this.isBook(content)) return 'book';
    return 'general';
  }

  isCode(content) {
    const patterns = [
      /function\s+\w+/, /class\s+\w+/, /def\s+\w+/,
      /var\s+\w+/, /const\s+\w+/, /let\s+\w+/,
      /=>/g, /;/g
    ];
    return patterns.some(p => p.test(content));
  }

  isMarkdown(content) {
    const patterns = [
      /^#{1,6}\s+/gm, /^[-*+]\s+/gm, /^\d+\.\s+/gm,
      /\[.*\]\(.*\)/g, /```/g
    ];
    return patterns.some(p => p.test(content));
  }

  isDocumentation(content) {
    return /第[一二三四五六七八九十百千万]+章/.test(content) ||
           /Chapter\s+\d+/.test(content) ||
           /Section\s+\d+/.test(content);
  }

  isBook(content) {
    return content.length > 5000 &&
           (content.includes('。') || content.includes('！')) &&
           content.split(/\n/).length > 20;
  }

  /**
   * 智能分段
   */
  splitContent(content, strategy = 'intelligent') {
    if (strategy === 'size') return this.sizeBasedSplit(content);
    if (strategy === 'semantic') return this.semanticSplit(content);
    
    const contentType = this.detectContentType(content);
    if (this.verbose) console.log(`内容类型：${contentType}`);
    
    switch (contentType) {
      case 'code': return this.splitCode(content);
      case 'markdown': return this.splitMarkdown(content);
      case 'documentation': return this.splitDocumentation(content);
      case 'book': return this.splitBook(content);
      default: return this.semanticSplit(content);
    }
  }

  /**
   * 基于大小的分段
   */
  sizeBasedSplit(content) {
    const chunks = [];
    let currentChunk = '';
    const sentences = content.split(/[.!?。！？]/).filter(s => s.trim());
    
    for (const sentence of sentences) {
      if (currentChunk && this.estimateTokens(currentChunk + ' ' + sentence) > this.chunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  /**
   * 基于语义的分段
   */
  semanticSplit(content) {
    const chunks = [];
    let currentChunk = '';
    const paragraphs = content.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      if (currentChunk && this.estimateTokens(currentChunk + '\n\n' + paragraph) > this.chunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  /**
   * 分割代码
   */
  splitCode(content) {
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      if (currentChunk && this.estimateTokens(currentChunk + '\n' + line) > this.chunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  /**
   * 分割 Markdown
   */
  splitMarkdown(content) {
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      const isHeading = /^#{1,6}\s+/.test(line);
      
      if (isHeading && currentChunk && this.estimateTokens(currentChunk + '\n\n' + line) > this.chunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  splitDocumentation(content) {
    return this.semanticSplit(content);
  }

  splitBook(content) {
    return this.semanticSplit(content);
  }

  /**
   * 创建处理提示词
   */
  createPrompt(chunk, taskType, index, total) {
    const basePrompt = `请处理以下内容（分段 ${index}/${total}）：\n\n${chunk}`;
    
    switch (taskType) {
      case 'analysis':
        return `${basePrompt}\n\n请分析这段内容的主要观点、关键信息和建议。`;
      case 'coding':
        return `${basePrompt}\n\n请分析这段代码的功能、潜在问题和改进建议。`;
      case 'research':
        return `${basePrompt}\n\n请研究这段内容中的关键概念和相关信息。`;
      case 'writing':
        return `${basePrompt}\n\n请优化这段内容的表达和结构。`;
      case 'summary':
        return `${basePrompt}\n\n请总结这段内容的核心要点。`;
      default:
        return basePrompt;
    }
  }

  /**
   * 处理单个分段
   */
  async processChunk(prompt, chunk) {
    return {
      chunk: chunk,
      prompt: prompt,
      result: `处理结果：${chunk.substring(0, 100)}...`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 直接处理
   */
  async processDirectly(content, taskType) {
    const prompt = this.createPrompt(content, taskType, 1, 1);
    const result = await this.processChunk(prompt, content);
    return {
      success: true,
      needsSplit: false,
      chunks: [content],
      results: [result],
      mergedResult: result
    };
  }

  /**
   * 合并结果
   */
  mergeResults(results) {
    const mergedContent = results.map(r => r.result).join('\n\n');
    return {
      totalChunks: results.length,
      mergedContent,
      processingTime: results.length * 2,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 自动处理流程
   */
  async autoProcess(content, options = {}) {
    const {
      strategy = 'intelligent',
      taskType = 'analysis'
    } = options;

    if (this.verbose) {
      console.log('=== 自动上下文处理 ===');
      console.log('输入长度：', content.length);
      console.log('策略：', strategy);
      console.log('任务类型：', taskType);
    }

    const contentCheck = this.detectOverflow(content);
    
    if (this.verbose) {
      console.log('上下文检测结果：', contentCheck);
    }

    if (!contentCheck.needsSplit) {
      if (this.verbose) console.log('内容未超限，直接处理');
      return await this.processDirectly(content, taskType);
    }

    if (this.verbose) console.log('内容超限，开始智能分段');
    
    const chunks = this.splitContent(content, strategy);
    
    if (this.verbose) {
      console.log(`分段完成，共 ${chunks.length} 个分段`);
    }

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = this.createPrompt(chunk, taskType, i + 1, chunks.length);
      
      if (this.verbose) {
        console.log(`处理分段 ${i + 1}/${chunks.length}`);
      }
      
      const result = await this.processChunk(prompt, chunk);
      results.push(result);
    }

    const mergedResult = this.mergeResults(results);

    return {
      success: true,
      needsSplit: true,
      chunks,
      results,
      mergedResult,
      contentCheck
    };
  }
}

module.exports = AutoContextHandler;

// 如果直接运行，执行示例
if (require.main === module) {
  const handler = new AutoContextHandler({ verbose: true });
  
  const sample = `这是一个很长的文本内容示例。由于模型有上下文限制，我们需要智能地将其分段处理。

长文本可能包含：
1. 大量的代码文件
2. 复杂的技术文档
3. 深度的分析报告
4. 详细的配置文件
5. 多个章节的书籍内容

每种内容类型都有其特点，需要不同的分段策略。

代码文件需要保持函数和类的完整性；
技术文档需要保持章节和逻辑的连贯性；
分析报告需要保持数据和结论的一致性；
配置文件需要保持结构的完整性；
书籍内容需要保持章节和段落的连续性。

因此，我们需要根据内容类型采用不同的分段策略，确保处理质量和效率。`;

  handler.autoProcess(sample, { strategy: 'intelligent', taskType: 'analysis' })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(console.error);
}