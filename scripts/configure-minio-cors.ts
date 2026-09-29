/**
 * One-time script to configure CORS on MinIO buckets.
 * 
 * This enables browser-based direct uploads via presigned URLs to work
 * with XMLHttpRequest progress events (xhr.upload.onprogress).
 * 
 * Without CORS, cross-origin XHR uploads to MinIO silently suppress
 * upload progress events, making the progress bar invisible to users.
 * 
 * Usage: npx tsx scripts/configure-minio-cors.ts
 */

import 'dotenv/config';
import { minioClient } from '../src/lib/minio';
import * as crypto from 'crypto';

const LIBRARY_BUCKET = 'library';
const HRMS_BUCKET = process.env.MINIO_BUCKET || 'hrms';

// Allowed origins for CORS - add your production domains here
const ALLOWED_ORIGINS = [
  '*',
];

function buildCorsXml(origins: string[]): string {
  const rules = origins.map(origin => `
    <CORSRule>
      <AllowedOrigin>${origin}</AllowedOrigin>
      <AllowedMethod>GET</AllowedMethod>
      <AllowedMethod>PUT</AllowedMethod>
      <AllowedMethod>HEAD</AllowedMethod>
      <AllowedMethod>POST</AllowedMethod>
      <AllowedMethod>DELETE</AllowedMethod>
      <AllowedHeader>*</AllowedHeader>
      <ExposeHeader>ETag</ExposeHeader>
      <ExposeHeader>Content-Length</ExposeHeader>
      <ExposeHeader>Content-Type</ExposeHeader>
      <MaxAgeSeconds>3600</MaxAgeSeconds>
    </CORSRule>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${rules}\n</CORSConfiguration>`;
}

async function setBucketCors(bucketName: string) {
  const corsXml = buildCorsXml(ALLOWED_ORIGINS);
  const payload = Buffer.from(corsXml);
  const md5Hash = crypto.createHash('md5').update(payload).digest('base64');

  try {
    // Use the S3-compatible PutBucketCors API via the minio client's internal method
    await (minioClient as any).makeRequestAsyncOmit(
      {
        method: 'PUT',
        bucketName: bucketName,
        query: 'cors',
        headers: {
          'Content-MD5': md5Hash,
          'Content-Type': 'application/xml',
        },
      },
      payload,
      [200],
      ''
    );
    console.log(`✅ CORS configured for bucket: ${bucketName}`);
  } catch (error: any) {
    console.error(`❌ Failed to set CORS for bucket ${bucketName}:`, error.message || error);
  }
}

async function getCorsConfig(bucketName: string) {
  try {
    const res = await (minioClient as any).makeRequestAsync(
      {
        method: 'GET',
        bucketName: bucketName,
        query: 'cors',
      },
      '',
      [200],
      ''
    );
    
    // Read the response body
    const chunks: Buffer[] = [];
    for await (const chunk of res) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf-8');
    console.log(`\n📋 Current CORS for "${bucketName}":\n${body}`);
  } catch (error: any) {
    if (error.code === 'NoSuchCORSConfiguration') {
      console.log(`\n📋 No CORS configured for "${bucketName}" (will be set now)`);
    } else {
      console.log(`\n⚠️  Could not read CORS for "${bucketName}":`, error.message || error);
    }
  }
}

async function main() {
  console.log('🔧 MinIO CORS Configuration Tool');
  console.log('=================================');
  console.log(`MinIO Endpoint: ${process.env.MINIO_ENDPOINT}`);
  console.log(`Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`Buckets to configure: ${LIBRARY_BUCKET}, ${HRMS_BUCKET}\n`);

  // Show current config
  await getCorsConfig(LIBRARY_BUCKET);
  await getCorsConfig(HRMS_BUCKET);

  console.log('\n--- Setting CORS ---\n');

  // Set CORS on both buckets
  await setBucketCors(LIBRARY_BUCKET);
  await setBucketCors(HRMS_BUCKET);

  console.log('\n--- Verifying ---\n');

  // Verify
  await getCorsConfig(LIBRARY_BUCKET);
  await getCorsConfig(HRMS_BUCKET);

  console.log('\n✨ Done! Upload progress should now work in both Library and File Share modules.');
}

main().catch(console.error);
