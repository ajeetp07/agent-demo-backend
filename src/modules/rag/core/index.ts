import envConfig from "@/config/env";
import { ELASTIC_SEARCH_INDEX_NAME } from "@/modules/rag/utils/rag.enum";
import {
  IIngestDocumentParams,
  IQueryFilterOptions,
  IRetrievalOptions,
} from "@/modules/rag/utils/rag.types";

import { RagAIService } from "@/modules/rag/core/ai-service";
import { ElasticsearchService } from "@/modules/rag/core/elastic-search";
import { VectorEmbeddingService } from "@/modules/rag/core/embeddings";
import { CohereReranker } from "@/modules/rag/core/reranker";
import { MongoDBVectorStore } from "@/modules/rag/core/vector-store";
import { DocumentIngestionService } from "@/modules/rag/core/ingestion";
import { RagQueryService } from "@/modules/rag/core/rag-query";

/**
 * Unified RAG Service that orchestrates both ingestion and query operations
 * This class acts as a facade, delegating to specialized services
 */
export class RagService {
  private ingestionService: DocumentIngestionService;
  private queryService: RagQueryService;

  constructor(
    ingestionService: DocumentIngestionService,
    queryService: RagQueryService,
  ) {
    this.ingestionService = ingestionService;
    this.queryService = queryService;
  }

  // ============================================
  // Document Ingestion Operations
  // ============================================

  /**
   * Ingest a document into the system
   */
  async ingestDocument(params: IIngestDocumentParams): Promise<string> {
    return this.ingestionService.ingestDocument(params);
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    return this.ingestionService.deleteDocument(documentId);
  }

  /**
   * List all documents
   */
  async listDocuments(): Promise<string[]> {
    return this.ingestionService.listDocuments();
  }

  // ============================================
  // Query Operations
  // ============================================

  /**
   * Query with full RAG pipeline (retrieval + answer generation)
   */
  async query(
    query: string,
    options: IRetrievalOptions,
    filterOptions: IQueryFilterOptions,
  ) {
    return this.queryService.query(query, options, filterOptions);
  }

  /**
   * Generate a title for a chat query
   */
  async generateChatTitle(query: string): Promise<string | null> {
    return this.queryService.generateChatTitle(query);
  }

  // ============================================
  // Direct Access to Underlying Services
  // ============================================

  /**
   * Get direct access to ingestion service if needed
   */
  get ingestion(): DocumentIngestionService {
    return this.ingestionService;
  }

  /**
   * Get direct access to query service if needed
   */
  get ragQuery(): RagQueryService {
    return this.queryService;
  }
}

// ============================================
// Service Initialization
// ============================================

// Initialize AI Service (shared between both services)
const aiService = new RagAIService({
  apiKey: envConfig.OPENAI_API_KEY,
  chatModel: envConfig.OPENAI_MODAL,
  embeddingModel: envConfig.OPENAI_EMBEDDING_MODAL,
  embeddingDimensions: envConfig.OPENAI_EMBEDDING_DIMENSIONS,
  temperature: 0.5,
});

// Initialize shared services
const embeddingService = new VectorEmbeddingService(aiService);
const elasticsearchService = new ElasticsearchService({
  node: envConfig.ELASTIC_SEARCH_HOST_URL,
  indexName: ELASTIC_SEARCH_INDEX_NAME.CONTEXTUAL_BM25_INDEX,
});
const vectorStore = new MongoDBVectorStore();
const reranker = new CohereReranker();

// Initialize specialized services
const documentIngestion = new DocumentIngestionService(
  embeddingService,
  elasticsearchService,
  vectorStore,
  aiService,
);

const ragQuery = new RagQueryService(
  embeddingService,
  elasticsearchService,
  vectorStore,
  reranker,
  aiService,
);

const ragService = new RagService(documentIngestion, ragQuery);

export default ragService;
