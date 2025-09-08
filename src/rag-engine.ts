import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface DocumentChunk {
  text: string;
  embedding?: number[];
  metadata: {
    documentNumber?: string;
    title?: string;
    pageNumber?: number;
    chunkIndex?: number;
    startChar?: number;  // 원본 문서에서 시작 위치
    endChar?: number;    // 원본 문서에서 끝 위치
  };
}

type APIProvider = 'openai' | 'anthropic' | 'none';

export class RAGEngine {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private chunks: Map<string, DocumentChunk[]> = new Map();
  private initialized = false;
  private provider: APIProvider = 'none';

  constructor() {
    // 먼저 OpenAI 확인
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey !== 'YOUR_OPENAI_API_KEY_HERE' && openaiKey !== '') {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.initialized = true;
      this.provider = 'openai';
      console.error('RAG Engine: OpenAI initialized');
      return;
    }

    // OpenAI 없으면 Claude 확인
    const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (claudeKey && claudeKey !== 'YOUR_CLAUDE_API_KEY_HERE' && claudeKey !== '') {
      this.anthropic = new Anthropic({ apiKey: claudeKey });
      this.initialized = true;
      this.provider = 'anthropic';
      console.error('RAG Engine: Claude/Anthropic initialized');
      return;
    }

    console.error('RAG Engine: No API key found, using fallback keyword search');
  }

  isEnabled(): boolean {
    return this.initialized && (this.openai !== null || this.anthropic !== null);
  }

  getProvider(): string {
    return this.provider;
  }

  // 문서를 청크로 분할
  private splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // 오버랩을 위해 마지막 부분 유지
          const words = currentChunk.split(' ');
          currentChunk = words.slice(-Math.floor(overlap / 10)).join(' ') + ' ';
        }
      }
      currentChunk += sentence + '. ';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // 문서 추가 및 임베딩 생성
  async addDocument(documentId: string, text: string, metadata: any): Promise<void> {
    if (!this.isEnabled()) {
      // API 없으면 텍스트만 저장
      const chunks = this.splitIntoChunks(text);
      let charOffset = 0;
      this.chunks.set(documentId, chunks.map((chunk, index) => {
        const startChar = text.indexOf(chunk, charOffset);
        const endChar = startChar + chunk.length;
        charOffset = endChar;
        return {
          text: chunk,
          metadata: { 
            ...metadata, 
            chunkIndex: index,
            startChar,
            endChar
          }
        };
      }));
      return;
    }

    try {
      const textChunks = this.splitIntoChunks(text);
      const documentChunks: DocumentChunk[] = [];
      let charOffset = 0;

      if (this.provider === 'openai' && this.openai) {
        // OpenAI 임베딩
        const batchSize = 20;
        for (let i = 0; i < textChunks.length; i += batchSize) {
          const batch = textChunks.slice(i, i + batchSize);
          
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: batch,
          });

          batch.forEach((chunk, idx) => {
            const startChar = text.indexOf(chunk, charOffset);
            const endChar = startChar + chunk.length;
            charOffset = endChar;
            
            documentChunks.push({
              text: chunk,
              embedding: response.data[idx].embedding,
              metadata: {
                ...metadata,
                chunkIndex: i + idx,
                startChar,
                endChar
              }
            });
          });
        }
      } else if (this.provider === 'anthropic') {
        // Claude는 직접적인 임베딩 API가 없으므로
        // 텍스트 청크만 저장하고 검색시 Claude를 사용
        textChunks.forEach((chunk, index) => {
          const startChar = text.indexOf(chunk, charOffset);
          const endChar = startChar + chunk.length;
          charOffset = endChar;
          
          documentChunks.push({
            text: chunk,
            embedding: undefined, // Claude는 임베딩 대신 직접 비교
            metadata: {
              ...metadata,
              chunkIndex: index,
              startChar,
              endChar
            }
          });
        });
      }

      this.chunks.set(documentId, documentChunks);
      console.error(`RAG: Added document ${documentId} with ${documentChunks.length} chunks using ${this.provider}`);
    } catch (error) {
      console.error('RAG: Error processing document:', error);
      // 실패시 텍스트만 저장
      const chunks = this.splitIntoChunks(text);
      let charOffset = 0;
      this.chunks.set(documentId, chunks.map((chunk, index) => {
        const startChar = text.indexOf(chunk, charOffset);
        const endChar = startChar + chunk.length;
        charOffset = endChar;
        return {
          text: chunk,
          metadata: { 
            ...metadata, 
            chunkIndex: index,
            startChar,
            endChar
          }
        };
      }));
    }
  }

  // 질문에 대한 검색
  async search(query: string, topK: number = 5): Promise<Array<{ text: string; score: number; metadata: any }>> {
    if (!this.isEnabled()) {
      // API 없으면 키워드 검색으로 폴백
      return this.keywordSearch(query, topK);
    }

    try {
      if (this.provider === 'openai' && this.openai) {
        // OpenAI 임베딩 기반 검색
        return await this.searchWithOpenAI(query, topK);
      } else if (this.provider === 'anthropic' && this.anthropic) {
        // Claude 기반 의미 검색
        return await this.searchWithClaude(query, topK);
      }
    } catch (error) {
      console.error('RAG: Search error:', error);
    }

    // 실패시 키워드 검색
    return this.keywordSearch(query, topK);
  }

  // OpenAI 임베딩 검색
  private async searchWithOpenAI(query: string, topK: number): Promise<Array<{ text: string; score: number; metadata: any }>> {
    if (!this.openai) return [];

    // 질문 임베딩 생성
    const queryResponse = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // 모든 청크와 코사인 유사도 계산
    const results: Array<{ text: string; score: number; metadata: any }> = [];
    
    for (const [docId, chunks] of this.chunks.entries()) {
      for (const chunk of chunks) {
        if (chunk.embedding) {
          const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          results.push({
            text: chunk.text,
            score,
            metadata: chunk.metadata
          });
        }
      }
    }

    // 상위 K개 반환
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // Claude 기반 의미 검색 (임베딩 없이 직접 비교)
  private async searchWithClaude(query: string, topK: number): Promise<Array<{ text: string; score: number; metadata: any }>> {
    if (!this.anthropic) return [];

    // 모든 청크 수집
    const allChunks: Array<{ text: string; metadata: any; index: number }> = [];
    for (const [docId, chunks] of this.chunks.entries()) {
      chunks.forEach((chunk, idx) => {
        allChunks.push({
          text: chunk.text.substring(0, 500), // 길이 제한
          metadata: chunk.metadata,
          index: allChunks.length
        });
      });
    }

    if (allChunks.length === 0) return [];

    // Claude에게 관련성 평가 요청 (배치 처리)
    const batchSize = 20;
    const results: Array<{ text: string; score: number; metadata: any }> = [];

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, Math.min(i + batchSize, allChunks.length));
      
      try {
        const prompt = `Given the query: "${query}"

Rate the relevance of each text chunk from 0 to 1.0.
Return ONLY a JSON array of scores in order, like: [0.9, 0.3, 0.7, ...]

Chunks:
${batch.map((c, idx) => `${idx + 1}. ${c.text.substring(0, 200)}...`).join('\n\n')}

Scores:`;

        const response = await this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307', // 가장 빠르고 저렴한 모델
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        // 응답 파싱
        const content = response.content[0];
        if (content.type === 'text') {
          try {
            const scores = JSON.parse(content.text.trim());
            if (Array.isArray(scores)) {
              batch.forEach((chunk, idx) => {
                if (idx < scores.length && typeof scores[idx] === 'number') {
                  results.push({
                    text: allChunks[chunk.index].text,
                    score: scores[idx],
                    metadata: chunk.metadata
                  });
                }
              });
            }
          } catch (e) {
            // 파싱 실패시 키워드 검색으로 폴백
            console.error('Claude response parsing failed:', e);
          }
        }
      } catch (error) {
        console.error('Claude API error:', error);
      }
    }

    // 결과가 없으면 키워드 검색으로 폴백
    if (results.length === 0) {
      return this.keywordSearch(query, topK);
    }

    // 상위 K개 반환
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // 키워드 기반 폴백 검색
  private keywordSearch(query: string, topK: number): Array<{ text: string; score: number; metadata: any }> {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    const results: Array<{ text: string; score: number; metadata: any }> = [];

    for (const [docId, chunks] of this.chunks.entries()) {
      for (const chunk of chunks) {
        const chunkLower = chunk.text.toLowerCase();
        let score = 0;

        // 전체 구문 매칭
        if (query.length > 5 && chunkLower.includes(query.toLowerCase())) {
          score += 10;
        }

        // 키워드 매칭
        for (const keyword of keywords) {
          if (chunkLower.includes(keyword)) {
            score += (chunkLower.split(keyword).length - 1) * (keyword.length >= 5 ? 2 : 1);
          }
        }

        if (score > 0) {
          results.push({
            text: chunk.text.substring(0, 500),
            score: score / 100, // 정규화
            metadata: chunk.metadata
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // 코사인 유사도 계산
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 문서 삭제
  removeDocument(documentId: string): void {
    this.chunks.delete(documentId);
  }

  // 모든 문서 삭제
  clear(): void {
    this.chunks.clear();
  }

  // 통계 정보
  getStats(): { documents: number; totalChunks: number; hasEmbeddings: boolean; provider: string } {
    let totalChunks = 0;
    let hasEmbeddings = false;
    
    for (const chunks of this.chunks.values()) {
      totalChunks += chunks.length;
      if (!hasEmbeddings && chunks.length > 0 && chunks[0].embedding) {
        hasEmbeddings = true;
      }
    }

    return {
      documents: this.chunks.size,
      totalChunks,
      hasEmbeddings,
      provider: this.provider
    };
  }
}