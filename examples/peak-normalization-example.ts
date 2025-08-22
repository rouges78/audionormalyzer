/**
 * Peak Normalization Example
 * 
 * This example demonstrates how to use the AudioProcessor's peak normalization
 * functionality to normalize audio files to a target peak level.
 */

import { createAudioProcessor } from '../services/audio-processor'
import { NormalizationOptions } from '../types/audio'
import path from 'path'

async function demonstratePeakNormalization() {
  console.log('🎵 Peak Normalization Example')
  console.log('================================')

  const audioProcessor = createAudioProcessor()
  
  // Example audio file paths (these would be real files in production)
  const inputFile = path.join(process.cwd(), 'temp', 'audio', 'sample.mp3')
  const outputFile = path.join(process.cwd(), 'temp', 'audio', 'normalized.mp3')

  try {
    // Step 1: Validate the input file format
    console.log('\n1. Validating input file format...')
    const isValid = await audioProcessor.validateFormat(inputFile)
    console.log(`   Format validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`)

    if (!isValid) {
      console.log('   Skipping normalization due to invalid format')
      return
    }

    // Step 2: Analyze the audio file
    console.log('\n2. Analyzing audio file...')
    const analysis = await audioProcessor.analyzeAudio(inputFile)
    console.log(`   Duration: ${analysis.duration.toFixed(2)} seconds`)
    console.log(`   Sample Rate: ${analysis.sampleRate} Hz`)
    console.log(`   Channels: ${analysis.channels}`)
    console.log(`   Current Peak Level: ${analysis.peakLevel.toFixed(2)} dB`)
    console.log(`   RMS Level: ${analysis.rmsLevel.toFixed(2)} dB`)
    console.log(`   LUFS Integrated: ${analysis.lufsIntegrated.toFixed(2)} LUFS`)
    console.log(`   Has Clipping: ${analysis.hasClipping ? '⚠️ Yes' : '✅ No'}`)

    // Step 3: Configure normalization options
    const targetPeakLevel = -1.0 // Target peak at -1 dB to prevent clipping
    const normalizationOptions: NormalizationOptions = {
      method: 'peak',
      targetLevel: targetPeakLevel,
      preserveFormat: true,
      outputPath: outputFile
    }

    // Step 4: Validate normalization options
    console.log('\n3. Validating normalization options...')
    const validation = audioProcessor.validateNormalizationOptions(normalizationOptions)
    if (!validation.isValid) {
      console.log('   ❌ Invalid options:')
      validation.errors.forEach(error => console.log(`      - ${error}`))
      return
    }
    console.log('   ✅ Options are valid')

    // Step 5: Calculate required gain
    const requiredGain = targetPeakLevel - analysis.peakLevel
    console.log(`\n4. Gain calculation:`)
    console.log(`   Current peak: ${analysis.peakLevel.toFixed(2)} dB`)
    console.log(`   Target peak: ${targetPeakLevel.toFixed(2)} dB`)
    console.log(`   Required gain: ${requiredGain > 0 ? '+' : ''}${requiredGain.toFixed(2)} dB`)

    if (Math.abs(requiredGain) < 0.1) {
      console.log('   ℹ️ Audio is already at target level (±0.1 dB)')
    } else if (requiredGain > 0) {
      console.log('   📈 Audio will be amplified')
    } else {
      console.log('   📉 Audio will be attenuated')
    }

    // Step 6: Apply peak normalization
    console.log('\n5. Applying peak normalization...')
    const normalizedFile = await audioProcessor.normalizeAudio(inputFile, normalizationOptions)
    console.log(`   ✅ Normalization complete!`)
    console.log(`   Output file: ${normalizedFile}`)

    // Step 7: Verify results (analyze normalized file)
    console.log('\n6. Verifying normalization results...')
    const normalizedAnalysis = await audioProcessor.analyzeAudio(normalizedFile)
    console.log(`   Original peak: ${analysis.peakLevel.toFixed(2)} dB`)
    console.log(`   Normalized peak: ${normalizedAnalysis.peakLevel.toFixed(2)} dB`)
    console.log(`   Target peak: ${targetPeakLevel.toFixed(2)} dB`)
    
    const peakDifference = Math.abs(normalizedAnalysis.peakLevel - targetPeakLevel)
    if (peakDifference < 0.5) {
      console.log(`   ✅ Peak normalization successful (±${peakDifference.toFixed(2)} dB)`)
    } else {
      console.log(`   ⚠️ Peak normalization may need adjustment (±${peakDifference.toFixed(2)} dB)`)
    }

    console.log('\n🎉 Peak normalization example completed successfully!')

  } catch (error) {
    console.error('\n❌ Error during peak normalization:')
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    // Provide helpful troubleshooting tips
    console.log('\n💡 Troubleshooting tips:')
    console.log('   - Ensure the input file exists and is readable')
    console.log('   - Check that the audio format is supported (MP3, WAV, FLAC, AAC)')
    console.log('   - Verify the output directory exists and is writable')
    console.log('   - Make sure target level is reasonable (-60 to 0 dB)')
  }
}

// Example usage scenarios
async function showUsageExamples() {
  console.log('\n📚 Peak Normalization Usage Examples')
  console.log('=====================================')

  const audioProcessor = createAudioProcessor()

  // Example 1: Conservative normalization for mastering
  console.log('\n1. Conservative mastering normalization:')
  const masteringOptions: NormalizationOptions = {
    method: 'peak',
    targetLevel: -0.1, // Very close to 0 dB but safe
    preserveFormat: true,
    outputPath: 'output/mastered.wav'
  }
  console.log(`   Target: ${masteringOptions.targetLevel} dB (mastering)`)

  // Example 2: Safe normalization for streaming
  console.log('\n2. Streaming-safe normalization:')
  const streamingOptions: NormalizationOptions = {
    method: 'peak',
    targetLevel: -1.0, // Safe for streaming platforms
    preserveFormat: true,
    outputPath: 'output/streaming.mp3'
  }
  console.log(`   Target: ${streamingOptions.targetLevel} dB (streaming)`)

  // Example 3: Conservative normalization for archival
  console.log('\n3. Archival normalization:')
  const archivalOptions: NormalizationOptions = {
    method: 'peak',
    targetLevel: -3.0, // Very conservative
    preserveFormat: true,
    outputPath: 'output/archive.flac'
  }
  console.log(`   Target: ${archivalOptions.targetLevel} dB (archival)`)

  // Validate all examples
  const examples = [masteringOptions, streamingOptions, archivalOptions]
  examples.forEach((options, index) => {
    const validation = audioProcessor.validateNormalizationOptions(options)
    console.log(`   Example ${index + 1}: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`)
  })
}

// Run the examples if this file is executed directly
if (require.main === module) {
  demonstratePeakNormalization()
    .then(() => showUsageExamples())
    .catch(console.error)
}

export { demonstratePeakNormalization, showUsageExamples }