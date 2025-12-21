# Storage Provider Plugin Specification

## Overview

Storage provider plugins implement the `IStorageProvider` interface to enable swappable storage backends for the PrintCon driver repository. This abstraction allows seamless migration between local disk, S3, Azure Blob, or custom storage solutions without changing application code.

## Interface Contract

All storage providers **MUST** implement the `IStorageProvider` interface:

```typescript
interface IStorageProvider {
    write(relativePath: string, buffer: Buffer): Promise<void>;
    read(relativePath: string): Promise<Buffer>;
    exists(relativePath: string): Promise<boolean>;
    delete(relativePath: string): Promise<void>;
    list(prefix: string): Promise<string[]>;
    getFileCount(): Promise<number>;
}
```

## Plugin Structure

```
storage-{name}/
├── index.ts          # Must export factory function
├── types.ts          # Re-export IStorageProvider from core
├── provider.ts       # Implementation class
├── config.json       # Provider-specific configuration
├── manifest.json     # Plugin manifest (type: storageProvider)
└── README.md         # Documentation
```

## Factory Function

Every storage provider **MUST** export a factory function following this naming convention:

```typescript
export function create{Name}Provider(config: any): IStorageProvider {
    return new {Name}Provider(config);
}
```

**Examples:**
- `createLocalDiskProvider(path: string)`
- `createS3Provider(config: S3Config)`
- `createAzureBlobProvider(config: AzureConfig)`

## Configuration

Storage providers are configured in `src/config/storage.json`:

```json
{
  "providerPlugin": "storage-localdisk",
  "providerConfig": {
    "repositoryPath": "C:\\PrintCon\\DriverRepository"
  }
}
```

**How It Works:**
1. The `providerPlugin` field specifies the plugin ID (must match registry entry)
2. The Core `StorageBroker` looks up the plugin in `src/core/registry.json`
3. The provider is dynamically imported using the registry path
4. The `providerConfig` is passed to the provider's factory function

**Key Benefit:** No Core code changes needed for new providers! Just install the plugin and update the config.

## Plugin Installation & Registry

Storage providers are installed like any other plugin:

```bash
npm run plugin:install storage-s3.plugin
```

This automatically:
1. Extracts the plugin to `plugins/storageProviders/storage-s3/`
2. Adds an entry to `src/core/registry.json`
3. Makes the provider available for configuration

**Registry Entry Example:**
```json
{
  "id": "storage-s3",
  "name": "Storage S3",
  "version": "1.0.0",
  "type": "storageProvider",
  "path": "plugins/storageProviders/storage-s3",
  "installedAt": "2025-12-20T12:00:00Z"
}
```

## Path Handling

### Path Format
- All paths are **relative** to the storage root
- Use forward slashes (`/`) even on Windows
- Example: `12/abc123def456.pd`

### Sharding Convention
Per the Driver Repository specification:
- **Single-Tier**: `{XX}/{hash}.pd` (e.g., `12/123456....pd`)
- **Two-Tier**: `{XX}/{YY}/{hash}.pd` (e.g., `12/34/123456....pd`)

Where:
- `XX` = First 2 characters of hash
- `YY` = Characters 3-4 of hash

### Provider Responsibilities
- **Directory Creation**: Providers must create parent directories on write
- **Path Normalization**: Handle platform-specific path separators internally
- **Case Handling**: Force hash strings to lowercase

## Method Specifications

### `write(relativePath, buffer)`
Writes a file to storage.

**Requirements:**
- Create parent directories if they don't exist
- Overwrite existing files
- Throw on permission/disk errors

**Example:**
```typescript
await provider.write('12/abc123.pd', buffer);
```

### `read(relativePath)`
Reads a file from storage.

**Requirements:**
- Return file content as Buffer
- **Throw error if file not found**

**Example:**
```typescript
const buffer = await provider.read('12/abc123.pd');
```

### `exists(relativePath)`
Checks if a file exists.

**Requirements:**
- Return `true` if file exists
- Return `false` if file doesn't exist
- **Never throw** - always return boolean

**Example:**
```typescript
if (await provider.exists('12/abc123.pd')) {
    // File exists
}
```

### `delete(relativePath)`
Deletes a file from storage.

**Requirements:**
- Remove the file
- Throw error if file not found
- Throw on permission errors

