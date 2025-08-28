// API Types

export interface User {
    id: string;
    email: string;
    role: 'admin' | 'member';
    orgId: string;
}

export interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    createdAt: string;
}

export interface Project {
    id: string;
    orgId: string;
    name: string;
    repoUrl?: string;
    defaultBranch: string;
    createdAt: string;
}

export interface Report {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    reporter?: string;
    source?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    env?: Record<string, any>;
    createdAt: string;
}

export interface Signal {
    id: string;
    reportId: string;
    kind: 'har' | 'screenshot' | 'video' | 'log';
    s3Key?: string;
    meta?: Record<string, any>;
    createdAt: string;
}

export interface Mapping {
    id: string;
    reportId: string;
    module?: string;
    files?: string[];
    framework?: string;
    confidence?: number;
    createdAt: string;
}

export interface Repro {
    id: string;
    reportId: string;
    framework?: string;
    entry?: string;
    dockerCompose?: Record<string, any>;
    seed?: Record<string, any>;
    sandboxUrl?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: string;
}

export interface Step {
    id: string;
    reproId: string;
    orderIdx: number;
    kind: 'click' | 'type' | 'request' | 'assert' | 'cli';
    payload: Record<string, any>;
    minimized: boolean;
    createdAt: string;
}

export interface Run {
    id: string;
    reproId: string;
    iteration: number;
    passed: boolean;
    durationMs?: number;
    logsS3?: string;
    videoS3?: string;
    traceS3?: string;
    createdAt: string;
}

export interface Export {
    id: string;
    reproId: string;
    kind: 'pr' | 'sandbox' | 'report';
    s3Key?: string;
    prUrl?: string;
    createdAt: string;
}

// API Request/Response types
export interface CreateReportRequest {
    projectId: string;
    title: string;
    description?: string;
    env?: Record<string, any>;
}

export interface CreateReproRequest {
    reportId: string;
    target?: 'web' | 'api' | 'cli';
}

export interface ValidateReproRequest {
    runs?: number;
}

export interface ExportRequest {
    reproId: string;
    kind: 'pr' | 'sandbox' | 'report';
    branch?: string;
    title?: string;
}

// Form types
export interface ReportFormData {
    title: string;
    description?: string;
    files?: File[];
    env?: Record<string, any>;
}

// Component prop types
export interface ReportCardProps {
    report: Report;
    signals?: Signal[];
    mappings?: Mapping[];
    repros?: Repro[];
    onView?: (report: Report) => void;
    onEdit?: (report: Report) => void;
    onDelete?: (report: Report) => void;
}

export interface ReproTimelineProps {
    repro: Repro;
    steps?: Step[];
    runs?: Run[];
    onRun?: (repro: Repro) => void;
    onMinimize?: (repro: Repro) => void;
    onExport?: (repro: Repro, kind: 'pr' | 'sandbox' | 'report') => void;
}
