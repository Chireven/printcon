# INFpossible

**Making the impossible (understanding INF files) possible!**

## Overview

INFpossible is a modular Windows INF file parser and analyzer for the PrintCon printer-drivers plugin. It provides:

- 📖 **Parsing**: Structured INF file parsing with line-by-line processing
- 🔍 **Analysis**: Metadata extraction (hardware IDs, models, version, isolation compatibility)
- 🗂️ **Dependencies**: File dependency tracking with compression-aware validation
- 🔧 **Integration**: Drop-in replacement for legacy parsing logic

## Modules

### Core (`parser.ts`, `resolver.ts`)
- `InfParser.parseInfFile()` - Parse INF into structured sections
- `InfResolver.resolveStrings()` - Handle %StringID% substitution
- `InfResolver.expandCopyFiles()` - Expand CopyFiles directives

### Metadata (`analyzer.ts`)
- `InfAnalyzer.extractDriverMetadata()` - Complete metadata extraction
- `InfAnalyzer.extractDriverIsolation()` - Type 3 driver isolation detection
- `InfAnalyzer.detectDriverClass()` - v3/v4/universal classification

### Dependencies (`dependencies.ts`, `compression.ts`)
- `DependencyTracker.buildDependencyGraph()` - Track all referenced files
- `DependencyTracker.validateDependencies()` - Compression-aware file validation
- `CompressionMapper.findFileVariants()` - Handle .dll ↔ .dl_ mapping

## Usage

```typescript
import { InfParser, InfResolver, InfAnalyzer } from './infpossible';

// Parse INF file
const content = await fs.readFile('driver.inf', 'utf8');
const parsed = InfParser.parseInfFile(content, 'driver.inf');

// Resolve string substitutions
InfResolver.resolveStrings(parsed);

// Extract metadata
const metadata = InfAnalyzer.extractDriverMetadata(parsed);

console.log(metadata.displayName);      // "HP LaserJet M605"
console.log(metadata.driverIsolation);  // "High" | "Medium" | "None" | "Unknown"
```

## Features

### ✅ Phase 1-3 Complete
- Core parser with streaming optimization
- String substitution and reference resolution
- Complete metadata analysis
- File dependency tracking
- Windows compression handling (.dl_ ↔ .dll)

### 🔮 Future Phases
- **Phase 4**: Driver slimming (Original/Slim/Skinny modes)
- **Phase 5**: Windows inbox driver extraction
- **Phase 6**: Advanced inbox features

## Architecture

```
infpossible/
├── types.ts          # TypeScript interfaces
├── parser.ts         # Core INF parsing
├── resolver.ts       # String substitution
├── analyzer.ts       # Metadata extraction
├── dependencies.ts   # File dependency tracking
├── compression.ts    # Windows file compression mapping
└── index.ts          # Module exports
```

## Integration

INFpossible is integrated with `pd-builder.ts` and automatically used during driver import. No configuration needed!

---

**Status**: Phases 1-3 Complete ✅ | Integration Complete ✅
