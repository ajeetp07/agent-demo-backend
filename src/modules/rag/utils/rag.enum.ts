export enum RAG_FILE_SCOPE {
  CENTRALIZED = "centralized",
  CHAT = "chat",
  BOTH = "both",
}

export enum COHERE_CLIENT_MODAL {
  RERANK_ENGLISH_MODAL = "rerank-english-v3.0",
}

export enum ELASTIC_SEARCH_INDEX_NAME {
  CONTEXTUAL_BM25_INDEX = "contextual_bm25_index",
}

export enum DEFAULT_CHAT_TITLE {
  TITLE = "New Chat",
}

export enum SENDER_ROLE {
  USER = "user",
  ASSISTANT = "assistant",
}

export enum SOURCE {
  CHAT = "chat",
  CENTRALIZED = "centralized",
  BOTH = "both",
}

export enum FILE_PROCESSING_STATUS {
  UPLOADED = "File Uploaded In Storage",
  EXTRACTING = "Extracting File Data",
  CHUNKING = "Generating Contextualized Chunks",
  ES_SEARCH = "Insert Document In Elastic Search",
  GENERATING_EMBEDDINGS = "Generate Vector Embedding Successfully",
  STORING_EMBEDDINGS = "Embedding Store Successfully",
  ERROR_IN_EXTRACTING = "Error In Extracting File Data",
  FAILED_TO_GENERATE_EMBEDDINGS = "Failed To Generate Embeddings",
  FAILED_TO_PROCESS_FILE = "Failed To Process File",
}

export enum FILE_REFERENCE {
  USER_KNOWLEDGE_BASE = "user_knowledge_base",
}
