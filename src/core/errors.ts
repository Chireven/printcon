
export class InitializationTimeoutError extends Error {
    constructor(pluginId: string, timeoutMs: number) {
        super(`Plugin '${pluginId}' failed to initialize within ${timeoutMs}ms.`);
        this.name = 'InitializationTimeoutError';
    }
}

export class CoreVersionMismatchError extends Error {
    constructor(pluginId: string, required: string, current: string) {
        super(`Plugin '${pluginId}' requires Core version '${required}', but current version is '${current}'.`);
        this.name = 'CoreVersionMismatchError';
    }
}
