import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MCP Server Safe Logger
 * Logs to file instead of stderr to prevent JSON response contamination
 */
class MCPLogger {
  private logFile: string;
  private stream: fs.WriteStream | null = null;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs', 'mcp');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with date
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logsDir, `mcp-server-${date}.log`);
    
    // Open write stream
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private write(level: string, message: string, data?: any) {
    if (!this.stream) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    
    this.stream.write(JSON.stringify(logEntry) + '\n');
  }

  info(message: string, data?: any) {
    this.write('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.write('WARN', message, data);
  }

  error(message: string, data?: any) {
    this.write('ERROR', message, data);
  }

  debug(message: string, data?: any) {
    this.write('DEBUG', message, data);
  }

  close() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

// Singleton instance
const mcpLogger = new MCPLogger();

// Clean shutdown
process.on('exit', () => {
  mcpLogger.close();
});

export default mcpLogger;