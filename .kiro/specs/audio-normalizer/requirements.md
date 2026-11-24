# Requirements Document

## Introduction

The audio normalization program is designed to automatically analyze and adjust the volume levels of the audio tracks within the same album, ensuring a more consistent and pleasant listening experience. The system must be able to process different audio formats and apply normalization algorithms that preserve the original audio quality.

## Requirements

### Requirement 1

**User Story:** As a user, I want to load a complete album of audio tracks, so that I can normalize all the songs at once.

#### Acceptance Criteria

1. WHEN the user selects a folder containing audio files THEN the system SHALL recognize and list all supported audio files
2. WHEN the user loads individual audio files THEN the system SHALL allow grouping them as an album
3. IF the audio files are in different formats THEN the system SHALL support at least MP3, WAV, FLAC and AAC
4. WHEN the files are loaded THEN the system SHALL show basic information such as the duration and format of each track

### Requirement 2

**User Story:** As a user, I want the system to automatically analyze the audio levels of all tracks, so that volume differences are identified.

#### Acceptance Criteria

1. WHEN the tracks are loaded THEN the system SHALL analyze the RMS level and the maximum peak of each track
2. WHEN the analysis is complete THEN the system SHALL show the current levels of each track in dB
3. WHEN significant differences are detected THEN the system SHALL highlight the tracks that need normalization
4. IF a track has clipping THEN the system SHALL report the problem to the user

### Requirement 3

**User Story:** As a user, I want to choose the most suitable normalization method, so that I get the desired result for my type of music.

#### Acceptance Criteria

1. WHEN the user opens the normalization options THEN the system SHALL offer at least peak and loudness (LUFS) normalization
2. WHEN peak normalization is selected THEN the system SHALL allow setting the target level in dB
3. WHEN loudness normalization is selected THEN the system SHALL use standards such as EBU R128
4. IF the user is inexperienced THEN the system SHALL provide predefined presets for different music genres

### Requirement 4

**User Story:** As a user, I want to process the tracks while keeping the original audio quality, so that the music is not degraded during normalization.

#### Acceptance Criteria

1. WHEN normalization is applied THEN the system SHALL preserve the original audio format
2. WHEN processing is under way THEN the system SHALL use algorithms that avoid distortion
3. IF the volume needs to be reduced THEN the system SHALL apply attenuation only, without excessive amplification
4. WHEN processing is complete THEN the system SHALL keep all the original metadata of the files

### Requirement 5

**User Story:** As a user, I want to save the normalized tracks to a specific location, so that I can easily organize my music library.

#### Acceptance Criteria

1. WHEN normalization is complete THEN the system SHALL allow choosing the destination folder
2. WHEN the files are saved THEN the system SHALL keep the original naming structure or allow customization
3. IF files with the same name already exist THEN the system SHALL ask for confirmation before overwriting
4. WHEN saving is complete THEN the system SHALL provide a report of the operations performed

### Requirement 6

**User Story:** As a user, I want to see a preview of the changes before applying them, so that I can check that the result is the one I want.

#### Acceptance Criteria

1. WHEN the changes are calculated THEN the system SHALL show the before and after levels for each track
2. WHEN the user selects a track THEN the system SHALL allow listening to a preview of the result
3. IF the changes seem excessive THEN the system SHALL allow adjusting the parameters
4. WHEN the user is satisfied THEN the system SHALL proceed with the final application