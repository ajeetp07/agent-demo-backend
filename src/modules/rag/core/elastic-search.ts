import envConfig from "@/config/env";
import {
  IChunk,
  ISearchService,
  ISearchResult,
} from "@/modules/rag/utils/rag.types";
import { Client } from "@elastic/elasticsearch";

interface ElasticsearchConfig {
  node: string;
  username?: string;
  password?: string;
  indexName: string;
}

export class ElasticsearchService implements ISearchService {
  private client: Client;
  private indexName: string;

  constructor(config: ElasticsearchConfig) {
    this.indexName = config.indexName;

    this.client = new Client({
      node: envConfig.ELASTIC_SEARCH_HOST_URL,
      auth: {
        apiKey: envConfig.ELASTIC_SEARCH_API_KEY,
      },
    });

    this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        // Create index with appropriate mappings for BM25
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              analysis: { analyzer: { default: { type: "english" } } },
              similarity: { default: { type: "BM25" } },
            },
            mappings: {
              properties: {
                id: { type: "keyword" },
                content: {
                  type: "text",
                  analyzer: "english",
                },
                contextualizedContent: {
                  type: "text",
                  analyzer: "english",
                },
                documentId: { type: "keyword" },
                userId: { type: "keyword" },
                chatId: { type: "keyword" },
                orderIndex: { type: "integer" },
                fileScope: { type: "keyword", index: false },
                metadata: { type: "object", enabled: true },
                createdAt: { type: "date" },
              },
            },
          },
        });
      }
    } catch {
      console.log("Error initializing Elasticsearch:");
    }
  }

  async indexChunks(chunk: IChunk | IChunk[]): Promise<void> {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    const operations: object[] = [];
    try {
      for (const chunk of chunks) {
        operations.push({
          index: {
            _index: this.indexName,
            _id: chunk.id,
          },
        });
        operations.push({
          id: chunk.id,
          content: chunk.content,
          contextualizedContent: chunk.contextualizedContent,
          documentId: chunk.documentId,
          userId: chunk.userId,
          chatId: chunk.chatId,
          fileScope: chunk.fileScope,
          metadata: chunk.metadata,
          createdAt: new Date().toISOString(),
        });
      }
      await this.client.bulk({
        operations,
        refresh: true,
      });
    } catch (error) {
      console.log("Error indexing chunk:", error);
      throw error;
    }
  }

  async search(
    query: string,
    topK: number,
    options?: {
      userId?: string;
      fileScope?: string;
      chatId?: string;
    },
  ): Promise<ISearchResult[]> {
    try {
      // Build filter array
      const filters: any[] = [];

      if (options?.userId) {
        filters.push({
          term: { userId: options.userId },
        });
      }

      if (options?.chatId) {
        filters.push({
          term: { chatId: options.chatId },
        });
      }

      if (options?.fileScope) {
        filters.push({
          term: { fileScope: options.fileScope },
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ["content", "contextualizedContent"],
                  },
                },
                ...filters,
              ],
            },
          },
          size: topK,
        },
      });
      const results: ISearchResult[] = response.hits.hits.map((hit: any) => ({
        chunk: {
          id: hit._source.id,
          content: hit._source.content,
          contextualizedContent: hit._source.contextualizedContent,
          documentId: hit._source.documentId,
          userId: hit._source.userId,
          chatId: hit._source.chatId,
          fileScope: hit._source.fileScope,
          metadata: hit._source.metadata,
          orderIndex: hit._source.orderIndex,
        },
        score: hit._score || 0,
        method: "bm25" as const,
      }));

      return results;
    } catch (error) {
      console.error("Error searching Elasticsearch:", error);
      throw error;
    }
  }

  async deleteChunk(chunkId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: chunkId,
      });
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        throw error;
      }
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: this.indexName,
      body: {
        query: {
          term: {
            documentId,
          },
        },
      },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health();
      return health.status !== "red";
    } catch {
      return false;
    }
  }

  // Advanced search with multiple fields and boosting
  async advancedSearch(query: string, topK: number): Promise<ISearchResult[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: [
                "contextualizedContent^2", // Higher boost for contextualized content
                "content",
              ],
              type: "best_fields",
            },
          },
          size: topK,
        },
      });

      const results: ISearchResult[] = response.hits.hits.map((hit: any) => ({
        chunk: {
          id: hit._source.id,
          content: hit._source.content,
          contextualizedContent: hit._source.contextualizedContent,
          documentId: hit._source.documentId,
          userId: hit._source.userId,
          chatId: hit._source.chatId,
          fileScope: hit._source.fileScope,
          metadata: hit._source.metadata,
          orderIndex: hit._source.orderIndex,
        },
        score: hit._score || 0,
        method: "bm25" as const,
      }));

      return results;
    } catch (error) {
      console.error("Error searching Elasticsearch:", error);
      return [];
    }
  }
}
