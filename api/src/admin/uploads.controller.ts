import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { memoryStorage } from 'multer';
import type { StaffUser } from '../generated/prisma/client';
import { CurrentStaff, StaffOnly } from '../auth/decorators';
import { firebaseApp } from '../auth/firebase';

const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Dev: files live in api/uploads and are served at /uploads (proxied by both apps).
 * UPLOAD_DIR overrides it, e.g. for the bundled function in the Functions emulator.
 */
export const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || resolve(__dirname, '..', '..', 'uploads');

@Controller('admin/uploads')
@StaffOnly('OWNER', 'STAFF')
export class AdminUploadsController {
  /** Dish photo upload. STORAGE_DRIVER=local (dev) or firebase (prod). */
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES } }))
  async upload(@CurrentStaff() staff: StaffUser, @UploadedFile() file?: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file uploaded (field name "file")');
    const ext = EXT[file.mimetype];
    if (!ext) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');

    const name = `${staff.venueId}/${randomUUID()}.${ext}`;

    if ((process.env.STORAGE_DRIVER ?? 'local') === 'firebase') {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage(firebaseApp()).bucket();
      const obj = bucket.file(`menu/${name}`);
      await obj.save(file.buffer, { contentType: file.mimetype, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
      await obj.makePublic();
      return { url: `https://storage.googleapis.com/${bucket.name}/menu/${name}` };
    }

    const dir = join(LOCAL_UPLOAD_DIR, staff.venueId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(LOCAL_UPLOAD_DIR, name), file.buffer);
    return { url: `/uploads/${name}` };
  }
}
