import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Database,
    Save,
    Play,
    Server,
    Layers,
    Shield,
    User,
    Key,
    HardDrive,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Construction,
    Table,
    FolderTree

} from 'lucide-react';

// Types for better type safety
type LogonType = 'windows' | 'sql';
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'failure';

interface MssqlSettingsProps {
    initialAction?: string | null;
}

export default function MssqlSettings({ initialAction }: MssqlSettingsProps) {
    // --- State ---
    const [config, setConfig] = useState({
        server: '',
        instance: '',
        database: '',
        logonType: 'windows' as LogonType,
        username: '',
        password: ''
    });

    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [isSaved, setIsSaved] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [databaseExists, setDatabaseExists] = useState<boolean | null>(null);
    const [showSchemaModal, setShowSchemaModal] = useState(false);
    const [schemaResults, setSchemaResults] = useState<any[]>([]);
    const [schemaStatus, setSchemaStatus] = useState<'idle' | 'testing' | 'fixing'>('idle');

    // Handle initial action
    useEffect(() => {
        if (initialAction === 'test-schema') {
            setShowSchemaModal(true);
        }
    }, [initialAction]);

    // Load saved configuration on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch('/api/system/env');
                const data = await res.json();
                if (res.ok && data.status === 'success' && data.config) {
                    setConfig(data.config);
                    setIsSaved(true);
                }
            } catch (error) {
                console.error('Failed to load config:', error);
            }
        };
        loadConfig();
    }, []);

    // Old useEffect removed in favor of combined logic below

    // --- Handlers ---
    const handleChange = (field: string, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        setIsSaved(false); // Reset saved state on edit
        setStatus('idle'); // Reset status on edit

        // Clear specific error
        if (errors[field]) {
            setErrors(prev => {
                const updatedErrors = { ...prev };
                delete updatedErrors[field];
                return updatedErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!config.server.trim()) newErrors.server = 'Server Host is required';
        if (!config.database.trim()) newErrors.database = 'Database Name is required';

        if (config.logonType === 'sql') {
            if (!config.username.trim()) newErrors.username = 'Username is required';
            if (!config.password.trim()) newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleTest = async () => {
        if (!validate()) {
            toast.error('Validation Failed', { description: 'Please fill in all required fields.' });
            return;
        }

        setStatus('testing');
        setDatabaseExists(null);

        try {
            const res = await fetch('/api/db/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                setStatus('success');
                setDatabaseExists(data.databaseExists);

                if (data.databaseExists) {
                    toast.success('Connection Verified', {
                        description: 'Connected successfully. Database exists.'
                    });
                } else {
                    toast.warning('Database Missing', {
                        description: 'Connected to server but database does not exist. Click Create Database.'
                    });
                }
            } else {
                throw new Error(data.message || 'Unknown server error');
            }
        } catch (error: any) {
            setStatus('failure');
            setDatabaseExists(null);
            toast.error('Connection Failed', {
                description: `Error: ${error.message}`
            });
        }
    };

    const handleSave = async () => {
        if (!validate()) return;

        setStatus('testing'); // Re-use loading state or add 'saving'
        try {
            const res = await fetch('/api/system/env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setIsSaved(true);
                setIsDirty(false);
                toast.success('Configuration Saved', { description: 'Database settings have been saved to .env. Server may restart.' });
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (error: any) {
            toast.error('Save Failed', { description: error.message });
        } finally {
            setStatus('idle');
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/db/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                toast.success('Database Created', { description: data.message });
                setDatabaseExists(true);
            } else {
                throw new Error(data.message || 'Failed to create database');
            }
        } catch (error: any) {
            toast.error('Create Failed', { description: error.message });
        }
    };

    const handleTestSchema = async () => {
        setSchemaStatus('testing');

        // simple helper for delay
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            // 1. Fetch full validation results
            const res = await fetch('/api/schema/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                console.log('Schema Validation Results:', data.tables);

                // 2. Progressive Update Loop
                const fullResults = data.tables;

                // Reset to "Testing..." state if needed, or just overlay updates
                // We'll iterate and update the specific item in the array
                for (const result of fullResults) {
                    setSchemaResults(prev => {
                        const next = [...prev];
                        const idx = next.findIndex(t => t.tableName === result.tableName);
                        if (idx !== -1) {
                            next[idx] = result;
                        } else {
                            // If new definition found (dynamic?), add it
                            next.push(result);
                        }
                        return next;
                    });

                    // Pleasant delay for "real-time" feel
                    await delay(150);
                }

                toast.info('Schema Validation Complete', {
                    description: data.needsHealing ? 'Issues found' : 'Schema is healthy'
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast.error('Validation Failed', { description: error.message });
        } finally {
            setSchemaStatus('idle');
        }
    };

    const handleFixSchema = async () => {
        setSchemaStatus('fixing');
        try {
            const res = await fetch('/api/schema/fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                toast.success('Schema Fixed', { description: data.message });
                // Re-validate
                await handleTestSchema();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast.error('Fix Failed', { description: error.message });
        } finally {
            setSchemaStatus('idle');
        }
    };

    // Load schema definitions on modal open
    useEffect(() => {
        if (showSchemaModal) {
            // Always fetch fresh definitions to capture runtime plugin additions
            fetch('/api/schema/definitions')
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setSchemaResults(data.definitions);
                    }
                });
        }
    }, [showSchemaModal]);

    // --- Render Helpers ---
    const ConnectionBadge = () => {
        switch (status) {
            case 'testing':
                return <div className="px-3 py-1 bg-sky-900/30 text-sky-400 rounded-full text-xs font-bold flex items-center gap-2 border border-sky-500/30"><div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>Testing...</div>;
            case 'success':
                return <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-2 border border-emerald-500/30"><CheckCircle2 className="w-3 h-3" />Connected</div>;
            case 'failure':
                return <div className="px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-bold flex items-center gap-2 border border-red-500/30"><XCircle className="w-3 h-3" />Failed</div>;
            default:
                return <div className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-700"><div className="w-2 h-2 bg-slate-600 rounded-full"></div>Not Tested</div>;
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 fade-in animate-in">
            {/* Header Removed - Handled by Shell */}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Configuration Form - Left Column */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Card: Connection Details */}
                    <section className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl shadow-black/20 overflow-hidden">
                        <div className="bg-slate-950/30 px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <Server className="w-4 h-4 text-sky-500" />
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Connection Details</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Server Host */}
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                    Server Host <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.server}
                                    onChange={(e) => handleChange('server', e.target.value)}
                                    placeholder="e.g. 192.168.1.100 or localhost"
                                    className={`w-full bg-slate-950 border ${errors.server ? 'border-red-900/50 focus:border-red-500 focus:ring-red-900/20' : 'border-slate-800 focus:border-sky-500 focus:ring-sky-900/20'} text-slate-200 rounded-md p-2.5 text-sm outline-none focus:ring-4 transition-all placeholder:text-slate-700`}
                                />
                                {errors.server && <p className="text-xs text-red-400 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.server}</p>}
                            </div>

                            {/* Instance */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instance Name</label>
                                <input
                                    type="text"
                                    value={config.instance}
                                    onChange={(e) => handleChange('instance', e.target.value)}
                                    placeholder="Default"
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-900/20 text-slate-200 rounded-md p-2.5 text-sm outline-none transition-all placeholder:text-slate-700"
                                />
                                <p className="text-[10px] text-slate-600">Leave empty for default instance.</p>
                            </div>

                            {/* Database */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                    Database <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.database}
                                    onChange={(e) => handleChange('database', e.target.value)}
                                    placeholder="Database Name"
                                    className={`w-full bg-slate-950 border ${errors.database ? 'border-red-900/50 focus:border-red-500 focus:ring-red-900/20' : 'border-slate-800 focus:border-sky-500 focus:ring-sky-900/20'} text-slate-200 rounded-md p-2.5 text-sm outline-none focus:ring-4 transition-all placeholder:text-slate-700`}
                                />
                                {errors.database && <p className="text-xs text-red-400 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.database}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Card: Authentication */}
                    <section className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl shadow-black/20 overflow-hidden">
                        <div className="bg-slate-950/30 px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-sky-500" />
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Authentication</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Auth Type Selection */}
                            {/* Auth Type Selection */}
                            {/* Auth Type Selection & Actions */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Logon Method</label>
                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="logonType"
                                                value="windows"
                                                checked={config.logonType === 'windows'}
                                                onChange={() => handleChange('logonType', 'windows')}
                                                className="w-4 h-4 text-sky-500 border-slate-700 bg-slate-950 focus:ring-sky-500/50"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Windows Authentication</span>
                                            </div>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="logonType"
                                                value="sql"
                                                checked={config.logonType === 'sql'}
                                                onChange={() => handleChange('logonType', 'sql')}
                                                className="w-4 h-4 text-sky-500 border-slate-700 bg-slate-950 focus:ring-sky-500/50"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">SQL Server Authentication</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Buttons Removed from here */}
                            </div>

                            {/* Conditional Inputs */}
                            {config.logonType === 'sql' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">Username <span className="text-red-400">*</span></label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                value={config.username}
                                                onChange={(e) => handleChange('username', e.target.value)}
                                                className={`w-full bg-slate-950 border ${errors.username ? 'border-red-900/50 focus:border-red-500' : 'border-slate-800 focus:border-sky-500 focus:ring-sky-900/20'} text-slate-200 rounded-md pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-4 transition-all placeholder:text-slate-700`}
                                                placeholder="sa"
                                            />
                                        </div>
                                        {errors.username && <p className="text-xs text-red-400 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.username}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">Password <span className="text-red-400">*</span></label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={config.password}
                                                onChange={(e) => handleChange('password', e.target.value)}
                                                className={`w-full bg-slate-950 border ${errors.password ? 'border-red-900/50 focus:border-red-500' : 'border-slate-800 focus:border-sky-500 focus:ring-sky-900/20'} text-slate-200 rounded-md pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-4 transition-all font-mono placeholder:text-slate-700`}
                                                placeholder="••••••••"
                                            />
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {errors.password && <p className="text-xs text-red-400 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.password}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Action Bar */}
                    {/* Status Message Only */}
                    <div className="flex items-center justify-end pt-2">
                        <div className="text-xs text-slate-500 font-medium">
                            {isDirty ? 'Unsaved changes' : isSaved ? 'All changes saved' : ''}
                        </div>
                    </div>
                </div>

                {/* Right Column - Status & Operations (Gated) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Database Operations Card */}
                    <section className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl shadow-black/20 overflow-hidden transition-all duration-300">
                        <div className="bg-slate-950/30 px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <Construction className="w-4 h-4 text-sky-500" />
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Operations</h2>
                        </div>
                        <div className="p-6 space-y-4">

                            <div className="space-y-4">
                                {/* Connection & Configuration */}
                                <div>
                                    <h3 className="text-xs font-bold text-white mb-1">Connection & Configuration</h3>
                                    <p className="text-[10px] text-slate-500 mb-2">Save settings and verify connection to server.</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={handleSave}
                                            disabled={status === 'testing'}
                                            className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-md transition-all shadow-lg shadow-sky-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Save className="w-3 h-3" />
                                            Save
                                        </button>
                                        <button
                                            onClick={handleTest}
                                            disabled={status === 'testing'}
                                            className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-md text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {status === 'testing' ? <div className="w-3 h-3 border-2 border-slate-500 border-t-white rounded-full animate-spin" /> : <Play className="w-3 h-3" />}
                                            Test
                                        </button>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-800 w-full" />

                                <div>
                                    <h3 className="text-xs font-bold text-white mb-1">Create Database</h3>
                                    <p className="text-[10px] text-slate-500 mb-2">Initialize a new blank database with the configured name.</p>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!isSaved || databaseExists === true || status !== 'success'}
                                        className="w-full py-2 bg-slate-950 hover:bg-sky-900/30 text-slate-400 hover:text-sky-400 border border-slate-800 hover:border-sky-500/50 rounded-md text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        Create Database
                                    </button>
                                    {databaseExists === false && status === 'success' && (
                                        <p className="text-[10px] text-amber-400 mt-1">Database does not exist. Click to create.</p>
                                    )}
                                </div>
                                <div className="h-px bg-slate-800 w-full" />
                                <div>
                                    <h3 className="text-xs font-bold text-white mb-1">Test Database Schema</h3>
                                    <p className="text-[10px] text-slate-500 mb-2">Validate tables and columns against expected schema.</p>
                                    <button
                                        onClick={() => setShowSchemaModal(true)}
                                        disabled={!isSaved || status === 'failure'}
                                        className="w-full py-2 bg-slate-950 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/50 rounded-md text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        Test Database Schema
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Schema Validation Modal */}
            {showSchemaModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-2xl shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <button
                                onClick={handleTestSchema}
                                disabled={schemaStatus !== 'idle'}
                                className="px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 border border-sky-500 text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {schemaStatus === 'testing' ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3 h-3" />
                                        Test Schema
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-4">
                                {/* Overall Status Indicator */}
                                <div className={`w-4 h-4 rounded-full border-2 transition-all ${schemaResults.length > 0 && schemaResults.every(r => r.status === 'valid')
                                    ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                                    : schemaResults.some(r => r.status !== 'valid' && r.status !== 'idle')
                                        ? 'bg-red-500 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                                        : 'bg-black border-slate-700'
                                    }`} />

                                <button
                                    onClick={() => setShowSchemaModal(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Centered Badges */}
                        <div className="p-12 min-h-[200px] flex flex-col items-center justify-center gap-6 bg-slate-950/50">

                            {/* Table Container */}
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                {schemaResults.map((table, idx) => {
                                    const isGreen = table.status === 'valid';
                                    const isRed = table.status === 'invalid' || table.status === 'missing';
                                    const isSchema = table.tableName.startsWith('Schema: ');
                                    const displayName = isSchema ? table.tableName.replace('Schema: ', '') : table.tableName;

                                    const className = isGreen
                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20'
                                        : isRed
                                            ? 'bg-red-500/10 border-red-500 text-red-400 shadow-lg shadow-red-900/20'
                                            : 'bg-black border-slate-800 text-slate-500'; // Default/Idle

                                    return (
                                        <div
                                            key={`${idx}-${table.status}`} // Force re-render on status change
                                            title={table.issues?.join('\n')}
                                            className={`px-4 py-2 rounded-full border text-sm font-bold transition-all transform hover:scale-105 cursor-help ${className} flex items-center gap-2`}
                                        >
                                            {isSchema ? <FolderTree className="w-4 h-4" /> : <Table className="w-4 h-4" />}
                                            {displayName}
                                            {isRed && <AlertCircle className="w-4 h-4 ml-1 text-red-400" />}
                                        </div>
                                    );
                                })}
                                {schemaResults.length === 0 && (
                                    <p className="text-slate-500 italic">No schema definitions found.</p>
                                )}
                            </div>

                            {/* Fix Actions */}
                            {schemaResults.some(r => (r.status === 'invalid' || r.status === 'missing')) && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
                                    <button
                                        onClick={handleFixSchema}
                                        disabled={schemaStatus === 'fixing'}
                                        className="px-6 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500 text-xs font-bold rounded-lg transition-all shadow-xl shadow-amber-900/20 flex items-center gap-2"
                                    >
                                        {schemaStatus === 'fixing' ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Running Fix Scripts...
                                            </>
                                        ) : (
                                            <>
                                                <Construction className="w-3 h-3" />
                                                Fix Schema Issues
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
