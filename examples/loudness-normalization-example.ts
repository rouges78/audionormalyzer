/**
 * Loudness Normalization Example
 * 
 * This example demonstrates how to use the AudioProcessor for LUFS-based
 * loudness normalization following EBU R128 standards.
 */

import { createAudioProcessor } from '../services/audio-processor'
import { NormalizationOptions } from '@/types/audio'
import path from 'path'

async function demonstrateLoudnessNormalization() {
  const audioProcessor = createAudioProcessor()
  
  // Example input file path
  const inputFile = path.join(process.cwd(), 'temp', 'audio', 'input.mp3')
  const outputFile = path.join(process.cwd(), 'output', 'normalized-loudness.mp3')
  
  try {
    console.log('🎵 Loudness Normalization Example')
    console.log('================================')
    
    // Step 1: Analyze the input audio file
    console.log('\n1. Analyzing input audio...')
    const analysis = await audioProcessor.analyzeAudio(inputFile)
    
    console.log(`   Duration: ${analysis.duration.toFixed(2)} seconds`)
    console.log(`   Sample Rate: ${analysis.sampleRate} Hz`)
    console.log(`   Channels: ${analysis.channels}`)
    console.log(`   Current LUFS: ${analysis.lufsIntegrated.toFixed(2)} LUFS`)
    console.log(`   True Peak: ${analysis.truePeak.toFixed(2)} dBTP`)
    console.log(`   Has Clipping: ${analysis.hasClipping ? 'Yes' : 'No'}`)
    
    // Step 2: Configure loudness normalization options
    console.log('\n2. Configuring loudness normalization...')
    
    // Common loudness targets:
    // -14 LUFS: YouTube, Spotify (loud)
    // -16 LUFS: Apple Music, Tidal
    // -18 LUFS: Amazon Music
    // -23 LUFS: EBU R128 broadcast standard
    const targetLufs = -16.0 // Apple Music / Tidal standard
    
    const options: NormalizationOptions = {
      method: 'loudness',
      targetLevel: targetLufs,
      preserveFormat: true,
      outputPath: outputFile
    }
    
    console.log(`   Target LUFS: ${targetLufs} LUFS`)
    console.log(`   Method: EBU R128 loudness normalization`)
    console.log(`   True Peak Limiting: -1.0 dBTP`)
    
    // Step 3: Validate normalization options
    console.log('\n3. Validating normalization options...')
    const validation = audioProcessor.validateNormalizationOptions(options)
    
    if (!validation.isValid) {
      console.error('   ❌ Invalid options:')
      validation.errors.forEach(error => console.error(`      - ${error}`))
      return
    }
    
    console.log('   ✅ Options are valid')
    
    // Step 4: Calculate expected gain
    const expectedGain = targetLufs - analysis.lufsIntegrated
    const truePeakAfterGain = analysis.truePeak + expectedGain
    
    console.log('\n4. Gain calculation preview...')
    console.log(`   Basic gain needed: ${expectedGain.toFixed(2)} dB`)
    console.log(`   True peak after gain: ${truePeakAfterGain.toFixed(2)} dBTP`)
    
    if (truePeakAfterGain > -1.0) {
      const reduction = truePeakAfterGain - (-1.0)
      console.log(`   ⚠️  True peak limiting will reduce gain by ${reduction.toFixed(2)} dB`)
    }
    
    // Step 5: Apply loudness normalization
    console.log('\n5. Applying loudness normalization...')
    const startTime = Date.now()
    
    const normalizedFile = await audioProcessor.normalizeAudio(inputFile, options)
    
    const processingTime = Date.now() - startTime
    console.log(`   ✅ Normalization completed in ${processingTime}ms`)
    console.log(`   Output file: ${normalizedFile}`)
    
    // Step 6: Validate EBU R128 compliance
    console.log('\n6. Validating EBU R128 compliance...')
    
    // Note: This method is private, so we'll analyze the output instead
    const normalizedAnalysis = await audioProcessor.analyzeAudio(normalizedFile)
    
    const lufsTolerance = 0.1
    const lufsDeviation = Math.abs(normalizedAnalysis.lufsIntegrated - targetLufs)
    const isLufsCompliant = lufsDeviation <= lufsTolerance
    const isTruePeakCompliant = normalizedAnalysis.truePeak <= -1.0
    const hasNoClipping = !normalizedAnalysis.hasClipping
    
    console.log(`   Final LUFS: ${normalizedAnalysis.lufsIntegrated.toFixed(2)} LUFS`)
    console.log(`   LUFS deviation: ${lufsDeviation.toFixed(3)} LUFS`)
    console.log(`   Final true peak: ${normalizedAnalysis.truePeak.toFixed(2)} dBTP`)
    console.log(`   Has clipping: ${normalizedAnalysis.hasClipping ? 'Yes' : 'No'}`)
    
    console.log('\n   Compliance Check:')
    console.log(`   ${isLufsCompliant ? '✅' : '❌'} LUFS within ±${lufsTolerance} tolerance`)
    console.log(`   ${isTruePeakCompliant ? '✅' : '❌'} True peak ≤ -1.0 dBTP`)
    console.log(`   ${hasNoClipping ? '✅' : '❌'} No clipping detected`)
    
    const isFullyCompliant = isLufsCompliant && isTruePeakCompliant && hasNoClipping
    console.log(`\n   Overall EBU R128 Compliance: ${isFullyCompliant ? '✅ PASS' : '❌ FAIL'}`)
    
    // Step 7: Show before/after comparison
    console.log('\n7. Before/After Comparison')
    console.log('==========================')
    console.log('                    Before      After      Change')
    console.log(`   LUFS:           ${analysis.lufsIntegrated.toFixed(2).padStart(6)}    ${normalizedAnalysis.lufsIntegrated.toFixed(2).padStart(6)}    ${(normalizedAnalysis.lufsIntegrated - analysis.lufsIntegrated).toFixed(2).padStart(6)}`)
    console.log(`   True Peak:      ${analysis.truePeak.toFixed(2).padStart(6)}    ${normalizedAnalysis.truePeak.toFixed(2).padStart(6)}    ${(normalizedAnalysis.truePeak - analysis.truePeak).toFixed(2).padStart(6)}`)
    console.log(`   Peak Level:     ${analysis.peakLevel.toFixed(2).padStart(6)}    ${normalizedAnalysis.peakLevel.toFixed(2).padStart(6)}    ${(normalizedAnalysis.peakLevel - analysis.peakLevel).toFixed(2).padStart(6)}`)
    console.log(`   RMS Level:      ${analysis.rmsLevel.toFixed(2).padStart(6)}    ${normalizedAnalysis.rmsLevel.toFixed(2).padStart(6)}    ${(normalizedAnalysis.rmsLevel - analysis.rmsLevel).toFixed(2).padStart(6)}`)
    
    console.log('\n🎉 Loudness normalization example completed successfully!')
    
  } catch (error) {
    console.error('❌ Error during loudness normalization:', error)
    
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      if (error.stack) {
        console.error('   Stack:', error.stack)
      }
    }
  }
}

