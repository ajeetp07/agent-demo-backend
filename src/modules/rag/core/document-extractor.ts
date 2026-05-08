import { IDocumentExtractor } from "@/modules/rag/utils/rag.types";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import * as XLSX from "xlsx";

export class DocumentExtractorService implements IDocumentExtractor {
  supportedTypes(): string[] {
    return [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv",
      "application/json",
      "text/html",
      "text/markdown",
    ];
  }

  isSupportedFileType(fileType: string): boolean {
    return this.supportedTypes().includes(fileType);
  }

  async extractText(
    fileContent: string | Buffer,
    fileType: string,
  ): Promise<string> {
    try {
      switch (fileType) {
        case "text/plain":
        case "text/markdown":
        case "text/html":
          return this.extractPlainText(fileContent);

        case "application/pdf":
          return await this.extractPDF(fileContent);

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/msword":
          return await this.extractWord(fileContent);

        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        case "application/vnd.ms-excel":
          return this.extractExcel(fileContent);

        case "text/csv":
          return this.extractCSV(fileContent);

        case "application/json":
          return this.extractJSON(fileContent);

        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error("Error extracting text:", error);
      throw new Error(`Failed to extract text: ${(error as Error).message}`);
    }
  }

  private extractPlainText(content: string | Buffer): string {
    if (Buffer.isBuffer(content)) {
      return content.toString("utf-8");
    }
    return content;
  }

  private async extractPDF(content: string | Buffer): Promise<string> {
    try {
      const buffer = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content, "base64");

      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${(error as Error).message}`);
    }
  }

  private async extractWord(content: string | Buffer): Promise<string> {
    try {
      const buffer = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content, "base64");

      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(
        `Word document extraction failed: ${(error as Error).message}`,
      );
    }
  }

  private extractExcel(content: string | Buffer): string {
    try {
      const buffer = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content, "base64");

      const workbook = XLSX.read(buffer, { type: "buffer" });
      let text = "";

      // Extract text from all sheets
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n=== Sheet: ${sheetName} ===\n`;
        text += XLSX.utils.sheet_to_txt(sheet);
      });

      return text;
    } catch (error) {
      throw new Error(`Excel extraction failed: ${(error as Error).message}`);
    }
  }

  private extractCSV(content: string | Buffer): string {
    try {
      const text = Buffer.isBuffer(content)
        ? content.toString("utf-8")
        : content;

      // Convert CSV to readable text format
      const rows = text
        .split("\n")
        .map((row) => row.trim())
        .filter((row) => row);
      const headers = rows[0];

      let formatted = `Headers: ${headers}\n\n`;
      formatted += rows.slice(1).join("\n");

      return formatted;
    } catch (error) {
      throw new Error(`CSV extraction failed: ${(error as Error).message}`);
    }
  }

  private extractJSON(content: string | Buffer): string {
    try {
      const text = Buffer.isBuffer(content)
        ? content.toString("utf-8")
        : content;

      const json = JSON.parse(text);

      // Convert JSON to readable text format
      return this.jsonToText(json);
    } catch (error) {
      throw new Error(`JSON extraction failed: ${(error as Error).message}`);
    }
  }

  private jsonToText(obj: any, prefix: string = ""): string {
    let text = "";

    if (typeof obj === "object" && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          text += `${prefix}[${index}]:\n`;
          text += this.jsonToText(item, prefix + "  ");
        });
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            text += `${prefix}${key}:\n`;
            text += this.jsonToText(value, prefix + "  ");
          } else {
            text += `${prefix}${key}: ${value}\n`;
          }
        });
      }
    } else {
      text += `${prefix}${obj}\n`;
    }

    return text;
  }
}
