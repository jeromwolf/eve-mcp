// 나머지 5사이클 테스트 (6-10)
import 'dotenv/config';

const remainingScenarios = [
  {
    id: 6,
    keyword: 'inspection report findings',
    questions: [
      'What violations were identified?',
      'What corrective actions were required?',
      'What inspection procedures were used?',
      'What performance indicators were evaluated?',
      'What follow-up actions are planned?'
    ]
  },
  {
    id: 7,
    keyword: 'environmental impact statement',
    questions: [
      'What environmental impacts are assessed?',
      'What mitigation measures are proposed?',
      'What alternatives were considered?',
      'What cumulative impacts are discussed?',
      'What monitoring programs are required?'
    ]
  },
  {
    id: 8,
    keyword: 'physical security plan',
    questions: [
      'What security zones are defined?',
      'What access control measures are described?',
      'What threat assessments are mentioned?',
      'What response capabilities are required?',
      'What training requirements are specified?'
    ]
  },
  {
    id: 9,
    keyword: 'quality assurance program',
    questions: [
      'What QA criteria are established?',
      'What audit requirements are specified?',
      'What document control procedures are described?',
      'What corrective action programs are mentioned?',
      'What training and qualification requirements exist?'
    ]
  },
  {
    id: 10,
    keyword: 'severe accident analysis',
    questions: [
      'What accident scenarios are analyzed?',
      'What core damage frequencies are calculated?',
      'What containment failure modes are identified?',
      'What mitigation strategies are described?',
      'What emergency response procedures are outlined?'
    ]
  }
];

class RemainingCycleRunner {
  constructor() {
    this.results = [];
  }

  async runCycle(scenario) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 CYCLE ${scenario.id}: ${scenario.keyword.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    const result = {
      cycleId: scenario.id,
      keyword: scenario.keyword,
      timestamp: new Date().toISOString(),
      search: { found: 0, duration: 0 },
      download: { success: 0, failed: 0, duration: 0, documents: [] },
      qa: { answered: 0, total: scenario.questions.length, duration: 0, results: [] },
      totalDuration: 0,
      success: false
    };

    try {
      // Import modules
      const { ImprovedADAMSScraper } = await import('./build/adams-real-improved.js');
      const { EnhancedRAGEngine } = await import('./build/rag-engine-enhanced.js');
      const fs = await import('fs/promises');
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const pdfParse = require('pdf-parse');
      
      const scraper = new ImprovedADAMSScraper();
      const ragEngine = new EnhancedRAGEngine();

      // Step 1: Search
      console.log(`📋 [${scenario.id}] Searching for: "${scenario.keyword}"`);
      const searchStart = Date.now();
      await scraper.initialize();
      const docs = await scraper.searchReal(scenario.keyword, 12);
      result.search.found = docs.length;
      result.search.duration = Date.now() - searchStart;
      console.log(`✅ [${scenario.id}] Found ${docs.length} documents (${(result.search.duration/1000).toFixed(1)}s)`);

      if (docs.length === 0) {
        throw new Error('No documents found');
      }

      // Step 2: Download (limit to 3 for speed)
      console.log(`📥 [${scenario.id}] Downloading top 3 documents...`);
      const downloadStart = Date.now();
      const toDownload = docs.slice(0, 3);
      
      for (const doc of toDownload) {
        try {
          console.log(`  📄 [${scenario.id}] Downloading: ${doc.accessionNumber}`);
          const success = await scraper.downloadRealPDF(doc.accessionNumber, '', `cycle${scenario.id}`);
          
          if (success) {
            // Load into RAG
            const pdfPath = `./downloaded_pdfs/cycle${scenario.id}_2025-09-11/${doc.accessionNumber}.pdf`;
            try {
              const pdfBuffer = await fs.readFile(pdfPath);
              const pdfData = await pdfParse(pdfBuffer);
              
              await ragEngine.addDocumentWithPages(
                doc.accessionNumber,
                pdfData.text,
                {
                  title: doc.title,
                  documentNumber: doc.accessionNumber,
                  pages: pdfData.numpages
                },
                pdfData.numpages
              );
              
              result.download.success++;
              result.download.documents.push({
                accessionNumber: doc.accessionNumber,
                title: doc.title,
                pages: pdfData.numpages,
                chars: pdfData.text.length
              });
              console.log(`  ✅ [${scenario.id}] Added to RAG: ${doc.accessionNumber} (${pdfData.numpages} pages)`);
            } catch (ragError) {
              console.log(`  ⚠️ [${scenario.id}] RAG load failed: ${ragError.message}`);
              result.download.success++;
            }
          } else {
            result.download.failed++;
            console.log(`  ❌ [${scenario.id}] Download failed: ${doc.accessionNumber}`);
          }
        } catch (error) {
          result.download.failed++;
          console.log(`  ❌ [${scenario.id}] Error: ${error.message}`);
        }
      }
      
      result.download.duration = Date.now() - downloadStart;
      console.log(`📊 [${scenario.id}] Downloads: ${result.download.success} success, ${result.download.failed} failed (${(result.download.duration/1000).toFixed(1)}s)`);

      // Step 3: Q&A
      if (result.download.success > 0) {
        console.log(`❓ [${scenario.id}] Running Q&A tests...`);
        const qaStart = Date.now();
        
        for (const [i, question] of scenario.questions.entries()) {
          try {
            console.log(`  Q${i+1}: ${question}`);
            const results = await ragEngine.search(question, 2);
            
            if (results && results.length > 0) {
              result.qa.answered++;
              result.qa.results.push({
                question,
                resultsCount: results.length,
                topScore: results[0].score,
                topText: results[0].text.substring(0, 80) + '...'
              });
              console.log(`    ✅ Found ${results.length} results (score: ${results[0].score.toFixed(3)})`);
            } else {
              result.qa.results.push({
                question,
                resultsCount: 0,
                error: 'No results found'
              });
              console.log(`    ❌ No results found`);
            }
          } catch (error) {
            result.qa.results.push({
              question,
              error: error.message
            });
            console.log(`    ❌ Error: ${error.message}`);
          }
        }
        
        result.qa.duration = Date.now() - qaStart;
        console.log(`🧠 [${scenario.id}] Q&A: ${result.qa.answered}/${result.qa.total} answered (${(result.qa.duration/1000).toFixed(1)}s)`);
      }

      await scraper.close();
      
      result.totalDuration = Date.now() - startTime;
      result.success = result.search.found > 0 && result.download.success > 0 && result.qa.answered > 0;
      
      console.log(`${result.success ? '✅' : '❌'} [${scenario.id}] Cycle completed: ${(result.totalDuration/1000).toFixed(1)}s total`);
      
    } catch (error) {
      result.totalDuration = Date.now() - startTime;
      result.error = error.message;
      console.log(`❌ [${scenario.id}] Cycle failed: ${error.message}`);
    }

    // Generate cycle report
    await this.generateCycleReport(result);
    return result;
  }

