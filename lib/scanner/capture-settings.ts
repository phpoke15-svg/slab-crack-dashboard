/** High-res capture tuned for on-device OCR (card name + collector number). */
export const SCAN_CAPTURE_MAX_EDGE = 1920
export const SCAN_CAPTURE_JPEG_QUALITY = 0.94

/** Vision / phash fallback can use a smaller payload. */
export const SCAN_VISION_MAX_EDGE = 768
export const SCAN_VISION_JPEG_QUALITY = 0.85

/** Minimum sharpness (Laplacian variance) before auto-scan fires. */
export const SCAN_STABILITY_BLUR_MIN = 42
export const SCAN_STABILITY_HOLD_MS = 650
