"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const fs_1 = require("fs");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const uploadsDir = (0, path_1.join)(process.cwd(), 'uploads', 'logos');
    if (!(0, fs_1.existsSync)(uploadsDir))
        (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    app.useStaticAssets?.((0, path_1.join)(process.cwd(), 'uploads'), { prefix: '/uploads' });
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Facturo API running on port ${port}`);
    console.log(`📁 Uploads served at /uploads/`);
}
bootstrap();
//# sourceMappingURL=main.js.map