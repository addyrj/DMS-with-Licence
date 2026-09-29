// src/app/api/logo/route.js
// Proxies images from backend to avoid cross-origin blocking
// Allows: /uploads/logos/ (company logos), /uploads/{dbname}/ (media files), /tvfiles/{dbname}/ (direct uploads)

import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const logoPath = searchParams.get('path');

  if (!logoPath) {
    return new NextResponse('Missing path', { status: 400 });
  }

  // Allow company logos AND media bucket files
  // Valid patterns:
  //   /uploads/logos/client_4.png
  //   /uploads/tata_db/folder/file.mp4
  //   /uploads/electrocon_db/promo/promo-001.jpg
  const isLogo    = logoPath.startsWith('/uploads/logos/');
  const isMedia   = /^\/uploads\/[a-z0-9_]+\//.test(logoPath);
  const isTvFile  = /^\/tvfiles\/[a-z0-9_]+\//.test(logoPath);  // FIX B: allow tvfiles/

  if (!isLogo && !isMedia && !isTvFile) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block path traversal attempts
  if (logoPath.includes('..') || logoPath.includes('//')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const response = await fetch(`${BACKEND}${logoPath}`);

    if (!response.ok) {
      return new NextResponse('File not found', { status: 404 });
    }

    const buffer      = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':                contentType,
        'Cache-Control':               'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new NextResponse('Error fetching file', { status: 500 });
  }
}
