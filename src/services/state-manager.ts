import { promises as fs } from 'fs';
import * as path from 'path';
import mcpLogger from '../mcp-logger.js';
import { configManager } from '../server/config.js';

interface SessionState {
  lastSearchResults: any[];
  lastSearchQuery?: string;
  timestamp: number;
}

export class StateManager {
  private readonly statePath: string;
  private readonly maxStateAge: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    const config = configManager.getConfig();
    this.statePath = path.join(config.storage.logsPath, 'session-state.json');
    mcpLogger.info('StateManager initialized', { statePath: this.statePath });
  }

  /**
   * Save search results to persistent state
   */
  async saveSearchResults(results: any[], query?: string): Promise<void> {
    try {
      const state: SessionState = {
        lastSearchResults: results,
        lastSearchQuery: query,
        timestamp: Date.now()
      };

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      
      // Save state
      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
      
      mcpLogger.info('Search results saved to state', {
        resultCount: results.length,
        query: query,
        timestamp: state.timestamp
      });
    } catch (error: any) {
      mcpLogger.error('Failed to save search results', {
        error: error.message,
        statePath: this.statePath
      });
    }
  }

  /**
   * Load search results from persistent state
   */
  async loadSearchResults(): Promise<{ results: any[], query?: string } | null> {
    try {
      // Check if state file exists
      const exists = await fs.access(this.statePath).then(() => true).catch(() => false);
      if (!exists) {
        mcpLogger.debug('No state file found');
        return null;
      }

      // Read and parse state
      const stateData = await fs.readFile(this.statePath, 'utf8');
      const state: SessionState = JSON.parse(stateData);

      // Check if state is not too old
      const age = Date.now() - state.timestamp;
      if (age > this.maxStateAge) {
        mcpLogger.info('State expired, clearing', {
          age: Math.round(age / 1000),
          maxAge: Math.round(this.maxStateAge / 1000)
        });
        await this.clearState();
        return null;
      }

      mcpLogger.info('Search results loaded from state', {
        resultCount: state.lastSearchResults.length,
        query: state.lastSearchQuery,
        ageMinutes: Math.round(age / 60000)
      });

      return {
        results: state.lastSearchResults,
        query: state.lastSearchQuery
      };
    } catch (error: any) {
      mcpLogger.error('Failed to load search results', {
        error: error.message,
        statePath: this.statePath
      });
      return null;
    }
  }

  /**
   * Clear persistent state
   */
  async clearState(): Promise<void> {
    try {
      const exists = await fs.access(this.statePath).then(() => true).catch(() => false);
      if (exists) {
        await fs.unlink(this.statePath);
        mcpLogger.info('Session state cleared');
      }
    } catch (error: any) {
      mcpLogger.error('Failed to clear state', {
        error: error.message,
        statePath: this.statePath
      });
    }
  }

  /**
   * Get state file info
   */
  async getStateInfo(): Promise<{
    exists: boolean;
    age?: number;
    resultCount?: number;
    query?: string;
  }> {
    try {
      const exists = await fs.access(this.statePath).then(() => true).catch(() => false);
      if (!exists) {
        return { exists: false };
      }

      const stateData = await fs.readFile(this.statePath, 'utf8');
      const state: SessionState = JSON.parse(stateData);
      const age = Date.now() - state.timestamp;

      return {
        exists: true,
        age,
        resultCount: state.lastSearchResults.length,
        query: state.lastSearchQuery
      };
    } catch (error: any) {
      mcpLogger.error('Failed to get state info', { error: error.message });
      return { exists: false };
    }
  }

  /**
   * Auto-cleanup old state files
   */
  async cleanup(): Promise<void> {
    const info = await this.getStateInfo();
    if (info.exists && info.age && info.age > this.maxStateAge) {
      await this.clearState();
    }
  }
}

// Singleton instance
export const stateManager = new StateManager();