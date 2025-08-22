import { NextRequest, NextResponse } from 'next/server'
import { ProcessingStorage } from '@/lib/processing-storage'

/**
 * GET /api/process/[id]/stream
 * Server-Sent Events endpoint for real-time processing progress updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return new NextResponse('Process ID required', { status: 400 })
    }

    const processingData = ProcessingStorage.get(id)
    if (!processingData) {
      return new NextResponse('Process not found', { status: 404 })
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial status
        const initialData = {
          id: processingData.id,
          status: processingData.status,
          progress: Math.round((processingData.processedFiles / processingData.totalFiles) * 100),
          processedFiles: processingData.processedFiles,
          totalFiles: processingData.totalFiles
        }
        
        controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`)

        // Set up polling to check for updates
        const interval = setInterval(() => {
          const currentData = ProcessingStorage.get(id)
          
          if (!currentData) {
            controller.enqueue(`data: ${JSON.stringify({ error: 'Process not found' })}\n\n`)
            controller.close()
            clearInterval(interval)
            return
          }

          const progress = Math.round((currentData.processedFiles / currentData.totalFiles) * 100)
          
          const updateData = {
            id: currentData.id,
            status: currentData.status,
            progress,
            processedFiles: currentData.processedFiles,
            totalFiles: currentData.totalFiles,
            timestamp: new Date().toISOString()
          }

          // Send update
          controller.enqueue(`data: ${JSON.stringify(updateData)}\n\n`)

          // Close stream if processing is complete or failed
          if (currentData.status === 'completed' || currentData.status === 'error') {
            // Send final update with results
            const finalData = {
              ...updateData,
              results: currentData.results,
              processingTime: currentData.processingTime,
              error: currentData.error
            }
            
            controller.enqueue(`data: ${JSON.stringify(finalData)}\n\n`)
            controller.close()
            clearInterval(interval)
          }
        }, 1000) // Update every second

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('Errore nello stream SSE:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}