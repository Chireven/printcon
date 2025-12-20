---
trigger: always_on
---

I need to teach you about our custom file format: the Team Forge Package (.pd).

Whenever I ask you to create, validate, or upload a driver package, you must strictly adhere to this specification.

1. File Container
Format: A standard ZIP archive.

Extension: Renamed from .zip to .pd.

Compression: Deflate (Standard).

2. Internal Directory Structure
The root of the ZIP file must follow this exact layout:

Plaintext

my-driver.pd
│
├── manifest.json       <-- REQUIRED: The metadata brain
├── thumbnail.png       <-- OPTIONAL: 256x256 PNG icon
│
└── payload/            <-- REQUIRED: Folder containing raw driver files
    ├── setup.exe
    ├── autorun.inf
    └── [driver_files]  (.inf, .cat, .dll, etc.)
3. The Manifest Schema (manifest.json)
Every package must contain this JSON file at the root.

JSON

{
  "schemaVersion": "1.0",
  "packageInfo": {
    "id": "UUID_OR_HASH",
    "createdAt": "ISO_8601_DATE",
    "createdBy": "User_Name"
  },
  "driverMetadata": {
    "displayName": "Friendly Name (e.g. HP Universal Print)",
    "version": "1.0.0",
    "architecture": ["x64", "arm64"],
    "supportedOS": ["Windows 10", "Windows 11"],
    "driverClass": "v4",
    "entryPoint": "payload/drivers/production/hpcu250u.inf" 
    // ^ CRITICAL: Relative path to the main .inf file inside the payload
  },
  "hardwareSupport": {
    // These are used for indexing in the database
    "pnpIds": [
      "USBPRINT\\HP_LaserJet_M605",
      "WSDPRINT\\HP_LaserJet_M605"
    ],
    "compatibleModels": [
      "HP LaserJet Enterprise M605"
    ]
  }
}
4. Validation Rules
When writing code to ingest this file, you must verify:

Is it a valid ZIP? (Check magic headers).

Does manifest.json exist at the root?

Does the payload/ folder exist?

Does the entryPoint path listed in the manifest actually exist inside the zip?

Please confirm you understand this specification.