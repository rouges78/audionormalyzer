import { parseFile, IAudioMetadata, ICommonTagsResult } from 'music-metadata'
import NodeID3 from 'node-id3'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Interface for the extracted audio metadata
 */
export interface AudioMetadata {
  title?: string
  artist?: string
  album?: string
  year?: number
  genre?: string[]
  track?: {
    no: number | null
    of: number | null
  }
  albumartist?: string
  composer?: string
  comment?: string[]
  duration?: number
  bitrate?: number
  sampleRate?: number
  channels?: number
  format?: string
  picture?: Array<{
    format: string
    type: string
    description: string
    data: Buffer
  }>
}

/**
 * Interface for the metadata preservation options
 */
export interface MetadataPreservationOptions {
  preserveArtwork?: boolean
  preserveComments?: boolean
  preserveCustomTags?: boolean
  overwriteExisting?: boolean
}

/**
 * MetadataManager service to handle metadata extraction and preservation
 */
export class MetadataManager {
  /**
   * Extracts metadata from an audio file
   * @param filePath Path of the audio file
   * @returns Promise<AudioMetadata> Extracted metadata
   */
  async extractMetadata(filePath: string): Promise<AudioMetadata> {
    try {
      // Check that the file exists
      await fs.access(filePath)

      // Use music-metadata to extract complete metadata
      const metadata = await parseFile(filePath)

      return this.convertToAudioMetadata(metadata)
    } catch (error) {
      throw new Error(`Errore nell'estrazione metadati da ${filePath}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Preserves metadata from a source file to a destination one
   * @param sourcePath Path of the source file
   * @param targetPath Path of the destination file
   * @param options Preservation options
   */
  async preserveMetadata(
    sourcePath: string,
    targetPath: string,
    options: MetadataPreservationOptions = {}
  ): Promise<void> {
    try {
      // Extract metadata from the source file
      const sourceMetadata = await this.extractMetadata(sourcePath)

      // Apply metadata to the destination file
      await this.applyMetadata(targetPath, sourceMetadata, options)
    } catch (error) {
      throw new Error(`Errore nella preservazione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Applies metadata to an audio file
   * @param filePath Path of the destination file
   * @param metadata Metadata to apply
   * @param options Apply options
   */
  async applyMetadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions = {}
  ): Promise<void> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase()

      // Determine the write method based on the format
      switch (fileExtension) {
        case '.mp3':
          await this.applyID3Metadata(filePath, metadata, options)
          break
        case '.flac':
        case '.ogg':
          await this.applyVorbisMetadata(filePath, metadata, options)
          break
        case '.m4a':
        case '.aac':
          await this.applyMP4Metadata(filePath, metadata, options)
          break
        case '.wav':
          // WAV supports limited metadata, use ID3v2 if possible
          await this.applyWAVMetadata(filePath, metadata, options)
          break
        default:
          console.warn(`Format ${fileExtension} not supported for metadata writing`)
      }
    } catch (error) {
      throw new Error(`Errore nell'applicazione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Compares metadata between two files
   * @param filePath1 First file
   * @param filePath2 Second file
   * @returns Object with the differences
   */
  async compareMetadata(filePath1: string, filePath2: string): Promise<{
    differences: string[]
    identical: boolean
  }> {
    try {
      const metadata1 = await this.extractMetadata(filePath1)
      const metadata2 = await this.extractMetadata(filePath2)

      const differences: string[] = []

      // Compare the main fields
      const fieldsToCompare = ['title', 'artist', 'album', 'year', 'genre', 'albumartist']

      for (const field of fieldsToCompare) {
        const value1 = (metadata1 as any)[field]
        const value2 = (metadata2 as any)[field]

        if (JSON.stringify(value1) !== JSON.stringify(value2)) {
          differences.push(`${field}: "${value1}" vs "${value2}"`)
        }
      }

      return {
        differences,
        identical: differences.length === 0
      }
    } catch (error) {
      throw new Error(`Errore nel confronto metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Cleans metadata from a file (removes all tags)
   * @param filePath File path
   */
  async clearMetadata(filePath: string): Promise<void> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase()

      if (fileExtension === '.mp3') {
        // Remove all ID3 tags
        const success = NodeID3.removeTags(filePath)
        if (!success) {
          throw new Error('Impossibile rimuovere tag ID3')
        }
      } else {
        console.warn(`Metadata removal not implemented for format ${fileExtension}`)
      }
    } catch (error) {
      throw new Error(`Errore nella rimozione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  // Private methods for handling specific formats

  private async applyID3Metadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    const tags: any = {}

    // Map common metadata to ID3 tags
    if (metadata.title) tags.title = metadata.title
    if (metadata.artist) tags.artist = metadata.artist
    if (metadata.album) tags.album = metadata.album
    if (metadata.year) tags.year = metadata.year.toString()
    if (metadata.genre && metadata.genre.length > 0) tags.genre = metadata.genre[0]
    if (metadata.albumartist) tags.performerInfo = metadata.albumartist
    if (metadata.composer) tags.composer = metadata.composer
    if (metadata.track?.no) tags.trackNumber = metadata.track.no.toString()
    if (metadata.comment && metadata.comment.length > 0) tags.comment = {
      language: 'eng',
      text: metadata.comment[0]
    }

    // Add artwork if requested
    if (options.preserveArtwork && metadata.picture && metadata.picture.length > 0) {
      const artwork = metadata.picture[0]
      tags.image = {
        mime: artwork.format,
        type: {
          id: 3, // Cover (front)
          name: 'front cover'
        },
        description: artwork.description || 'Cover',
        imageBuffer: artwork.data
      }
    }

    // Write tags to the file
    const success = NodeID3.write(tags, filePath)
    if (!success) {
      throw new Error('Impossibile scrivere tag ID3')
    }
  }

  private async applyVorbisMetadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    // For FLAC/OGG, we should use a specific library such as node-flac
    // For now, placeholder implementation
    console.warn('Vorbis metadata writing not fully implemented yet')
  }

  private async applyMP4Metadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    // For MP4/M4A, we should use a specific library
    // For now, placeholder implementation
    console.warn('MP4 metadata writing not fully implemented yet')
  }

  private async applyWAVMetadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    // WAV has limited metadata support
    // Alcuni player supportano ID3v2 in WAV
    console.warn('WAV metadata writing is limited')
  }

  private convertToAudioMetadata(metadata: IAudioMetadata): AudioMetadata {
    const common = metadata.common

    return {
      title: common.title,
      artist: common.artist,
      album: common.album,
      year: common.year,
      genre: Array.isArray(common.genre) ? common.genre : common.genre ? [common.genre] : undefined,
      track: common.track,
      albumartist: common.albumartist,
      composer: Array.isArray(common.composer) ? common.composer[0] : common.composer,
      comment: common.comment?.map(comment =>
        typeof comment === 'string' ? comment : comment.text || ''
      ),
      duration: metadata.format.duration,
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      channels: metadata.format.numberOfChannels,
      format: metadata.format.container,
      picture: common.picture?.map(pic => ({
        format: pic.format,
        type: pic.type || 'Cover',
        description: pic.description || '',
        data: Buffer.from(pic.data)
      }))
    }
  }

  /**
   * Checks whether a file supports metadata
   * @param filePath File path
   * @returns boolean True if the format supports metadata
   */
  supportsMetadata(filePath: string): boolean {
    const supportedExtensions = ['.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wav']
    const extension = path.extname(filePath).toLowerCase()
    return supportedExtensions.includes(extension)
  }

  /**
   * Gets info about the metadata supported for a format
   * @param filePath File path
   * @returns Object with info about the supported metadata
   */
  getMetadataSupport(filePath: string): {
    format: string
    supportsBasicTags: boolean
    supportsArtwork: boolean
    supportsCustomTags: boolean
    readOnly: boolean
  } {
    const extension = path.extname(filePath).toLowerCase()

    switch (extension) {
      case '.mp3':
        return {
          format: 'ID3v2',
          supportsBasicTags: true,
          supportsArtwork: true,
          supportsCustomTags: true,
          readOnly: false
        }
      case '.flac':
        return {
          format: 'Vorbis Comments',
          supportsBasicTags: true,
          supportsArtwork: true,
          supportsCustomTags: true,
          readOnly: true // Writing not implemented yet
        }
      case '.ogg':
        return {
          format: 'Vorbis Comments',
          supportsBasicTags: true,
          supportsArtwork: false,
          supportsCustomTags: true,
          readOnly: true
        }
      case '.m4a':
      case '.aac':
        return {
          format: 'iTunes-style',
          supportsBasicTags: true,
          supportsArtwork: true,
          supportsCustomTags: true,
          readOnly: true
        }
      case '.wav':
        return {
          format: 'Limited',
          supportsBasicTags: false,
          supportsArtwork: false,
          supportsCustomTags: false,
          readOnly: true
        }
      default:
        return {
          format: 'Unsupported',
          supportsBasicTags: false,
          supportsArtwork: false,
          supportsCustomTags: false,
          readOnly: true
        }
    }
  }
}

/**
 * Factory function to create a MetadataManager instance
 */
export function createMetadataManager(): MetadataManager {
  return new MetadataManager()
}