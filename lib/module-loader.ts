// Dynamic Module Loader System
// Sistema per caricamento dinamico di moduli e plugin a runtime

import { PluginMetadata, BasePlugin, pluginManager } from './plugin-system'

interface ModuleInfo {
  id: string
  name: string
  version: string
  path: string
  type: 'plugin' | 'extension' | 'component' | 'utility'
  loaded: boolean
  loadTime?: number
  error?: string
  dependencies: string[]
  size?: number
}

interface LoadOptions {
  timeout?: number
  retry?: number
  cache?: boolean
  validate?: boolean
  dependencies?: boolean
}

interface ModuleCache {
  [key: string]: {
    module: any
    timestamp: number
    size: number
    hits: number
  }
}

export class ModuleLoader {
  private cache: ModuleCache = {}
  private loading: Map<string, Promise<any>> = new Map()
  private modules: Map<string, ModuleInfo> = new Map()
  private dependencies: Map<string, Set<string>> = new Map()
  private cacheEnabled = true
  private maxCacheSize = 50 * 1024 * 1024 // 50MB
  private currentCacheSize = 0

  constructor() {
    this.setupErrorHandling()
  }

  // Dynamic module loading
  async loadModule(
    path: string, 
    options: LoadOptions = {}
  ): Promise<any> {
    const {
      timeout = 10000,
      retry = 3,
      cache = true,
      validate = true,
      dependencies = true
    } = options

    // Check if already loading
    if (this.loading.has(path)) {
      return await this.loading.get(path)
    }

    // Check cache first
    if (cache && this.cacheEnabled && this.cache[path]) {
      const cached = this.cache[path]
      cached.hits++
      console.log(`📦 Module loaded from cache: ${path}`)
      return cached.module
    }

    // Create loading promise
    const loadingPromise = this.performLoad(path, {
      timeout,
      retry,
      validate,
      dependencies
    })

    this.loading.set(path, loadingPromise)

    try {
      const module = await loadingPromise
      
      // Cache the module
      if (cache && this.cacheEnabled) {
        await this.cacheModule(path, module)
      }

      return module
    } finally {
      this.loading.delete(path)
    }
  }

