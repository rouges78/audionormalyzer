// API Extensions System
// Sistema di estensioni API per architettura estensibile e integrazioni

import { EventEmitter } from 'events'
import { pluginManager, PluginAPI } from './plugin-system'
import { moduleLoader } from './module-loader'

// Extension interfaces
export interface APIExtension {
  id: string
  name: string
  version: string
  namespace: string
  methods: ExtensionMethod[]
  events: ExtensionEvent[]
  middleware: ExtensionMiddleware[]
  permissions: string[]
}

export interface ExtensionMethod {
  name: string
  handler: Function
  description: string
  parameters: Parameter[]
  returnType: string
  permissions?: string[]
  rateLimit?: RateLimit
}

export interface ExtensionEvent {
  name: string
  description: string
  data?: any
}

export interface ExtensionMiddleware {
  name: string
  handler: (context: APIContext, next: Function) => Promise<any>
  order: number
  enabled: boolean
}

export interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  validation?: ValidationRule[]
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'custom'
  value: any
  message?: string
}

export interface RateLimit {
  requests: number
  window: number // milliseconds
  byIP?: boolean
  byUser?: boolean
}

export interface APIContext {
  method: string
  parameters: any
  user?: any
  session?: any
  timestamp: number
  requestId: string
  metadata: Record<string, any>
}

export interface APIResponse {
  success: boolean
  data?: any
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    timestamp: number
    requestId: string
    processingTime: number
    version: string
  }
}

// API Extension Manager
export class APIExtensionManager extends EventEmitter {
  private extensions: Map<string, APIExtension> = new Map()
  private methods: Map<string, ExtensionMethod> = new Map()
  private middleware: ExtensionMiddleware[] = []
  private eventHandlers: Map<string, Function[]> = new Map()
  private rateLimiters: Map<string, RateLimiter> = new Map()
  private isInitialized = false

