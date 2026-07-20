import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { MulterError } from 'multer';
import { config } from './config';
import { HttpError } from './lib/upload';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import postsRouter from './routes/posts';
import boatsRouter from './routes/boats';
import crewRouter from './routes/crew';
import adminRouter from './routes/admin';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/boats', boatsRouter);
app.use('/api/crew', crewRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen no puede superar los 5MB'
        : 'Error al subir el archivo';
    return res.status(413).json({ error: message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`Backend escuchando en http://localhost:${config.port}`);
});