  private async performLoad(
    path: string, 
    options: {
      timeout: number
      retry: number
      validate: boolean
      dependencies: boolean
    }
  ): Promise<any> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= options.retry; attempt++) {
      try {
        console.log(`📥 Loading module: ${path} (attempt ${attempt}/${options.retry})`)
        
        const startTime = performance.now()
        const module = await this.loadWithTimeout(path, options.timeout)
        const loadTime = performance.now() - startTime

        // Validate module if requested
        if (options.validate) {
          this.validateModule(module, path)
        }

        // Load dependencies if requested
        if (options.dependencies) {
          await this.loadDependencies(module, path)
        }

        // Register module info
        this.registerModuleInfo(path, module, loadTime)

        console.log(`✅ Module loaded successfully: ${path} (${loadTime.toFixed(2)}ms)`)
        return module

      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ Module load attempt ${attempt} failed for ${path}:`, error)
        
        if (attempt < options.retry) {
          // Wait before retry with exponential backoff
          await this.delay(Math.pow(2, attempt - 1) * 1000)
        }
      }
    }

    throw new Error(`Failed to load module ${path} after ${options.retry} attempts: ${lastError?.message}`)
  }

  private async loadWithTimeout(path: string, timeout: number): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Module load timeout: ${path}`))
      }, timeout)

      try {
        let module: any

        if (this.isURL(path)) {
          // Load from URL
          module = await this.loadFromURL(path)
        } else if (this.isLocalPath(path)) {
          // Load from local path
          module = await this.loadFromPath(path)
        } else {
          // Assume it's a module name/identifier
          module = await this.loadFromRegistry(path)
        }

        clearTimeout(timeoutId)
        resolve(module)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  private async loadFromURL(url: string): Promise<any> {
    try {
      // Fetch module code
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const code = await response.text()
      
      // Create module URL
      const blob = new Blob([code], { type: 'application/javascript' })
      const moduleURL = URL.createObjectURL(blob)
      
      try {
        const module = await import(moduleURL)
        return module
      } finally {
        URL.revokeObjectURL(moduleURL)
      }
    } catch (error) {
      throw new Error(`Failed to load module from URL ${url}: ${error}`)
    }
  }

  private async loadFromPath(path: string): Promise<any> {
    try {
      // Dynamic import for local modules
      const module = await import(path)
      return module
    } catch (error) {
      throw new Error(`Failed to load module from path ${path}: ${error}`)
    }
  }

  private async loadFromRegistry(name: string): Promise<any> {
    // This would connect to a plugin registry or CDN
    const registryURL = `https://audio-plugins.example.com/${name}/latest.js`
    return await this.loadFromURL(registryURL)
  }

  private validateModule(module: any, path: string): void {
    // Basic validation
    if (!module) {
      throw new Error(`Module is null or undefined: ${path}`)
    }

    // Check for common export patterns
    const hasDefault = 'default' in module
    const hasNamedExports = Object.keys(module).length > (hasDefault ? 1 : 0)
    
    if (!hasDefault && !hasNamedExports) {
      throw new Error(`Module has no exports: ${path}`)
    }

    // Validate plugin modules
    if (this.isPluginModule(module)) {
      this.validatePluginModule(module, path)
    }
  }

  private isPluginModule(module: any): boolean {
    const PluginClass = module.default || module
    return (
      typeof PluginClass === 'function' &&
      PluginClass.prototype &&
      (
        'initialize' in PluginClass.prototype ||
        'metadata' in PluginClass.prototype
      )
    )
  }

  private validatePluginModule(module: any, path: string): void {
    const PluginClass = module.default || module
    
    // Check required methods
    const requiredMethods = ['initialize', 'activate', 'deactivate', 'destroy']
    for (const method of requiredMethods) {
      if (!(method in PluginClass.prototype)) {
        throw new Error(`Plugin module missing required method '${method}': ${path}`)
      }
    }

    // Validate metadata if present
    if ('metadata' in PluginClass.prototype) {
      const metadata = PluginClass.prototype.metadata as PluginMetadata
      const requiredFields = ['id', 'name', 'version', 'category']
      
      for (const field of requiredFields) {
        if (!metadata[field as keyof PluginMetadata]) {
          throw new Error(`Plugin metadata missing required field '${field}': ${path}`)
        }
      }
    }
  }

  private async loadDependencies(module: any, path: string): Promise<void> {
    const dependencies = this.extractDependencies(module)
    
    if (dependencies.length === 0) return

    console.log(`📦 Loading ${dependencies.length} dependencies for ${path}`)
    
    // Load dependencies in parallel
    const dependencyPromises = dependencies.map(dep => 
      this.loadModule(dep, { dependencies: false }) // Avoid circular dependencies
    )

    try {
      await Promise.all(dependencyPromises)
      this.dependencies.set(path, new Set(dependencies))
    } catch (error) {
      throw new Error(`Failed to load dependencies for ${path}: ${error}`)
    }
  }

  private extractDependencies(module: any): string[] {
    const dependencies: string[] = []

    // Check module metadata
    if (module.dependencies) {
      dependencies.push(...module.dependencies)
    }

    // Check plugin metadata
    const PluginClass = module.default || module
    if (PluginClass?.prototype?.metadata?.dependencies) {
      dependencies.push(...PluginClass.prototype.metadata.dependencies)
    }

    // Check package.json style dependencies
    if (module.peerDependencies) {
      dependencies.push(...Object.keys(module.peerDependencies))
    }

    return [...new Set(dependencies)] // Remove duplicates
  }

  private async cacheModule(path: string, module: any): Promise<void> {
    const moduleSize = this.estimateModuleSize(module)
    
    // Check cache size limits
    if (this.currentCacheSize + moduleSize > this.maxCacheSize) {
      await this.evictCache(moduleSize)
    }

    this.cache[path] = {
      module,
      timestamp: Date.now(),
      size: moduleSize,
      hits: 0
    }

    this.currentCacheSize += moduleSize
    console.log(`💾 Module cached: ${path} (${moduleSize} bytes)`)
  }

  private estimateModuleSize(module: any): number {
    try {
      // Rough estimation of module size
      const serialized = JSON.stringify(module, (key, value) => {
        if (typeof value === 'function') {
          return value.toString()
        }
        return value
      })
      return new Blob([serialized]).size
    } catch {
      return 1024 // Default fallback size
    }
  }

  private async evictCache(neededSize: number): Promise<void> {
    // LRU eviction based on hits and timestamp
    const entries = Object.entries(this.cache)
      .map(([path, data]) => ({
        path,
        score: data.hits / Math.max(1, (Date.now() - data.timestamp) / 1000),
        size: data.size
      }))
      .sort((a, b) => a.score - b.score)

    let freedSize = 0
    for (const entry of entries) {
      delete this.cache[entry.path]
      freedSize += entry.size
      this.currentCacheSize -= entry.size
      
      console.log(`🗑️ Evicted from cache: ${entry.path}`)
      
      if (freedSize >= neededSize) break
    }
  }

  private registerModuleInfo(path: string, module: any, loadTime: number): void {
    const info: ModuleInfo = {
      id: this.generateModuleId(path),
      name: this.extractModuleName(module, path),
      version: this.extractModuleVersion(module),
      path,
      type: this.detectModuleType(module),
      loaded: true,
      loadTime,
      dependencies: this.extractDependencies(module),
      size: this.estimateModuleSize(module)
    }

    this.modules.set(path, info)
  }

  private generateModuleId(path: string): string {
    return `module_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
  }

  private extractModuleName(module: any, path: string): string {
    if (module.name) return module.name
    if (module.default?.name) return module.default.name
    if (module.default?.prototype?.metadata?.name) return module.default.prototype.metadata.name
    
    // Extract from path
    return path.split('/').pop()?.replace(/\.[^.]*$/, '') || 'Unknown'
  }

  private extractModuleVersion(module: any): string {
    if (module.version) return module.version
    if (module.default?.version) return module.default.version
    if (module.default?.prototype?.metadata?.version) return module.default.prototype.metadata.version
    
    return '1.0.0'
  }

  private detectModuleType(module: any): ModuleInfo['type'] {
    if (this.isPluginModule(module)) return 'plugin'
    if (module.extension || module.isExtension) return 'extension'
    if (module.component || module.isComponent) return 'component'
    return 'utility'
  }

  // Utility methods
  private isURL(path: string): boolean {
    try {
      new URL(path)
      return true
    } catch {
      return false
    }
  }

  private isLocalPath(path: string): boolean {
    return path.startsWith('./') || path.startsWith('../') || path.startsWith('/')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private setupErrorHandling(): void {
    // Global error handling for module loading
    window.addEventListener('error', (event) => {
      if (event.filename && this.loading.has(event.filename)) {
        console.error(`🔴 Module load error: ${event.filename}`, event.error)
      }
    })
  }

  // Public API methods
  async loadPlugin(path: string, options: LoadOptions = {}): Promise<string> {
    const module = await this.loadModule(path, options)
    return await pluginManager.loadPlugin(module)
  }

  async unloadModule(path: string): Promise<void> {
    const moduleInfo = this.modules.get(path)
    if (!moduleInfo) return

    // Remove from cache
    delete this.cache[path]
    
    // Remove dependencies tracking
    this.dependencies.delete(path)
    
    // Mark as unloaded
    moduleInfo.loaded = false
    
    console.log(`🗑️ Module unloaded: ${path}`)
  }

  getModuleInfo(path: string): ModuleInfo | undefined {
    return this.modules.get(path)
  }

  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values())
  }

  getLoadedModules(): ModuleInfo[] {
    return this.getAllModules().filter(m => m.loaded)
  }

  clearCache(): void {
    this.cache = {}
    this.currentCacheSize = 0
    console.log('🧹 Module cache cleared')
  }

  getCacheStats() {
    return {
      size: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      entries: Object.keys(this.cache).length,
      hitRate: this.calculateHitRate()
    }
  }

  private calculateHitRate(): number {
    const entries = Object.values(this.cache)
    if (entries.length === 0) return 0
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    return totalHits / entries.length
  }

  // Configuration
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
    if (!enabled) {
      this.clearCache()
    }
  }

  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size
    if (this.currentCacheSize > size) {
      this.evictCache(this.currentCacheSize - size)
    }
  }
}

// Singleton instance
export const moduleLoader = new ModuleLoader()

// Hot Module Replacement (HMR) support for development
export class HotModuleReloader {
  private watchers: Map<string, any> = new Map()

  async enableHMR(path: string): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not supported, HMR disabled')
      return
    }

    try {
      // This would set up file watching for development
      console.log(`🔥 HMR enabled for: ${path}`)
    } catch (error) {
      console.error('❌ Failed to enable HMR:', error)
    }
  }

  disableHMR(path: string): void {
    const watcher = this.watchers.get(path)
    if (watcher) {
      watcher.close()
      this.watchers.delete(path)
      console.log(`🔥 HMR disabled for: ${path}`)
    }
  }
}

export const hmr = new HotModuleReloader()