import { parseFile, IAudioMetadata, ICommonTagsResult } from 'music-metadata'
import NodeID3 from 'node-id3'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Interfaccia per i metadati audio estratti
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
 * Interfaccia per le opzioni di preservazione metadati
 */
export interface MetadataPreservationOptions {
  preserveArtwork?: boolean
  preserveComments?: boolean
  preserveCustomTags?: boolean
  overwriteExisting?: boolean
}

/**
 * MetadataManager service per gestire estrazione e preservazione metadati
 */
export class MetadataManager {
  /**
   * Estrae metadati da un file audio
   * @param filePath Percorso del file audio
   * @returns Promise<AudioMetadata> Metadati estratti
   */
  async extractMetadata(filePath: string): Promise<AudioMetadata> {
    try {
      // Verifica che il file esista
      await fs.access(filePath)

      // Usa music-metadata per estrarre metadati completi
      const metadata = await parseFile(filePath)

      return this.convertToAudioMetadata(metadata)
    } catch (error) {
      throw new Error(`Errore nell'estrazione metadati da ${filePath}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Preserva metadati da un file sorgente a uno di destinazione
   * @param sourcePath Percorso del file sorgente
   * @param targetPath Percorso del file di destinazione
   * @param options Opzioni di preservazione
   */
  async preserveMetadata(
    sourcePath: string,
    targetPath: string,
    options: MetadataPreservationOptions = {}
  ): Promise<void> {
    try {
      // Estrai metadati dal file sorgente
      const sourceMetadata = await this.extractMetadata(sourcePath)

      // Applica metadati al file di destinazione
      await this.applyMetadata(targetPath, sourceMetadata, options)
    } catch (error) {
      throw new Error(`Errore nella preservazione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Applica metadati a un file audio
   * @param filePath Percorso del file di destinazione
   * @param metadata Metadati da applicare
   * @param options Opzioni di applicazione
   */
  async applyMetadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions = {}
  ): Promise<void> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase()

      // Determina il metodo di scrittura in base al formato
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
          // WAV supporta metadati limitati, usa ID3v2 se possibile
          await this.applyWAVMetadata(filePath, metadata, options)
          break
        default:
          console.warn(`Formato ${fileExtension} non supportato per scrittura metadati`)
      }
    } catch (error) {
      throw new Error(`Errore nell'applicazione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Confronta metadati tra due file
   * @param filePath1 Primo file
   * @param filePath2 Secondo file
   * @returns Oggetto con le differenze
   */
  async compareMetadata(filePath1: string, filePath2: string): Promise<{
    differences: string[]
    identical: boolean
  }> {
    try {
      const metadata1 = await this.extractMetadata(filePath1)
      const metadata2 = await this.extractMetadata(filePath2)

      const differences: string[] = []

      // Confronta campi principali
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
   * Pulisce metadati da un file (rimuove tutti i tag)
   * @param filePath Percorso del file
   */
  async clearMetadata(filePath: string): Promise<void> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase()

      if (fileExtension === '.mp3') {
        // Rimuovi tutti i tag ID3
        const success = NodeID3.removeTags(filePath)
        if (!success) {
          throw new Error('Impossibile rimuovere tag ID3')
        }
      } else {
        console.warn(`Rimozione metadati non implementata per formato ${fileExtension}`)
      }
    } catch (error) {
      throw new Error(`Errore nella rimozione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  // Metodi privati per gestione formati specifici

  private async applyID3Metadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    const tags: any = {}

    // Mappa metadati comuni a tag ID3
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

    // Aggiungi artwork se richiesto
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

    // Scrivi tag al file
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
    // Per FLAC/OGG, dovremmo usare una libreria specifica come node-flac
    // Per ora, implementazione placeholder
    console.warn('Scrittura metadati Vorbis non ancora implementata completamente')
  }

  private async applyMP4Metadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    // Per MP4/M4A, dovremmo usare una libreria specifica
    // Per ora, implementazione placeholder
    console.warn('Scrittura metadati MP4 non ancora implementata completamente')
  }

  private async applyWAVMetadata(
    filePath: string,
    metadata: AudioMetadata,
    options: MetadataPreservationOptions
  ): Promise<void> {
    // WAV ha supporto limitato per metadati
    // Alcuni player supportano ID3v2 in WAV
    console.warn('Scrittura metadati WAV limitata')
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
   * Valida se un file supporta metadati
   * @param filePath Percorso del file
   * @returns boolean True se il formato supporta metadati
   */
  supportsMetadata(filePath: string): boolean {
    const supportedExtensions = ['.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wav']
    const extension = path.extname(filePath).toLowerCase()
    return supportedExtensions.includes(extension)
  }

  /**
   * Ottiene informazioni sui metadati supportati per un formato
   * @param filePath Percorso del file
   * @returns Oggetto con informazioni sui metadati supportati
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
          readOnly: true // Non ancora implementata scrittura
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
 * Factory function per creare istanza MetadataManager
 */
export function createMetadataManager(): MetadataManager {
  return new MetadataManager()
}