#!/usr/bin/env node

import { runCitationTest } from './test-citation.js';
import { runIntegrationTest } from './test-integration.js';

/**
 * 모든 테스트 실행
 */

async function runAllTests() {
  console.log('================================================================================');
  console.log('🧪 COMPREHENSIVE TEST SUITE - NRC ADAMS MCP with Citations');
  console.log('================================================================================');
  console.log(`Test Suite Start: ${new Date().toISOString()}\n`);

  const tests = [
    {
      name: "Citation Functionality Test",
      description: "Tests if citation features work correctly in ask_about_documents",
      runner: runCitationTest
    },
    {
      name: "Integration Test", 
      description: "Tests full pipeline: search → download → RAG → citations",
      runner: runIntegrationTest
    }
  ];

  let totalSuites = tests.length;
  let passedSuites = 0;
  let failedSuites = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 TEST SUITE ${i + 1}/${tests.length}: ${test.name}`);
    console.log(`📝 ${test.description}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      await test.runner();
      passedSuites++;
      console.log(`\n✅ TEST SUITE ${i + 1} COMPLETED SUCCESSFULLY`);
    } catch (error) {
      failedSuites++;
      console.log(`\n❌ TEST SUITE ${i + 1} FAILED:`, error.message);
    }

    // 테스트 간 휴식
    if (i < tests.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next test suite...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 최종 요약
  console.log('\n\n' + '='.repeat(80));
  console.log('🏁 FINAL TEST SUITE RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Test Suites: ${totalSuites}`);
  console.log(`Passed: ${passedSuites} ✅`);
  console.log(`Failed: ${failedSuites} ❌`);
  console.log(`Success Rate: ${Math.round((passedSuites / totalSuites) * 100)}%`);

  if (passedSuites === totalSuites) {
    console.log('\n🎉 ALL TEST SUITES PASSED!');
    console.log('🔥 The NRC ADAMS MCP citation system is working perfectly!');
  } else if (passedSuites > 0) {
    console.log('\n⚠️ SOME TEST SUITES FAILED');
    console.log('💡 The citation system may be partially working or need adjustments.');
  } else {
    console.log('\n💥 ALL TEST SUITES FAILED');
    console.log('🔧 The citation system needs significant debugging.');
    console.log('\n🛠️ TROUBLESHOOTING STEPS:');
    console.log('1. Ensure Claude Desktop is completely restarted (Cmd+Q)');
    console.log('2. Clear cache: rm -rf ~/Library/Caches/com.anthropic.claude-desktop/');
    console.log('3. Check MCP server configuration');
    console.log('4. Verify OpenAI API key is working');
    console.log('5. Test in a new conversation in Claude Desktop');
  }

  console.log(`\nTest Suite End: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

// 직접 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}