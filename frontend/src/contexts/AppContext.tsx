import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from '../lib/api';
import type { LokiLogsResponse, PrometheusMetricsResponse } from '../lib/api';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  functionCount: number;
  invocations24h: number;
  errorRate: number;
}

export interface FunctionConfig {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  runtime: string;
  memory: number;
  timeout: number;
  httpMethods: string[];
  environmentVariables: Record<string, string>;
  code: string; // Plain text for UI (decoded from API)
  invocationUrl: string | null;
  status: 'active' | 'building' | 'deploying' | 'failed' | 'disabled';
  lastModified: Date;
  lastDeployed?: Date;
  invocations24h: number;
  errors24h: number;
  avgDuration: number;
}

export interface ExecutionLog {
  id: string;
  functionId: string;
  timestamp: Date;
  status: 'success' | 'error';
  duration: number;
  statusCode: number;
  requestBody?: any;
  responseBody?: any;
  logs: string[];
  level: 'info' | 'warn' | 'error';
}

interface AppContextType {
  workspaces: Workspace[];
  functions: FunctionConfig[];
  executionLogs: ExecutionLog[];
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  createFunction: (config: Omit<FunctionConfig, 'id' | 'lastModified' | 'invocations24h' | 'errors24h' | 'avgDuration' | 'invocationUrl' | 'status' | 'lastDeployed'>) => Promise<FunctionConfig>;
  updateFunction: (id: string, updates: Partial<FunctionConfig>) => Promise<void>;
  deleteFunction: (id: string) => Promise<void>;
  invokeFunction: (id: string, requestBody: any) => Promise<ExecutionLog>;
  getFunctionLogs: (functionId: string) => Promise<ExecutionLog[]>;
  loadFunctions: (workspaceId: string) => Promise<void>;
  getLokiLogs: (functionId: string, limit?: number) => Promise<LokiLogsResponse>;
  getPrometheusMetrics: (functionId: string) => Promise<PrometheusMetricsResponse>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper for Base64 (Unicode safe)
const encodeBase64 = (str: string) => {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error('Encoding error', e);
        return '';
    }
};

