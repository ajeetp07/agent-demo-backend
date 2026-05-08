import { TObjectId } from "@/types";
import { RAG_FILE_SCOPE, SOURCE } from "@/modules/rag/utils/rag.enum";
import { ragValidators } from "@/modules/rag/utils/rag.validation";

export type TRagController = typeof ragValidators;

// ----------------
// type definition
// ----------------

export type TGenerateAIResponse = {
  query: string;
  userId: TObjectId;
  chatId?: string;
  source?: SOURCE;
  msgId?: string;
  socketClientId: string;
  tempAiMessageId?: string;
};

export type TCentralizedFile = {
  fileName: string;
  fileUrl: string;
  size: number;
  status: string;
};

export type TUpdateFileData = Omit<IFileUrls, "_id" | "createdAt"> & {
  chatId: TObjectId;
};

export type TFileCheckFilter = {
  chatId: TObjectId;
  userId: TObjectId;
};

export type TStorePreferenceFilter = {
  chatId: TObjectId;
  source: SOURCE;
};

export type TChatsFilter = {
  chatId: TObjectId;
  userRef: TObjectId;
};

export type TSingleChat = {
  chatId: TObjectId;
  userId: TObjectId;
};

// ----------
// interface
// ----------
export interface IFileUrls {
  _id: TObjectId;
  fileName: string;
  fileUrl: string;
  size: number; // file size in bytes
  createdAt: string;
}

export interface IRagDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface IChunk {
  id: string;
  content: string;
  contextualizedContent: string;
  embedding?: number[];
  documentId: string;
  userId: string;
  chatId?: string;
  fileScope: RAG_FILE_SCOPE;
  metadata?: Record<string, any>;
  orderIndex: number;
}

export interface ISearchResult {
  chunk: IChunk;
  score: number;
  method: "embedding" | "bm25" | "hybrid" | "reranked";
}

export interface IRetrievalOptions {
  useEmbeddings?: boolean;
  useBM25?: boolean;
  useReranking?: boolean;
  topK?: number;
  initialRetrievalCount?: number;
}

export interface IQueryFilterOptions {
  userId?: string;
  fileScope?: RAG_FILE_SCOPE;
  chatId?: string;
  aiMessageId?: string;
  tempAiMessageId?: string;
  socketClientId?: string;
}

// Service Interfaces

export interface IContextGenerator {
  generateContext(wholeDocument: string, chunkContent: string): Promise<string>;
}

export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export interface ISearchFilterOptions {
  userId?: string;
  fileScope?: string;
  chatId?: string;
}

export interface ISearchService {
  indexChunks(chunk: IChunk | IChunk[]): Promise<void>;
  search(
    query: string,
    topK: number,
    options?: ISearchFilterOptions,
  ): Promise<ISearchResult[]>;
  deleteDocument(documentId: string): Promise<void>;
  deleteChunk(chunkId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
  initialize(): Promise<void>;
}

export interface IVectorStoreFilterOptions {
  userId?: string;
  fileScope?: string;
  chatId?: string;
}

export interface IVectorStore {
  upsertChunk(chunk: IChunk): Promise<void>;
  insertChunks(chunk: IChunk | IChunk[]): Promise<void>;
  searchSimilar(
    embedding: number[],
    topK: number,
    options?: IVectorStoreFilterOptions,
  ): Promise<ISearchResult[]>;
  getChunk(chunkId: string): Promise<IChunk | null>;
  deleteChunk(chunkId: string): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  listDocuments(): Promise<string[]>;
  healthCheck(): Promise<boolean>;
}

export interface IReranker {
  rerank(
    query: string,
    results: ISearchResult[],
    topK: number,
  ): Promise<ISearchResult[]>;
}

export interface IDocumentExtractor {
  extractText(fileContent: string | Buffer, fileType: string): Promise<string>;
  supportedTypes(): string[];
}

export interface IUploadFile {
  fileUrl: string;
  fileName: string;
  documentId: string;
  userId: string;
  chatId?: string;
  fileScope: RAG_FILE_SCOPE;
}

export interface ISplitIntoChunksParams {
  document: IRagDocument;
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
  };
  userId: string;
  fileScope: RAG_FILE_SCOPE;
  chatId?: string | undefined;
}

export interface IIngestDocumentParams {
  document: IRagDocument;
  userId: string;
  chatId?: string;
  fileScope: RAG_FILE_SCOPE;
}
