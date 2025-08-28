import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3Service {
    private s3: AWS.S3;

    constructor(private configService: ConfigService) {
        this.s3 = new AWS.S3({
            endpoint: this.configService.get('S3_ENDPOINT'),
            accessKeyId: this.configService.get('S3_ACCESS_KEY'),
            secretAccessKey: this.configService.get('S3_SECRET_KEY'),
            s3ForcePathStyle: true, // Required for MinIO
            signatureVersion: 'v4',
        });
    }

    async uploadFile(
        key: string,
        file: Express.Multer.File,
        bucket: string = this.configService.get('S3_BUCKET', 'bug-repro-artifacts'),
    ): Promise<string> {
        const uploadParams = {
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                originalName: file.originalname,
                uploadedAt: new Date().toISOString(),
            },
        };

        const result = await this.s3.upload(uploadParams).promise();
        return result.Location;
    }

    async downloadFile(
        key: string,
        bucket: string = this.configService.get('S3_BUCKET', 'bug-repro-artifacts'),
    ): Promise<Buffer> {
        const downloadParams = {
            Bucket: bucket,
            Key: key,
        };

        const result = await this.s3.getObject(downloadParams).promise();
        return result.Body as Buffer;
    }

    async deleteFile(
        key: string,
        bucket: string = this.configService.get('S3_BUCKET', 'bug-repro-artifacts'),
    ): Promise<void> {
        const deleteParams = {
            Bucket: bucket,
            Key: key,
        };

        await this.s3.deleteObject(deleteParams).promise();
    }

    async getSignedUrl(
        key: string,
        expires: number = 3600, // 1 hour
        bucket: string = this.configService.get('S3_BUCKET', 'bug-repro-artifacts'),
    ): Promise<string> {
        const signedUrlParams = {
            Bucket: bucket,
            Key: key,
            Expires: expires,
        };

        return this.s3.getSignedUrlPromise('getObject', signedUrlParams);
    }

    generateKey(prefix: string, filename: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${prefix}/${timestamp}-${random}-${filename}`;
    }
}