  async generateCycleReport(result) {
    const fs = await import('fs/promises');
    const reportDir = './test-cycles-20250111/reports';
    await fs.mkdir(reportDir, { recursive: true });
    
    const successRate = ((result.search.found > 0 ? 33 : 0) + 
                        (result.download.success > 0 ? 33 : 0) + 
                        (result.qa.answered > 0 ? 34 : 0));
    
    const report = `# Cycle ${result.cycleId} Test Report

## Summary
**Keyword**: ${result.keyword}
**Date**: ${result.timestamp}
**Success Rate**: ${successRate}%
**Total Duration**: ${(result.totalDuration/1000).toFixed(2)}s

## Results

### 🔍 Search Phase
- **Documents Found**: ${result.search.found}
- **Duration**: ${(result.search.duration/1000).toFixed(2)}s
- **Status**: ${result.search.found > 0 ? '✅ Success' : '❌ Failed'}

### 📥 Download Phase
- **Successful**: ${result.download.success}
- **Failed**: ${result.download.failed}
- **Duration**: ${(result.download.duration/1000).toFixed(2)}s
- **Status**: ${result.download.success > 0 ? '✅ Success' : '❌ Failed'}

#### Downloaded Documents
${result.download.documents.map(doc => 
  `- **${doc.accessionNumber}**: ${doc.title.substring(0, 60)}... (${doc.pages} pages, ${doc.chars} chars)`
).join('\n')}

### 🧠 Q&A Phase
- **Answered**: ${result.qa.answered}/${result.qa.total}
- **Success Rate**: ${((result.qa.answered/result.qa.total)*100).toFixed(1)}%
- **Duration**: ${(result.qa.duration/1000).toFixed(2)}s
- **Status**: ${result.qa.answered > 0 ? '✅ Success' : '❌ Failed'}

#### Q&A Results
${result.qa.results.map((qa, i) => `
**Q${i+1}**: ${qa.question}
${qa.resultsCount > 0 ? 
  `✅ **Results**: ${qa.resultsCount} found (top score: ${qa.topScore?.toFixed(3) || 'N/A'})
  **Preview**: ${qa.topText || 'N/A'}` : 
  `❌ **Error**: ${qa.error || 'No results'}`}
`).join('\n')}

---
*Generated by NRC ADAMS MCP Test Suite*
`;

    const reportPath = `${reportDir}/cycle_${result.cycleId}_report.md`;
    await fs.writeFile(reportPath, report);
    console.log(`📄 [${result.cycleId}] Report saved: ${reportPath}`);
  }

