import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Security
    app.use(helmet());
    app.use(compression());

    // CORS
    app.enableCors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Global prefix
    app.setGlobalPrefix('v1');

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('AI Bug Reproduction Tool API')
        .setDescription('REST API for converting natural language bug reports into deterministic repros')
        .setVersion('1.0')
        .addTag('reports', 'Bug report management')
        .addTag('repros', 'Reproduction generation and management')
        .addTag('exports', 'Export functionality')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Start server
    const port = process.env.API_PORT || 4000;
    await app.listen(port);

    console.log(`🚀 API server running on: http://localhost:${port}`);
    console.log(`📚 API documentation: http://localhost:${port}/api`);
}

bootstrap();
