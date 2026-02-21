import { NextRequest, NextResponse } from 'next/server';
import { getModelById } from '@/lib/models';

const FREEPIK_API_BASE = 'https://api.freepik.com';

function getApiKey(request: NextRequest): string | null {
    if (process.env.FREEPIK_API_KEY) return process.env.FREEPIK_API_KEY;
    return request.headers.get('x-api-key');
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key tidak dikonfigurasi. Masukkan API key di halaman utama atau set FREEPIK_API_KEY di environment.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { model: modelId, ...params } = body;

        if (!modelId) {
            return NextResponse.json({ error: 'Model ID diperlukan' }, { status: 400 });
        }

        const model = getModelById(modelId);
        if (!model) {
            return NextResponse.json({ error: `Model tidak dikenal: ${modelId}` }, { status: 400 });
        }

        // Clean up params — remove empty strings/nulls
        const cleanParams: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== '' && value !== null && value !== undefined) {
                cleanParams[key] = value;
            }
        }

        const url = `${FREEPIK_API_BASE}${model.endpoint}`;
        console.log('[Generate]', url, JSON.stringify(cleanParams));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-freepik-api-key': apiKey,
            },
            body: JSON.stringify(cleanParams),
        });

        // Safely parse — Freepik sometimes returns non-JSON (HTML error pages, 504 timeouts)
        const contentType = response.headers.get('content-type') || '';
        let data: Record<string, unknown>;

        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('[Generate] Non-JSON response:', response.status, text.substring(0, 500));
            return NextResponse.json(
                { error: `Freepik API error (${response.status}). Server returned non-JSON response. Please try again.` },
                { status: response.status || 502 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: data.message || data.error || 'Permintaan API gagal', details: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Generate error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Kesalahan server internal' },
            { status: 500 }
        );
    }
}
