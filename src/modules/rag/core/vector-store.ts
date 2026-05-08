import { VectorEmbeddingsModel } from "@/db/models/ragChat/embeddings";
import envConfig from "@/config/env";
import {
  IChunk,
  IVectorStore,
  IVectorStoreFilterOptions,
  ISearchResult,
} from "@/modules/rag/utils/rag.types";
import mongoose from "mongoose";

export class MongoDBVectorStore implements IVectorStore {
  constructor() {
    mongoose.connection.once("open", async () => {
      await this.createVectorSearchIndex();
    });
  }

  private async createVectorSearchIndex(): Promise<void> {
    try {
      const indexes = await VectorEmbeddingsModel.listSearchIndexes();

      const vectorIndexExists = indexes.some(
        (idx) => idx.name === "vector_index",
      );

      if (!vectorIndexExists) {
        try {
          await VectorEmbeddingsModel.createSearchIndex({
            name: "vector_index",
            definition: {
              mappings: {
                dynamic: false,
                fields: {
                  embedding: {
                    type: "knnVector",
                    dimensions: envConfig.OPENAI_EMBEDDING_DIMENSIONS,
                    similarity: "cosine",
                  },
                  fileScope: {
                    type: "token",
                  },
                  userId: {
                    type: "token",
                  },
                  chatId: {
                    type: "token",
                  },
                  documentId: {
                    type: "token",
                  },
                },
              },
            },
          });
        } catch (indexError) {
          console.warn(
            "Could not create vector search index (requires MongoDB Atlas):",
            (indexError as Error).message,
          );
        }
      }
    } catch (error) {
      console.warn("Vector index creation skipped:", (error as Error).message);
    }
  }

