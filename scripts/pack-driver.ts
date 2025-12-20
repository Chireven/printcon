import fs from 'fs/promises';
import path from 'path';
import { PDPackageBuilder } from '../plugins/printers/printer-drivers/pd-builder';

/**
 * CLI tool to convert raw driver folders into .pd packages
 * 
 * Usage: npm run pack-driver -- --input "./downloads/hp-driver" --output "./dist"
 */

interface CliArgs {
    input?: string;
    output?: string;
}

function parseArgs(): CliArgs {
    const args: CliArgs = {};
    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--input' && argv[i + 1]) {
            args.input = argv[i + 1];
            i++;
        } else if (argv[i] === '--output' && argv[i + 1]) {
            args.output = argv[i + 1];
            i++;
        }
    }

    return args;
}

async function findInfFiles(folderPath: string): Promise<string[]> {
    const infFiles: string[] = [];

    async function scan(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.name.toLowerCase().endsWith('.inf')) {
                infFiles.push(fullPath);
            }
        }
    }

    await scan(folderPath);
    return infFiles;
}

async function selectInfFile(infFiles: string[]): Promise<string> {
    if (infFiles.length === 0) {
        throw new Error('No INF files found in the input folder');
    }

    if (infFiles.length === 1) {
        console.log(`✓ Found 1 INF file: ${path.basename(infFiles[0])}`);
        return infFiles[0];
    }

    // Multiple INF files - prioritize printer drivers
    console.log(`\n📋 Found ${infFiles.length} INF files:`);

    const printerInfs: string[] = [];
    const otherInfs: string[] = [];

    for (const infPath of infFiles) {
        const content = await fs.readFile(infPath, 'utf8');

        if (content.includes('Class=Printer') ||
            content.includes('Class = Printer') ||
            content.includes('ClassGuid={4D36E979-E325-11CE-BFC1-08002BE10318}')) {
            printerInfs.push(infPath);
        } else {
            otherInfs.push(infPath);
        }
    }

    // If we found printer INF files, use the first one
    if (printerInfs.length > 0) {
        const selected = printerInfs[0];
        console.log(`✓ Auto-selected printer driver: ${path.basename(selected)}`);
        if (printerInfs.length > 1) {
            console.log(`  (${printerInfs.length - 1} other printer INF(s) ignored)`);
        }
        return selected;
    }

    // No printer INFs found, use first INF
    const selected = infFiles[0];
    console.log(`⚠ No printer INF found, using: ${path.basename(selected)}`);
    return selected;
}

async function main() {
    console.log('🔧 PrintCon Driver Packager\n');

    const args = parseArgs();

    if (!args.input) {
        console.error('❌ Error: --input argument is required');
        console.log('\nUsage: npm run pack-driver -- --input "./path/to/driver" --output "./dist"');
        process.exit(1);
    }

    const inputPath = path.resolve(args.input);
    const outputPath = args.output ? path.resolve(args.output) : path.resolve('./dist');

    console.log(`📂 Input:  ${inputPath}`);
    console.log(`📦 Output: ${outputPath}\n`);

    try {
        // 1. Verify input folder exists
        const inputStats = await fs.stat(inputPath);
        if (!inputStats.isDirectory()) {
            throw new Error('Input path must be a directory');
        }

        // 2. Find all INF files
        console.log('🔍 Scanning for INF files...');
        const infFiles = await findInfFiles(inputPath);

        // 3. Select the appropriate INF file
        const selectedInf = await selectInfFile(infFiles);

        // 4. Parse INF metadata
        console.log('\n📖 Parsing driver metadata...');
        const metadata = await PDPackageBuilder.parseInfMetadata(selectedInf);

        console.log(`   Name:         ${metadata.displayName}`);
        console.log(`   Version:      ${metadata.version}`);
        console.log(`   Manufacturer: ${metadata.manufacturer}`);
        console.log(`   Architecture: ${metadata.architecture.join(', ')}`);
        console.log(`   Models:       ${metadata.models.length} model(s)`);
        console.log(`   Hardware IDs: ${metadata.hardwareIds.length} ID(s)`);

        // 5. Build .pd package
        console.log('\n🔨 Building .pd package...');
        const { packageBuffer, manifest } = await PDPackageBuilder.buildPackage(
            inputPath,
            'cli-user'
        );

        // 6. Ensure output directory exists
        await fs.mkdir(outputPath, { recursive: true });

        // 7. Write .pd file
        const outputFilename = `${metadata.displayName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pd`;
        const outputFilePath = path.join(outputPath, outputFilename);

        await fs.writeFile(outputFilePath, packageBuffer);

        console.log(`\n✅ Package created successfully!`);
        console.log(`   File: ${outputFilePath}`);
        console.log(`   Size: ${(packageBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`   Package ID: ${manifest.packageInfo.id}`);

    } catch (error: any) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

main();
