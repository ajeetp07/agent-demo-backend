import {
  IChunk,
  IEmbeddingService,
  IQueryFilterOptions,
  IReranker,
  ISearchService,
  IVectorStore,
  IVectorStoreFilterOptions,
  IRetrievalOptions,
  ISearchResult,
} from "@/modules/rag/utils/rag.types";
import { RAG_FILE_SCOPE, SENDER_ROLE } from "@/modules/rag/utils/rag.enum";

import { Messages } from "@/db/models/ragChat/messages";
import { socketService } from "@/providers/socket";
import { RagAIService } from "@/modules/rag/core/ai-service";
import { RECIPROCAL_RANK_FUSION_K } from "@/modules/rag/utils/rag.constant";

/**
 * This services is used to generate responses to user queries
 */
export class RagQueryService {
  private embeddingService: IEmbeddingService;
  private searchService: ISearchService;
  private vectorStore: IVectorStore;
  private reranker: IReranker;
  private aiService: RagAIService;

  constructor(
    embeddingService: IEmbeddingService,
    searchService: ISearchService,
    vectorStore: IVectorStore,
    reranker: IReranker,
    aiService: RagAIService,
  ) {
    this.embeddingService = embeddingService;
    this.searchService = searchService;
    this.vectorStore = vectorStore;
    this.reranker = reranker;
    this.aiService = aiService;
  }

  /**
   * Reciprocal Rank Fusion algorithm
   */
  private reciprocalRankFusion(
    embeddingResults: ISearchResult[],
    bm25Results: ISearchResult[],
  ): ISearchResult[] {
    const scoreMap = new Map<string, { score: number; chunk: IChunk }>();

    const addResults = (results: ISearchResult[]) => {
      results.forEach((result, index) => {
        const rrfScore = 1 / (RECIPROCAL_RANK_FUSION_K + index + 1);
        const existing = scoreMap.get(result.chunk.id);

        scoreMap.set(result.chunk.id, {
          score: (existing?.score ?? 0) + rrfScore,
          chunk: result.chunk,
        });
      });
    };

    addResults(embeddingResults);
    addResults(bm25Results);

    // Convert to array and sort by score
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const combined = Array.from(scoreMap.entries()).map(([_, data]) => ({
      chunk: data.chunk,
      score: data.score,
      method: "hybrid" as const,
    }));

    return combined.sort((a, b) => b.score - a.score);
  }

  /**
   * Main retrieval function with configurable options
   */
  async retrieve(
    query: string,
    options: IRetrievalOptions,
    filterOptions?: IQueryFilterOptions,
  ): Promise<ISearchResult[]> {
    const {
      useEmbeddings,
      useBM25,
      useReranking,
      topK = 10,
      initialRetrievalCount = 15,
    } = options;

    const { userId, fileScope, chatId } = filterOptions || {};

    try {
      let results: ISearchResult[] = [];

      // Hybrid retrieval (best performance)
      if (useEmbeddings && useBM25) {
        // Retrieve from both sources in parallel
        const [embeddingResults, bm25Results] = await Promise.all([
          this.retrieveByEmbedding(query, initialRetrievalCount, {
            fileScope:
              fileScope === RAG_FILE_SCOPE.BOTH ? undefined : fileScope,
            userId,
            chatId,
          }),
          this.searchService.search(query, initialRetrievalCount, {
            fileScope:
              fileScope === RAG_FILE_SCOPE.BOTH ? undefined : fileScope,
            userId,
            chatId,
          }),
        ]);

        // Combine using reciprocal rank fusion
        results = this.reciprocalRankFusion(embeddingResults, bm25Results);
      }
      // Embeddings only
      else if (useEmbeddings) {
        results = await this.retrieveByEmbedding(query, initialRetrievalCount);
      }
      // BM25 only
      else if (useBM25) {
        results = await this.searchService.search(query, initialRetrievalCount);
      }

      // Apply reranking if enabled
      if (useReranking && results.length > topK) {
        results = await this.reranker.rerank(query, results, topK);
      } else {
        results = results.slice(0, topK);
      }

      return results;
    } catch (error) {
      console.error("[Retrieval] Error:", error);
      throw error;
    }
  }

  /**
   * Retrieve using vector similarity
   */
  private async retrieveByEmbedding(
    query: string,
    topK: number,
    options?: IVectorStoreFilterOptions,
  ): Promise<ISearchResult[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    return await this.vectorStore.searchSimilar(queryEmbedding, topK, options);
  }

  /**
   * Query with full RAG pipeline (retrieval + answer generation)
   */
  async query(
    userQuery: string,
    options: IRetrievalOptions,
    filterOptions: IQueryFilterOptions,
  ) {
    const { aiMessageId, tempAiMessageId, chatId, socketClientId } =
      filterOptions;

    try {
      // Retrieve relevant chunks
      const results = await this.retrieve(userQuery, options, filterOptions);

      // Build context from retrieved chunks (use original content, not contextualized)
      const context = results
        .map(
          (r, i) =>
            `[Source ${i + 1} , Score: ${r.score.toFixed(5)}]:\n${r.chunk.contextualizedContent}`,
        )
        .join("\n\n---\n\n");

      // Generate answer using centralized AI service

      const stream = await this.aiService.generateAnswer(
        context,
        userQuery,
        true,
      );

      let answer = "";

      if (typeof stream !== "string") {
        for await (const chunk of stream) {
          const content = chunk.content?.toString();

          if (content) {
            answer += content;

            if (socketClientId) {
              // Send chunk to client
              socketService?.emitToRoom(socketClientId, "ai-response-chunk", {
                chunk: content,
                messageId: aiMessageId!,
                tempAiMessageId: tempAiMessageId!,
                chatId: chatId!,
                sender: SENDER_ROLE.ASSISTANT,
              });
            }

            // Update message in database

            if (aiMessageId) {
              await Messages.updateOne(
                { _id: aiMessageId },
                { $set: { text: answer } },
              );
            }
          }
        }

        socketService?.emitToRoom(socketClientId!, "ai-response-complete", {
          fullResponse: answer,
          messageId: aiMessageId!,
          tempAiMessageId: tempAiMessageId!,
          chatId: chatId!,
        });
      } else {
        answer = stream;
      }

      return {
        answer,
        context,
        metadata: {
          retrievalMethod: this.getRetrievalMethodString(options),
          totalChunksRetrieved: results.length,
        },
      };
    } catch {
      socketService?.emitToRoom(socketClientId!, "ai-response-error", {
        messageId: aiMessageId,
        tempAiMessageId: tempAiMessageId,
        chatId: chatId,
        chunk: "An error occurred while generating a response.",
        sender: SENDER_ROLE.ASSISTANT,
      });

      if (aiMessageId) {
        await Messages.updateOne(
          { _id: aiMessageId },
          {
            $set: {
              text: "An error occurred while generating a response.",
              status: "error",
            },
          },
        );
      }
    }
  }
  /**
   * Generate a title for a chat query
   */
  async generateChatTitle(query: string): Promise<string | null> {
    return await this.aiService.generateTitle(query);
  }

  /**
   * Helper to generate retrieval method description
   */
  private getRetrievalMethodString(options?: IRetrievalOptions): string {
    const parts: string[] = [];

    if (options?.useEmbeddings) parts.push("Embeddings");
    if (options?.useBM25) parts.push("BM25");
    if (options?.useReranking) parts.push("Reranking");

    return parts.length > 0 ? parts.join(" + ") : "Default";
  }
}
