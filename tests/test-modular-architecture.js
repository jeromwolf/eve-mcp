#!/usr/bin/env node

/**
 * Integration Test for Modular NRC ADAMS MCP Server v3.0
 * Tests the new modular architecture with separate services
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

class ModularArchitectureTest {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    this.testResults.total++;
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      await testFn();
      console.log(`✅ PASS: ${name}`);
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASS', error: null });
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAIL', error: error.message });
    }
  }

  async testMCPServerResponse() {
    // Test basic MCP server functionality
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000
      });

      let responseReceived = false;
      let responseData = '';

      // Send tools/list request
      const listRequest = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1
      }) + '\n';

      serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        
        try {
          const response = JSON.parse(responseData.trim());
          if (response.result && response.result.tools) {
            const tools = response.result.tools;
            const expectedTools = [
              'search_adams',
              'download_adams_documents', 
              'ask_about_documents',
              'list_downloaded_documents',
              'clear_cache',
              'get_system_stats'
            ];

            const foundTools = tools.map(t => t.name);
            const missingTools = expectedTools.filter(t => !foundTools.includes(t));
            
            if (missingTools.length === 0 && foundTools.includes('get_system_stats')) {
              responseReceived = true;
              serverProcess.kill();
              resolve(`Found all ${tools.length} expected tools including new get_system_stats`);
            } else {
              reject(new Error(`Missing tools: ${missingTools.join(', ')}`));
            }
          }
        } catch (e) {
          // Waiting for complete JSON response
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.log('    Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Server process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!responseReceived) {
          reject(new Error(`Server closed with code ${code} without proper response`));
        }
      });

      // Send the request
      setTimeout(() => {
        serverProcess.stdin.write(listRequest);
      }, 1000);

      // Timeout handling
      setTimeout(() => {
        if (!responseReceived) {
          serverProcess.kill();
          reject(new Error('Server response timeout after 15 seconds'));
        }
      }, 15000);
    });
  }

  async testModularServicesExist() {
    // Test that all modular service files exist
    const serviceFiles = [
      'src/services/search-service.ts',
      'src/services/download-service.ts', 
      'src/services/cache-manager.ts',
      'src/server/config.ts'
    ];

    for (const file of serviceFiles) {
      const filePath = path.join(__dirname, file);
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error(`Service file missing: ${file}`);
      }

      // Check file size to ensure it's not empty
      if (stats.size < 1000) {
        throw new Error(`Service file too small (${stats.size} bytes): ${file}`);
      }
    }

    return `All ${serviceFiles.length} modular service files exist and have content`;
  }

  async testBuildOutput() {
    // Test that built files exist and are recent
    const buildFiles = [
      'build/index.js',
      'build/services/search-service.js',
      'build/services/download-service.js',
      'build/services/cache-manager.js',
      'build/server/config.js'
    ];

    for (const file of buildFiles) {
      const filePath = path.join(__dirname, file);
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error(`Build file missing: ${file}`);
      }

      // Check if file is recent (built within last hour)
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
      if (ageMinutes > 60) {
        throw new Error(`Build file is old (${Math.round(ageMinutes)} min): ${file}`);
      }
    }

    return `All ${buildFiles.length} build files exist and are recent`;
  }

  async testIndexFileReduction() {
    // Test that the new index.ts is significantly smaller than backup
    const newIndexPath = path.join(__dirname, 'src/index.ts');
    const backupIndexPath = path.join(__dirname, 'src/index-backup.ts');

    const newStats = await fs.stat(newIndexPath);
    const backupStats = await fs.stat(backupIndexPath);

    const reduction = ((backupStats.size - newStats.size) / backupStats.size) * 100;

    if (reduction < 10) {
      throw new Error(`Index.ts not significantly reduced: only ${reduction.toFixed(1)}% smaller`);
    }

    return `Index.ts reduced by ${reduction.toFixed(1)}% (${backupStats.size} → ${newStats.size} bytes)`;
  }

  async testConfigurationSystem() {
    // Test configuration system can be imported and provides defaults
    return new Promise((resolve, reject) => {
      const testProcess = spawn('node', ['-e', `
        import('./build/server/config.js').then(config => {
          const cfg = config.configManager.getConfig();
          console.log(JSON.stringify({
            hasCache: !!cfg.cache,
            hasADAMS: !!cfg.adams,
            hasDownload: !!cfg.download,
            hasRAG: !!cfg.rag,
            maxCacheSize: cfg.cache?.maxSize,
            defaultTarget: cfg.download?.defaultTarget
          }));
        }).catch(err => {
          console.error('ERROR:', err.message);
          process.exit(1);
        });
      `], { timeout: 10000 });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Configuration system test failed'));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (result.hasCache && result.hasADAMS && result.hasDownload && result.hasRAG) {
            resolve(`Config system working: cache=${result.maxCacheSize}, target=${result.defaultTarget}`);
          } else {
            reject(new Error('Configuration missing required sections'));
          }
        } catch (e) {
          reject(new Error(`Config test output parse error: ${e.message}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Config test process error: ${error.message}`));
      });
    });
  }

  async runAllTests() {
    console.log('🏗️  Testing NRC ADAMS MCP Server v3.0 - Modular Architecture');
    console.log('=' .repeat(65));

    await this.runTest(
      'Modular Service Files Exist',
      () => this.testModularServicesExist()
    );

    await this.runTest(
      'TypeScript Build Output Complete', 
      () => this.testBuildOutput()
    );

    await this.runTest(
      'Index.ts Size Reduction',
      () => this.testIndexFileReduction()
    );

    await this.runTest(
      'Configuration System Functional',
      () => this.testConfigurationSystem()
    );

    await this.runTest(
      'MCP Server Tools Response',
      () => this.testMCPServerResponse()
    );

    // Print summary
    console.log('\n' + '='.repeat(65));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(65));
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`   • ${t.name}: ${t.error}`));
    }

    console.log('\n🎯 ARCHITECTURE STATUS:');
    if (this.testResults.passed === this.testResults.total) {
      console.log('✅ Modular architecture refactoring SUCCESSFUL!');
      console.log('🚀 Ready for production deployment');
    } else {
      console.log('⚠️  Modular architecture needs attention');
      console.log('🔧 Review failed tests and fix issues');
    }

    return this.testResults.passed === this.testResults.total;
  }
}

// Run tests
const tester = new ModularArchitectureTest();
tester.runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  });