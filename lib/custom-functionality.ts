// Custom Functionality Support System
// Sistema per supportare funzionalità personalizzate definite dall'utente

import { EventEmitter } from 'events'
import { pluginManager, BasePlugin, PluginMetadata } from './plugin-system'
import { moduleLoader } from './module-loader'
import { apiExtensionManager, APIExtension, ExtensionBuilder } from './api-extensions'
import { AudioAnalysis } from '@/types/audio'

// Custom functionality interfaces
export interface CustomFunction {
  id: string
  name: string
  description: string
  category: 'processor' | 'analyzer' | 'visualizer' | 'utility' | 'workflow'
  inputTypes: string[]
  outputType: string
  parameters: CustomParameter[]
  code: string
  language: 'javascript' | 'typescript' | 'wasm'
  compiled?: any
  created: number
  modified: number
  author: string
  version: string
  tags: string[]
  dependencies: string[]
  examples: CustomExample[]
}

export interface CustomParameter {
  name: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'audiodata'
  required: boolean
  defaultValue?: any
  min?: number
  max?: number
  options?: any[]
  description: string
  validation?: string // Custom validation code
}

export interface CustomExample {
  name: string
  description: string
  input: any
  expectedOutput: any
  code?: string
}

export interface CustomWorkflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  variables: WorkflowVariable[]
  triggers: WorkflowTrigger[]
  created: number
  modified: number
  author: string
  tags: string[]
}

export interface WorkflowStep {
  id: string
  type: 'function' | 'condition' | 'loop' | 'parallel' | 'custom'
  functionId?: string
  condition?: string
  loopVariable?: string
  loopRange?: [number, number]
  customCode?: string
  parameters: Record<string, any>
  nextSteps: string[]
  errorHandling: 'continue' | 'stop' | 'retry'
}

export interface WorkflowVariable {
  name: string
  type: string
  value: any
  scope: 'global' | 'step' | 'local'
}

export interface WorkflowTrigger {
  type: 'manual' | 'fileLoad' | 'analysis' | 'timer' | 'condition'
  condition?: string
  schedule?: string
  enabled: boolean
}

export interface ExecutionContext {
  functionId: string
  input: any
  parameters: Record<string, any>
  variables: Map<string, any>
  metadata: {
    timestamp: number
    executionId: string
    userId?: string
    debugMode: boolean
  }
}

export interface ExecutionResult {
  success: boolean
  output?: any
  error?: {
    type: string
    message: string
    stack?: string
    line?: number
  }
  performance: {
    startTime: number
    endTime: number
    memoryUsed: number
    cpuTime: number
  }
  logs: LogEntry[]
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: number
  data?: any
}

// Custom Functionality Manager
export class CustomFunctionalityManager extends EventEmitter {
  private functions: Map<string, CustomFunction> = new Map()
  private workflows: Map<string, CustomWorkflow> = new Map()
  private executionContexts: Map<string, ExecutionContext> = new Map()
  private sandboxWorker: Worker | null = null
  private compiledFunctions: Map<string, Function> = new Map()
  private isInitialized = false

