import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createHash } from 'crypto';
import { Readable, pipeline } from 'stream';
import { generateUUID } from '@shared/utils';
import { promisify } from 'util';
import type {
  IStorageService,
  FileMetadata,
  UploadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
} from '@core/domain/ports/services';

const pipelineAsync = promisify(pipeline);

/**
 * Local Storage Adapter
 *
 * Section 2.4: Infrastructure Layer - Storage Adapter
 *
 * Stores files on the local filesystem.
 * Suitable for development and single-server deployments.
 */
@Injectable()
export class LocalStorageAdapter implements IStorageService {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = path.resolve(this.configService.get<string>('storage.local.path', './uploads'));
    this.baseUrl = this.configService.get<string>('storage.local.baseUrl', '/uploads');
  }

  private resolvePath(filePath: string): { absolutePath: string; relativePath: string } {
    if (!filePath || filePath.includes('\0') || path.isAbsolute(filePath)) {
      throw new Error('Invalid storage path');
    }

    const absolutePath = path.resolve(this.basePath, filePath);
    const relativePath = path.relative(this.basePath, absolutePath);
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error('Storage path escapes the configured root');
    }

    return { absolutePath, relativePath };
  }

  private getFileUrl(filePath: string): string {
    const normalizedPath = this.resolvePath(filePath).relativePath.replace(/\\/g, '/');
    const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl.replace(/\/$/, '')}/${encodedPath}`;
  }

  async upload(
    file: Buffer | NodeJS.ReadableStream,
    originalName: string,
    mimeType: string,
    options: UploadOptions = {},
  ): Promise<FileMetadata> {
    const directory = options.directory || '';
    const safeOriginalName = path.basename(originalName);
    const extension = path.extname(safeOriginalName);
    const filename = options.preserveOriginalName
      ? safeOriginalName
      : `${path.basename(options.filename || generateUUID())}${extension}`;

    const { relativePath, absolutePath } = this.resolvePath(path.join(directory, filename));

    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // Write file
    let size: number;
    let hash: string;

    if (Buffer.isBuffer(file)) {
      await fs.writeFile(absolutePath, file);
      size = file.length;
      hash = createHash('sha256').update(file).digest('hex');
    } else {
      // Stream upload
      const writeStream = createWriteStream(absolutePath);
      const hashStream = createHash('sha256');

      size = 0;
      const readable = file as Readable;

      await pipelineAsync(
        readable,
        async function* (source) {
          for await (const chunk of source) {
            size += (chunk as Buffer).length;
            hashStream.update(chunk as Buffer);
            yield chunk;
          }
        },
        writeStream,
      );

      hash = hashStream.digest('hex');
    }

    const metadata: FileMetadata = {
      originalName,
      mimeType,
      size,
      path: relativePath.replace(/\\/g, '/'),
      url: this.getFileUrl(relativePath),
      etag: hash,
      uploadedAt: new Date(),
      metadata: options.metadata,
    };

    this.logger.debug(`File uploaded: ${relativePath}`);

    return metadata;
  }

  async download(filePath: string): Promise<Buffer> {
    const { absolutePath } = this.resolvePath(filePath);
    return fs.readFile(absolutePath);
  }

  getStream(filePath: string): Promise<NodeJS.ReadableStream> {
    const { absolutePath } = this.resolvePath(filePath);
    return Promise.resolve(createReadStream(absolutePath));
  }

  async delete(filePath: string): Promise<void> {
    const { absolutePath } = this.resolvePath(filePath);
    try {
      await fs.unlink(absolutePath);
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async deleteMany(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => this.delete(p)));
  }

  async exists(filePath: string): Promise<boolean> {
    const { absolutePath } = this.resolvePath(filePath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata | null> {
    const { absolutePath, relativePath } = this.resolvePath(filePath);
    try {
      const stats = await fs.stat(absolutePath);
      const content = await fs.readFile(absolutePath);
      const hash = createHash('sha256').update(content).digest('hex');

      return {
        originalName: path.basename(relativePath),
        mimeType: 'application/octet-stream', // Would need mime-types library for accurate detection
        size: stats.size,
        path: relativePath.replace(/\\/g, '/'),
        url: this.getFileUrl(relativePath),
        etag: hash,
        uploadedAt: stats.birthtime,
      };
    } catch {
      return null;
    }
  }

  getSignedUrl(filePath: string, _options: SignedUrlOptions = {}): Promise<string> {
    // Local storage doesn't support signed URLs
    // Return the public URL instead
    return Promise.resolve(this.getFileUrl(filePath));
  }

  getUploadSignedUrl(
    filePath: string,
    _mimeType: string,
    _options: SignedUrlOptions = {},
  ): Promise<{ url: string; fields?: Record<string, string> }> {
    // Local storage doesn't support presigned uploads
    // Return direct upload endpoint
    const safePath = this.resolvePath(filePath).relativePath.replace(/\\/g, '/');
    return Promise.resolve({
      url: `/api/v1/files/upload?path=${encodeURIComponent(safePath)}`,
    });
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const prefix = options.prefix || '.';
    const limit = Math.min(Math.max(options.limit || 100, 1), 1000);
    const { absolutePath: searchPath, relativePath: safePrefix } = this.resolvePath(prefix);

    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      const files: FileMetadata[] = [];

      for (const entry of entries.slice(0, limit)) {
        if (entry.isFile()) {
          const filePath = path.join(safePrefix, entry.name);
          if (options.includeMetadata) {
            const metadata = await this.getMetadata(filePath);
            if (metadata) {
              files.push(metadata);
            }
          } else {
            files.push({
              originalName: entry.name,
              mimeType: 'application/octet-stream',
              size: 0,
              path: filePath.replace(/\\/g, '/'),
              url: this.getFileUrl(filePath),
              uploadedAt: new Date(),
            });
          }
        }
      }

      return {
        files,
        hasMore: entries.length > limit,
      };
    } catch {
      return { files: [], hasMore: false };
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<FileMetadata> {
    const { absolutePath: sourceAbsolute } = this.resolvePath(sourcePath);
    const { absolutePath: destAbsolute, relativePath: safeDestinationPath } =
      this.resolvePath(destinationPath);

    await fs.mkdir(path.dirname(destAbsolute), { recursive: true });
    await fs.copyFile(sourceAbsolute, destAbsolute);

    const metadata = await this.getMetadata(safeDestinationPath);
    if (!metadata) {
      throw new Error('Failed to copy file');
    }
    return metadata;
  }

  async move(sourcePath: string, destinationPath: string): Promise<FileMetadata> {
    const metadata = await this.copy(sourcePath, destinationPath);
    await this.delete(sourcePath);
    return metadata;
  }

  getPublicUrl(filePath: string): string | null {
    return this.getFileUrl(filePath);
  }
}
