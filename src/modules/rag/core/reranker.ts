import { IReranker, ISearchResult } from "@/modules/rag/utils/rag.types";
import { RagAIService } from "@/modules/rag/core/ai-service";
import { CohereClient } from "cohere-ai";
import envConfig from "@/config/env";
import { COHERE_CLIENT_MODAL } from "@/modules/rag/utils/rag.enum";

/**
 * Reranker Adapter
 */
export class AIReranker implements IReranker {
  constructor(private aiService: RagAIService) {}

  async rerank(
    query: string,
    results: ISearchResult[],
    topK: number,
  ): Promise<ISearchResult[]> {
    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    try {
      // Prepare chunks for reranking
      const chunks = results.map((r) => ({
        id: r.chunk.id,
        content: r.chunk.contextualizedContent,
      }));

      // Get ranked indices from AI service
      const rankedIndices = await this.aiService.rerankResults(
        query,
        chunks,
        topK,
      );

      // Reorder results based on ranking
      const reranked: ISearchResult[] = [];
      const usedIndices = new Set<number>();

      for (const idx of rankedIndices) {
        if (!usedIndices.has(idx) && idx < results.length) {
          reranked.push({
            ...results[idx],
            method: "reranked" as const,
            score: 1 / (reranked.length + 1),
          });
          usedIndices.add(idx);
        }
      }

      // Add any missing results
      for (let i = 0; i < results.length && reranked.length < topK; i++) {
        if (!usedIndices.has(i)) {
          reranked.push({
            ...results[i],
            method: "reranked" as const,
            score: 1 / (reranked.length + 1),
          });
        }
      }

      return reranked.slice(0, topK);
    } catch (error) {
      console.error("[AIReranker] Error:", error);
      // Fallback to original ranking
      return results.slice(0, topK);
    }
  }
}

// Alternative implementation using Cohere Rerank
export class CohereReranker implements IReranker {
  private modelName: string;
  private client: CohereClient;

  constructor(modelName: string = COHERE_CLIENT_MODAL.RERANK_ENGLISH_MODAL) {
    this.modelName = modelName;
    this.client = new CohereClient({
      token: envConfig.COHERE_CLIENT_TOKEN,
    });
  }

  async rerank(
    query: string,
    results: ISearchResult[],
    topK: number,
  ): Promise<ISearchResult[]> {
    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    try {
      const documents = results.map((r) => r.chunk.contextualizedContent);

      const rerankResponse = await this.client.rerank({
        query,
        documents,
        model: this.modelName,
        topN: topK,
      });

      // Reorder results based on Cohere's ranking
      const reranked: ISearchResult[] = rerankResponse.results.map(
        (result) => ({
          ...results[result.index],
          score: result.relevanceScore,
          method: "reranked" as const,
        }),
      );

      return reranked;
    } catch (error) {
      console.error("Error reranking with Cohere:", error);
      return results.slice(0, topK);
    }
  }
}
