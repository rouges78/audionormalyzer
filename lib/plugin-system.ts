// Plugin Architecture System
// Architectural system for dynamic loading of plugins and extensions

import { AudioAnalysis } from '@/types/audio'
import { EventEmitter } from 'events'

// Plugin Interfaces
export interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: 'processor' | 'visualizer' | 'analyzer' | 'utility' | 'ui'
  tags: string[]
  dependencies?: string[]
  minAppVersion: string
  homepage?: string
  repository?: string
  license: string
}

export interface PluginCapabilities {
  audioProcessing: boolean
  visualization: boolean
  analysis: boolean
  fileFormat: boolean
  ui: boolean
  realtime: boolean
  gpu: boolean
}

export interface PluginAPI {
  // Core API access
  getAudioData(): Float32Array | null
  getAnalysis(): AudioAnalysis | null
  setStatus(message: string): void
  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void
  
  // Processing API
  processAudio(data: Float32Array): Promise<Float32Array>
  analyzeAudio(data: Float32Array): Promise<any>
  
  // UI API
  createPanel(title: string, content: HTMLElement): string
  removePanel(id: string): void
  updatePanel(id: string, content: HTMLElement): void
  
  // Storage API
  getConfig(key: string): any
  setConfig(key: string, value: any): void
  
  // Events API
  on(event: string, callback: Function): void
  emit(event: string, ...args: any[]): void
  off(event: string, callback: Function): void
}

export interface BasePlugin {
  metadata: PluginMetadata
  capabilities: PluginCapabilities
  
  // Lifecycle methods
  initialize(api: PluginAPI): Promise<void>
  activate(): Promise<void>
  deactivate(): Promise<void>
  destroy(): Promise<void>
  
  // Optional methods
  onAudioLoaded?(analysis: AudioAnalysis): void
  onProcessingStart?(): void
  onProcessingEnd?(): void
  onSettingsChanged?(settings: any): void
}

// Specific plugin types
export interface AudioProcessorPlugin extends BasePlugin {
  processAudio(data: Float32Array, settings?: any): Promise<Float32Array>
  getProcessorSettings(): any
  setProcessorSettings(settings: any): void
}

export interface VisualizerPlugin extends BasePlugin {
  render(canvas: HTMLCanvasElement, data: Float32Array, analysis: AudioAnalysis): void
  getVisualizerSettings(): any
  setVisualizerSettings(settings: any): void
}

export interface AnalyzerPlugin extends BasePlugin {
  analyze(data: Float32Array): Promise<any>
  getAnalysisType(): string
  getAnalysisSettings(): any
}

// Plugin Registry
class PluginRegistry {
  private plugins: Map<string, BasePlugin> = new Map()
  private activePlugins: Set<string> = new Set()
  private pluginConfigs: Map<string, any> = new Map()

  register(plugin: BasePlugin): void {
    const { id } = plugin.metadata
    
    if (this.plugins.has(id)) {
      throw new Error(`Plugin ${id} is already registered`)
    }
    
    // Validate plugin
    this.validatePlugin(plugin)
    
    this.plugins.set(id, plugin)
    console.log(`✅ Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`)
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    // Deactivate if active
    if (this.activePlugins.has(pluginId)) {
      this.deactivate(pluginId)
    }

    this.plugins.delete(pluginId)
    this.pluginConfigs.delete(pluginId)
    console.log(`🗑️ Plugin unregistered: ${pluginId}`)
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is already active`)
      return
    }

    try {
      await plugin.activate()
      this.activePlugins.add(pluginId)
      console.log(`🚀 Plugin activated: ${plugin.metadata.name}`)
    } catch (error) {
      console.error(`❌ Failed to activate plugin ${pluginId}:`, error)
      throw error
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (!this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is not active`)
      return
    }

    try {
      await plugin.deactivate()
      this.activePlugins.delete(pluginId)
      console.log(`⏹️ Plugin deactivated: ${plugin.metadata.name}`)
    } catch (error) {
      console.error(`❌ Failed to deactivate plugin ${pluginId}:`, error)
    }
  }

  get(pluginId: string): BasePlugin | undefined {
    return this.plugins.get(pluginId)
  }

  getAll(): BasePlugin[] {
    return Array.from(this.plugins.values())
  }

  getActive(): BasePlugin[] {
    return Array.from(this.activePlugins)
      .map(id => this.plugins.get(id))
      .filter(Boolean) as BasePlugin[]
  }

  getByCategory(category: PluginMetadata['category']): BasePlugin[] {
    return this.getAll().filter(plugin => plugin.metadata.category === category)
  }

  private validatePlugin(plugin: BasePlugin): void {
    const { metadata, capabilities } = plugin

    // Required metadata fields
    const requiredFields = ['id', 'name', 'version', 'description', 'author', 'category', 'license']
    for (const field of requiredFields) {
      if (!metadata[field as keyof PluginMetadata]) {
        throw new Error(`Plugin missing required field: ${field}`)
      }
    }

    // Validate category
    const validCategories = ['processor', 'visualizer', 'analyzer', 'utility', 'ui']
    if (!validCategories.includes(metadata.category)) {
      throw new Error(`Invalid plugin category: ${metadata.category}`)
    }

    // Validate required methods
    const requiredMethods = ['initialize', 'activate', 'deactivate', 'destroy']
    for (const method of requiredMethods) {
      if (typeof plugin[method as keyof BasePlugin] !== 'function') {
        throw new Error(`Plugin missing required method: ${method}`)
      }
    }
  }
}

