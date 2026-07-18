/** High-res capture tuned for on-device OCR (card name + collector number). */
export const SCAN_CAPTURE_MAX_EDGE = 1920
export const SCAN_CAPTURE_JPEG_QUALITY = 0.94

/** Vision API payload — high enough for Gemini to read name/number/set. */
export const SCAN_VISION_MAX_EDGE = 1280
export const SCAN_VISION_JPEG_QUALITY = 0.92

/** Minimum sharpness (Laplacian variance) before auto-scan fires. */
export const SCAN_STABILITY_BLUR_MIN = 42
export const SCAN_STABILITY_HOLD_MS = 650
