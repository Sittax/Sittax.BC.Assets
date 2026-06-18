import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { config } from "@/lib/config";

/** Contrato de storage injetável — facilita fake em memória para testes. */
export interface Storage {
  salvar(chave: string, buffer: Buffer, mime: string): Promise<void>;
  abrirStream(chave: string): Promise<{ stream: Readable; mime: string }>;
}

/** Implementação real via MinIO (SDK S3). */
class MinioStorage implements Storage {
  private client: S3Client;
  private bucket: string;
  private inicializado = false;

  constructor() {
    this.client = new S3Client({
      endpoint: config.MINIO_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.MINIO_ACCESS_KEY,
        secretAccessKey: config.MINIO_SECRET_KEY,
      },
      forcePathStyle: config.MINIO_FORCE_PATH_STYLE,
      // Sem retry/backoff: se o MinIO está fora, falha NA HORA — o importador
      // não pode travar minutos tentando reconectar a cada imagem.
      maxAttempts: 1,
    });
    this.bucket = config.MINIO_BUCKET;
  }

  /** Garante que o bucket existe antes do primeiro uso. */
  private async garantirBucket() {
    if (this.inicializado) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.inicializado = true;
  }

  async salvar(chave: string, buffer: Buffer, mime: string): Promise<void> {
    await this.garantirBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: buffer,
        ContentType: mime,
      }),
    );
  }

  async abrirStream(chave: string): Promise<{ stream: Readable; mime: string }> {
    await this.garantirBucket();
    const resp = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: chave }),
    );
    const body = resp.Body;
    if (!body) throw new Error(`Objeto não encontrado: ${chave}`);
    return {
      stream: body as unknown as Readable,
      mime: resp.ContentType ?? "application/octet-stream",
    };
  }
}

/** Implementação fake em memória para testes (injetada via interface). */
export class MemoryStorage implements Storage {
  private store = new Map<string, { buffer: Buffer; mime: string }>();

  async salvar(chave: string, buffer: Buffer, mime: string): Promise<void> {
    this.store.set(chave, { buffer, mime });
  }

  async abrirStream(chave: string): Promise<{ stream: Readable; mime: string }> {
    const entry = this.store.get(chave);
    if (!entry) throw new Error(`Objeto não encontrado: ${chave}`);
    const stream = Readable.from(entry.buffer);
    return { stream, mime: entry.mime };
  }

  /** Utilitário de teste: verifica se a chave existe. */
  tem(chave: string): boolean {
    return this.store.has(chave);
  }
}

let _storage: Storage | null = null;

/** Instância singleton de storage (lazy — não inicializa no build). */
export function getStorage(): Storage {
  if (!_storage) _storage = new MinioStorage();
  return _storage;
}