// Plugin Manager
export class PluginManager extends EventEmitter {
  private registry = new PluginRegistry()
  private api: PluginAPI
  private loadedModules: Map<string, any> = new Map()
  private isInitialized = false

  constructor() {
    super()
    this.api = this.createPluginAPI()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Load built-in plugins
      await this.loadBuiltInPlugins()
      
      // Load user plugins from storage
      await this.loadUserPlugins()
      
      this.isInitialized = true
      this.emit('initialized')
      console.log('🎉 Plugin Manager initialized successfully')
    } catch (error) {
      console.error('❌ Plugin Manager initialization failed:', error)
      throw error
    }
  }

  async loadPlugin(source: string | Function, metadata?: PluginMetadata): Promise<string> {
    try {
      let PluginClass: any

      if (typeof source === 'string') {
        // Dynamic import from URL or path
        const module = await import(source)
        PluginClass = module.default || module
      } else if (typeof source === 'function') {
        // Direct class/function
        PluginClass = source
      } else {
        throw new Error('Invalid plugin source')
      }

      // Create plugin instance
      const plugin: BasePlugin = new PluginClass()

      // Use provided metadata or plugin's own metadata
      if (metadata) {
        plugin.metadata = { ...plugin.metadata, ...metadata }
      }

      // Initialize plugin
      await plugin.initialize(this.api)

      // Register plugin
      this.registry.register(plugin)
      this.loadedModules.set(plugin.metadata.id, PluginClass)

      this.emit('pluginLoaded', plugin.metadata.id)
      return plugin.metadata.id

    } catch (error) {
      console.error('❌ Failed to load plugin:', error)
      throw error
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId)
    if (!plugin) return

    try {
      // Destroy plugin
      await plugin.destroy()
      
      // Unregister
      this.registry.unregister(pluginId)
      this.loadedModules.delete(pluginId)
      
      this.emit('pluginUnloaded', pluginId)
    } catch (error) {
      console.error(`❌ Failed to unload plugin ${pluginId}:`, error)
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    await this.registry.activate(pluginId)
    this.emit('pluginActivated', pluginId)
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    await this.registry.deactivate(pluginId)
    this.emit('pluginDeactivated', pluginId)
  }

  getPlugin(pluginId: string): BasePlugin | undefined {
    return this.registry.get(pluginId)
  }

  getAllPlugins(): BasePlugin[] {
    return this.registry.getAll()
  }

  getActivePlugins(): BasePlugin[] {
    return this.registry.getActive()
  }

  getPluginsByCategory(category: PluginMetadata['category']): BasePlugin[] {
    return this.registry.getByCategory(category)
  }

  // Execute plugins by category
  async executeProcessors(audioData: Float32Array): Promise<Float32Array> {
    const processors = this.getActivePlugins()
      .filter(p => p.capabilities.audioProcessing) as AudioProcessorPlugin[]

    let result = audioData
    for (const processor of processors) {
      try {
        result = await processor.processAudio(result)
      } catch (error) {
        console.error(`❌ Processor plugin ${processor.metadata.id} failed:`, error)
      }
    }
    return result
  }

  async executeAnalyzers(audioData: Float32Array): Promise<Map<string, any>> {
    const analyzers = this.getActivePlugins()
      .filter(p => p.capabilities.analysis) as AnalyzerPlugin[]

    const results = new Map<string, any>()
    
    await Promise.all(
      analyzers.map(async (analyzer) => {
        try {
          const result = await analyzer.analyze(audioData)
          results.set(analyzer.metadata.id, result)
        } catch (error) {
          console.error(`❌ Analyzer plugin ${analyzer.metadata.id} failed:`, error)
        }
      })
    )

    return results
  }

  executeVisualizers(canvas: HTMLCanvasElement, audioData: Float32Array, analysis: AudioAnalysis): void {
    const visualizers = this.getActivePlugins()
      .filter(p => p.capabilities.visualization) as VisualizerPlugin[]

    for (const visualizer of visualizers) {
      try {
        visualizer.render(canvas, audioData, analysis)
      } catch (error) {
        console.error(`❌ Visualizer plugin ${visualizer.metadata.id} failed:`, error)
      }
    }
  }

  private createPluginAPI(): PluginAPI {
    return {
      // Core API
      getAudioData: () => {
        // This would be connected to the main audio system
        return null
      },
      getAnalysis: () => {
        // This would be connected to the main analysis system
        return null
      },
      setStatus: (message: string) => {
        this.emit('statusUpdate', message)
      },
      showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        this.emit('notification', { message, type })
      },

      // Processing API
      processAudio: async (data: Float32Array) => {
        // This would be connected to the main processing pipeline
        return data
      },
      analyzeAudio: async (data: Float32Array) => {
        // This would be connected to the main analysis system
        return {}
      },

      // UI API
      createPanel: (title: string, content: HTMLElement) => {
        const id = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        this.emit('createPanel', { id, title, content })
        return id
      },
      removePanel: (id: string) => {
        this.emit('removePanel', id)
      },
      updatePanel: (id: string, content: HTMLElement) => {
        this.emit('updatePanel', { id, content })
      },

      // Storage API
      getConfig: (key: string) => {
        return JSON.parse(localStorage.getItem(`plugin_config_${key}`) || 'null')
      },
      setConfig: (key: string, value: any) => {
        localStorage.setItem(`plugin_config_${key}`, JSON.stringify(value))
      },

      // Events API
      on: (event: string, callback: (...args: any[]) => void) => {
        this.on(event, callback)
      },
      emit: (event: string, ...args: any[]) => {
        this.emit(event, ...args)
      },
      off: (event: string, callback: (...args: any[]) => void) => {
        this.off(event, callback)
      }
    }
  }

  private async loadBuiltInPlugins(): Promise<void> {
    // Load built-in plugins here
    console.log('📦 Loading built-in plugins...')
    
    // Example: Load built-in reverb processor
    // await this.loadPlugin('./plugins/built-in/reverb-processor')
  }

  private async loadUserPlugins(): Promise<void> {
    // Load user plugins from configuration
    console.log('👤 Loading user plugins...')
    
    const userPlugins = JSON.parse(localStorage.getItem('user_plugins') || '[]')
    for (const pluginPath of userPlugins) {
      try {
        await this.loadPlugin(pluginPath)
      } catch (error) {
        console.warn(`⚠️ Failed to load user plugin ${pluginPath}:`, error)
      }
    }
  }

  // Plugin management utilities
  saveUserPlugins(): void {
    const userPlugins = this.getAllPlugins()
      .filter(p => !p.metadata.id.startsWith('builtin_'))
      .map(p => p.metadata.id)

    localStorage.setItem('user_plugins', JSON.stringify(userPlugins))
  }

  exportPlugin(pluginId: string): string {
    const plugin = this.registry.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    return JSON.stringify({
      metadata: plugin.metadata,
      capabilities: plugin.capabilities,
      // Note: Actual code export would require additional serialization
    }, null, 2)
  }

  async importPlugin(pluginData: string): Promise<string> {
    const data = JSON.parse(pluginData)
    // Implementation would depend on the plugin format
    // This is a simplified version
    throw new Error('Plugin import not yet implemented')
  }
}

// Singleton instance
export const pluginManager = new PluginManager()

// Plugin development utilities
export class PluginBuilder {
  static createMetadata(
    id: string,
    name: string,
    version: string,
    description: string,
    author: string,
    category: PluginMetadata['category']
  ): PluginMetadata {
    return {
      id,
      name,
      version,
      description,
      author,
      category,
      tags: [],
      minAppVersion: '1.0.0',
      license: 'MIT'
    }
  }

  static createCapabilities(options: Partial<PluginCapabilities> = {}): PluginCapabilities {
    return {
      audioProcessing: false,
      visualization: false,
      analysis: false,
      fileFormat: false,
      ui: false,
      realtime: false,
      gpu: false,
      ...options
    }
  }
}