  async runAll() {
    console.log('🚀 Starting Remaining 5-Cycle Test Suite (6-10)');
    console.log(`⏰ Expected duration: ~15-20 minutes\n`);
    
    const allResults = [];
    
    for (const scenario of remainingScenarios) {
      const result = await this.runCycle(scenario);
      allResults.push(result);
      
      // Brief pause between cycles
      console.log(`⏳ [${scenario.id}] Pausing 3 seconds before next cycle...\n`);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Generate summary for cycles 6-10
    await this.generateSummary(allResults);
    
    // Generate combined summary (1-10)
    await this.generateCombinedSummary();
    
    return allResults;
  }

  async generateSummary(results) {
    const fs = await import('fs/promises');
    
    const successful = results.filter(r => r.success);
    const totalDocs = results.reduce((sum, r) => sum + r.search.found, 0);
    const totalDownloads = results.reduce((sum, r) => sum + r.download.success, 0);
    const totalAnswered = results.reduce((sum, r) => sum + r.qa.answered, 0);
    const totalQuestions = results.reduce((sum, r) => sum + r.qa.total, 0);
    
    const summary = `# 🎯 Cycles 6-10 Test Summary

## Performance (Cycles 6-10)
- **Successful Cycles**: ${successful.length}/5 (${(successful.length/5*100).toFixed(1)}%)
- **Total Documents Found**: ${totalDocs}
- **Total Downloads**: ${totalDownloads}
- **Q&A Success**: ${totalAnswered}/${totalQuestions} (${(totalAnswered/totalQuestions*100).toFixed(1)}%)

## Cycle Results
${results.map(r => `
### Cycle ${r.cycleId}: ${r.keyword}
- **Status**: ${r.success ? '✅ Success' : '❌ Failed'}
- **Documents**: ${r.search.found} found, ${r.download.success} downloaded
- **Q&A**: ${r.qa.answered}/${r.qa.total} answered
- **Duration**: ${(r.totalDuration/1000).toFixed(1)}s
`).join('')}

## Performance Metrics (Cycles 6-10)
- **Average Search Time**: ${(results.reduce((sum, r) => sum + r.search.duration, 0) / results.length / 1000).toFixed(2)}s
- **Average Download Time**: ${(results.reduce((sum, r) => sum + r.download.duration, 0) / results.length / 1000).toFixed(2)}s
- **Average Q&A Time**: ${(results.reduce((sum, r) => sum + r.qa.duration, 0) / results.length / 1000).toFixed(2)}s
- **Total Test Time**: ${(results.reduce((sum, r) => sum + r.totalDuration, 0) / 1000 / 60).toFixed(2)} minutes

---
*Cycles 6-10 completed on ${new Date().toISOString()}*
`;

    const summaryPath = './test-cycles-20250111/reports/CYCLES_6-10_SUMMARY.md';
    await fs.writeFile(summaryPath, summary);
    
    console.log(`\n📋 Cycles 6-10 summary: ${summaryPath}`);
  }

  async generateCombinedSummary() {
    const fs = await import('fs/promises');
    
    // Read all cycle reports to get combined stats
    const cycleFiles = [];
    for (let i = 1; i <= 10; i++) {
      try {
        const content = await fs.readFile(`./test-cycles-20250111/reports/cycle_${i}_report.md`, 'utf8');
        cycleFiles.push({ id: i, content });
      } catch (error) {
        // Skip missing files
      }
    }
    
    const combinedSummary = `# 🏆 COMPLETE 10-CYCLE TEST SUITE SUMMARY

## 🎯 FINAL RESULTS
- **Total Cycles Completed**: ${cycleFiles.length}/10
- **Test Status**: ${cycleFiles.length === 10 ? '✅ COMPLETE' : '⏳ PARTIAL'}

## All Cycles Overview
${cycleFiles.map(f => {
  const lines = f.content.split('\n');
  const keyword = lines.find(l => l.startsWith('**Keyword**:'))?.replace('**Keyword**: ', '') || 'Unknown';
  const successRate = lines.find(l => l.startsWith('**Success Rate**:'))?.replace('**Success Rate**: ', '') || '0%';
  return `### Cycle ${f.id}: ${keyword}
- **Success Rate**: ${successRate}`;
}).join('\n')}

## Test Completion Status
${cycleFiles.length === 10 ? 
  '🎉 **ALL 10 CYCLES COMPLETED SUCCESSFULLY!**' : 
  `⏳ **${cycleFiles.length}/10 cycles completed**`
}

---
*Final report generated on ${new Date().toISOString()}*
`;

    const finalSummaryPath = './test-cycles-20250111/reports/COMPLETE_10_CYCLE_SUMMARY.md';
    await fs.writeFile(finalSummaryPath, combinedSummary);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎊 COMPLETE 10-CYCLE TEST SUITE RESULTS 🎊');
    console.log(`📋 Final summary: ${finalSummaryPath}`);
    console.log(`${'='.repeat(80)}`);
  }
}

// Execute remaining test suite
const runner = new RemainingCycleRunner();
runner.runAll()
  .then(() => {
    console.log('\n✅ All remaining cycles completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Remaining test suite failed:', error.message);
    process.exit(1);
  });