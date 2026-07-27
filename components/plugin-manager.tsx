import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  Puzzle, 
  Play, 
  Square, 
  Code, 
  Download, 
  Upload, 
  Settings, 
  Trash2, 
  Plus, 
  Zap, 
  Activity, 
  Cpu, 
  HardDrive,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Tag,
  FileCode,
  Workflow,
  Terminal
} from 'lucide-react'

import { pluginManager, BasePlugin } from '@/lib/plugin-system'
import { moduleLoader } from '@/lib/module-loader'
import { apiExtensionManager, APIExtension } from '@/lib/api-extensions'
import { customFunctionalityManager, CustomFunction, CustomWorkflow } from '@/lib/custom-functionality'

interface PluginManagerProps {
  className?: string
}

export function PluginManager({ className }: PluginManagerProps) {
  const [activeTab, setActiveTab] = useState<'plugins' | 'extensions' | 'functions' | 'workflows' | 'modules'>('plugins')
  const [plugins, setPlugins] = useState<BasePlugin[]>([])
  const [extensions, setExtensions] = useState<APIExtension[]>([])
  const [customFunctions, setCustomFunctions] = useState<CustomFunction[]>([])
  const [workflows, setWorkflows] = useState<CustomWorkflow[]>([])
  const [modules, setModules] = useState<any[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createType, setCreateType] = useState<'plugin' | 'function' | 'workflow'>('function')
  
  const [systemStats, setSystemStats] = useState({
    pluginsLoaded: 0,
    pluginsActive: 0,
    extensionsRegistered: 0,
    functionsCreated: 0,
    workflowsActive: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  })

  // Load data
  useEffect(() => {
    loadAllData()
    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadAllData = useCallback(async () => {
    try {
      // Initialize all systems
      await pluginManager.initialize()
      await apiExtensionManager.initialize()
      await customFunctionalityManager.initialize()

      // Load data
      setPlugins(pluginManager.getAllPlugins())
      setExtensions(apiExtensionManager.getExtensions())
      setCustomFunctions(customFunctionalityManager.getFunctions())
      setWorkflows(customFunctionalityManager.getWorkflows())
      setModules(moduleLoader.getAllModules())
      
      updateStats()
    } catch (error) {
      console.error('Failed to load plugin data:', error)
    }
  }, [])

  const updateStats = useCallback(() => {
    const stats = {
      pluginsLoaded: pluginManager.getAllPlugins().length,
      pluginsActive: pluginManager.getActivePlugins().length,
      extensionsRegistered: apiExtensionManager.getExtensions().length,
      functionsCreated: customFunctionalityManager.getFunctions().length,
      workflowsActive: customFunctionalityManager.getWorkflows().filter(w => 
        w.triggers.some(t => t.enabled)
      ).length,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      cacheHitRate: moduleLoader.getCacheStats().hitRate
    }
    setSystemStats(stats)
  }, [])

  // Filter functions
  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = !searchQuery || 
      plugin.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.metadata.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || plugin.metadata.category === categoryFilter
    
    const isActive = pluginManager.getActivePlugins().some(p => p.metadata.id === plugin.metadata.id)
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && isActive) ||
      (statusFilter === 'inactive' && !isActive)
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  const filteredFunctions = customFunctions.filter(func => {
    const matchesSearch = !searchQuery || 
      func.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      func.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || func.category === categoryFilter
    
    return matchesSearch && matchesCategory
  })

  // Plugin actions
  const handlePluginToggle = async (pluginId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await pluginManager.deactivatePlugin(pluginId)
      } else {
        await pluginManager.activatePlugin(pluginId)
      }
      setPlugins(pluginManager.getAllPlugins())
      updateStats()
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  const handlePluginUnload = async (pluginId: string) => {
    try {
      await pluginManager.unloadPlugin(pluginId)
      setPlugins(pluginManager.getAllPlugins())
      updateStats()
    } catch (error) {
      console.error('Failed to unload plugin:', error)
    }
  }

  const handleLoadPlugin = async (source: string) => {
    try {
      await moduleLoader.loadPlugin(source)
      setPlugins(pluginManager.getAllPlugins())
      setModules(moduleLoader.getAllModules())
      updateStats()
    } catch (error) {
      console.error('Failed to load plugin:', error)
    }
  }

  // Function actions
  const handleExecuteFunction = async (functionId: string) => {
    try {
      // Example execution with test data
      const testData = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5])
      const result = await customFunctionalityManager.executeFunction(
        functionId, 
        testData, 
        {},
        { debugMode: true }
      )
      
      console.log('Function execution result:', result)
      // You would show this in a dialog or notification
    } catch (error) {
      console.error('Failed to execute function:', error)
    }
  }

  const handleDeleteFunction = async (functionId: string) => {
    try {
      await customFunctionalityManager.deleteFunction(functionId)
      setCustomFunctions(customFunctionalityManager.getFunctions())
      updateStats()
    } catch (error) {
      console.error('Failed to delete function:', error)
    }
  }

  // Workflow actions
  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const results = await customFunctionalityManager.executeWorkflow(
        workflowId,
        null,
        { debugMode: true }
      )
      console.log('Workflow execution results:', results)
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  return (
    <Card className={`plugin-manager ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <Puzzle className="h-5 w-5 text-[color:var(--primary-ink)]" />
            Plugin & Extension Manager
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New {createType}</DialogTitle>
                </DialogHeader>
                <CreateNewDialog type={createType} onTypeChange={setCreateType} onClose={() => setIsCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
            
            <Button variant="ghost" size="sm" onClick={loadAllData}>
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* System Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-4">
          <StatCard 
            icon={<Puzzle />} 
            label="Plugins" 
            value={`${systemStats.pluginsActive}/${systemStats.pluginsLoaded}`}
            color="blue"
          />
          <StatCard 
            icon={<Zap />} 
            label="Extensions" 
            value={systemStats.extensionsRegistered.toString()}
            color="purple"
          />
          <StatCard 
            icon={<Code />} 
            label="Functions" 
            value={systemStats.functionsCreated.toString()}
            color="green"
          />
          <StatCard 
            icon={<Workflow />} 
            label="Workflows" 
            value={systemStats.workflowsActive.toString()}
            color="orange"
          />
          <StatCard 
            icon={<HardDrive />} 
            label="Memory" 
            value={`${(systemStats.memoryUsage / 1024 / 1024).toFixed(1)}MB`}
            color="red"
          />
          <StatCard 
            icon={<Activity />} 
            label="Cache Hit" 
            value={`${(systemStats.cacheHitRate * 100).toFixed(1)}%`}
            color="cyan"
          />
          <StatCard 
            icon={<Cpu />} 
            label="Modules" 
            value={modules.length.toString()}
            color="yellow"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins, functions, workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="processor">Processor</SelectItem>
              <SelectItem value="visualizer">Visualizer</SelectItem>
              <SelectItem value="analyzer">Analyzer</SelectItem>
              <SelectItem value="utility">Utility</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => setActiveTab(tab as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="plugins">Plugins</TabsTrigger>
            <TabsTrigger value="extensions">Extensions</TabsTrigger>
            <TabsTrigger value="functions">Functions</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
          </TabsList>
          
          <TabsContent value="plugins" className="space-y-4">
            <PluginsList 
              plugins={filteredPlugins}
              onToggle={handlePluginToggle}
              onUnload={handlePluginUnload}
              onLoad={handleLoadPlugin}
            />
          </TabsContent>
          
          <TabsContent value="extensions" className="space-y-4">
            <ExtensionsList extensions={extensions} />
          </TabsContent>
          
          <TabsContent value="functions" className="space-y-4">
            <FunctionsList 
              functions={filteredFunctions}
              onExecute={handleExecuteFunction}
              onDelete={handleDeleteFunction}
            />
          </TabsContent>
          
          <TabsContent value="workflows" className="space-y-4">
            <WorkflowsList 
              workflows={workflows}
              onExecute={handleExecuteWorkflow}
            />
          </TabsContent>
          
          <TabsContent value="modules" className="space-y-4">
            <ModulesList modules={modules} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Sub-components
function StatCard({ icon, label, value, color }: any) {
  const colorClasses = {
    blue: 'text-[color:var(--info)] bg-[color:var(--tint-info)]',
    purple: 'text-[color:var(--primary-ink)] bg-[color:var(--tint-primary)]',
    green: 'text-[color:var(--success)] bg-[color:var(--tint-success)]',
    orange: 'text-[color:var(--warning-strong)] bg-[color:var(--tint-warning-strong)]',
    red: 'text-[color:var(--danger)] bg-[color:var(--tint-danger)]',
    cyan: 'text-[color:var(--info)] bg-[color:var(--tint-info)]',
    yellow: 'text-[color:var(--warning)] bg-[color:var(--tint-warning)]'
  }

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4">{icon}</div>
        <div>
          <div className="text-xs font-medium opacity-80">{label}</div>
          <div className="text-sm font-bold">{value}</div>
        </div>
      </div>
    </div>
  )
}

function PluginsList({ plugins, onToggle, onUnload, onLoad }: any) {
  const [loadUrl, setLoadUrl] = useState('')

  return (
    <div className="space-y-4">
      {/* Load Plugin Section */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Plugin URL or path..."
              value={loadUrl}
              onChange={(e) => setLoadUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => onLoad(loadUrl)} disabled={!loadUrl}>
              <Download className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {plugins.map((plugin: BasePlugin) => {
        const isActive = pluginManager.getActivePlugins().some(p => p.metadata.id === plugin.metadata.id)
        
        return (
          <Card key={plugin.metadata.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{plugin.metadata.name}</h3>
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{plugin.metadata.category}</Badge>
                    <span className="text-sm text-muted-foreground">v{plugin.metadata.version}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {plugin.metadata.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {plugin.metadata.author}
                    </span>
                    {plugin.metadata.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {plugin.metadata.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => onToggle(plugin.metadata.id, isActive)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUnload(plugin.metadata.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ExtensionsList({ extensions }: any) {
  return (
    <div className="space-y-4">
      {extensions.map((extension: APIExtension) => (
        <Card key={extension.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{extension.name}</h3>
              <Badge>{extension.namespace}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium mb-1">Methods ({extension.methods.length})</div>
                {extension.methods.slice(0, 3).map(method => (
                  <div key={method.name} className="text-muted-foreground">
                    {extension.namespace}.{method.name}
                  </div>
                ))}
                {extension.methods.length > 3 && (
                  <div className="text-muted-foreground">+{extension.methods.length - 3} more</div>
                )}
              </div>
              <div>
                <div className="font-medium mb-1">Events ({extension.events.length})</div>
                {extension.events.slice(0, 3).map(event => (
                  <div key={event.name} className="text-muted-foreground">
                    {event.name}
                  </div>
                ))}
              </div>
              <div>
                <div className="font-medium mb-1">Middleware ({extension.middleware.length})</div>
                {extension.middleware.slice(0, 3).map(middleware => (
                  <div key={middleware.name} className="text-muted-foreground">
                    {middleware.name}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FunctionsList({ functions, onExecute, onDelete }: any) {
  return (
    <div className="space-y-4">
      {functions.map((func: CustomFunction) => (
        <Card key={func.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{func.name}</h3>
                <Badge variant="outline">{func.category}</Badge>
                <Badge variant="secondary">{func.language}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => onExecute(func.id)}>
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(func.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {func.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {func.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(func.created).toLocaleDateString()}
              </span>
              <span>Parameters: {func.parameters.length}</span>
              <span>Input: {func.inputTypes.join(', ')}</span>
              <span>Output: {func.outputType}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WorkflowsList({ workflows, onExecute }: any) {
  return (
    <div className="space-y-4">
      {workflows.map((workflow: CustomWorkflow) => (
        <Card key={workflow.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{workflow.name}</h3>
              <Button size="sm" onClick={() => onExecute(workflow.id)}>
                <Play className="h-4 w-4 mr-2" />
                Execute
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {workflow.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Steps: {workflow.steps.length}</span>
              <span>Variables: {workflow.variables.length}</span>
              <span>Triggers: {workflow.triggers.filter(t => t.enabled).length} active</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(workflow.created).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ModulesList({ modules }: any) {
  return (
    <div className="space-y-4">
      {modules.map((module: any) => (
        <Card key={module.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{module.name}</h3>
                <Badge variant={module.loaded ? 'default' : 'secondary'}>
                  {module.loaded ? 'Loaded' : 'Unloaded'}
                </Badge>
                <Badge variant="outline">{module.type}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">v{module.version}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Path: {module.path}</span>
              {module.size && <span>Size: {(module.size / 1024).toFixed(1)}KB</span>}
              {module.loadTime && <span>Load Time: {module.loadTime.toFixed(2)}ms</span>}
              <span>Dependencies: {module.dependencies.length}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CreateNewDialog({ type, onTypeChange, onClose }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium mb-2 block">Creation Type</label>
        <Select value={type} onValueChange={onTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="function">Custom Function</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="plugin">Plugin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === 'function' && <CreateFunctionForm onClose={onClose} />}
      {type === 'workflow' && <CreateWorkflowForm onClose={onClose} />}
      {type === 'plugin' && <CreatePluginForm onClose={onClose} />}
    </div>
  )
}

function CreateFunctionForm({ onClose }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'processor',
    code: '// Write your function code here\nconst result = input.map(sample => sample * params.gain);\nreturn new Float32Array(result);'
  })

  const handleSubmit = async () => {
    try {
      await customFunctionalityManager.createFunction({
        ...formData,
        category: formData.category as 'processor' | 'analyzer' | 'visualizer' | 'utility' | 'workflow',
        inputTypes: ['audiodata'],
        outputType: 'audiodata',
        parameters: [
          {
            name: 'gain',
            type: 'number',
            required: true,
            defaultValue: 1.0,
            description: 'Gain multiplier'
          }
        ],
        language: 'javascript',
        author: 'User',
        version: '1.0.0',
        tags: [],
        dependencies: [],
        examples: []
      })
      onClose()
    } catch (error) {
      console.error('Failed to create function:', error)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Function name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <Textarea
        placeholder="Function description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />
      <Select value={formData.category} onValueChange={(category) => setFormData({ ...formData, category })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="processor">Processor</SelectItem>
          <SelectItem value="analyzer">Analyzer</SelectItem>
          <SelectItem value="visualizer">Visualizer</SelectItem>
          <SelectItem value="utility">Utility</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Function code"
        value={formData.code}
        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
        className="h-40 font-mono text-sm"
      />
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={!formData.name || !formData.code}>
          Create Function
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function CreateWorkflowForm({ onClose }: any) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Workflow creation UI would go here...</p>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
    </div>
  )
}

function CreatePluginForm({ onClose }: any) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Plugin creation UI would go here...</p>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
    </div>
  )
}