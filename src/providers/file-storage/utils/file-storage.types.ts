export interface IUploadFile {
  key: string;
  buffer: Buffer;
  mimeType: string;
}

export interface IPreSignedUrlOptions {
  expiresIn?: number;
  operation?: "put" | "get";
}

export type TStorageProvider = "s3" | "azure" | "gcp";

export interface IPreSignedUrl {
  url: string;
  keyFile: string;
}

export interface IUploadProvider {
  upload(file: IUploadFile): Promise<{ key: string }>;
  uploadMany(files: IUploadFile[]): Promise<{ key: string }[]>;
  delete(key: string): Promise<void>;
  getPreSignedUrl(
    key: string,
    mimeType: string,
    options?: IPreSignedUrlOptions,
  ): Promise<IPreSignedUrl>;
}

export enum STORAGE_PROVIDER {
  S3 = "s3",
  AZURE = "azure",
  GCP = "gcp",
}