  async upsertChunk(chunk: IChunk): Promise<void> {
    try {
      await VectorEmbeddingsModel.findOneAndUpdate(
        { id: chunk.id },
        {
          $set: {
            content: chunk.content,
            contextualizedContent: chunk.contextualizedContent,
            embedding: chunk.embedding,
            documentId: chunk.documentId,
            userId: chunk.userId,
            chatId: chunk.chatId,
            fileScope: chunk.fileScope,
            metadata: chunk.metadata,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
    } catch (error) {
      console.error("Error upserting chunk:", error);
      throw new Error(`Failed to upsert chunk: ${(error as Error).message}`);
    }
  }

  async insertChunks(chunk: IChunk | IChunk[]): Promise<void> {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    try {
      await VectorEmbeddingsModel.insertMany(chunks);
    } catch (error) {
      console.error("Error inserting chunks:", error);
      throw new Error(`Failed to insert chunks: ${(error as Error).message}`);
    }
  }

  async searchSimilar(
    embedding: number[],
    topK: number,
    options?: IVectorStoreFilterOptions,
  ): Promise<ISearchResult[]> {
    try {
      // Try MongoDB Atlas Vector Search first
      return await this.searchWithAtlasVectorSearch(embedding, topK, options);
    } catch (error) {
      // Fallback to cosine similarity calculation
      console.warn(
        "Atlas Vector Search failed, using fallback:",
        (error as Error).message,
      );
      return await this.searchSimilarFallback(embedding, topK, options);
    }
  }

  private async searchWithAtlasVectorSearch(
    embedding: number[],
    topK: number,
    filterOptions?: IVectorStoreFilterOptions,
  ): Promise<ISearchResult[]> {
    const filters: Record<string, unknown> = {};

    if (filterOptions?.fileScope) {
      filters.fileScope = filterOptions.fileScope;
    }
    if (filterOptions?.chatId) {
      filters.chatId = filterOptions.chatId;
    }
    if (filterOptions?.userId) {
      filters.userId = filterOptions.userId;
    }
    let filterQuery: Record<string, unknown> = {};
    const entries = Object.entries(filters);

    if (entries.length === 1) {
      filterQuery = { [entries[0][0]]: entries[0][1] };
    } else if (entries.length > 1) {
      filterQuery = { $and: entries.map(([key, value]) => ({ [key]: value })) };
    }

    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: topK * 10,
          limit: topK,
          ...(entries.length ? { filter: filterQuery } : {}),
        },
      },

      {
        $project: {
          _id: 0,
          id: 1,
          content: 1,
          contextualizedContent: 1,
          documentId: 1,
          userId: 1,
          chatId: 1,
          fileScope: 1,
          metadata: 1,
          embedding: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await VectorEmbeddingsModel.aggregate(pipeline).exec();

    return results.map((doc) => ({
      chunk: {
        id: doc.id,
        content: doc.content,
        contextualizedContent: doc.contextualizedContent,
        documentId: doc.documentId,
        userId: doc.userId,
        chatId: doc.chatId,
        metadata: doc.metadata,
        fileScope: doc.fileScope,
        embedding: doc.embedding,
        orderIndex: doc.orderIndex,
      },
      score: doc.score || 0,
      method: "embedding" as const,
    }));
  }

  private async searchSimilarFallback(
    embedding: number[],
    topK: number,
    filterOptions?: IVectorStoreFilterOptions,
  ): Promise<ISearchResult[]> {
    const { fileScope, chatId, userId } = filterOptions || {};
    const filters: Record<string, unknown> = {};

    if (fileScope) {
      filters.fileScope = fileScope;
    }
    if (chatId) {
      filters.chatId = chatId;
    }
    if (userId) {
      filters.userId = userId;
    }
    const chunks = await VectorEmbeddingsModel.find({
      ...filters,
      embedding: { $exists: true, $ne: null },
    })
      .lean()
      .exec();

    // Calculate cosine similarity for each chunk
    const results: ISearchResult[] = chunks
      .map((chunk) => ({
        chunk: {
          id: chunk.id,
          content: chunk.content,
          contextualizedContent: chunk.contextualizedContent,
          documentId: chunk.documentId,
          userId: chunk.userId.toString(),
          chatId: chunk.chatId.toString(),
          fileScope: chunk.fileScope,
          metadata: chunk.metadata,
          embedding: chunk.embedding,
          orderIndex: chunk.orderIndex,
        },
        score: this.cosineSimilarity(embedding, chunk.embedding!),
        method: "embedding" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimensions");
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  async getChunk(chunkId: string): Promise<IChunk | null> {
    try {
      const doc = await VectorEmbeddingsModel.findOne({ id: chunkId })
        .select("-_id -__v")
        .lean()
        .exec();

      if (!doc) return null;

      return {
        id: doc.id,
        content: doc.content,
        contextualizedContent: doc.contextualizedContent,
        documentId: doc.documentId,
        userId: doc.userId.toString(),
        chatId: doc.chatId ? doc.chatId.toString() : undefined,
        fileScope: doc.fileScope,
        metadata: doc.metadata,
        embedding: doc.embedding,
        orderIndex: doc.orderIndex,
      };
    } catch (error) {
      console.error("Error getting chunk:", error);
      throw new Error(`Failed to get chunk: ${(error as Error).message}`);
    }
  }

  async deleteChunk(chunkId: string): Promise<void> {
    try {
      await VectorEmbeddingsModel.deleteOne({ id: chunkId }).exec();
    } catch (error) {
      console.error("Error deleting chunk:", error);
      throw new Error(`Failed to delete chunk: ${(error as Error).message}`);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await VectorEmbeddingsModel.deleteMany({
        documentId,
      }).exec();
    } catch (error) {
      console.error("Error deleting document:", error);
      throw new Error(`Failed to delete document: ${(error as Error).message}`);
    }
  }

  async listDocuments(): Promise<string[]> {
    try {
      const distinctDocs =
        await VectorEmbeddingsModel.distinct("documentId").exec();
      return distinctDocs;
    } catch (error) {
      console.error("Error listing documents:", error);
      throw new Error(`Failed to list documents: ${(error as Error).message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Ping the database
      return mongoose.connection.readyState === 1;
    } catch (error) {
      console.error("MongoDB health check failed:", error);
      return false;
    }
  }

  /**
   * Get all chunks for a specific document
   */
  async getDocumentChunks(documentId: string): Promise<IChunk[]> {
    try {
      const docs = await VectorEmbeddingsModel.find({ documentId })
        .select("-_id -__v")
        .sort({ startIndex: 1 })
        .lean()
        .exec();

      return docs.map((doc) => ({
        id: doc.id,
        content: doc.content,
        contextualizedContent: doc.contextualizedContent,
        documentId: doc.documentId,
        userId: doc.userId.toString(),
        chatId: doc.chatId ? doc.chatId.toString() : undefined,
        fileScope: doc.fileScope,
        metadata: doc.metadata,
        embedding: doc.embedding,
        orderIndex: doc.orderIndex,
      }));
    } catch (error) {
      console.error("Error getting document chunks:", error);
      throw new Error(
        `Failed to get document chunks: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Count total chunks in the database
   */
  async countChunks(): Promise<number> {
    try {
      return await VectorEmbeddingsModel.countDocuments().exec();
    } catch (error) {
      console.error("Error counting chunks:", error);
      return 0;
    }
  }

  /**
   * Count chunks for a specific document
   */
  async countDocumentChunks(documentId: string): Promise<number> {
    try {
      return await VectorEmbeddingsModel.countDocuments({ documentId }).exec();
    } catch (error) {
      console.error("Error counting document chunks:", error);
      return 0;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    totalDocuments: number;
    averageChunksPerDocument: number;
  }> {
    try {
      const totalChunks = await this.countChunks();
      const documents = await this.listDocuments();
      const totalDocuments = documents.length;
      const averageChunksPerDocument =
        totalDocuments > 0 ? totalChunks / totalDocuments : 0;

      return {
        totalChunks,
        totalDocuments,
        averageChunksPerDocument:
          Math.round(averageChunksPerDocument * 100) / 100,
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      throw new Error(`Failed to get stats: ${(error as Error).message}`);
    }
  }
}
