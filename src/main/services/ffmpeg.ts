/**
 * FFmpeg/FFprobe Service
 * Forensic metadata extraction from media files
 * Phase 2: Media Ingestion
 */

import ffmpeg from 'fluent-ffmpeg';
import { FFprobeMetadata } from '../../shared/types';
import path from 'path';
import fs from 'fs';

/**
 * Extract forensic metadata from a media file using FFprobe
 * @param filePath Absolute path to media file
 * @returns Promise resolving to FFprobeMetadata
 */
export const extractMetadata = (filePath: string): Promise<FFprobeMetadata> => {
  return new Promise((resolve, reject) => {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[FFprobe] Error extracting metadata:', err);
        return reject(err);
      }

      try {
        // Find video and audio streams
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const primaryStream = videoStream || audioStream;

        if (!primaryStream) {
          return reject(new Error('No valid video or audio stream found'));
        }

        // Extract frame rate
        // FFprobe returns frame rate as a fraction string like "24000/1001" for 23.976
        let fps = 30; // Default fallback
        if (videoStream?.r_frame_rate) {
          const [numerator, denominator] = videoStream.r_frame_rate.split('/').map(Number);
          if (denominator && denominator !== 0) {
            fps = numerator / denominator;
          }
        } else if (videoStream?.avg_frame_rate) {
          const [numerator, denominator] = videoStream.avg_frame_rate.split('/').map(Number);
          if (denominator && denominator !== 0) {
            fps = numerator / denominator;
          }
        }

        // Round to common frame rates for display (but store precise value)
        // Common rates: 23.976, 24, 25, 29.97, 30, 50, 59.94, 60
        const preciseFps = Math.round(fps * 1000) / 1000;

        // Extract resolution
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;
        const resolution = `${width}x${height}`;

        // Extract duration (in seconds, float)
        const duration = metadata.format.duration || 0;

        // Extract format
        const format = metadata.format.format_name || 'unknown';

        // Determine MIME type
        let mime_type = 'application/octet-stream';
        if (videoStream && audioStream) {
          mime_type = 'video/mixed';
        } else if (videoStream) {
          mime_type = 'video/' + (metadata.format.format_name?.split(',')[0] || 'unknown');
        } else if (audioStream) {
          mime_type = 'audio/' + (metadata.format.format_name?.split(',')[0] || 'unknown');
        }

        // Get file size
        const stats = fs.statSync(filePath);
        const file_size = stats.size;

        // Extract start timecode from video stream tags
        // ProRes, MOV, and other professional formats embed start timecode in metadata
        // Check both stream-level and format-level tags
        const timecode_start = videoStream?.tags?.timecode ||
                              metadata.format.tags?.timecode ||
                              null;

        // Extract total frame count from nb_frames (if available)
        // Fallback to calculating from duration * fps if not present
        let total_frames = null;
        if (videoStream?.nb_frames) {
          total_frames = parseInt(videoStream.nb_frames as string, 10);
        } else if (duration > 0 && preciseFps > 0) {
          total_frames = Math.floor(duration * preciseFps);
        }

        const result: FFprobeMetadata = {
          duration,
          fps: preciseFps,
          width,
          height,
          resolution,
          format,
          has_video: !!videoStream,
          has_audio: !!audioStream,
          mime_type,
          file_size,
          timecode_start,
          total_frames,
        };

        console.log('[FFprobe] Successfully extracted metadata:', {
          file: path.basename(filePath),
          duration: `${duration.toFixed(2)}s`,
          fps: preciseFps,
          resolution,
          total_frames,
          start_tc: timecode_start || 'N/A',
          size: `${(file_size / 1024 / 1024).toFixed(2)} MB`,
        });

        resolve(result);
      } catch (parseError) {
        console.error('[FFprobe] Error parsing metadata:', parseError);
        reject(parseError);
      }
    });
  });
};

/**
 * Validate if a file is a supported media type
 * @param filePath Absolute path to file
 * @returns boolean indicating if file extension is supported
 */
export const isSupportedMediaFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  const supportedExtensions = [
    // Video
    '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.mts', '.m2ts',
    // Audio
    '.wav', '.mp3', '.m4a', '.aac', '.flac',
    // Image (for static shots)
    '.jpg', '.jpeg', '.png', '.tiff', '.tif',
  ];

  return supportedExtensions.includes(ext);
};

/**
 * Generate a sanitized clean name from a filename
 * Removes common camera prefixes and normalizes
 * @param fileName Original filename
 * @returns Clean, human-readable name
 */
export const generateCleanName = (fileName: string): string => {
  const baseName = path.basename(fileName, path.extname(fileName));

  // Remove common camera prefixes (e.g., "C0001", "CAM_A_", "MVI_")
  let cleanName = baseName
    .replace(/^(C\d{4}|CAM_[A-Z]_|MVI_|IMG_|DSC_|DSCF|P\d{7})/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If we removed everything, use original base name
  if (!cleanName) {
    cleanName = baseName;
  }

  return cleanName;
};

/**
 * Calculate end timecode from start timecode and duration
 * @param startTC Start timecode in SMPTE format (HH:MM:SS:FF or HH:MM:SS;FF)
 * @param duration Duration in seconds
 * @param fps Frame rate
 * @returns End timecode in SMPTE format, or null if startTC is invalid
 */
export const calculateEndTimecode = (
  startTC: string | null,
  duration: number,
  fps: number
): string | null => {
  if (!startTC || duration === 0 || fps === 0) {
    return null;
  }

  try {
    // Parse start timecode (supports both drop-frame ; and non-drop :)
    const isDropFrame = startTC.includes(';');
    const separator = isDropFrame ? ';' : ':';
    const parts = startTC.split(/[:;]/);

    if (parts.length !== 4) {
      console.warn('[Timecode] Invalid start timecode format:', startTC);
      return null;
    }

    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    let seconds = parseInt(parts[2], 10);
    let frames = parseInt(parts[3], 10);

    // Convert start timecode to total frames
    const startTotalFrames = (hours * 3600 + minutes * 60 + seconds) * fps + frames;

    // Add duration in frames
    const durationFrames = Math.floor(duration * fps);
    const endTotalFrames = startTotalFrames + durationFrames;

    // Convert back to timecode
    const totalSeconds = Math.floor(endTotalFrames / fps);
    hours = Math.floor(totalSeconds / 3600);
    minutes = Math.floor((totalSeconds % 3600) / 60);
    seconds = totalSeconds % 60;
    frames = Math.floor(endTotalFrames % fps);

    // Format with leading zeros
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}${separator}${pad(minutes)}${separator}${pad(seconds)}${separator}${pad(frames)}`;
  } catch (error) {
    console.error('[Timecode] Error calculating end timecode:', error);
    return null;
  }
};
