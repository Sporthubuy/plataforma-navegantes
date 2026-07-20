import multer from 'multer';

/** Error con status HTTP propio, respetado por el error handler global. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Multer en memoria: imágenes jpg/png/webp de hasta 5MB. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new HttpError(415, 'Formato no soportado (solo jpg, png o webp)'));
    }
  },
});

export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}
