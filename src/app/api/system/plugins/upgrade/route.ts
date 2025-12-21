import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import semver from 'semver'; // Available in dependencies
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    let tempPath = '';

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const targetPluginId = formData.get('targetPluginId') as string;

        if (!file || !targetPluginId) {
            return NextResponse.json({ error: 'Missing file or targetPluginId' }, { status: 400 });
        }

        // 1. Save to Temp
        const buffer = Buffer.from(await file.arrayBuffer());
        const tempName = `upgrade-${Date.now()}-${file.name}`;
        tempPath = join(tmpdir(), tempName);
        await writeFile(tempPath, buffer);

        // 2. Inspect Manifest (via CLI script to ensure isolation/env)
        // We assume valid JSON output from inspect.ts
        const { stdout: inspectStdout } = await execAsync(`npx tsx scripts/inspect.ts "${tempPath}"`);
        let manifest;
        try {
            manifest = JSON.parse(inspectStdout.trim());
        } catch (e) {
            throw new Error(`Failed to parse plugin manifest: ${inspectStdout}`);
        }

        if (manifest.error) {
            throw new Error(manifest.error);
        }

        // 3. Validation Logic
        if (manifest.id !== targetPluginId) {
            throw new Error(`Upgrade Mismatch: The uploaded package ID used '${manifest.id}' but you are trying to upgrade '${targetPluginId}'.`);
        }

        // Read Registry
        const registryPath = join(process.cwd(), 'src/core/registry.json');
        if (!fs.existsSync(registryPath)) {
            throw new Error('Registry not found.');
        }

        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const installedPlugin = registry.find((p: any) => p.id === targetPluginId);

        if (!installedPlugin) {
            throw new Error(`Plugin '${targetPluginId}' is not installed.`);
        }

        // Check Version
        // Using semver.gt
        const newVersion = manifest.version;
        const currentVersion = installedPlugin.version;

        if (!semver.valid(newVersion)) throw new Error(`Invalid new version: ${newVersion}`);
        if (!semver.valid(currentVersion)) throw new Error(`Invalid current version: ${currentVersion}`);

        if (!semver.gt(newVersion, currentVersion)) {
            throw new Error(`Upgrade Failed: New version (${newVersion}) must be greater than current version (${currentVersion}).`);
        }

        // 4. Install (Reuse existing script with --update flag)
        const { stdout: installStdout } = await execAsync(`npm run plugin:install -- "${tempPath}" --update`);

        // Success
        await unlink(tempPath); // Cleanup

        return NextResponse.json({
            status: 'success',
            message: `Plugin '${manifest.id}' upgraded to v${manifest.version}.`,
            output: installStdout
        });

    } catch (error: any) {
        // Cleanup on error
        if (tempPath && fs.existsSync(tempPath)) {
            try { await unlink(tempPath); } catch { }
        }

        console.error('[Upgrade Error]', error);
        return NextResponse.json({
            status: 'error',
            error: error.message || 'Upgrade failed'
        }, { status: 400 });
    }
}
