import {
  IChunk,
  IEmbeddingService,
  IIngestDocumentParams,
  ISearchService,
  ISplitIntoChunksParams,
  IVectorStore,
} from "@/modules/rag/utils/rag.types";

import { socketService } from "@/providers/socket";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { RagAIService } from "@/modules/rag/core/ai-service";
import { CHUNKING_OPTIONS } from "@/modules/rag/utils/rag.constant";
import { FILE_PROCESSING_STATUS } from "@/modules/rag/utils/rag.enum";
import { CentralizedFile } from "@/db/models/ragChat/centralizedFile";

export class DocumentIngestionService {
  private embeddingService: IEmbeddingService;
  private searchService: ISearchService;
  private vectorStore: IVectorStore;
  private aiService: RagAIService;

  constructor(
    embeddingService: IEmbeddingService,
    searchService: ISearchService,
    vectorStore: IVectorStore,
    aiService: RagAIService,
  ) {
    this.embeddingService = embeddingService;
    this.searchService = searchService;
    this.vectorStore = vectorStore;
    this.aiService = aiService;
  }

  /**
   * Split document into chunks with overlap
   */
  private async splitIntoChunks({
    document,
    options,
    userId,
    chatId,
    fileScope,
  }: ISplitIntoChunksParams): Promise<
    Omit<IChunk, "contextualizedContent" | "embedding">[]
  > {
    const { content, id, metadata } = document;
    const chunks: Omit<IChunk, "contextualizedContent" | "embedding">[] = [];

    const chunkSize = options?.chunkSize || CHUNKING_OPTIONS.chunkSize;
    const overlap = options?.chunkOverlap || CHUNKING_OPTIONS.chunkOverlap;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: overlap,
    });

    const splitChunks = await splitter.splitText(content);

    splitChunks.forEach((chunk, index) => {
      chunks.push({
        id: `${id}_chunk_${index}`,
        content: chunk,
        documentId: id,
        userId: userId,
        chatId: chatId,
        metadata,
        fileScope,
        orderIndex: index,
      });
    });

    return chunks;
  }

  /**
   * Ingest a document into the system
   */
  async ingestDocument({
    document,
    userId,
    chatId,
    fileScope,
  }: IIngestDocumentParams): Promise<string> {
    const { fileName, fileUrl } = document.metadata || {};
    const fileInfo = {
      fileName,
      fileUrl,
    };

    try {
      // Step 1: Split into chunks
      const rawChunks = await this.splitIntoChunks({
        document,
        options: CHUNKING_OPTIONS,
        userId,
        chatId,
        fileScope,
      });

      // Step 2: Generate context for each chunk (in batches for efficiency)
      socketService?.emitFileProcessingStatus({
        ...fileInfo,
        status: FILE_PROCESSING_STATUS.CHUNKING,
      });

      await CentralizedFile.findOneAndUpdate(
        { "file.fileUrl": fileUrl, "file.fileName": fileName },
        { $set: { "file.status": FILE_PROCESSING_STATUS.CHUNKING } },
        { new: true },
      );
      const batchSize = 5;
      const contextualizedChunks: IChunk[] = [];

      for (let i = 0; i < rawChunks.length; i += batchSize) {
        const batch = rawChunks.slice(i, i + batchSize);

        const batchPromises = batch.map(async (chunk) => {
          const context = await this.aiService.generateContext(
            document.content,
            chunk.content,
          );

          return {
            ...chunk,
            contextualizedContent: `${context}\n\n${chunk.content}`,
          };
        });

        const batchResults = await Promise.all(batchPromises);
        contextualizedChunks.push(...batchResults);
      }

      socketService?.emitFileProcessingStatus({
        ...fileInfo,
        status: FILE_PROCESSING_STATUS.GENERATING_EMBEDDINGS,
      });

      await CentralizedFile.findOneAndUpdate(
        { "file.fileUrl": fileUrl, "file.fileName": fileName },
        {
          $set: { "file.status": FILE_PROCESSING_STATUS.GENERATING_EMBEDDINGS },
        },
        { new: true },
      );
      // Step 3: Generate embeddings (batch processing)
      const texts = contextualizedChunks.map((c) => c.contextualizedContent);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      // Step 4: Store in both vector store and search service

      const chunksWithEmbeddings = contextualizedChunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      }));

      const storePromises = [
        this.vectorStore.insertChunks(chunksWithEmbeddings),
        this.searchService.indexChunks(chunksWithEmbeddings),
      ];
      await Promise.all(storePromises);

      socketService?.emitFileProcessingStatus({
        ...fileInfo,
        status: FILE_PROCESSING_STATUS.STORING_EMBEDDINGS,
      });

      await CentralizedFile.findOneAndUpdate(
        { "file.fileUrl": fileUrl, "file.fileName": fileName },
        { $set: { "file.status": FILE_PROCESSING_STATUS.STORING_EMBEDDINGS } },
        { new: true },
      );

      return document.id;
    } catch (error) {
      console.log("[Ingestion] Error:", error);
      throw error;
    }
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    await Promise.all([
      this.vectorStore.deleteDocument(documentId),
      this.searchService.deleteDocument(documentId),
    ]);
  }

  /**
   * List all documents
   */
  async listDocuments(): Promise<string[]> {
    return await this.vectorStore.listDocuments();
  }
}