// Example usage for different streaming platforms
async function demonstratePlatformTargets() {
  console.log('\n🎯 Platform-Specific Loudness Targets')
  console.log('=====================================')
  
  const platforms = [
    { name: 'YouTube', target: -14.0, description: 'Loud, competitive loudness' },
    { name: 'Spotify', target: -14.0, description: 'Loud setting (user can change)' },
    { name: 'Apple Music', target: -16.0, description: 'Balanced loudness' },
    { name: 'Tidal', target: -16.0, description: 'High-quality streaming' },
    { name: 'Amazon Music', target: -18.0, description: 'Conservative loudness' },
    { name: 'Broadcast (EBU)', target: -23.0, description: 'European broadcast standard' },
    { name: 'Podcast', target: -19.0, description: 'Speech-optimized loudness' }
  ]
  
  platforms.forEach(platform => {
    console.log(`   ${platform.name.padEnd(15)}: ${platform.target.toString().padStart(6)} LUFS - ${platform.description}`)
  })
  
  console.log('\n💡 Tip: Choose your target based on your distribution platform!')
  console.log('   For multi-platform release, consider -16 LUFS as a good compromise.')
}

// Run the examples
if (require.main === module) {
  demonstrateLoudnessNormalization()
    .then(() => demonstratePlatformTargets())
    .catch(console.error)
}

export {
  demonstrateLoudnessNormalization,
  demonstratePlatformTargets
}