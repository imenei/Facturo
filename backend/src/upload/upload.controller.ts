import {
  Controller, Post, Delete, Param, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException, Res, Get
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const logoStorage = diskStorage({
  destination: './uploads/logos',
  filename: (req, file, cb) => {
    const unique = uuidv4();
    const ext = extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const imageFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  if (!allowed.includes(extname(file.originalname).toLowerCase())) {
    return cb(new BadRequestException('Format non supporté. Utilisez JPG, PNG, WEBP ou SVG'), false);
  }
  cb(null, true);
};

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { storage: logoStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const url = `/uploads/logos/${file.filename}`;
    return { url, filename: file.filename, originalName: file.originalname, size: file.size };
  }

  @Get('logos/:filename')
  serveLogo(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'logos', filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'Fichier non trouvé' });
    }
    res.sendFile(filePath);
  }

  @Delete('logo/:filename')
  deleteLogo(@Param('filename') filename: string) {
    const filePath = join(process.cwd(), 'uploads', 'logos', filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return { success: true, message: 'Logo supprimé' };
    }
    return { success: false, message: 'Fichier non trouvé' };
  }
}
