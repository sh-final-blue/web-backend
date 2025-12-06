import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from '../lib/api';
import type { LokiLogsResponse, PrometheusMetricsResponse, BuildResponse, TaskStatusResponse, DeployResponse } from '../lib/api';

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
  buildAndDeployFunction: (functionId: string, code: string, onProgress?: (status: string) => void) => Promise<string>;
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

  const loadWorkspaces = useCallback(async () => {
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
  }, []);

  const loadFunctions = useCallback(async (workspaceId: string) => {
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
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace> => {
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
  }, []);

  const updateWorkspace = useCallback(async (id: string, updates: Partial<Workspace>): Promise<void> => {
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
  }, []);

  const deleteWorkspace = useCallback(async (id: string): Promise<void> => {
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
  }, [currentWorkspaceId]);

  const createFunction = useCallback(async (config: Omit<FunctionConfig, 'id' | 'lastModified' | 'invocations24h' | 'errors24h' | 'avgDuration' | 'invocationUrl' | 'status' | 'lastDeployed'>): Promise<FunctionConfig> => {
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
  }, [currentWorkspaceId]);

  const updateFunction = useCallback(async (id: string, updates: Partial<FunctionConfig>): Promise<void> => {
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
  }, [currentWorkspaceId]);

  const deleteFunction = useCallback(async (id: string): Promise<void> => {
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
  }, [currentWorkspaceId]);

  const invokeFunction = useCallback(async (id: string, requestBody: any): Promise<ExecutionLog> => {
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
  }, [currentWorkspaceId, functions]);

  const getFunctionLogs = useCallback(async (functionId: string): Promise<ExecutionLog[]> => {
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
  }, [currentWorkspaceId]);

  const getLokiLogs = useCallback(async (functionId: string, limit: number = 100): Promise<LokiLogsResponse> => {
    try {
      const response = await api.getLokiLogs(functionId, limit);
      return response;
    } catch (error) {
      console.error('Failed to load Loki logs:', error);
      throw error;
    }
  }, []);

  const getPrometheusMetrics = useCallback(async (functionId: string): Promise<PrometheusMetricsResponse> => {
    try {
      const response = await api.getPrometheusMetrics(functionId);
      return response;
    } catch (error) {
      console.error('Failed to load Prometheus metrics:', error);
      throw error;
    }
  }, []);

  const buildAndDeployFunction = useCallback(async (
    functionId: string,
    code: string,
    onProgress?: (status: string) => void
  ): Promise<string> => {
    if (!currentWorkspaceId) throw new Error('No workspace selected');

    const fn = functions.find(f => f.id === functionId);
    if (!fn) throw new Error('Function not found');

    try {
      // Step 1: 코드를 .py 파일로 변환
      onProgress?.('Preparing code...');
      const blob = new Blob([code], { type: 'text/plain' });
      const file = new File([blob], `${fn.name}.py`, { type: 'text/plain' });

      // Step 2: Build & Push
      onProgress?.('Building and pushing image...');
      const buildResponse = await api.buildAndPush(
        file,
        '217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/blue-final-faas-app',
        'AWS',
        undefined, // IRSA + 더미 패스워드 자동 처리
        'sha256',
        fn.name,
        currentWorkspaceId
      );

      const taskId = buildResponse.task_id;
      onProgress?.(`Build task created: ${taskId}`);

      // Step 3: Polling (최대 10분)
      let attempts = 0;
      const maxAttempts = 120; // 5초 * 120 = 10분

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        attempts++;

        const statusResponse = await api.getTaskStatus(taskId);
        const status = statusResponse.status;

        onProgress?.(`Build status: ${status} (${attempts}/${maxAttempts})`);

        if (status === 'completed' || status === 'done') {
          const imageUrl = statusResponse.result?.image_url;
          if (!imageUrl) {
            throw new Error('Build completed but no image URL returned');
          }

          onProgress?.('Build completed! Deploying to Kubernetes...');

          // Step 4: Deploy to K8s
          const deployResponse = await api.deployToK8s({
            namespace: 'default',
            image_ref: imageUrl,
            function_id: functionId,
            enable_autoscaling: true,
            use_spot: false,
          });

          const endpoint = deployResponse.endpoint;
          if (!endpoint) {
            throw new Error('Deploy succeeded but no endpoint returned');
          }

          onProgress?.(`Deployed successfully: ${endpoint}`);

          // Step 5: Function의 invocationUrl 업데이트
          await api.updateFunction(currentWorkspaceId, functionId, {
            // invocationUrl은 백엔드에서 자동으로 설정되어야 하지만,
            // 현재는 status만 업데이트
            status: 'active',
          });

          // 로컬 state 업데이트
          setFunctions(prev => prev.map(f =>
            f.id === functionId
              ? { ...f, status: 'active', invocationUrl: endpoint }
              : f
          ));

          return endpoint;
        } else if (status === 'failed') {
          const errorMsg = statusResponse.error || 'Build failed';
          throw new Error(`Build failed: ${errorMsg}`);
        }

        // 'pending', 'running' 상태면 계속 polling
      }

      // 타임아웃
      throw new Error('Build timeout (10 minutes exceeded)');
    } catch (error) {
      console.error('Build and deploy failed:', error);

      // 실패 시 status를 'failed'로 업데이트
      if (currentWorkspaceId) {
        try {
          await api.updateFunction(currentWorkspaceId, functionId, {
            status: 'failed',
          });
          setFunctions(prev => prev.map(f =>
            f.id === functionId ? { ...f, status: 'failed' } : f
          ));
        } catch (updateError) {
          console.error('Failed to update function status:', updateError);
        }
      }

      throw error;
    }
  }, [currentWorkspaceId, functions]);

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

  const contextValue = React.useMemo(() => ({
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
    buildAndDeployFunction,
  }), [
    workspaces,
    functions,
    executionLogs,
    currentWorkspaceId,
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
    buildAndDeployFunction,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
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
