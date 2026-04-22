import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type { PrimaryGroup, Settings, Shortcut, WindowState } from '../../shared/types/store'

interface LegacyBridgePayload {
  hasInitialized?: boolean
  settings?: {
    theme?: string
    sidebarOpen?: boolean
  }
}

interface StoreSnapshot {
  primaryGroups: PrimaryGroup[]
  settings: Settings
  windowState: WindowState
  lastActiveWebsiteId: string | null
  shortcuts: Shortcut[]
  storeSchemaVersion: number
}

const SUPPORTED_SCHEMA_VERSION = 1
const BRIDGE_TIMEOUT_MS = 3000

class StoreMigrationService {
  private bridgePayload: LegacyBridgePayload | null = null
  private bridgeResolved = false
  private bridgeResolver: (() => void) | null = null
  private readonly bridgePromise: Promise<void>
  private readonly readyPromise: Promise<void>
  private readyResolver: (() => void) | null = null
  private readyRejecter: ((error: unknown) => void) | null = null
  private started = false
  private backupFilePath: string | null = null

  constructor() {
    this.bridgePromise = new Promise<void>((resolve) => {
      this.bridgeResolver = resolve
    })

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolver = resolve
      this.readyRejecter = reject
    })
  }

  async start(): Promise<void> {
    if (this.started) {
      return this.readyPromise
    }
    this.started = true

    void this.run()
    return this.readyPromise
  }

  async waitUntilReady(): Promise<void> {
    return this.readyPromise
  }

  submitBridge(payload: LegacyBridgePayload): { accepted: boolean } {
    this.bridgePayload = payload
    if (!this.bridgeResolved) {
      this.bridgeResolved = true
      this.bridgeResolver?.()
    }
    return { accepted: true }
  }

  private async run(): Promise<void> {
    try {
      const { storeService } = await import('./store')

      const existingSchemaVersion = await storeService.getStoreSchemaVersion()
      if (existingSchemaVersion > SUPPORTED_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported store schema version: ${existingSchemaVersion}, supported: ${SUPPORTED_SCHEMA_VERSION}`
        )
      }

      await Promise.race([
        this.bridgePromise,
        new Promise<void>((resolve) => {
          setTimeout(resolve, BRIDGE_TIMEOUT_MS)
        })
      ])

      if (!this.bridgeResolved) {
        console.warn('[StoreMigration] bridge-timeout: proceeding without bridge payload')
      }

      if (this.bridgePayload) {
        await this.applyLegacyBridge(this.bridgePayload)
      }

      const snapshot = await this.createSnapshot()
      this.backupFilePath = await this.writeSnapshot(snapshot)

      await this.runMigrations()

      this.readyResolver?.()
    } catch (error) {
      console.error('[StoreMigration] Migration failed:', error)
      try {
        if (this.backupFilePath) {
          await this.restoreSnapshot(this.backupFilePath)
          console.error('[StoreMigration] Migration rollback completed')
        }
      } catch (rollbackError) {
        console.error('[StoreMigration] Rollback failed, reset may be required:', rollbackError)
      }

      this.readyRejecter?.(error)
    }
  }

  private async applyLegacyBridge(payload: LegacyBridgePayload): Promise<void> {
    const { storeService } = await import('./store')
    const currentSettings = await storeService.getSettings()
    const bridgeSettings = payload.settings || {}
    const updates: Partial<Settings> = {}
    const isFirstBridge = currentSettings.legacyBridgeCompletedAt === undefined

    if (
      (currentSettings.theme === undefined || currentSettings.theme === null) &&
      (bridgeSettings.theme === 'light' || bridgeSettings.theme === 'dark')
    ) {
      updates.theme = bridgeSettings.theme
    } else if (
      isFirstBridge &&
      currentSettings.theme === 'light' &&
      bridgeSettings.theme === 'dark'
    ) {
      // Allow first bridge to override default theme value from localStorage.
      updates.theme = 'dark'
    } else if (bridgeSettings.theme !== undefined && currentSettings.theme !== bridgeSettings.theme) {
      console.log('[StoreMigration] bridge conflict resolved by store priority: settings.theme')
    }

    const currentSidebarOpen = currentSettings.sidebarOpen
    if (
      (currentSidebarOpen === undefined || currentSidebarOpen === null) &&
      typeof bridgeSettings.sidebarOpen === 'boolean'
    ) {
      updates.sidebarOpen = bridgeSettings.sidebarOpen
    } else if (
      typeof bridgeSettings.sidebarOpen === 'boolean' &&
      currentSidebarOpen !== bridgeSettings.sidebarOpen
    ) {
      console.log('[StoreMigration] bridge conflict resolved by store priority: settings.sidebarOpen')
    }

    const currentLegacyInit = currentSettings.legacyHasInitialized
    if ((currentLegacyInit === undefined || currentLegacyInit === null) && payload.hasInitialized !== undefined) {
      updates.legacyHasInitialized = payload.hasInitialized
    }

    if (isFirstBridge) {
      updates.legacyBridgeCompletedAt = Date.now()
    }

    if (Object.keys(updates).length > 0) {
      await storeService.updateSettings(updates)
    }
  }

  private async runMigrations(): Promise<void> {
    const { storeService } = await import('./store')
    const currentSchemaVersion = await storeService.getStoreSchemaVersion()
    if (currentSchemaVersion <= 0) {
      await storeService.setStoreSchemaVersion(1)
      return
    }

    if (currentSchemaVersion === 1) {
      return
    }
  }

  private async createSnapshot(): Promise<StoreSnapshot> {
    const { storeService } = await import('./store')
    return {
      primaryGroups: await storeService.getPrimaryGroups(),
      settings: await storeService.getSettings(),
      windowState: await storeService.getWindowState(),
      lastActiveWebsiteId: await storeService.getLastActiveWebsiteId(),
      shortcuts: await storeService.getShortcuts(),
      storeSchemaVersion: await storeService.getStoreSchemaVersion()
    }
  }

  private async writeSnapshot(snapshot: StoreSnapshot): Promise<string> {
    const backupDir = path.join(app.getPath('userData'), 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, 'pager-mvp-migration-snapshot.json')
    await fs.writeFile(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8')
    return backupPath
  }

  private async restoreSnapshot(snapshotPath: string): Promise<void> {
    const { storeService } = await import('./store')
    const raw = await fs.readFile(snapshotPath, 'utf-8')
    const snapshot = JSON.parse(raw) as StoreSnapshot

    await storeService.setPrimaryGroups(snapshot.primaryGroups)
    await storeService.setSettings(snapshot.settings)
    await storeService.setWindowStateExact(snapshot.windowState)
    await storeService.setLastActiveWebsiteId(snapshot.lastActiveWebsiteId)
    await storeService.setShortcuts(snapshot.shortcuts)
    await storeService.setStoreSchemaVersion(snapshot.storeSchemaVersion)
  }
}

export const storeMigrationService = new StoreMigrationService()
export type { LegacyBridgePayload }
