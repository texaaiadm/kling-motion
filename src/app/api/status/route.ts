import { NextRequest, NextResponse } from 'next/server';
import { getModelById } from '@/lib/models';

const FREEPIK_API_BASE = 'https://api.freepik.com';

function getApiKey(request: NextRequest): string | null {
    if (process.env.FREEPIK_API_KEY) return process.env.FREEPIK_API_KEY;
    return request.headers.get('x-api-key');
}

export async function GET(request: NextRequest) {
    try {
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'API key tidak dikonfigurasi.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const modelId = searchParams.get('model');
        const taskId = searchParams.get('taskId');

        if (!modelId || !taskId) {
            return NextResponse.json({ error: 'model dan taskId diperlukan' }, { status: 400 });
        }

        const model = getModelById(modelId);
        if (!model) {
            return NextResponse.json({ error: `Model tidak dikenal: ${modelId}` }, { status: 400 });
        }

        const statusUrl = `${FREEPIK_API_BASE}${model.statusEndpoint}/${taskId}`;
        console.log('[Status Check]', statusUrl);

        const response = await fetch(statusUrl, {
            method: 'GET',
            headers: { 'x-freepik-api-key': apiKey },
        });

        const contentType = response.headers.get('content-type') || '';
        let data: Record<string, unknown>;

        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('[Status Check] Non-JSON response:', response.status, text.substring(0, 500));

            if (response.status === 404) {
                return NextResponse.json(
                    { error: `Task tidak ditemukan (404). URL: ${statusUrl}`, status: response.status },
                    { status: 404 }
                );
            }
            return NextResponse.json(
                { error: `Server Freepik mengembalikan respons non-JSON (${response.status}).`, rawSnippet: text.substring(0, 200) },
                { status: response.status || 502 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: data.message || data.error || 'Gagal memeriksa status', details: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Status check error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Kesalahan server internal' },
            { status: 500 }
        );
    }
}
