import { Client } from 'minio'

const portStr = process.env.MINIO_PORT;
const port = portStr ? Number(portStr) : undefined;

export const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT?.replace(/^https?:\/\//, '').split(':')[0] || '127.0.0.1',
    port: process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : undefined,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
})