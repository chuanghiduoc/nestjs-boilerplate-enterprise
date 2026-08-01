import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  let storageRoot: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'nestjs-storage-'));
    adapter = new LocalStorageAdapter(
      new ConfigService({
        storage: { local: { path: storageRoot, baseUrl: '/uploads' } },
      }),
    );
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('rejects paths that escape the storage root', async () => {
    await expect(adapter.download('../secret.txt')).rejects.toThrow('escapes');
    await expect(adapter.delete('../secret.txt')).rejects.toThrow('escapes');
    await expect(adapter.copy('../secret.txt', 'copy.txt')).rejects.toThrow('escapes');
  });

  it('strips directory components from preserved filenames', async () => {
    const metadata = await adapter.upload(Buffer.from('content'), '../outside.txt', 'text/plain', {
      preserveOriginalName: true,
    });

    expect(metadata.path).toBe('outside.txt');
    await expect(readFile(join(storageRoot, 'outside.txt'), 'utf8')).resolves.toBe('content');
  });

  it('encodes public URL path segments', async () => {
    await adapter.upload(Buffer.from('content'), 'hello world.txt', 'text/plain', {
      preserveOriginalName: true,
    });

    expect(adapter.getPublicUrl('hello world.txt')).toBe('/uploads/hello%20world.txt');
  });
});
