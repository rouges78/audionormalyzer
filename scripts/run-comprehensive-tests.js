#!/usr/bin/env node

/**
 * Script per eseguire la suite completa di test per il sistema di normalizzazione audio
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🎵 Audio Normalizer - Comprehensive Test Suite');
console.log('='.repeat(50));

const testCategories = [
  {
    name: 'Unit Tests - Core Functionality',
    pattern: 'services/__tests__/**/*.test.ts',
    description: 'Test delle funzionalità core (audio processing, file management, etc.)'
  },
  {
    name: 'Unit Tests - Normalization Algorithms',
    pattern: 'services/__tests__/normalization-algorithms.test.ts',
    description: 'Test degli algoritmi di normalizzazione (peak, loudness, EBU R128)'
  },
  {
    name: 'Unit Tests - Error Handling',
    pattern: 'services/__tests__/error-handling.test.ts',
    description: 'Test della gestione errori e scenari di fallimento'
  },
  {
    name: 'Unit Tests - Performance',
    pattern: 'services/__tests__/performance.test.ts',
    description: 'Test delle performance e gestione memoria'
  },
  {
    name: 'Integration Tests - API Endpoints',
    pattern: 'app/api/**/__tests__/**/*.test.ts',
    description: 'Test di integrazione degli endpoint API'
  },
  {
    name: 'Integration Tests - Complete Workflows',
    pattern: '__tests__/integration/complete-workflow.test.ts',
    description: 'Test end-to-end del workflow completo (upload → analyze → normalize → download)'
  },
  {
    name: 'Integration Tests - Format Compatibility',
    pattern: '__tests__/integration/format-compatibility.test.ts',
    description: 'Test di compatibilità con diversi formati audio'
  },
  {
    name: 'Integration Tests - Large Album Performance',
    pattern: '__tests__/integration/large-album-performance.test.ts',
    description: 'Test delle performance con album di grandi dimensioni'
  },
  {
    name: 'Integration Tests - Concurrent Processing',
    pattern: '__tests__/integration/concurrent-processing.test.ts',
    description: 'Test del processing concorrente e gestione risorse'
  }
];

function runTestCategory(category) {
  console.log(`\n📋 ${category.name}`);
  console.log(`   ${category.description}`);
  console.log('-'.repeat(50));
  
  try {
    const command = `npx vitest run "${category.pattern}" --reporter=verbose`;
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${category.name} - PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${category.name} - FAILED`);
    return false;
  }
}

function runAllTests() {
  console.log('\n🚀 Running all tests...');
  console.log('-'.repeat(50));
  
  try {
    const command = 'npx vitest run --reporter=verbose';
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ All tests - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Some tests - FAILED');
    return false;
  }
}

function runCoverageReport() {
  console.log('\n📊 Generating coverage report...');
  console.log('-'.repeat(50));
  
  try {
    const command = 'npx vitest run --coverage';
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Coverage report generated');
    return true;
  } catch (error) {
    console.log('❌ Coverage report failed');
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node run-comprehensive-tests.js [options]

Options:
  --category <name>    Run specific test category
  --all               Run all tests at once
  --coverage          Generate coverage report
  --list              List available test categories
  --help, -h          Show this help message

Examples:
  node run-comprehensive-tests.js --category "Unit Tests - Core Functionality"
  node run-comprehensive-tests.js --all
  node run-comprehensive-tests.js --coverage
`);
    return;
  }
  
  if (args.includes('--list')) {
    console.log('\n📋 Available test categories:');
    testCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}`);
      console.log(`   ${category.description}`);
    });
    return;
  }
  
  if (args.includes('--coverage')) {
    runCoverageReport();
    return;
  }
  
  if (args.includes('--all')) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
    return;
  }
  
  const categoryIndex = args.indexOf('--category');
  if (categoryIndex !== -1 && args[categoryIndex + 1]) {
    const categoryName = args[categoryIndex + 1];
    const category = testCategories.find(cat => cat.name === categoryName);
    
    if (category) {
      const success = runTestCategory(category);
      process.exit(success ? 0 : 1);
    } else {
      console.log(`❌ Category "${categoryName}" not found`);
      console.log('Use --list to see available categories');
      process.exit(1);
    }
    return;
  }
  
  // Default: run tests by category
  console.log('\n🎯 Running tests by category...');
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const category of testCategories) {
    const success = runTestCategory(category);
    if (success) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed categories: ${totalPassed}`);
  console.log(`❌ Failed categories: ${totalFailed}`);
  console.log(`📋 Total categories: ${testCategories.length}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All test categories passed!');
    console.log('\n💡 Next steps:');
    console.log('   • Run --coverage to check test coverage');
    console.log('   • Review any performance warnings');
    console.log('   • Update documentation if needed');
  } else {
    console.log('\n⚠️  Some test categories failed. Please review the output above.');
  }
  
  process.exit(totalFailed === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  runTestCategory,
  runAllTests,
  runCoverageReport,
  testCategories
};