  constructor() {
    super()
    this.setupCoreAPI()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Load core extensions
      await this.loadCoreExtensions()
      
      // Setup middleware chain
      this.setupMiddlewareChain()
      
      // Initialize rate limiters
      this.setupRateLimiters()
      
      this.isInitialized = true
      this.emit('initialized')
      console.log('🚀 API Extension Manager initialized')
    } catch (error) {
      console.error('❌ API Extension Manager initialization failed:', error)
      throw error
    }
  }

  // Extension registration
  registerExtension(extension: APIExtension): void {
    const { id, namespace } = extension

    if (this.extensions.has(id)) {
      throw new Error(`Extension ${id} is already registered`)
    }

    // Validate extension
    this.validateExtension(extension)

    // Register methods
    for (const method of extension.methods) {
      const fullMethodName = `${namespace}.${method.name}`
      this.methods.set(fullMethodName, method)
    }

    // Register middleware
    this.middleware.push(...extension.middleware)
    this.middleware.sort((a, b) => a.order - b.order)

    // Register event handlers
    for (const event of extension.events) {
      const handlers = this.eventHandlers.get(event.name) || []
      this.eventHandlers.set(event.name, handlers)
    }

    this.extensions.set(id, extension)
    console.log(`✅ Extension registered: ${extension.name} v${extension.version}`)
    this.emit('extensionRegistered', extension)
  }

  unregisterExtension(extensionId: string): void {
    const extension = this.extensions.get(extensionId)
    if (!extension) return

    // Remove methods
    for (const method of extension.methods) {
      const fullMethodName = `${extension.namespace}.${method.name}`
      this.methods.delete(fullMethodName)
    }

    // Remove middleware
    this.middleware = this.middleware.filter(
      m => !extension.middleware.find(em => em.name === m.name)
    )

    // Remove event handlers
    for (const event of extension.events) {
      this.eventHandlers.delete(event.name)
    }

    this.extensions.delete(extensionId)
    console.log(`🗑️ Extension unregistered: ${extension.name}`)
    this.emit('extensionUnregistered', extension)
  }

  // API method execution
  async executeMethod(
    methodName: string, 
    parameters: any = {}, 
    context: Partial<APIContext> = {}
  ): Promise<APIResponse> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()
    
    const fullContext: APIContext = {
      method: methodName,
      parameters,
      timestamp: Date.now(),
      requestId,
      metadata: {},
      ...context
    }

    try {
      // Check if method exists
      const method = this.methods.get(methodName)
      if (!method) {
        throw new APIError('METHOD_NOT_FOUND', `Method ${methodName} not found`)
      }

      // Check permissions
      await this.checkPermissions(method, fullContext)

      // Check rate limits
      await this.checkRateLimit(method, fullContext)

      // Validate parameters
      await this.validateParameters(method, parameters)

      // Execute middleware chain
      const result = await this.executeMiddlewareChain(fullContext, async () => {
        return await method.handler(parameters, fullContext)
      })

      const processingTime = performance.now() - startTime

      const response: APIResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: Date.now(),
          requestId,
          processingTime,
          version: '1.0.0'
        }
      }

      this.emit('methodExecuted', { method: methodName, context: fullContext, response })
      return response

    } catch (error) {
      const processingTime = performance.now() - startTime
      
      const response: APIResponse = {
        success: false,
        error: this.formatError(error),
        metadata: {
          timestamp: Date.now(),
          requestId,
          processingTime,
          version: '1.0.0'
        }
      }

      this.emit('methodError', { method: methodName, context: fullContext, error, response })
      return response
    }
  }

  // Event system
  emitEvent(eventName: string, data?: any): void {
    const handlers = this.eventHandlers.get(eventName) || []
    
    for (const handler of handlers) {
      try {
        handler(data)
      } catch (error) {
        console.error(`❌ Event handler error for ${eventName}:`, error)
      }
    }

    this.emit('eventEmitted', { eventName, data })
  }

  addEventListener(eventName: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventName) || []
    handlers.push(handler)
    this.eventHandlers.set(eventName, handlers)
  }

  removeEventListener(eventName: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventName) || []
    const index = handlers.indexOf(handler)
    if (index !== -1) {
      handlers.splice(index, 1)
      this.eventHandlers.set(eventName, handlers)
    }
  }

  // Middleware management
  private async executeMiddlewareChain(context: APIContext, handler: Function): Promise<any> {
    let index = 0

    const next = async (): Promise<any> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++]
        if (middleware.enabled) {
          return await middleware.handler(context, next)
        } else {
          return await next()
        }
      } else {
        return await handler()
      }
    }

    return await next()
  }

  // Validation and security
  private validateExtension(extension: APIExtension): void {
    const requiredFields = ['id', 'name', 'version', 'namespace']
    for (const field of requiredFields) {
      if (!extension[field as keyof APIExtension]) {
        throw new Error(`Extension missing required field: ${field}`)
      }
    }

    // Validate namespace format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(extension.namespace)) {
      throw new Error('Invalid namespace format')
    }

    // Validate methods
    for (const method of extension.methods) {
      if (typeof method.handler !== 'function') {
        throw new Error(`Method ${method.name} handler must be a function`)
      }
    }
  }

  private async validateParameters(method: ExtensionMethod, parameters: any): Promise<void> {
    for (const param of method.parameters) {
      const value = parameters[param.name]

      // Check required parameters
      if (param.required && (value === undefined || value === null)) {
        throw new APIError('MISSING_PARAMETER', `Required parameter '${param.name}' is missing`)
      }

      // Type validation
      if (value !== undefined && !this.validateType(value, param.type)) {
        throw new APIError('INVALID_TYPE', `Parameter '${param.name}' must be of type ${param.type}`)
      }

      // Custom validation
      if (param.validation && value !== undefined) {
        await this.validateValue(value, param.validation, param.name)
      }
    }
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string'
      case 'number': return typeof value === 'number' && !isNaN(value)
      case 'boolean': return typeof value === 'boolean'
      case 'array': return Array.isArray(value)
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value)
      case 'function': return typeof value === 'function'
      default: return true
    }
  }

  private async validateValue(value: any, rules: ValidationRule[], paramName: string): Promise<void> {
    for (const rule of rules) {
      switch (rule.type) {
        case 'min':
          if (typeof value === 'number' && value < rule.value) {
            throw new APIError('VALIDATION_ERROR', `${paramName} must be at least ${rule.value}`)
          }
          if (typeof value === 'string' && value.length < rule.value) {
            throw new APIError('VALIDATION_ERROR', `${paramName} must be at least ${rule.value} characters`)
          }
          break

        case 'max':
          if (typeof value === 'number' && value > rule.value) {
            throw new APIError('VALIDATION_ERROR', `${paramName} must be at most ${rule.value}`)
          }
          if (typeof value === 'string' && value.length > rule.value) {
            throw new APIError('VALIDATION_ERROR', `${paramName} must be at most ${rule.value} characters`)
          }
          break

        case 'pattern':
          if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
            throw new APIError('VALIDATION_ERROR', rule.message || `${paramName} format is invalid`)
          }
          break

        case 'custom':
          if (typeof rule.value === 'function') {
            const isValid = await rule.value(value)
            if (!isValid) {
              throw new APIError('VALIDATION_ERROR', rule.message || `${paramName} validation failed`)
            }
          }
          break
      }
    }
  }

  private async checkPermissions(method: ExtensionMethod, context: APIContext): Promise<void> {
    if (!method.permissions || method.permissions.length === 0) {
      return // No permissions required
    }

    // This would integrate with your authentication/authorization system
    const userPermissions = context.user?.permissions || []
    
    const hasPermission = method.permissions.some(required => 
      userPermissions.includes(required) || userPermissions.includes('admin')
    )

    if (!hasPermission) {
      throw new APIError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to execute this method')
    }
  }

  private async checkRateLimit(method: ExtensionMethod, context: APIContext): Promise<void> {
    if (!method.rateLimit) return

    const key = this.getRateLimitKey(method, context)
    const limiter = this.rateLimiters.get(key) || new RateLimiter(method.rateLimit)
    
    this.rateLimiters.set(key, limiter)

    if (!limiter.checkLimit()) {
      throw new APIError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
    }
  }

  private getRateLimitKey(method: ExtensionMethod, context: APIContext): string {
    const parts = [method.name]
    
    if (method.rateLimit?.byUser && context.user?.id) {
      parts.push(`user:${context.user.id}`)
    }
    
    if (method.rateLimit?.byIP && context.metadata?.ip) {
      parts.push(`ip:${context.metadata.ip}`)
    }
    
    return parts.join(':')
  }

  // Core API setup
  private setupCoreAPI(): void {
    // Core audio processing API
    this.registerExtension({
      id: 'core.audio',
      name: 'Core Audio API',
      version: '1.0.0',
      namespace: 'audio',
      methods: [
        {
          name: 'analyze',
          handler: async (params: { data: Float32Array }) => {
            // Connect to main audio analysis system
            return { peak: -6.2, rms: -18.4, lufs: -23.1 }
          },
          description: 'Analyze audio data',
          parameters: [
            {
              name: 'data',
              type: 'object',
              required: true,
              description: 'Audio data as Float32Array'
            }
          ],
          returnType: 'object'
        },
        {
          name: 'normalize',
          handler: async (params: { data: Float32Array, target: number }) => {
            // Connect to normalization system
            return { data: params.data, applied: true }
          },
          description: 'Normalize audio data',
          parameters: [
            {
              name: 'data',
              type: 'object',
              required: true,
              description: 'Audio data to normalize'
            },
            {
              name: 'target',
              type: 'number',
              required: false,
              description: 'Target level in dB',
              validation: [
                { type: 'min', value: -60 },
                { type: 'max', value: 0 }
              ]
            }
          ],
          returnType: 'object'
        }
      ],
      events: [
        {
          name: 'audioLoaded',
          description: 'Fired when audio file is loaded'
        },
        {
          name: 'processingComplete',
          description: 'Fired when audio processing is complete'
        }
      ],
      middleware: [],
      permissions: []
    })
  }

  private async loadCoreExtensions(): Promise<void> {
    // Load additional core extensions
    console.log('📦 Loading core API extensions...')
  }

  private setupMiddlewareChain(): void {
    // Add core middleware
    this.middleware.push({
      name: 'logger',
      handler: async (context: APIContext, next: Function) => {
        console.log(`🔗 API Call: ${context.method} [${context.requestId}]`)
        const result = await next()
        console.log(`✅ API Complete: ${context.method} [${context.requestId}]`)
        return result
      },
      order: 0,
      enabled: true
    })

    this.middleware.push({
      name: 'errorHandler',
      handler: async (context: APIContext, next: Function) => {
        try {
          return await next()
        } catch (error) {
          console.error(`❌ API Error: ${context.method}`, error)
          throw error
        }
      },
      order: 999,
      enabled: true
    })
  }

  private setupRateLimiters(): void {
    // Cleanup old rate limiters periodically
    setInterval(() => {
      const now = Date.now()
      for (const [key, limiter] of this.rateLimiters.entries()) {
        if (now - limiter.lastReset > limiter.window * 2) {
          this.rateLimiters.delete(key)
        }
      }
    }, 60000) // Cleanup every minute
  }

  // Utility methods
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private formatError(error: any): { code: string; message: string; details?: any } {
    if (error instanceof APIError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }

    return {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An internal error occurred',
      details: error.stack
    }
  }

  // Public API
  getExtensions(): APIExtension[] {
    return Array.from(this.extensions.values())
  }

  getExtension(id: string): APIExtension | undefined {
    return this.extensions.get(id)
  }

  getMethods(): string[] {
    return Array.from(this.methods.keys())
  }

  getMethod(name: string): ExtensionMethod | undefined {
    return this.methods.get(name)
  }
}