const decodeBase64 = (str: string) => {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return str; 
    }
    
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [functions, setFunctions] = useState<FunctionConfig[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspaceId) {
      loadFunctions(currentWorkspaceId);
    } else {
      setFunctions([]);
    }
  }, [currentWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const data = await api.getWorkspaces();
      const mapped = data.map(ws => ({
        ...ws,
        description: ws.description || '',
        createdAt: new Date(ws.createdAt)
      }));
      setWorkspaces(mapped);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const loadFunctions = async (workspaceId: string) => {
    try {
      const data = await api.getFunctions(workspaceId);
      const mapped = data.map(fn => ({
        ...fn,
        code: decodeBase64(fn.code), // Decode for UI
        description: fn.description || '',
        lastModified: new Date(fn.lastModified),
        lastDeployed: fn.lastDeployed ? new Date(fn.lastDeployed) : undefined,
        status: fn.status as FunctionConfig['status']
      }));
      setFunctions(mapped);
    } catch (error) {
      console.error('Failed to load functions:', error);
    }
  };

  const createWorkspace = async (name: string, description?: string): Promise<Workspace> => {
    try {
      const ws = await api.createWorkspace({ name, description: description || '' });
      const newWorkspace: Workspace = {
        ...ws,
        description: ws.description || '',
        createdAt: new Date(ws.createdAt)
      };
      setWorkspaces(prev => [...prev, newWorkspace]);
      return newWorkspace;
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<Workspace>): Promise<void> => {
    try {
      const apiUpdates: api.UpdateWorkspaceData = {};
      if (updates.name) apiUpdates.name = updates.name;
      if (updates.description) apiUpdates.description = updates.description;
      
      const ws = await api.updateWorkspace(id, apiUpdates);
      const updatedWorkspace = {
        ...ws,
        description: ws.description || '',
        createdAt: new Date(ws.createdAt)
      };
      
      setWorkspaces(prev => prev.map(w => w.id === id ? updatedWorkspace : w));
    } catch (error) {
      console.error('Failed to update workspace:', error);
      throw error;
    }
  };

  const deleteWorkspace = async (id: string): Promise<void> => {
    try {
      await api.deleteWorkspace(id);
      setWorkspaces(prev => prev.filter(ws => ws.id !== id));
      if (currentWorkspaceId === id) {
        setCurrentWorkspaceId(null);
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      throw error;
    }
  };

  const createFunction = async (config: Omit<FunctionConfig, 'id' | 'lastModified' | 'invocations24h' | 'errors24h' | 'avgDuration' | 'invocationUrl' | 'status' | 'lastDeployed'>): Promise<FunctionConfig> => {
    if (!currentWorkspaceId) throw new Error('No workspace selected');

    try {
      const apiData: api.CreateFunctionData = {
        name: config.name,
        description: config.description || '',
        runtime: config.runtime,
        memory: config.memory,
        timeout: config.timeout,
        httpMethods: config.httpMethods,
        environmentVariables: config.environmentVariables,
        code: encodeBase64(config.code),
      };

      const fn = await api.createFunction(currentWorkspaceId, apiData);
      
      const newFunction: FunctionConfig = {
        ...fn,
        code: decodeBase64(fn.code),
        description: fn.description || '',
        lastModified: new Date(fn.lastModified),
        lastDeployed: fn.lastDeployed ? new Date(fn.lastDeployed) : undefined,
        status: fn.status as FunctionConfig['status']
      };

      setFunctions(prev => [...prev, newFunction]);
      
      setWorkspaces(prev => prev.map(ws => 
        ws.id === currentWorkspaceId ? { ...ws, functionCount: ws.functionCount + 1 } : ws
      ));

      return newFunction;
    } catch (error) {
      console.error('Failed to create function:', error);
      throw error;
    }
  };

  const updateFunction = async (id: string, updates: Partial<FunctionConfig>): Promise<void> => {
    if (!currentWorkspaceId) throw new Error('No workspace selected');

    try {
      const apiUpdates: api.UpdateFunctionData = {};
      if (updates.description !== undefined) apiUpdates.description = updates.description;
      if (updates.memory !== undefined) apiUpdates.memory = updates.memory;
      if (updates.timeout !== undefined) apiUpdates.timeout = updates.timeout;
      if (updates.httpMethods !== undefined) apiUpdates.httpMethods = updates.httpMethods;
      if (updates.environmentVariables !== undefined) apiUpdates.environmentVariables = updates.environmentVariables;
      if (updates.code !== undefined) apiUpdates.code = encodeBase64(updates.code);
      
      const fn = await api.updateFunction(currentWorkspaceId, id, apiUpdates);
      
      const updatedFunction: FunctionConfig = {
        ...fn,
        code: decodeBase64(fn.code),
        description: fn.description || '',
        lastModified: new Date(fn.lastModified),
        lastDeployed: fn.lastDeployed ? new Date(fn.lastDeployed) : undefined,
        status: fn.status as FunctionConfig['status']
      };

      setFunctions(prev => prev.map(f => f.id === id ? updatedFunction : f));
    } catch (error) {
      console.error('Failed to update function:', error);
      throw error;
    }
  };

  const deleteFunction = async (id: string): Promise<void> => {
    if (!currentWorkspaceId) throw new Error('No workspace selected');
    
    try {
      await api.deleteFunction(currentWorkspaceId, id);
      setFunctions(prev => prev.filter(f => f.id !== id));
      
      setWorkspaces(prev => prev.map(ws => 
        ws.id === currentWorkspaceId ? { ...ws, functionCount: Math.max(0, ws.functionCount - 1) } : ws
      ));
    } catch (error) {
      console.error('Failed to delete function:', error);
      throw error;
    }
  };

  const invokeFunction = async (id: string, requestBody: any): Promise<ExecutionLog> => {
    if (!currentWorkspaceId) throw new Error('No workspace selected');

    const fn = functions.find(f => f.id === id);
    if (!fn) throw new Error('Function not found');

    try {
      const result = await api.invokeFunction(currentWorkspaceId, id, requestBody);
      const log: ExecutionLog = {
        ...result,
        timestamp: new Date(result.timestamp),
      };

      setExecutionLogs(prev => [log, ...prev]);
      return log;
    } catch (error) {
      console.error('Failed to invoke function:', error);
      throw error;
    }
  };

  const getFunctionLogs = async (functionId: string): Promise<ExecutionLog[]> => {
    if (!currentWorkspaceId) return [];

    try {
      const logs = await api.getFunctionLogs(currentWorkspaceId, functionId);
      const mappedLogs = logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      setExecutionLogs(mappedLogs);
      return mappedLogs;
    } catch (error) {
      console.error('Failed to load logs:', error);
      return [];
    }
  };

  const getLokiLogs = async (functionId: string, limit: number = 100): Promise<LokiLogsResponse> => {
    try {
      const response = await api.getLokiLogs(functionId, limit);
      return response;
    } catch (error) {
      console.error('Failed to load Loki logs:', error);
      throw error;
    }
  };

  const getPrometheusMetrics = async (functionId: string): Promise<PrometheusMetricsResponse> => {
    try {
      const response = await api.getPrometheusMetrics(functionId);
      return response;
    } catch (error) {
      console.error('Failed to load Prometheus metrics:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Expose API functions to window for easier console testing
    if (typeof window !== 'undefined') {
      (window as any).appApi = {
        getWorkspaces: api.getWorkspaces,
        createWorkspace: api.createWorkspace,
        updateWorkspace: api.updateWorkspace,
        deleteWorkspace: api.deleteWorkspace,
        getFunctions: api.getFunctions,
        createFunction: api.createFunction,
        updateFunction: api.updateFunction,
        deleteFunction: api.deleteFunction,
        getFunctionLogs: api.getFunctionLogs,
        encodeBase64,
        decodeBase64,
      };
    }
  }, []);


  return (
    <AppContext.Provider value={{
      workspaces,
      functions,
      executionLogs,
      currentWorkspaceId,
      setCurrentWorkspaceId,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      createFunction,
      updateFunction,
      deleteFunction,
      invokeFunction,
      getFunctionLogs,
      loadFunctions,
      getLokiLogs,
      getPrometheusMetrics,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
