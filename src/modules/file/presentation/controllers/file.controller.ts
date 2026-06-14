import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Readable } from 'stream';
import { Auth, ApiStandardResponses } from '@shared/decorators';
import {
  STORAGE_SERVICE,
  type IStorageService,
  type FileMetadata,
} from '@core/domain/ports/services';
import {
  UploadFileDto,
  FileResponseDto,
  RequestPresignedUrlDto,
  PresignedUrlResponseDto,
  DeleteFileDto,
  DeleteFilesDto,
} from '../dtos/file.dto';

/**
 * File Controller
 *
 * Handles file upload, download, and management.
 *
 * Section 7: Infrastructure Components - File Storage
 */
@ApiTags('Files')
@Controller('files')
export class FileController {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('storage.upload.maxFileSize', 10485760);
    this.allowedMimeTypes = this.configService.get<string[]>('storage.upload.allowedMimeTypes', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ]);
  }

  /**
   * Upload a single file
   * POST /files/upload
   */
  @Post('upload')
  @Auth({ permissions: ['files:upload'] })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        directory: { type: 'string' },
        public: { type: 'boolean' },
      },
      required: ['file'],
    },
  })
  @ApiStandardResponses()
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ): Promise<{ data: FileResponseDto }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateFile(file);

    const metadata = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        directory: dto.directory,
        public: dto.public,
      },
    );

    return {
      data: this.toFileResponse(metadata),
    };
  }

  /**
   * Upload multiple files
   * POST /files/upload-multiple
   */
  @Post('upload-multiple')
  @Auth({ permissions: ['files:upload'] })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        directory: { type: 'string' },
        public: { type: 'boolean' },
      },
      required: ['files'],
    },
  })
  @ApiStandardResponses()
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
  ): Promise<{ data: FileResponseDto[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    files.forEach((file) => {
      this.validateFile(file);
    });

    const results = await Promise.all(
      files.map((file) =>
        this.storageService.upload(file.buffer, file.originalname, file.mimetype, {
          directory: dto.directory,
          public: dto.public,
        }),
      ),
    );

    return {
      data: results.map((m) => this.toFileResponse(m)),
    };
  }

  /**
   * Get presigned URL for direct upload
   * POST /files/presigned-url
   */
  @Post('presigned-url')
  @Auth({ permissions: ['files:upload'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get presigned URL for direct upload to storage' })
  @ApiBearerAuth()
  @ApiStandardResponses()
  async getPresignedUploadUrl(
    @Body() dto: RequestPresignedUrlDto,
  ): Promise<{ data: PresignedUrlResponseDto }> {
    if (!this.allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    const extension = dto.filename.split('.').pop() || '';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const path = dto.directory ? `${dto.directory}/${filename}` : filename;

    const result = await this.storageService.getUploadSignedUrl(path, dto.mimeType, {
      expiresIn: 3600,
    });

    return {
      data: {
        url: result.url,
        path,
        fields: result.fields,
        expiresIn: 3600,
      },
    };
  }

  /**
   * Download a file
   * GET /files/download/:path
   */
  @Get('download/*path')
  @Auth({ permissions: ['files:read'] })
  @ApiOperation({ summary: 'Download a file' })
  @ApiBearerAuth()
  async downloadFile(
    @Param('path') pathParam: string | string[],
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = this.normalizeWildcardPath(pathParam);
    const exists = await this.storageService.exists(filePath);
    if (!exists) {
      throw new NotFoundException('File not found');
    }

    const metadata = await this.storageService.getMetadata(filePath);
    const stream = await this.storageService.getStream(filePath);

    res.set({
      'Content-Type': metadata?.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${metadata?.originalName || 'download'}"`,
    });

    return new StreamableFile(stream as Readable);
  }

  /**
   * Get file metadata
   * GET /files/metadata/:path
   */
  @Get('metadata/*path')
  @Auth({ permissions: ['files:read'] })
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiBearerAuth()
  @ApiStandardResponses({ includeNotFound: true })
  async getFileMetadata(
    @Param('path') pathParam: string | string[],
  ): Promise<{ data: FileResponseDto }> {
    const filePath = this.normalizeWildcardPath(pathParam);
    const metadata = await this.storageService.getMetadata(filePath);

    if (!metadata) {
      throw new NotFoundException('File not found');
    }

    return {
      data: this.toFileResponse(metadata),
    };
  }

  /**
   * Get signed URL for temporary access
   * GET /files/signed-url
   */
  @Get('signed-url')
  @Auth({ permissions: ['files:read'] })
  @ApiOperation({ summary: 'Get signed URL for temporary file access' })
  @ApiBearerAuth()
  @ApiStandardResponses()
  async getSignedUrl(
    @Query('path') filePath: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<{ data: { url: string; expiresIn: number } }> {
    const exists = await this.storageService.exists(filePath);
    if (!exists) {
      throw new NotFoundException('File not found');
    }

    const expiry = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const url = await this.storageService.getSignedUrl(filePath, { expiresIn: expiry });

    return {
      data: {
        url,
        expiresIn: expiry,
      },
    };
  }

  /**
   * Delete a file
   * DELETE /files
   */
  @Delete()
  @Auth({ permissions: ['files:delete'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file' })
  @ApiBearerAuth()
  @ApiStandardResponses()
  async deleteFile(@Body() dto: DeleteFileDto): Promise<{ data: { deleted: boolean } }> {
    const exists = await this.storageService.exists(dto.path);
    if (!exists) {
      throw new NotFoundException('File not found');
    }

    await this.storageService.delete(dto.path);

    return {
      data: { deleted: true },
    };
  }

  /**
   * Delete multiple files
   * DELETE /files/batch
   */
  @Delete('batch')
  @Auth({ permissions: ['files:delete'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete multiple files' })
  @ApiBearerAuth()
  @ApiStandardResponses()
  async deleteMultipleFiles(@Body() dto: DeleteFilesDto): Promise<{ data: { deleted: number } }> {
    await this.storageService.deleteMany(dto.paths);

    return {
      data: { deleted: dto.paths.length },
    };
  }

  /**
   * Normalize an Express 5 wildcard (`*path`) parameter into a file path.
   *
   * path-to-regexp v8 captures wildcard segments as an array, so a request for
   * `download/a/b/c.png` yields `['a', 'b', 'c.png']` which we rejoin with "/".
   */
  private normalizeWildcardPath(pathParam: string | string[]): string {
    return Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  /**
   * Convert FileMetadata to FileResponseDto
   */
  private toFileResponse(metadata: FileMetadata): FileResponseDto {
    return {
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      path: metadata.path,
      url: metadata.url,
      etag: metadata.etag,
      uploadedAt: metadata.uploadedAt.toISOString(),
    };
  }
}
