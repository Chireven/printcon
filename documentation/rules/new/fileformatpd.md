---
trigger: always_on
---

# PrintCon Driver Package (.pd) File Format Specification

## Overview

The `.pd` (Package Driver) file format is a standardized container for Windows printer drivers used by the PrintCon management system. It provides a structured, validated approach to driver distribution and deployment.

**Purpose:** Whenever you create, validate, or upload a driver package, you must strictly adhere to this specification.

---

## File Structure

### Container Format

- **Type**: ZIP archive (DEFLATE compression)
- **Extension**: `.pd` (renamed from `.zip`)
- **Encoding**: Standard ZIP format

### Internal Directory Layout

```
driver-package.pd
│
├── manifest.json          (REQUIRED - Package metadata)
├── thumbnail.png          (OPTIONAL - 256x256 PNG icon)
│
└── payload/               (REQUIRED - Driver files directory)
    ├── setup.exe
    ├── autorun.inf
    ├── driver.inf         (Main driver INF file)
    ├── driver.cat         (Catalog file)
    ├── driver.dll         (Driver binaries)
    └── [driver_files]     (.inf, .cat, .dll, .gpd, .ppd, etc.)
```

---

## Manifest Schema

The `manifest.json` file **must** exist at the root of the ZIP archive and conform to the following schema.

### Schema Version 1.0

```json
{
  "schemaVersion": "1.0",
  "packageInfo": {
    "id": "UUID_OR_HASH",
    "createdAt": "ISO_8601_DATE",
    "createdBy": "USERNAME"
  },
  "driverMetadata": {
    "displayName": "Friendly Name (e.g. HP Universal Print)",
    "version": "1.0.0.0",
    "architecture": ["x64", "arm64"],
    "supportedOS": ["Windows 10", "Windows 11"],
    "driverClass": "v4",
    "entryPoint": "payload/drivers/production/hpcu250u.inf"
  },
  "hardwareSupport": {
    "pnpIds": [
      "USBPRINT\\HP_LaserJet_M605",
      "WSDPRINT\\HP_LaserJet_M605"
    ],
    "compatibleModels": [
      "HP LaserJet Enterprise M605"
    ]
  }
}
```

### Field Definitions

#### `schemaVersion` (string, required)
- **Purpose**: Identifies the manifest format version
- **Current Version**: `"1.0"`
- **Format**: Semantic versioning string

#### `packageInfo` (object, required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ Yes | Unique identifier (UUID v4 recommended) |
| `createdAt` | string | ✅ Yes | ISO 8601 timestamp (e.g., `2024-12-20T12:00:00Z`) |
| `createdBy` | string | ✅ Yes | Username or system identifier |

#### `driverMetadata` (object, required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | string | ✅ Yes | Human-readable driver name |
| `version` | string | ✅ Yes | Driver version (e.g., `1.0.0.0`) |
| `architecture` | array[string] | ✅ Yes | Supported architectures: `x64`, `x86`, `arm64`, `amd64` |
| `supportedOS` | array[string] | ✅ Yes | Compatible Windows versions |
| `driverClass` | string | ✅ Yes | Driver class: `v3`, `v4`, or `universal` |
| `entryPoint` | string | ✅ Yes | **Relative path** to main INF file within the package |

> [!IMPORTANT]
> **Critical - Entry Point Path:** The `entryPoint` must be a valid relative path to the main `.inf` file inside the payload directory. Example: `payload/hpcu250u.inf` or `payload/drivers/production/hpcu250u.inf`

#### `hardwareSupport` (object, required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pnpIds` | array[string] | ✅ Yes | Plug and Play hardware IDs |
| `compatibleModels` | array[string] | ✅ Yes | Human-readable model names |

**PnP ID Format Examples:**
- USB: `USBPRINT\Manufacturer_ModelABCD`
- WSD: `WSDPRINT\Manufacturer_Model`
- Network: `LPTENUM\Manufacturer_Model`

---

## Validation Rules

A valid `.pd` package **must** satisfy all of the following:

### 1. ZIP Structure Validation
- ✅ File is a valid ZIP archive (check magic headers)
- ✅ Can be opened with standard ZIP tools
- ✅ Uses DEFLATE compression

### 2. Manifest Validation
- ✅ `manifest.json` exists at the **root** of the ZIP
- ✅ JSON is well-formed and parsable
- ✅ All required fields are present
- ✅ Field types match schema definitions
- ✅ `schemaVersion` is `"1.0"`

### 3. Payload Validation
- ✅ `payload/` directory exists
- ✅ Contains at least one file
- ✅ `entryPoint` file exists at the specified path
- ✅ Entry point is a valid `.inf` file

### 4. Entry Point Validation
- ✅ File specified in `driverMetadata.entryPoint` exists
- ✅ Path is relative to package root
- ✅ File is located within `payload/` directory
- ✅ File has `.inf` extension
- ✅ Entry point path listed in manifest actually exists inside the zip

---

## Example: Complete Package

