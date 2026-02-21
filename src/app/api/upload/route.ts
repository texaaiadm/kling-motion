import { NextRequest, NextResponse } from 'next/server';

const CATBOX_API = 'https://catbox.moe/user/api.php';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
        }

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            return NextResponse.json(
                { error: 'Format file tidak didukung. Gunakan JPG/PNG/WEBP untuk gambar atau MP4/MOV/WEBM untuk video.' },
                { status: 400 }
            );
        }

        // Max 200MB for Catbox
        const maxSize = 200 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'Ukuran file terlalu besar. Maksimal 200MB.' },
                { status: 400 }
            );
        }

        // Upload to Catbox.moe
        const catboxForm = new FormData();
        catboxForm.append('reqtype', 'fileupload');
        catboxForm.append('fileToUpload', file, file.name);

        const response = await fetch(CATBOX_API, {
            method: 'POST',
            body: catboxForm,
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('[Upload] Catbox error:', response.status, text);
            return NextResponse.json(
                { error: `Upload gagal (${response.status}). Coba lagi.` },
                { status: 502 }
            );
        }

        const url = await response.text();

        if (!url || !url.startsWith('https://')) {
            console.error('[Upload] Invalid Catbox response:', url);
            return NextResponse.json(
                { error: 'Upload gagal — response tidak valid.' },
                { status: 502 }
            );
        }

        return NextResponse.json({ url: url.trim() });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload gagal' },
            { status: 500 }
        );
    }
}
