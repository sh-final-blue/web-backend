const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, public statusText: string, public data?: any) {
    super(`API Error: ${status} ${statusText}`);
  }
}

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// --- Interfaces ---

export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  functionCount: number;
  invocations24h: number;
  errorRate: number;
}

export interface CreateWorkspaceData {
  name: string;
  description: string;
}

export interface UpdateWorkspaceData {
  name?: string;
  description?: string;
}

export interface FunctionItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  runtime: string;
  memory: number;
  timeout: number;
  httpMethods: string[];
  environmentVariables: Record<string, string>;
  code: string; // Base64 encoded string from backend
  invocationUrl: string | null;
  status: 'active' | 'building' | 'deploying' | 'failed' | 'disabled';
  lastModified: string;
  lastDeployed: string | null;
  invocations24h: number;
  errors24h: number;
  avgDuration: number;
}

export interface CreateFunctionData {
  name: string;
  description: string;
  runtime: string;
  memory: number;
  timeout: number;
  httpMethods: string[];
  environmentVariables: Record<string, string>;
  code: string; // Must be Base64 encoded
}

export interface UpdateFunctionData {
  description?: string;
  memory?: number;
  timeout?: number;
  httpMethods?: string[];
  environmentVariables?: Record<string, string>;
  code?: string; // Must be Base64 encoded
  status?: string;
}

export interface LogItem {
  id: string;
  functionId: string;
  timestamp: string;
  status: 'success' | 'error';
  duration: number;
  statusCode: number;
  requestBody?: any;
  responseBody?: any;
  logs: string[];
  level: 'info' | 'warn' | 'error';
}

// --- Workspace API ---

export async function getWorkspaces(): Promise<Workspace[]> {
  return fetchApi<Workspace[]>('/api/workspaces');
}

export async function createWorkspace(data: CreateWorkspaceData): Promise<Workspace> {
  return fetchApi<Workspace>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return fetchApi<Workspace>(`/api/workspaces/${id}`);
}

export async function updateWorkspace(id: string, data: UpdateWorkspaceData): Promise<Workspace> {
  return fetchApi<Workspace>(`/api/workspaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  return fetchApi<void>(`/api/workspaces/${id}`, {
    method: 'DELETE',
  });
}

// --- Function API ---

export async function getFunctions(workspaceId: string): Promise<FunctionItem[]> {
  return fetchApi<FunctionItem[]>(`/api/workspaces/${workspaceId}/functions`);
}

export async function createFunction(workspaceId: string, data: CreateFunctionData): Promise<FunctionItem> {
  return fetchApi<FunctionItem>(`/api/workspaces/${workspaceId}/functions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getFunction(workspaceId: string, functionId: string): Promise<FunctionItem> {
  return fetchApi<FunctionItem>(`/api/workspaces/${workspaceId}/functions/${functionId}`);
}

export async function updateFunction(workspaceId: string, functionId: string, data: UpdateFunctionData): Promise<FunctionItem> {
  return fetchApi<FunctionItem>(`/api/workspaces/${workspaceId}/functions/${functionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteFunction(workspaceId: string, functionId: string): Promise<void> {
  return fetchApi<void>(`/api/workspaces/${workspaceId}/functions/${functionId}`, {
    method: 'DELETE',
  });
}

export async function getFunctionLogs(workspaceId: string, functionId: string): Promise<LogItem[]> {
  // Assuming the backend supports query params for limit, e.g. ?limit=100
  return fetchApi<LogItem[]>(`/api/workspaces/${workspaceId}/functions/${functionId}/logs?limit=100`);
}
