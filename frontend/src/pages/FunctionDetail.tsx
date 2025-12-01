import { useState } from 'react';
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
import { Activity, AlertCircle, Clock, Copy, Play, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function FunctionDetail() {
  const { workspaceId, functionId } = useParams<{ workspaceId: string; functionId: string }>();
  const { functions, getFunctionLogs, invokeFunction, deleteFunction } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fn = functions.find(f => f.id === functionId);
  const logs = getFunctionLogs(functionId!);

  const [requestBody, setRequestBody] = useState('{\n  "key": "value"\n}');
  const [isInvoking, setIsInvoking] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  if (!fn) {
    return (
      <AppLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold">{t('functionDetail.notFound')}</h1>
        </div>
      </AppLayout>
    );
  }

  const endpointUrl = `https://api.example.com/w/${workspaceId}/f/${functionId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(endpointUrl);
    toast.success(t('functionDetail.endpoint.copied'));
  };

  const handleInvokeFunction = async () => {
    if (fn.status === 'disabled') {
      toast.error(t('functionDetail.test.disabledError'));
      return;
    }

    try {
      setIsInvoking(true);
      const body = JSON.parse(requestBody);
      const result = await invokeFunction(fn.id, body);
      setLastResult(result);
      toast.success(t('functionDetail.test.success'));
    } catch (error) {
      toast.error(t('functionDetail.test.invalidJson'));
    } finally {
      setIsInvoking(false);
    }
  };

  const handleDeleteFunction = () => {
    if (confirm(t('functionDetail.deleteConfirm', { name: fn.name }))) {
      deleteFunction(fn.id);
      toast.success(t('functionDetail.deleteSuccess'));
      navigate(`/workspaces/${workspaceId}/functions`);
    }
  };

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
            <Button variant="destructive" onClick={handleDeleteFunction}>
              <Trash className="h-4 w-4 mr-2" />
              {t('functionDetail.deleteButton')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('functionDetail.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="test">{t('functionDetail.tabs.test')}</TabsTrigger>
            <TabsTrigger value="logs">{t('functionDetail.tabs.logs')}</TabsTrigger>
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
