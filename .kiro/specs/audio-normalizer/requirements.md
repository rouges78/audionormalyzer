# Requirements Document

## Introduction

Il programma di normalizzazione audio è progettato per analizzare e regolare automaticamente i livelli di volume delle tracce audio all'interno dello stesso album, garantendo un'esperienza di ascolto più omogenea e piacevole. Il sistema deve essere in grado di processare diversi formati audio e applicare algoritmi di normalizzazione che mantengano la qualità audio originale.

## Requirements

### Requirement 1

**User Story:** Come utente, voglio caricare un album completo di tracce audio, così da poter normalizzare tutti i brani contemporaneamente.

#### Acceptance Criteria

1. WHEN l'utente seleziona una cartella contenente file audio THEN il sistema SHALL riconoscere e listare tutti i file audio supportati
2. WHEN l'utente carica file audio individuali THEN il sistema SHALL permettere di raggrupparli come album
3. IF i file audio sono in formati diversi THEN il sistema SHALL supportare almeno MP3, WAV, FLAC e AAC
4. WHEN vengono caricati i file THEN il sistema SHALL mostrare informazioni base come durata e formato di ogni traccia

### Requirement 2

**User Story:** Come utente, voglio che il sistema analizzi automaticamente i livelli audio di tutte le tracce, così da identificare le differenze di volume.

#### Acceptance Criteria

1. WHEN le tracce sono caricate THEN il sistema SHALL analizzare il livello RMS e il picco massimo di ogni traccia
2. WHEN l'analisi è completata THEN il sistema SHALL mostrare i livelli attuali di ogni traccia in dB
3. WHEN vengono rilevate differenze significative THEN il sistema SHALL evidenziare le tracce che necessitano normalizzazione
4. IF una traccia ha clipping THEN il sistema SHALL segnalare il problema all'utente

### Requirement 3

**User Story:** Come utente, voglio scegliere il metodo di normalizzazione più adatto, così da ottenere il risultato desiderato per il mio tipo di musica.

#### Acceptance Criteria

1. WHEN l'utente accede alle opzioni di normalizzazione THEN il sistema SHALL offrire almeno normalizzazione per picco e per loudness (LUFS)
2. WHEN viene selezionata la normalizzazione per picco THEN il sistema SHALL permettere di impostare il livello target in dB
3. WHEN viene selezionata la normalizzazione per loudness THEN il sistema SHALL utilizzare standard come EBU R128
4. IF l'utente è inesperto THEN il sistema SHALL fornire preset predefiniti per diversi generi musicali

### Requirement 4

**User Story:** Come utente, voglio processare le tracce mantenendo la qualità audio originale, così da non degradare la musica durante la normalizzazione.

#### Acceptance Criteria

1. WHEN viene applicata la normalizzazione THEN il sistema SHALL preservare il formato audio originale
2. WHEN il processing è in corso THEN il sistema SHALL utilizzare algoritmi che evitano distorsioni
3. IF è necessario ridurre il volume THEN il sistema SHALL applicare solo attenuazione senza amplificazione eccessiva
4. WHEN il processing è completato THEN il sistema SHALL mantenere tutti i metadati originali dei file

### Requirement 5

**User Story:** Come utente, voglio salvare le tracce normalizzate in una location specifica, così da organizzare facilmente la mia libreria musicale.

#### Acceptance Criteria

1. WHEN la normalizzazione è completata THEN il sistema SHALL permettere di scegliere la cartella di destinazione
2. WHEN vengono salvati i file THEN il sistema SHALL mantenere la struttura di nomi originale o permettere personalizzazione
3. IF esistono già file con lo stesso nome THEN il sistema SHALL chiedere conferma prima di sovrascrivere
4. WHEN il salvataggio è completato THEN il sistema SHALL fornire un report delle operazioni eseguite

### Requirement 6

**User Story:** Come utente, voglio vedere un'anteprima dei cambiamenti prima di applicarli, così da verificare che il risultato sia quello desiderato.

#### Acceptance Criteria

1. WHEN vengono calcolate le modifiche THEN il sistema SHALL mostrare i livelli prima e dopo per ogni traccia
2. WHEN l'utente seleziona una traccia THEN il sistema SHALL permettere di ascoltare un'anteprima del risultato
3. IF i cambiamenti sembrano eccessivi THEN il sistema SHALL permettere di regolare i parametri
4. WHEN l'utente è soddisfatto THEN il sistema SHALL procedere con l'applicazione definitiva