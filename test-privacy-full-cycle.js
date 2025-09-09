import 'dotenv/config';
import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { RAGEngine } from './build/rag-engine.js';
import { getKeywordStatistics } from './build/utils.js';
import { ComplianceChecker } from './build/logger-privacy.js';
import fs from 'fs/promises';
import path from 'path';

// 테스트 시나리오 정의
const testScenarios = [
  {
    name: 'Nuclear Safety Analysis',
    searchQuery: 'nuclear reactor safety analysis 2024',
    userEmail: 'researcher@university.edu',
    userPhone: '010-9876-5432',
    ipAddress: '192.168.1.100'
  },
  {
    name: 'Emergency Planning',
    searchQuery: 'emergency core cooling system',
    userEmail: 'john.doe@nrc.gov',
    userPhone: '202-555-0123',
    ipAddress: '10.0.0.50'
  },
  {
    name: 'Reactor Vessel Inspection',
    searchQuery: 'reactor vessel inspection report',
    userEmail: 'inspector@example.com',
    userPhone: '555-123-4567',
    ipAddress: '172.16.0.10'
  }
];

async function runPrivacyFullCycleTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 PRIVACY-ENHANCED FULL CYCLE TEST');
  console.log('='.repeat(80));
  console.log(`Test Start: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  const scraper = new ImprovedADAMSScraper();
  const rag = new RAGEngine();
  
  const testResults = {
    scenarios: [],
    privacyViolations: [],
    complianceStatus: null,
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      piiLeaks: 0
    }
  };
  
  try {
    for (const scenario of testScenarios) {
      console.log('\n' + '─'.repeat(70));
      console.log(`📋 SCENARIO: ${scenario.name}`);
      console.log('─'.repeat(70));
      
      const scenarioResult = {
        name: scenario.name,
        steps: [],
        hasPrivacyIssues: false
      };
      
      // Simulate user context (이 정보들이 로그에 노출되면 안됨)
      const userContext = {
        email: scenario.userEmail,
        phone: scenario.userPhone,
        ip: scenario.ipAddress,
        sessionId: `sess_${Math.random().toString(36).substr(2, 9)}`,
        apiKey: `sk-${Math.random().toString(36).substr(2, 32)}`
      };
      
      console.log('\n🔍 Step 1: SEARCH');
      console.log(`Query: "${scenario.searchQuery}"`);
      console.log(`User: ${userContext.email} (This should be masked in logs)`);
      
      // 1. 검색 수행
      const searchStart = Date.now();
      let searchResults = [];
      
      try {
        searchResults = await scraper.searchReal(scenario.searchQuery, 3);
        const searchTime = Date.now() - searchStart;
        
        console.log(`✅ Found ${searchResults.length} documents in ${searchTime}ms`);
        searchResults.slice(0, 2).forEach((doc, i) => {
          console.log(`  ${i+1}. ${doc.accessionNumber}: ${doc.title.substring(0, 50)}...`);
        });
        
        scenarioResult.steps.push({
          step: 'search',
          success: true,
          resultCount: searchResults.length,
          timeMs: searchTime
        });
      } catch (error) {
        console.log(`❌ Search failed: ${error.message}`);
        scenarioResult.steps.push({
          step: 'search',
          success: false,
          error: error.message
        });
      }
      
      // 2. 다운로드 테스트
      if (searchResults.length > 0) {
        console.log('\n📥 Step 2: DOWNLOAD');
        const doc = searchResults[0];
        console.log(`Downloading: ${doc.accessionNumber}`);
        console.log(`User IP: ${userContext.ip} (This should be masked in logs)`);
        
        const downloadStart = Date.now();
        
        try {
          // 키워드 기반 폴더에 저장
          const success = await scraper.downloadRealPDF(
            doc.accessionNumber,
            '',
            scenario.searchQuery
          );
          
          const downloadTime = Date.now() - downloadStart;
          
          if (success) {
            console.log(`✅ Downloaded in ${downloadTime}ms`);
            scenarioResult.steps.push({
              step: 'download',
              success: true,
              document: doc.accessionNumber,
              timeMs: downloadTime
            });
            
            // 3. RAG 테스트
            console.log('\n🧠 Step 3: RAG PROCESSING');
            console.log(`Session: ${userContext.sessionId} (This should be masked)`);
            
            try {
              // 간단한 텍스트로 RAG 테스트
              const sampleText = `Document ${doc.accessionNumber}: ${doc.title}. 
                This document discusses nuclear safety regulations and procedures.
                Contact: ${userContext.email}, Phone: ${userContext.phone}`;
              
              await rag.addDocument(doc.accessionNumber, sampleText, {
                title: doc.title,
                userEmail: userContext.email, // 이것도 마스킹되어야 함
                uploadedBy: userContext.email
              });
              
              const ragStats = rag.getStats();
              console.log(`✅ RAG initialized: ${ragStats.totalChunks} chunks`);
              
              // Q&A 테스트
              const questions = [
                'What is this document about?',
                `Who uploaded this? Email: ${userContext.email}` // 민감 정보 포함 질문
              ];
              
              for (const q of questions) {
                const results = await rag.search(q, 2);
                console.log(`  Q: ${q.substring(0, 50)}...`);
                console.log(`  A: ${results.length} results found`);
              }
              
              scenarioResult.steps.push({
                step: 'rag',
                success: true,
                chunks: ragStats.totalChunks
              });
              
            } catch (error) {
              console.log(`❌ RAG failed: ${error.message}`);
              scenarioResult.steps.push({
                step: 'rag',
                success: false,
                error: error.message
              });
            }
          } else {
            console.log('❌ Download failed');
            scenarioResult.steps.push({
              step: 'download',
              success: false
            });
          }
        } catch (error) {
          console.log(`❌ Download error: ${error.message}`);
          scenarioResult.steps.push({
            step: 'download',
            success: false,
            error: error.message
          });
        }
      }
      
      // 시나리오 결과 저장
      testResults.scenarios.push(scenarioResult);
      
      // 청소
      rag.clear();
    }
    
    // 4. 로그 파일 개인정보 검사
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 PRIVACY COMPLIANCE CHECK');
    console.log('═'.repeat(70));
    
    const today = new Date().toISOString().split('T')[0];
    const logFiles = [
      `logs/daily/app-${today}.log`,
      `logs/errors/error-${today}.log`,
      `logs/audit/audit-${today}.log`
    ];
    
    console.log('\nScanning log files for PII...');
    
    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.split('\n');
        
        console.log(`\n📄 ${logFile}`);
        console.log(`  Total lines: ${lines.length}`);
        
        // PII 패턴 검사
        const piiPatterns = [
          { name: 'Email', pattern: /[\w\.-]+@[\w\.-]+\.\w+/g, exclude: /\[EMAIL_MASKED\]/ },
          { name: 'Phone', pattern: /\d{2,3}-\d{3,4}-\d{4}/g, exclude: /\[PHONE_MASKED\]/ },
          { name: 'IP Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, exclude: /\[IPADDRESS_MASKED\]/ },
          { name: 'User Path', pattern: /\/Users\/\w+|\/home\/\w+/g, exclude: /\[USER\]/ },
          { name: 'API Key', pattern: /sk-[a-zA-Z0-9]{32}/g, exclude: /\[SENSITIVE_MASKED\]/ }
        ];
        
        let violations = 0;
        
        for (const check of piiPatterns) {
          let found = 0;
          lines.forEach((line, lineNum) => {
            const matches = line.match(check.pattern);
            if (matches && !check.exclude.test(line)) {
              found++;
              if (found <= 2) { // 처음 2개만 보고
                testResults.privacyViolations.push({
                  file: logFile,
                  line: lineNum + 1,
                  type: check.name,
                  sample: line.substring(0, 100) + '...'
                });
              }
            }
          });
          
          if (found > 0) {
            console.log(`  ⚠️ ${check.name}: ${found} potential exposures`);
            violations += found;
          } else {
            console.log(`  ✅ ${check.name}: Clean`);
          }
        }
        
        testResults.summary.piiLeaks += violations;
        
      } catch (error) {
        console.log(`  ⚠️ Could not read: ${error.message}`);
      }
    }
    
    // 5. 컴플라이언스 리포트
    console.log('\n📊 Compliance Report');
    const complianceReport = ComplianceChecker.generateComplianceReport();
    testResults.complianceStatus = complianceReport;
    
    console.log(`  Status: ${complianceReport.status}`);
    console.log(`  PII Found: ${complianceReport.personalDataFound}`);
    console.log(`  Violations: ${complianceReport.violationCount}`);
    
    // 6. 키워드 폴더 통계
    console.log('\n📁 Keyword Folder Statistics');
    const folderStats = await getKeywordStatistics();
    console.log(`  Total Keywords: ${folderStats.totalKeywords}`);
    console.log(`  Total Documents: ${folderStats.totalDocuments}`);
    console.log(`  Total Size: ${(folderStats.totalSizeKB / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    testResults.summary.failed++;
  } finally {
    await scraper.cleanup();
    rag.clear();
    
    // 7. 최종 요약
    console.log('\n' + '═'.repeat(80));
    console.log('📈 TEST SUMMARY');
    console.log('═'.repeat(80));
    
    // 시나리오 결과
    testResults.scenarios.forEach(scenario => {
      const passed = scenario.steps.filter(s => s.success).length;
      const total = scenario.steps.length;
      const status = passed === total ? '✅' : '⚠️';
      console.log(`${status} ${scenario.name}: ${passed}/${total} steps passed`);
    });
    
    // 개인정보 보호 결과
    console.log('\n🔒 Privacy Protection:');
    if (testResults.summary.piiLeaks === 0) {
      console.log('  ✅ No PII leaks detected in logs');
    } else {
      console.log(`  ⚠️ ${testResults.summary.piiLeaks} potential PII exposures found`);
      testResults.privacyViolations.slice(0, 3).forEach(v => {
        console.log(`    - ${v.file}:${v.line} (${v.type})`);
      });
    }
    
    // 전체 통계
    const totalSteps = testResults.scenarios.reduce((sum, s) => sum + s.steps.length, 0);
    const passedSteps = testResults.scenarios.reduce((sum, s) => 
      sum + s.steps.filter(step => step.success).length, 0);
    
    console.log('\n📊 Overall Statistics:');
    console.log(`  Scenarios: ${testResults.scenarios.length}`);
    console.log(`  Steps: ${passedSteps}/${totalSteps} passed`);
    console.log(`  PII Compliance: ${testResults.summary.piiLeaks === 0 ? 'PASS' : 'FAIL'}`);
    
    // 결과 파일 저장
    const reportPath = `logs/test-privacy-report-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}`);
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Privacy-Enhanced Full Cycle Test Completed');
    console.log(`End Time: ${new Date().toISOString()}`);
    console.log('═'.repeat(80));
  }
}

// 실행
runPrivacyFullCycleTest().catch(console.error);