import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { AppLayout } from '@/components/AppLayout';
import { WorkspaceSidebar } from '@/components/WorkspaceSidebar';
import { CodeEditor } from '@/components/CodeEditor';
import { MetricsCard } from '@/components/MetricsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertCircle, Clock, Copy, Play, Trash, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { ApiError, type LokiLogsResponse, type PrometheusMetricsResponse } from '@/lib/api';

export default function FunctionDetail() {
  const { workspaceId, functionId } = useParams<{ workspaceId: string; functionId: string }>();
  const { functions, executionLogs, getFunctionLogs, invokeFunction, deleteFunction, getLokiLogs, getPrometheusMetrics, buildAndDeployFunction, setCurrentWorkspaceId, loadFunctions } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fn = functions.find(f => f.id === functionId);
  const logs = executionLogs.filter(log => log.functionId === functionId);

  useEffect(() => {
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId);
    }
  }, [workspaceId, setCurrentWorkspaceId]);

  useEffect(() => {
    if (functionId) {
      getFunctionLogs(functionId);
    }
  }, [functionId, getFunctionLogs]);

  const [requestBody, setRequestBody] = useState('{\n  "key": "value"\n}');
  const [isInvoking, setIsInvoking] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Loki Logs State
  const [lokiLogs, setLokiLogs] = useState<LokiLogsResponse | null>(null);
  const [isLoadingLokiLogs, setIsLoadingLokiLogs] = useState(false);

  // Prometheus Metrics State
  const [prometheusMetrics, setPrometheusMetrics] = useState<PrometheusMetricsResponse | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Deploy State
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState<string>('');
  const [isFunctionLoading, setIsFunctionLoading] = useState(false);

  useEffect(() => {
    // Safeguard: if we refreshed on detail page and functions list is empty, load it.
    const shouldLoad = workspaceId && !fn && !isFunctionLoading;
    if (!shouldLoad) return;

    const load = async () => {
      try {
        setIsFunctionLoading(true);
        await loadFunctions(workspaceId);
      } finally {
        setIsFunctionLoading(false);
      }
    };

    load();
  }, [workspaceId, fn, isFunctionLoading, loadFunctions]);

  const endpointUrl = fn.invocationUrl || `${import.meta.env.VITE_API_URL || window.location.origin}/api/workspaces/${workspaceId}/functions/${functionId}/invoke`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(endpointUrl);
    toast.success(t('functionDetail.endpoint.copied'));
  };

  const handleInvokeFunction = async () => {
    if (fn.status === 'disabled') {
      toast.error(t('functionDetail.test.disabledError'));
      return;
    }

    let body: any;
    try {
      body = JSON.parse(requestBody);
    } catch (error) {
      toast.error(t('functionDetail.test.invalidJson'));
      return;
    }

    try {
      setIsInvoking(true);
      const result = await invokeFunction(fn.id, body);
      setLastResult(result);
      toast.success(t('functionDetail.test.success'));
    } catch (error) {
      if (error instanceof ApiError) {
        const errorMessage =
          (error.data as any)?.error?.message ||
          error.statusText ||
          'Failed to invoke function.';
        toast.error(errorMessage);
      } else {
        toast.error('Failed to invoke function.');
      }
    } finally {
      setIsInvoking(false);
    }
  };

  const handleDeleteFunction = async () => {
    if (confirm(t('functionDetail.deleteConfirm', { name: fn.name }))) {
      try {
        await deleteFunction(fn.id);
        toast.success(t('functionDetail.deleteSuccess'));
        navigate(`/workspaces/${workspaceId}/functions`);
      } catch (error) {
        console.error("Failed to delete function:", error);
        toast.error(t('functionDetail.deleteError', 'Failed to delete the function.'));
      }
    }
  };

  const loadLokiLogs = useCallback(async () => {
    if (!functionId) return;
    setIsLoadingLokiLogs(true);
    try {
      const data = await getLokiLogs(functionId, 100);
      setLokiLogs(data);
    } catch (error) {
      console.error('Failed to load Loki logs:', error);
      // toast.error('Failed to load real-time logs');
    } finally {
      setIsLoadingLokiLogs(false);
    }
  }, [functionId, getLokiLogs]);

  const loadPrometheusMetrics = useCallback(async () => {
    if (!functionId) return;
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const data = await getPrometheusMetrics(functionId);
      setPrometheusMetrics(data);
    } catch (error) {
      console.error('Failed to load Prometheus metrics:', error);
      if (error instanceof ApiError) {
        if (error.status === 503) {
          setMetricsError('Observability backend is unavailable (Prometheus/Loki unreachable).');
        } else {
          setMetricsError('Unable to load metrics right now. Please try again later.');
        }
      } else {
        setMetricsError('Unable to load metrics right now. Please try again later.');
      }
      setPrometheusMetrics(null);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [functionId, getPrometheusMetrics]);

  const handleDeploy = async () => {
    if (!functionId || !fn) return;

    setIsDeploying(true);
    setDeployProgress('Starting build and deploy...');

    try {
      const endpoint = await buildAndDeployFunction(
        functionId,
        fn.code,
        (status) => {
          setDeployProgress(status);
        }
      );

      if (!endpoint) {
        toast.info('배포는 완료되었고 엔드포인트가 발급 중입니다. 약 5초 뒤 새로고침하거나 다시 시도해주세요.');
        setDeployProgress('');
        return;
      }

      toast.success(`Deployed successfully! Endpoint: ${endpoint}`);
      setDeployProgress('');
    } catch (error: any) {
      console.error('Deploy failed:', error);
      const message = typeof error?.message === 'string' ? error.message : '';
      if (message.toLowerCase().includes('endpoint')) {
        toast.info('엔드포인트가 아직 생성 중입니다. 5초 정도 기다린 뒤 새로고침하거나 다시 시도해주세요.');
      } else {
        toast.error(`배포 실패: ${message || '알 수 없는 오류가 발생했습니다.'} (kubectl logs -n blue-faas deployment/blue-faas -c blue-faas --tail=200 로 확인 가능)`);
      }
      setDeployProgress('');
    } finally {
      setIsDeploying(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    if (functionId) {
      loadLokiLogs();
      loadPrometheusMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionId]);

  // Auto-deploy on mount if status is 'building'
  useEffect(() => {
    if (fn && fn.status === 'building' && !isDeploying) {
      handleDeploy();
    }
  }, [fn?.status]);

  if (!fn) {
    return (
      <AppLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold">
            {isFunctionLoading ? t('common.loading') : t('functionDetail.notFound')}
          </h1>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout sidebar={<WorkspaceSidebar />}>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{fn.name}</h1>
                <Badge variant={fn.status === 'active' ? 'default' : 'secondary'}>
                  {t(`common.${fn.status}`)}
                </Badge>
              </div>
              {fn.description && (
                <p className="text-muted-foreground">{fn.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {fn.status === 'building' || fn.status === 'failed' || !fn.invocationUrl ? (
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  variant="default"
                >
                  {isDeploying ? 'Deploying...' : 'Deploy Function'}
                </Button>
              ) : null}
              <Button variant="destructive" onClick={handleDeleteFunction}>
                <Trash className="h-4 w-4 mr-2" />
                {t('functionDetail.deleteButton')}
              </Button>
            </div>
          </div>
          {isDeploying && deployProgress && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm font-medium text-blue-900">Deployment in Progress</div>
              <div className="text-xs text-blue-700 mt-1">{deployProgress}</div>
            </div>
          )}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('functionDetail.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="test">{t('functionDetail.tabs.test')}</TabsTrigger>
            <TabsTrigger value="logs">{t('functionDetail.tabs.logs')}</TabsTrigger>
            <TabsTrigger value="realtime-logs">Real-time Logs</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="code">{t('functionDetail.tabs.code')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('functionDetail.endpoint.title')}</CardTitle>
                <CardDescription>{t('functionDetail.endpoint.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
                  <code className="flex-1">{endpointUrl}</code>
                  <Button variant="ghost" size="icon" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <strong>{t('functionDetail.endpoint.allowedMethods')}:</strong> {fn.httpMethods.join(', ')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('functionDetail.configuration.title')}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('functionDetail.configuration.runtime')}</div>
                  <div className="font-medium">{fn.runtime}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('functionDetail.configuration.memory')}</div>
                  <div className="font-medium">{fn.memory} MB</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('functionDetail.configuration.timeout')}</div>
                  <div className="font-medium">{fn.timeout}s</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('functionDetail.configuration.lastDeployed')}</div>
                  <div className="font-medium">
                    n
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricsCard
                title={t('workspace.metrics.invocations')}
                value="n"
                icon={Activity}
                description={t('workspace.metrics.last24h')}
              />
              <MetricsCard
                title={t('common.error')}
                value="n"
                icon={AlertCircle}
                description={t('workspace.metrics.last24h')}
              />
              <MetricsCard
                title={t('workspace.metrics.avgDuration')}
                value="nms"
                icon={Clock}
                description={t('workspace.metrics.acrossAll')}
              />
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('functionDetail.test.request')}</CardTitle>
                  <CardDescription>{t('functionDetail.test.requestDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="font-mono text-sm min-h-[300px]"
                    placeholder='{"key": "value"}'
                  />
                  <Button 
                    onClick={handleInvokeFunction} 
                    disabled={isInvoking || fn.status === 'disabled'}
                    className="w-full"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isInvoking ? t('functionDetail.test.invoking') : t('functionDetail.test.invokeButton')}
                  </Button>
                </CardContent>
              </Card>

              {lastResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('functionDetail.test.response')}</CardTitle>
                    <CardDescription>
                      {t('functionDetail.test.responseDescription', { statusCode: lastResult.statusCode, duration: lastResult.duration })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="p-4 bg-muted rounded-md text-sm overflow-auto max-h-[300px]">
                      {JSON.stringify(lastResult.responseBody, null, 2)}
                    </pre>
                    {lastResult.logs && lastResult.logs.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2">{t('functionDetail.test.logs')}:</div>
                        <div className="space-y-1">
                          {lastResult.logs.map((log: string, i: number) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('functionDetail.logs.title')}</CardTitle>
                <CardDescription>{t('functionDetail.logs.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('functionDetail.logs.noLogs')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('functionDetail.logs.timestamp')}</TableHead>
                        <TableHead>{t('functionDetail.logs.status')}</TableHead>
                        <TableHead>{t('functionDetail.logs.duration')}</TableHead>
                        <TableHead>{t('functionDetail.logs.statusCode')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            n
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">nms</TableCell>
                          <TableCell className="text-muted-foreground">{log.statusCode}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="realtime-logs" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Real-time Logs (Loki)</CardTitle>
                  <CardDescription>Live logs from your function execution</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLokiLogs}
                  disabled={isLoadingLokiLogs}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLokiLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingLokiLogs ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading logs...
                  </div>
                ) : !lokiLogs || lokiLogs.logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No real-time logs available
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {lokiLogs.logs.map((log, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-md font-mono text-xs">
                        <div className="text-muted-foreground mb-1">
                          {new Date(parseInt(log.timestamp) / 1000000).toLocaleString()}
                        </div>
                        <div>{log.line}</div>
                      </div>
                    ))}
                  </div>
                )}
                {lokiLogs && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Total logs: {lokiLogs.total}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prometheus Metrics</CardTitle>
                  <CardDescription>Pod metrics and resource usage</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPrometheusMetrics}
                  disabled={isLoadingMetrics}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMetrics ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading metrics...
                  </div>
                ) : metricsError ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {metricsError}
                  </div>
                ) : !prometheusMetrics ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics yet. Deploy and invoke the function to generate data.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <div className="text-sm font-medium mb-2">Status: {prometheusMetrics.status}</div>
                      <div className="text-sm text-muted-foreground mb-2">Function ID: {prometheusMetrics.function_id}</div>
                      {prometheusMetrics.data.result && prometheusMetrics.data.result.length > 0 ? (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Metrics Data:</div>
                          <pre className="text-xs overflow-auto max-h-[400px] bg-background p-3 rounded">
                            {JSON.stringify(prometheusMetrics.data.result, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-2">No metric results found</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('functionDetail.code.title')}</CardTitle>
                <CardDescription>{t('functionDetail.code.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeEditor
                  value={fn.code}
                  onChange={() => {}}
                  language="python"
                  height="600px"
                  readOnly
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
