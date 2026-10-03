import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { validateImageLimits } from './config/image-limits.js';
async function bootstrap() {
    validateImageLimits();
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
//# sourceMappingURL=main.js.map