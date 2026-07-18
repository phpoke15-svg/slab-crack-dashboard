/** High-res capture tuned for on-device OCR (card name + collector number). */
export const SCAN_CAPTURE_MAX_EDGE = 1920
export const SCAN_CAPTURE_JPEG_QUALITY = 0.94

/** Vision API payload — high enough for Gemini to read name/number/set. */
export const SCAN_VISION_MAX_EDGE = 1280
export const SCAN_VISION_JPEG_QUALITY = 0.92

/** Point & Scan: analyze 4 frames/sec (250ms) from the live preview. */
export const POINT_SCAN_FRAME_MS = 250
/** Pause re-matching the same card id after a hit. */
export const POINT_SCAN_SAME_CARD_COOLDOWN_MS = 8000

/** Minimum sharpness (Laplacian variance) before auto-scan fires. */
export const SCAN_STABILITY_BLUR_MIN = 32
export const SCAN_STABILITY_HOLD_MS = 450
