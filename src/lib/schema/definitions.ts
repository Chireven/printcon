export interface ColumnDefinition {
    name: string;
    type: string; // SQL Type e.g. 'NVARCHAR(255)', 'INT'
    nullable: boolean;
    primaryKey?: boolean;
    identity?: boolean; // Auto Increment
    defaultValue?: string;
}

export interface TableDefinition {
    name: string;
    schema?: string; // e.g. 'plg_printer_drivers' (Defaults to 'dbo')
    columns: ColumnDefinition[];
}

export const SchemaDefinitions: TableDefinition[] = [
    {
        name: 'Printers',
        columns: [
            { name: 'Id', type: 'VARCHAR(50)', nullable: false, primaryKey: true },
            { name: 'Name', type: 'NVARCHAR(255)', nullable: false },
            { name: 'IpAddress', type: 'VARCHAR(50)', nullable: true },
            { name: 'Model', type: 'NVARCHAR(100)', nullable: true },
            { name: 'Status', type: 'VARCHAR(20)', nullable: true }
        ]
    },
    {
        name: 'Jobs',
        columns: [
            { name: 'JobId', type: 'INT', nullable: false, primaryKey: true, identity: true },
            { name: 'PrinterId', type: 'VARCHAR(50)', nullable: false },
            { name: 'DocumentName', type: 'NVARCHAR(500)', nullable: false },
            { name: 'SubmittedAt', type: 'DATETIME', nullable: false, defaultValue: 'GETDATE()' },
            { name: 'Status', type: 'VARCHAR(20)', nullable: false }
        ]
    }
];