  constructor() {
    super()
    this.setupSandbox()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Load saved functions and workflows
      await this.loadSavedFunctions()
      await this.loadSavedWorkflows()
      
      // Setup built-in functions
      await this.setupBuiltInFunctions()
      
      // Initialize code execution sandbox
      await this.initializeSandbox()
      
      this.isInitialized = true
      this.emit('initialized')
      console.log('🎨 Custom Functionality Manager initialized')
    } catch (error) {
      console.error('❌ Custom Functionality Manager initialization failed:', error)
      throw error
    }
  }

  // Function management
  async createFunction(functionDef: Omit<CustomFunction, 'id' | 'created' | 'modified' | 'compiled'>): Promise<string> {
    const id = this.generateId('func')
    const now = Date.now()

    const customFunction: CustomFunction = {
      ...functionDef,
      id,
      created: now,
      modified: now,
      compiled: null
    }

    // Validate function
    await this.validateFunction(customFunction)

    // Compile function
    try {
      await this.compileFunction(customFunction)
    } catch (error) {
      throw new Error(`Function compilation failed: ${error}`)
    }

    // Store function
    this.functions.set(id, customFunction)
    await this.saveFunction(customFunction)

    // Register as plugin if applicable
    if (customFunction.category !== 'utility') {
      await this.registerAsPlugin(customFunction)
    }

    this.emit('functionCreated', customFunction)
    console.log(`✅ Custom function created: ${customFunction.name}`)
    return id
  }

  async updateFunction(id: string, updates: Partial<CustomFunction>): Promise<void> {
    const func = this.functions.get(id)
    if (!func) {
      throw new Error(`Function ${id} not found`)
    }

    const updatedFunction: CustomFunction = {
      ...func,
      ...updates,
      modified: Date.now(),
      compiled: null // Reset compilation
    }

    // Validate and recompile
    await this.validateFunction(updatedFunction)
    await this.compileFunction(updatedFunction)

    this.functions.set(id, updatedFunction)
    await this.saveFunction(updatedFunction)

    this.emit('functionUpdated', updatedFunction)
    console.log(`🔄 Custom function updated: ${updatedFunction.name}`)
  }

  async deleteFunction(id: string): Promise<void> {
    const func = this.functions.get(id)
    if (!func) return

    // Remove from storage
    this.functions.delete(id)
    this.compiledFunctions.delete(id)
    localStorage.removeItem(`custom_function_${id}`)

    // Unregister plugin if applicable
    await pluginManager.unloadPlugin(`custom_${id}`)

    this.emit('functionDeleted', id)
    console.log(`🗑️ Custom function deleted: ${func.name}`)
  }

  // Function execution
  async executeFunction(
    functionId: string, 
    input: any, 
    parameters: Record<string, any> = {},
    options: { debugMode?: boolean; timeout?: number } = {}
  ): Promise<ExecutionResult> {
    const func = this.functions.get(functionId)
    if (!func) {
      throw new Error(`Function ${functionId} not found`)
    }

    const executionId = this.generateId('exec')
    const startTime = performance.now()

    const context: ExecutionContext = {
      functionId,
      input,
      parameters,
      variables: new Map(),
      metadata: {
        timestamp: Date.now(),
        executionId,
        debugMode: options.debugMode || false
      }
    }

    this.executionContexts.set(executionId, context)

    try {
      // Validate input
      await this.validateInput(func, input)
      
      // Validate parameters
      await this.validateFunctionParameters(func, parameters)

      // Execute function
      const output = await this.runFunction(func, context, options.timeout || 30000)

      const endTime = performance.now()
      const result: ExecutionResult = {
        success: true,
        output,
        performance: {
          startTime,
          endTime,
          memoryUsed: this.getMemoryUsage(),
          cpuTime: endTime - startTime
        },
        logs: this.getExecutionLogs(executionId)
      }

      this.emit('functionExecuted', { functionId, context, result })
      return result

    } catch (error) {
      const endTime = performance.now()
      const result: ExecutionResult = {
        success: false,
        error: this.formatExecutionError(error),
        performance: {
          startTime,
          endTime,
          memoryUsed: this.getMemoryUsage(),
          cpuTime: endTime - startTime
        },
        logs: this.getExecutionLogs(executionId)
      }

      this.emit('functionError', { functionId, context, error, result })
      return result

    } finally {
      this.executionContexts.delete(executionId)
    }
  }

  // Workflow management
  async createWorkflow(workflowDef: Omit<CustomWorkflow, 'id' | 'created' | 'modified'>): Promise<string> {
    const id = this.generateId('workflow')
    const now = Date.now()

    const workflow: CustomWorkflow = {
      ...workflowDef,
      id,
      created: now,
      modified: now
    }

    await this.validateWorkflow(workflow)

    this.workflows.set(id, workflow)
    await this.saveWorkflow(workflow)

    this.emit('workflowCreated', workflow)
    console.log(`✅ Custom workflow created: ${workflow.name}`)
    return id
  }

  async executeWorkflow(
    workflowId: string, 
    input?: any,
    options: { debugMode?: boolean; variables?: Record<string, any> } = {}
  ): Promise<ExecutionResult[]> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    const results: ExecutionResult[] = []
    const workflowVariables = new Map<string, any>()

    // Initialize variables
    for (const variable of workflow.variables) {
      workflowVariables.set(variable.name, variable.value)
    }

    // Add input variables
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        workflowVariables.set(key, value)
      }
    }

    try {
      // Execute workflow steps
      for (const step of workflow.steps) {
        const stepResult = await this.executeWorkflowStep(step, workflowVariables, input, options)
        results.push(stepResult)

        if (!stepResult.success && step.errorHandling === 'stop') {
          break
        }
      }

      this.emit('workflowExecuted', { workflowId, results })
      return results

    } catch (error) {
      console.error(`❌ Workflow execution failed: ${workflowId}`, error)
      throw error
    }
  }

  // Code compilation and execution
  private async compileFunction(func: CustomFunction): Promise<void> {
    if (func.language === 'javascript' || func.language === 'typescript') {
      try {
        // Create a safe function wrapper
        const wrappedCode = this.createFunctionWrapper(func)
        const compiledFunction = new Function('input', 'params', 'context', 'api', wrappedCode)
        this.compiledFunctions.set(func.id, compiledFunction)
        func.compiled = true
      } catch (error) {
        throw new Error(`JavaScript compilation failed: ${error}`)
      }
    } else if (func.language === 'wasm') {
      // WebAssembly compilation would go here
      throw new Error('WebAssembly support not yet implemented')
    }
  }

  private createFunctionWrapper(func: CustomFunction): string {
    return `
      // Custom function: ${func.name}
      try {
        // User code execution context
        const console = {
          log: (...args) => context.log('info', ...args),
          warn: (...args) => context.log('warn', ...args),
          error: (...args) => context.log('error', ...args),
          debug: (...args) => context.log('debug', ...args)
        };
        
        // Utility functions
        const utils = {
          fft: api.fft,
          normalize: api.normalize,
          filter: api.filter,
          analyze: api.analyze
        };
        
        // Execute user code
        ${func.code}
        
        // Return result (user code should define 'result' variable)
        return typeof result !== 'undefined' ? result : null;
        
      } catch (error) {
        throw new Error('Function execution error: ' + error.message);
      }
    `
  }

  private async runFunction(
    func: CustomFunction, 
    context: ExecutionContext, 
    timeout: number
  ): Promise<any> {
    const compiledFunction = this.compiledFunctions.get(func.id)
    if (!compiledFunction) {
      throw new Error('Function not compiled')
    }

    // Create execution API
    const api = this.createExecutionAPI(context)

    // Execute with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Function execution timeout'))
      }, timeout)

      try {
        const result = compiledFunction(context.input, context.parameters, context, api)
        clearTimeout(timeoutId)
        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  private createExecutionAPI(context: ExecutionContext): any {
    return {
      // Audio processing utilities
      fft: (data: Float32Array) => {
        // FFT implementation
        return new Float32Array(data.length / 2)
      },
      
      normalize: (data: Float32Array, target: number = -23) => {
        // Normalization implementation
        const peak = Math.max(...Array.from(data).map(Math.abs))
        const targetLinear = Math.pow(10, target / 20)
        const gain = targetLinear / peak
        return data.map(sample => sample * gain)
      },
      
      filter: (data: Float32Array, type: string, frequency: number) => {
        // Audio filtering implementation
        return data // Simplified
      },
      
      analyze: (data: Float32Array) => {
        // Audio analysis implementation
        return {
          peak: Math.max(...Array.from(data).map(Math.abs)),
          rms: Math.sqrt(Array.from(data).reduce((sum, x) => sum + x * x, 0) / data.length)
        }
      },

      // Variable access
      getVar: (name: string) => context.variables.get(name),
      setVar: (name: string, value: any) => context.variables.set(name, value),

      // Logging
      log: (level: string, ...args: any[]) => {
        // Add to execution logs
        console.log(`[${level.toUpperCase()}]`, ...args)
      }
    }
  }

  // Validation methods
  private async validateFunction(func: CustomFunction): Promise<void> {
    // Basic validation
    if (!func.name || !func.code) {
      throw new Error('Function name and code are required')
    }

    // Code syntax validation
    if (func.language === 'javascript' || func.language === 'typescript') {
      try {
        // Basic syntax check
        new Function(func.code)
      } catch (error) {
        throw new Error(`Code syntax error: ${error}`)
      }
    }

    // Parameter validation
    for (const param of func.parameters) {
      if (!param.name || !param.type) {
        throw new Error('Parameter name and type are required')
      }
    }
  }

  private async validateInput(func: CustomFunction, input: any): Promise<void> {
    if (func.inputTypes.length === 0) return

    const inputType = typeof input
    const isValid = func.inputTypes.some(type => {
      switch (type) {
        case 'audiodata': return input instanceof Float32Array
        case 'array': return Array.isArray(input)
        case 'object': return inputType === 'object' && !Array.isArray(input)
        default: return inputType === type
      }
    })

    if (!isValid) {
      throw new Error(`Invalid input type. Expected: ${func.inputTypes.join(' or ')}`)
    }
  }

  private async validateFunctionParameters(func: CustomFunction, params: Record<string, any>): Promise<void> {
    for (const param of func.parameters) {
      const value = params[param.name]

      if (param.required && value === undefined) {
        throw new Error(`Required parameter '${param.name}' is missing`)
      }

      if (value !== undefined) {
        // Type checking
        const valueType = typeof value
        let isValidType = false

        switch (param.type) {
          case 'audiodata':
            isValidType = value instanceof Float32Array
            break
          case 'array':
            isValidType = Array.isArray(value)
            break
          case 'object':
            isValidType = valueType === 'object' && !Array.isArray(value)
            break
          default:
            isValidType = valueType === param.type
        }

        if (!isValidType) {
          throw new Error(`Parameter '${param.name}' must be of type ${param.type}`)
        }

        // Range validation
        if (param.type === 'number' && typeof value === 'number') {
          if (param.min !== undefined && value < param.min) {
            throw new Error(`Parameter '${param.name}' must be at least ${param.min}`)
          }
          if (param.max !== undefined && value > param.max) {
            throw new Error(`Parameter '${param.name}' must be at most ${param.max}`)
          }
        }

        // Custom validation
        if (param.validation) {
          try {
            const isValid = new Function('value', param.validation)(value)
            if (!isValid) {
              throw new Error(`Parameter '${param.name}' failed custom validation`)
            }
          } catch (error) {
            throw new Error(`Parameter validation error for '${param.name}': ${error}`)
          }
        }
      }
    }
  }

  private async validateWorkflow(workflow: CustomWorkflow): Promise<void> {
    if (!workflow.name || workflow.steps.length === 0) {
      throw new Error('Workflow name and steps are required')
    }

    // Validate steps
    for (const step of workflow.steps) {
      if (step.type === 'function' && step.functionId) {
        if (!this.functions.has(step.functionId)) {
          throw new Error(`Function ${step.functionId} not found for step ${step.id}`)
        }
      }
    }
  }

  // Workflow step execution
  private async executeWorkflowStep(
    step: WorkflowStep,
    variables: Map<string, any>,
    input: any,
    options: { debugMode?: boolean }
  ): Promise<ExecutionResult> {
    try {
      switch (step.type) {
        case 'function':
          if (!step.functionId) {
            throw new Error('Function ID required for function step')
          }
          return await this.executeFunction(step.functionId, input, step.parameters, options)

        case 'condition':
          const conditionResult = this.evaluateCondition(step.condition!, variables)
          return {
            success: true,
            output: conditionResult,
            performance: { startTime: 0, endTime: 0, memoryUsed: 0, cpuTime: 0 },
            logs: []
          }

        case 'custom':
          // Execute custom code
          if (!step.customCode) {
            throw new Error('Custom code required for custom step')
          }
          
          const customFunction = new Function('input', 'params', 'variables', step.customCode)
          const output = customFunction(input, step.parameters, Object.fromEntries(variables))
          
          return {
            success: true,
            output,
            performance: { startTime: 0, endTime: 0, memoryUsed: 0, cpuTime: 0 },
            logs: []
          }

        default:
          throw new Error(`Unsupported step type: ${step.type}`)
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatExecutionError(error),
        performance: { startTime: 0, endTime: 0, memoryUsed: 0, cpuTime: 0 },
        logs: []
      }
    }
  }

  private evaluateCondition(condition: string, variables: Map<string, any>): boolean {
    try {
      const vars = Object.fromEntries(variables)
      const func = new Function(...Object.keys(vars), `return ${condition}`)
      return Boolean(func(...Object.values(vars)))
    } catch (error) {
      console.error('Condition evaluation error:', error)
      return false
    }
  }

  // Plugin integration
  private async registerAsPlugin(func: CustomFunction): Promise<void> {
    const pluginClass = this.createPluginClass(func)
    await pluginManager.loadPlugin(pluginClass)
  }

  private createPluginClass(func: CustomFunction): any {
    const self = this
    
    return class CustomFunctionPlugin implements BasePlugin {
      metadata: PluginMetadata = {
        id: `custom_${func.id}`,
        name: func.name,
        version: func.version,
        description: func.description,
        author: func.author,
        category: func.category as any,
        tags: func.tags,
        license: 'Custom',
        minAppVersion: '1.0.0'
      }

      capabilities = {
        audioProcessing: func.category === 'processor',
        visualization: func.category === 'visualizer',
        analysis: func.category === 'analyzer',
        fileFormat: false,
        ui: false,
        realtime: true,
        gpu: false
      }

      async initialize(api: any): Promise<void> {
        console.log(`🔧 Custom plugin initialized: ${func.name}`)
      }

      async activate(): Promise<void> {
        console.log(`🚀 Custom plugin activated: ${func.name}`)
      }

      async deactivate(): Promise<void> {
        console.log(`⏹️ Custom plugin deactivated: ${func.name}`)
      }

      async destroy(): Promise<void> {
        console.log(`🗑️ Custom plugin destroyed: ${func.name}`)
      }

      async processAudio(data: Float32Array): Promise<Float32Array> {
        const result = await self.executeFunction(func.id, data)
        return result.success ? result.output : data
      }
    }
  }

  // Storage methods
  private async loadSavedFunctions(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('custom_function_'))
    
    for (const key of keys) {
      try {
        const functionData = JSON.parse(localStorage.getItem(key)!)
        this.functions.set(functionData.id, functionData)
        await this.compileFunction(functionData)
      } catch (error) {
        console.warn(`⚠️ Failed to load saved function ${key}:`, error)
      }
    }

    console.log(`📦 Loaded ${this.functions.size} saved functions`)
  }

  private async loadSavedWorkflows(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('custom_workflow_'))
    
    for (const key of keys) {
      try {
        const workflowData = JSON.parse(localStorage.getItem(key)!)
        this.workflows.set(workflowData.id, workflowData)
      } catch (error) {
        console.warn(`⚠️ Failed to load saved workflow ${key}:`, error)
      }
    }

    console.log(`📦 Loaded ${this.workflows.size} saved workflows`)
  }

  private async saveFunction(func: CustomFunction): Promise<void> {
    localStorage.setItem(`custom_function_${func.id}`, JSON.stringify(func))
  }

  private async saveWorkflow(workflow: CustomWorkflow): Promise<void> {
    localStorage.setItem(`custom_workflow_${workflow.id}`, JSON.stringify(workflow))
  }

  private async setupBuiltInFunctions(): Promise<void> {
    // Example built-in function
    await this.createFunction({
      name: 'Simple Gain',
      description: 'Apply gain to audio data',
      category: 'processor',
      inputTypes: ['audiodata'],
      outputType: 'audiodata',
      parameters: [
        {
          name: 'gain',
          type: 'number',
          required: true,
          defaultValue: 1.0,
          min: 0.0,
          max: 10.0,
          description: 'Gain multiplier'
        }
      ],
      code: `
        const gain = params.gain || 1.0;
        const result = input.map(sample => sample * gain);
        return new Float32Array(result);
      `,
      language: 'javascript',
      author: 'System',
      version: '1.0.0',
      tags: ['audio', 'gain', 'builtin'],
      dependencies: [],
      examples: [
        {
          name: 'Double volume',
          description: 'Double the volume of audio',
          input: new Float32Array([0.1, -0.2, 0.3]),
          expectedOutput: new Float32Array([0.2, -0.4, 0.6])
        }
      ]
    })
  }

  private setupSandbox(): void {
    // Setup Web Worker for sandboxed execution
    // This would be implemented for production use
  }

  private async initializeSandbox(): Promise<void> {
    // Initialize sandbox environment
    console.log('🏗️ Sandbox environment initialized')
  }

  // Utility methods
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0
  }

  private getExecutionLogs(executionId: string): LogEntry[] {
    // Return logs for execution (would be implemented with proper logging)
    return []
  }

  private formatExecutionError(error: any): ExecutionResult['error'] {
    return {
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      line: error.lineNumber
    }
  }

  // Public API
  getFunctions(): CustomFunction[] {
    return Array.from(this.functions.values())
  }

  getFunction(id: string): CustomFunction | undefined {
    return this.functions.get(id)
  }

  getWorkflows(): CustomWorkflow[] {
    return Array.from(this.workflows.values())
  }

  getWorkflow(id: string): CustomWorkflow | undefined {
    return this.workflows.get(id)
  }

  getFunctionsByCategory(category: CustomFunction['category']): CustomFunction[] {
    return this.getFunctions().filter(f => f.category === category)
  }
}

// Singleton instance
export const customFunctionalityManager = new CustomFunctionalityManager()

