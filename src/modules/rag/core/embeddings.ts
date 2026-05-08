import { IEmbeddingService } from "@/modules/rag/utils/rag.types";
import { RagAIService } from "@/modules/rag/core/ai-service";

export class VectorEmbeddingService implements IEmbeddingService {
  constructor(private aiService: RagAIService) {}

  async generateEmbedding(text: string): Promise<number[]> {
    return this.aiService.generateEmbedding(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.aiService.generateEmbeddings(texts);
  }

  getDimensions(): number {
    return this.aiService.getEmbeddingDimensions();
  }
}
