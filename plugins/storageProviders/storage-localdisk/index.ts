import fs from 'fs';
import path from 'path';
import type { IStorageProvider } from '../../../src/core/types/storage';

export class LocaldiskProvider implements IStorageProvider {
  private rootPath: string;

  constructor(config: string | { repositoryPath: string }) {
    // Handle both string config (legacy/simple) and object config
    const incomingPath = typeof config === 'string' ? config : config?.repositoryPath;

    if (!incomingPath) {
      throw new Error('LocaldiskProvider requires a valid repositoryPath.');
    }

    // Ensure absolute path
    this.rootPath = path.isAbsolute(incomingPath)
      ? incomingPath
      : path.join(process.cwd(), incomingPath);

    // Ensure root directory exists
    if (!fs.existsSync(this.rootPath)) {
      fs.mkdirSync(this.rootPath, { recursive: true });
    }
  }

  private getFullPath(relativePath: string): string {
    // Security check to prevent directory traversal
    const resolvedPath = path.resolve(this.rootPath, relativePath);
    if (!resolvedPath.startsWith(this.rootPath)) {
      throw new Error('Access denied: Path traversal detected.');
    }
    return resolvedPath;
  }

  async write(relativePath: string, buffer: Buffer): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(relativePath);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${relativePath}`);
      }
      throw error;
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(relativePath);
    try {
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    try {
      await fs.promises.unlink(fullPath);

      // Optional: Clean up empty parent directories? 
      // For now, keep it simple.
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Ignore if already gone
        return;
      }
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const fullPath = this.getFullPath(prefix);
    const results: string[] = [];

    // If prefix points to a file, return it? 
    // Typically prefix implies a directory in object storage terms.
    // But in FS, it might be a partial name.
    // Let's assume prefix is a Directory.

    // If the directory doesn't exist, return empty
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const stat = await fs.promises.stat(fullPath);
    if (!stat.isDirectory()) {
      return [];
    }

    const files = await fs.promises.readdir(fullPath);
    // We return relative paths from the prefix? 
    // The interface says "Array of relative paths".
    // Usually relative to the STORAGE ROOT.

    for (const file of files) {
      // Join prefix + file. 
      // Note: This is shallow listing.
      // S3 'list' is often recursive or has shallow option.
      // Let's implement shallow listing for now as it's standard for directory listing.
      results.push(path.join(prefix, file).replace(/\\/g, '/'));
    }

    return results;
  }

  async getFileCount(): Promise<number> {
    // Recursive count
    let count = 0;

    const countDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await countDir(path.join(dir, entry.name));
        } else {
          count++;
        }
      }
    };

    if (fs.existsSync(this.rootPath)) {
      await countDir(this.rootPath);
    }

    return count;
  }
}

export const createLocaldiskProvider = (config: any) => new LocaldiskProvider(config);
