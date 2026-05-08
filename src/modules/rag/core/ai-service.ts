import envConfig from "@/config/env";
import { DEFAULT_CHAT_TITLE } from "@/modules/rag/utils/rag.enum";
import {
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export interface AIServiceConfig {
  apiKey: string;
  chatModel?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  temperature?: number;
}

export class RagAIService {
  private chatModel: ChatOpenAI;
  public answerModel: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private embeddingDimensions: number;
  private apiKey: string;

  constructor(config: AIServiceConfig) {
    this.apiKey = config.apiKey;
    this.embeddingDimensions =
      config.embeddingDimensions ?? envConfig.OPENAI_EMBEDDING_DIMENSIONS;

    // Initialize chat model (for context generation and reranking)
    this.chatModel = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: config.chatModel || "gpt-4-turbo-preview",
      temperature: 0, // Deterministic for context generation
      maxTokens: 500,
    });

    // Initialize answer generation model (can be different, with higher temperature)
    this.answerModel = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: config.chatModel || "gpt-4-turbo-preview",
      temperature: config.temperature || 0.7,
      maxTokens: 2000,
    });

    // Initialize embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey,
      modelName: config.embeddingModel || "text-embedding-3-large",
      dimensions: this.embeddingDimensions,
    });
  }

  // ============================================
  // CONTEXT GENERATION METHODS
  // ============================================

  /**
   * Generate contextual information for a chunk
   */
  async generateContext(
    wholeDocument: string,
    chunkContent: string,
  ): Promise<string> {
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          "You are a helpful assistant that provides concise context for document chunks. " +
            "Your goal is to situate chunks within their broader document context to improve search retrieval.",
        ),
        new HumanMessage(
          `<document>\n${wholeDocument}\n</document>\n\n` +
            `Here is the chunk we want to situate within the whole document:\n` +
            `<chunk>\n${chunkContent}\n</chunk>\n\n` +
            `Please give a short succinct context to situate this chunk within the overall document ` +
            `for the purposes of improving search retrieval of the chunk. ` +
            `Answer only with the succinct context and nothing else.`,
        ),
      ];

      const response = await this.chatModel.invoke(messages);
      return response.content.toString().trim();
    } catch (error) {
      console.error("[AIService] Error generating context:", error);
      throw new Error(
        `Failed to generate context: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate context for multiple chunks in batch
   */
  async generateContextBatch(
    wholeDocument: string,
    chunks: string[],
  ): Promise<string[]> {
    const promises = chunks.map((chunk) =>
      this.generateContext(wholeDocument, chunk),
    );

    return await Promise.all(promises);
  }

  // ============================================
  // EMBEDDING METHODS
  // ============================================

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error("[AIService] Error generating embedding:", error);
      throw new Error(
        `Failed to generate embedding: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      return embeddings;
    } catch (error) {
      console.error("[AIService] Error generating embeddings:", error);
      throw new Error(
        `Failed to generate embeddings: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get embedding dimensions
   */
  getEmbeddingDimensions(): number {
    return this.embeddingDimensions;
  }

  // ============================================
  // RERANKING METHODS
  // ============================================

  /**
   * Rerank search results based on relevance to query
   */
  async rerankResults(
    query: string,
    chunks: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<number[]> {
    try {
      if (chunks.length === 0) return [];
      if (chunks.length <= topK) return chunks.map((_, i) => i);

      const chunksText = chunks
        .map((chunk, i) => `<chunk id="${i}">\n${chunk.content}\n</chunk>`)
        .join("\n\n");

      const messages: BaseMessage[] = [
        new SystemMessage(
          "You are a helpful assistant that ranks document chunks by relevance to a query. " +
            "Your task is to analyze each chunk and determine how relevant it is to answering the user's question.",
        ),
        new HumanMessage(
          `Given the following query and document chunks, rank the chunks by their relevance to the query.\n\n` +
            `Query: "${query}"\n\n` +
            `Document Chunks:\n${chunksText}\n\n` +
            `Return ONLY a comma-separated list of chunk IDs in order of relevance (most relevant first).\n` +
            `For example: 2,0,5,1,3\n` +
            `Do not include any other text or explanation, only the comma-separated numbers.`,
        ),
      ];

      const response = await this.chatModel.invoke(messages);
      const responseText = response.content.toString().trim();

      // Parse the ranked IDs
      const rankedIds = responseText
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id) && id >= 0 && id < chunks.length);

      return rankedIds;
    } catch (error) {
      console.error("[AIService] Error reranking results:", error);
      // Fallback to original order if reranking fails
      return chunks.map((_, i) => i);
    }
  }

  // ============================================
  // ANSWER GENERATION METHODS
  // ============================================

  /**
   * Generate an answer based on context and question
   */
  async generateAnswer(
    context: string,
    question: string,
    stream?: boolean,
  ): Promise<string | IterableReadableStream<AIMessageChunk>> {
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          `You are a helpful assistant that answers questions based on the provided context.  Your task is to generate an answer to the user's question based on the provided context. 

          If the context does not contain relevant information or the question is unrelated, respond politely with something like:
          "I'm sorry, but I couldn't find any relevant information to answer that question based on the documents." 
          Do not make up information or guess.
         `,
        ),
        new HumanMessage(`Context:\n${context}\n\n Question: ${question}\n\n`),
      ];
      if (stream) {
        // Return the stream response directly
        return await this.answerModel.stream(messages);
      }
      const response = await this.answerModel.invoke(messages);
      return response.content.toString();
    } catch (error) {
      console.error("[AIService] Error generating answer:", error);
      throw new Error(`Failed to generate answer: ${(error as Error).message}`);
    }
  }

  /**
   * Generate an answer with citations
   */
  async generateAnswerWithCitations(
    chunks: Array<{ content: string; source?: string }>,
    question: string,
  ): Promise<string> {
    try {
      const context = chunks
        .map((chunk, i) => {
          const source = chunk.source || `Source ${i + 1}`;
          return `[${source}]:\n${chunk.content}`;
        })
        .join("\n\n---\n\n");

      const messages: BaseMessage[] = [
        new HumanMessage(
          `Answer the following question based on the provided context. ` +
            `Include citations using the source labels provided (e.g., [Source 1]).\n\n` +
            `Context:\n${context}\n\n` +
            `Question: ${question}\n\n` +
            `Answer (with citations):`,
        ),
      ];

      const response = await this.answerModel.invoke(messages);
      return response.content.toString();
    } catch (error) {
      console.error(
        "[AIService] Error generating answer with citations:",
        error,
      );
      throw new Error(`Failed to generate answer: ${(error as Error).message}`);
    }
  }

  // ============================================
  // SUMMARIZATION METHODS
  // ============================================

  /**
   * Summarize a document
   */
  async summarizeDocument(
    content: string,
    maxTokens: number = 500,
  ): Promise<string> {
    try {
      const summaryModel = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: "gpt-4-turbo-preview",
        temperature: 0.3,
        maxTokens,
      });

      const messages: BaseMessage[] = [
        new SystemMessage(
          "You are a helpful assistant that creates concise summaries.",
        ),
        new HumanMessage(
          `Please provide a comprehensive summary of the following document:\n\n${content}`,
        ),
      ];

      const response = await summaryModel.invoke(messages);
      return response.content.toString();
    } catch (error) {
      console.error("[AIService] Error summarizing document:", error);
      throw new Error(
        `Failed to summarize document: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Extract key points from a document
   */
  async extractKeyPoints(content: string): Promise<string[]> {
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          "You are a helpful assistant that extracts key points from documents.",
        ),
        new HumanMessage(
          `Extract the main key points from the following document. ` +
            `Return them as a numbered list, one point per line.\n\n${content}`,
        ),
      ];

      const response = await this.chatModel.invoke(messages);
      const points = response.content
        .toString()
        .split("\n")
        .filter((line) => line.trim().length > 0);

      return points;
    } catch (error) {
      console.error("[AIService] Error extracting key points:", error);
      throw new Error(
        `Failed to extract key points: ${(error as Error).message}`,
      );
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if the AI service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    chatModel: string;
    embeddingModel: string;
    embeddingDimensions: number;
  } {
    return {
      chatModel: this.chatModel.model || "unknown",
      embeddingModel: this.embeddings.model || "unknown",
      embeddingDimensions: this.embeddingDimensions,
    };
  }

  /**
   * Update model configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    if (config.chatModel) {
      this.chatModel = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: config.chatModel,
        temperature: 0,
        maxTokens: 500,
      });
    }

    if (config.embeddingModel || config.embeddingDimensions) {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.apiKey,
        modelName: config.embeddingModel || this.embeddings.modelName,
        dimensions: config.embeddingDimensions || this.embeddingDimensions,
      });
    }
  }

  /**
   * Generate a title for a chat query
   */
  async generateTitle(query: string): Promise<string | null> {
    try {
      // Use OpenAI to generate a meaningful title
      const response = await this.answerModel.invoke([
        new SystemMessage(
          "Generate a short and meaningful title for the following chat query.",
        ),
        new HumanMessage(query),
      ]);

      const title =
        typeof response.content === "string"
          ? response.content.trim()
          : DEFAULT_CHAT_TITLE.TITLE;

      return title;
    } catch {
      return null;
    }
  }
}