// Rate Limiter
class RateLimiter {
  private requests: number = 0
  public lastReset: number = Date.now()
  public window: number

  constructor(private config: RateLimit) {
    this.window = config.window
  }

  checkLimit(): boolean {
    const now = Date.now()
    
    if (now - this.lastReset > this.window) {
      this.requests = 0
      this.lastReset = now
    }

    if (this.requests >= this.config.requests) {
      return false
    }

    this.requests++
    return true
  }
}

// API Error class
export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// Singleton instance
export const apiExtensionManager = new APIExtensionManager()

// Extension builder utility
export class ExtensionBuilder {
  private extension: Partial<APIExtension> = {
    methods: [],
    events: [],
    middleware: [],
    permissions: []
  }

  setInfo(id: string, name: string, version: string, namespace: string): this {
    this.extension.id = id
    this.extension.name = name
    this.extension.version = version
    this.extension.namespace = namespace
    return this
  }

  addMethod(method: ExtensionMethod): this {
    this.extension.methods!.push(method)
    return this
  }

  addEvent(event: ExtensionEvent): this {
    this.extension.events!.push(event)
    return this
  }

  addMiddleware(middleware: ExtensionMiddleware): this {
    this.extension.middleware!.push(middleware)
    return this
  }

  build(): APIExtension {
    if (!this.extension.id || !this.extension.name || !this.extension.version || !this.extension.namespace) {
      throw new Error('Extension info is incomplete')
    }

    return this.extension as APIExtension
  }
}

