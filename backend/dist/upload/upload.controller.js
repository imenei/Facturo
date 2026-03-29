"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const uuid_1 = require("uuid");
const logoStorage = (0, multer_1.diskStorage)({
    destination: './uploads/logos',
    filename: (req, file, cb) => {
        const unique = (0, uuid_1.v4)();
        const ext = (0, path_1.extname)(file.originalname);
        cb(null, `${unique}${ext}`);
    },
});
const imageFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    if (!allowed.includes((0, path_1.extname)(file.originalname).toLowerCase())) {
        return cb(new common_1.BadRequestException('Format non supporté. Utilisez JPG, PNG, WEBP ou SVG'), false);
    }
    cb(null, true);
};
let UploadController = class UploadController {
    uploadLogo(file) {
        if (!file)
            throw new common_1.BadRequestException('Aucun fichier reçu');
        const url = `/uploads/logos/${file.filename}`;
        return { url, filename: file.filename, originalName: file.originalname, size: file.size };
    }
    serveLogo(filename, res) {
        const filePath = (0, path_1.join)(process.cwd(), 'uploads', 'logos', filename);
        if (!(0, fs_1.existsSync)(filePath)) {
            return res.status(404).json({ message: 'Fichier non trouvé' });
        }
        res.sendFile(filePath);
    }
    deleteLogo(filename) {
        const filePath = (0, path_1.join)(process.cwd(), 'uploads', 'logos', filename);
        if ((0, fs_1.existsSync)(filePath)) {
            (0, fs_1.unlinkSync)(filePath);
            return { success: true, message: 'Logo supprimé' };
        }
        return { success: false, message: 'Fichier non trouvé' };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('logo'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: logoStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "uploadLogo", null);
__decorate([
    (0, common_1.Get)('logos/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "serveLogo", null);
__decorate([
    (0, common_1.Delete)('logo/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "deleteLogo", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('upload'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard)
], UploadController);
//# sourceMappingURL=upload.controller.js.map