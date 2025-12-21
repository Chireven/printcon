
import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';

interface SystemTask {
    id: string;
    name: string;
    description: string;
}

export default function SystemTasksView() {
    const [tasks, setTasks] = useState<SystemTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/system/tasks')
            .then(res => res.json())
            .then(data => {
                setTasks(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to load system tasks');
                setLoading(false);
            });
    }, []);

    const runTask = async (taskId: string, taskName: string) => {
        setRunning(taskId);
        try {
            const res = await fetch('/api/system/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId })
            });
            const data = await res.json();

            if (data.status === 'success') {
                toast.success(data.message);
            } else {
                toast.error(`Task Failed: ${data.message}`);
            }
        } catch (e) {
            toast.error('Failed to execute task');
        } finally {
            setRunning(null);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-white tracking-tight">System Tasks</h1>
                <p className="text-slate-400 text-sm mt-1">Maintenance operations and background jobs.</p>
            </div>

            <div className="grid gap-4">
                {tasks.map(task => (
                    <div
                        key={task.id}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center justify-between hover:border-slate-700 transition-colors group"
                    >
                        <div className="flex-1 pr-6">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-slate-200 text-sm">{task.name}</h3>
                                <code className="text-[10px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-800">
                                    {task.id}
                                </code>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">{task.description}</p>
                        </div>

                        <Button
                            onClick={() => runTask(task.id, task.name)}
                            disabled={!!running}
                            variant="primary"
                            size="sm"
                            icon={Play}
                            loading={running === task.id}
                        >
                            {running === task.id ? 'Running...' : 'Run Now'}
                        </Button>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>
                    <strong>Warning:</strong> Running system tasks can impact performance or cause temporary service interruption.
                    Ensure no critical operations are in progress before execution.
                </p>
            </div>
        </div>
    );
}