**Example:**
```typescript
await provider.delete('12/abc123.pd');
```

### `list(prefix)`
Lists all files with a given prefix.

**Requirements:**
- Return array of relative paths
- Recursively scan subdirectories
- Return empty array if prefix doesn't exist
- Filter results to match prefix

**Example:**
```typescript
const files = await provider.list('12/'); // All files in shard 12
```

### `getFileCount()`
Returns total number of files in storage.

**Requirements:**
- Count all `.pd` files
- Used for capacity monitoring
- Return 0 if storage is empty

**Example:**
```typescript
const count = await provider.getFileCount(); // 1,234,567
```

## Error Handling

| Method | File Not Found | Permission Error | Other Errors |
|--------|---------------|------------------|--------------|
| `write()` | Create file | Throw | Throw |
| `read()` | **Throw** | Throw | Throw |
| `exists()` | Return `false` | Return `false` | Return `false` |
| `delete()` | **Throw** | Throw | Throw |
| `list()` | Return `[]` | Throw | Throw |
| `getFileCount()` | Return `0` | Throw | Throw |

## Plugin Manifest

```json
{
  "id": "storage-{name}",
  "name": "Storage {Name}",
  "version": "1.0.0",
  "type": "storageProvider",
  "coreVersion": "^1.0.0",
  "requiredPermissions": [],
  "entryPoints": {
    "main": "index.ts"
  }
}
```

## Usage by Plugins

Plugins access storage through the `PluginAPI`:

```typescript
export const initialize: PluginInitializer = async (api) => {
    // Write a file
    await api.storage.write('12/abc123.pd', buffer);
    
    // Read a file
    const buffer = await api.storage.read('12/abc123.pd');
    
    // Check existence
    if (await api.storage.exists('12/abc123.pd')) {
        // File exists
    }
    
    // Delete a file
    await api.storage.delete('12/abc123.pd');
    
    // List files
    const files = await api.storage.list('12/');
};
```

## Example Implementations

### Local Disk
```typescript
export function createLocalDiskProvider(rootPath: string): IStorageProvider {
    return new LocalDiskProvider(rootPath);
}

class LocalDiskProvider implements IStorageProvider {
    constructor(private rootPath: string) {}
    
    async write(relativePath: string, buffer: Buffer): Promise<void> {
        const fullPath = path.join(this.rootPath, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buffer);
    }
    
    // ... other methods
}
```

### S3 (Future)
```typescript
export function createS3Provider(config: S3Config): IStorageProvider {
    return new S3Provider(config);
}

class S3Provider implements IStorageProvider {
    constructor(private config: S3Config) {}
    
    async write(relativePath: string, buffer: Buffer): Promise<void> {
        await s3.putObject({
            Bucket: this.config.bucket,
            Key: relativePath,
            Body: buffer
        });
    }
    
    // ... other methods
}
```

## Testing

Storage providers should include unit tests covering:
- ✅ Write creates directories
- ✅ Read returns correct content
- ✅ Exists returns true/false correctly
- ✅ Delete removes files
- ✅ List returns filtered results
- ✅ getFileCount returns accurate count
- ✅ Error handling for all methods

## Migration Between Providers

To switch storage providers:

1. **Install the new provider plugin:**
   ```bash
   npm run plugin:install storage-s3.plugin
   ```

2. **Update configuration:**
   ```json
   {
     "providerPlugin": "storage-s3",
     "providerConfig": {
       "bucket": "printcon-drivers",
       "region": "us-east-1"
     }
   }
   ```

3. **Restart application** - StorageBroker loads new provider from registry

4. **Migrate existing files** (if needed):
   ```typescript
   // The old provider is still in the registry
   const oldProvider = createLocalDiskProvider('C:\\Repo');
   const newProvider = createS3Provider(config);
   
   const files = await oldProvider.list('');
   for (const file of files) {
       const buffer = await oldProvider.read(file);
       await newProvider.write(file, buffer);
   }
   ```

**No Core Code Changes Required!** The registry-based loading system automatically discovers and loads the new provider.

---

**See Also:**
- [Driver Repository Specification](../.agent/rules/driverrepository.md)
- [Plugin Subsystem Documentation](./plugins/plugins-subsystem.md)
- [Local Disk Provider](../plugins/storageProviders/storage-localdisk/README.md)