### Directory Structure
```
Brother_MFC-L2710DW.pd
│
├── manifest.json
├── thumbnail.png
│
└── payload/
    ├── BRPRM17A.INF
    ├── BRPRM17A.CAT
    ├── BRPRM17A.DLL
    ├── BRPRM17A.GPD
    └── [additional files]
```

### manifest.json
```json
{
  "schemaVersion": "1.0",
  "packageInfo": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": "2024-12-20T15:30:00Z",
    "createdBy": "admin"
  },
  "driverMetadata": {
    "displayName": "Brother MFC-L2710DW series",
    "version": "1.0.0.0",
    "architecture": ["x64", "amd64"],
    "supportedOS": [
      "Windows 10",
      "Windows 11",
      "Windows Server 2019",
      "Windows Server 2022"
    ],
    "driverClass": "v4",
    "entryPoint": "payload/BRPRM17A.INF"
  },
  "hardwareSupport": {
    "pnpIds": [
      "USBPRINT\\BrotherMFC-L2710DW_se6610",
      "WSDPRINT\\BrotherMFC-L2710DW"
    ],
    "compatibleModels": [
      "Brother MFC-L2710DW",
      "Brother DCP-L2510D",
      "Brother HL-L2310D"
    ]
  }
}
```

---

## Creating a .pd Package

### Manual Creation

1. **Create directory structure:**
   ```powershell
   mkdir my-driver
   cd my-driver
   mkdir payload
   ```

2. **Copy driver files to `payload/`:**
   ```powershell
   copy C:\DriverSource\*.* payload\
   ```

3. **Create `manifest.json`** at root with required fields

4. **Create ZIP archive:**
   ```powershell
   Compress-Archive -Path .\* -DestinationPath driver.zip
   ```

5. **Rename to `.pd`:**
   ```powershell
   Rename-Item driver.zip driver.pd
   ```

### Automated Creation (PrintCon CLI)

```bash
npm run pack-driver -- --input "C:\Drivers\HP-LaserJet" --output "C:\Packages"
```

The CLI tool automatically:
- Scans for INF files
- Extracts metadata from INF
- Generates compliant manifest
- Creates ZIP structure
- Outputs `.pd` file

---

## Database Integration

When a `.pd` package is uploaded to PrintCon, the following occurs:

### 1. Package Storage
- **Hash**: SHA256 of entire package
- **Deduplication**: Packages with identical hashes are not re-stored
- **Storage**: File system storage using hash as filename

### 2. Database Records

**Packages Table:**
```sql
INSERT INTO [plg_printer_drivers].Packages (
    PackageId,           -- From manifest.packageInfo.id
    OriginalFilename,    -- Original .pd filename
    StorageHash,         -- SHA256 hash
    UploadedBy,          -- Username
    CreatedAt            -- Upload timestamp
)
```

**SupportedModels Table:**
```sql
-- One record per PnP ID
INSERT INTO [plg_printer_drivers].SupportedModels (
    PackageId,           -- Foreign key to Packages.Id
    ModelName,           -- From hardwareSupport.compatibleModels
    HardwareId           -- From hardwareSupport.pnpIds
)
```

---

## Common Errors and Solutions

### "Invalid ZIP file"
- **Cause**: File is corrupted or not a valid ZIP
- **Solution**: Re-create the ZIP archive using standard tools

### "manifest.json not found at root"
- **Cause**: Manifest is missing or in wrong location
- **Solution**: Ensure `manifest.json` is at the root, not in a subdirectory

### "entryPoint not found in package"
- **Cause**: Path in manifest doesn't match actual file location
- **Solution**: Verify `entryPoint` path is correct and file exists

### "INF file is not a printer driver"
- **Cause**: Entry point INF is not a printer driver class
- **Solution**: Ensure INF has `Class=Printer` or printer ClassGuid

### "Invalid column name 'UploadedAt'"
- **Cause**: Database schema mismatch
- **Solution**: Run schema validation/migration

---

## Best Practices

### Naming Conventions
- **Package ID**: Use UUID v4 for uniqueness
- **Display Name**: Use manufacturer + model (e.g., "HP LaserJet M605")
- **Filename**: Use descriptive names (e.g., `HP_LaserJet_M605.pd`)

### Version Management
- Use semantic versioning for `driverMetadata.version`
- Increment version for driver updates
- Keep `schemaVersion` at `"1.0"` unless format changes

### Hardware Support
- Include all PnP IDs for the driver
- List all compatible models, not just primary model
- Use official hardware ID strings from INF files

### Payload Organization
- Keep original driver folder structure
- Include all dependencies (DLLs, GPDs, PPDs)
- Don't modify driver files

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-20 | Initial specification |

---

## Related Documentation

- [pack-driver CLI Tool](../scripts/pack-driver.ts)
- [PDPackageBuilder Utility](../plugins/printers/printer-drivers/pd-builder.ts)
- [Database Schema](../plugins/printers/printer-drivers/manifest.json)

---

*This specification is maintained by the PrintCon development team.*
