// ============ KLING MOTION CONTROL MODELS ============
// Focused app for Kling Motion Control Pro & Standard

export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'url' | 'textarea' | 'select' | 'number' | 'boolean';
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    defaultValue?: unknown;
    options?: { label: string; value: string | number }[];
    min?: number;
    max?: number;
    step?: number;
}

export interface VideoModel {
    id: string;
    name: string;
    badge?: string;
    type: string;
    endpoint: string;
    statusEndpoint: string;
    description: string;
    fields: FormField[];
}

const models: VideoModel[] = [
    // --- Kling 2.6 Motion Control Pro ---
    // Docs: POST /v1/ai/video/kling-v2-6-motion-control-pro
    // Status: GET /v1/ai/image-to-video/kling-v2-6/{task-id}
    // Body params: image_url, video_url, prompt, character_orientation (video|image), cfg_scale
    {
        id: 'kling-v2-6-motion-control-pro',
        name: 'Kling Motion Control Pro',
        badge: 'PRO',
        type: 'video-effects',
        endpoint: '/v1/ai/video/kling-v2-6-motion-control-pro',
        statusEndpoint: '/v1/ai/image-to-video/kling-v2-6',
        description: 'Transfer motion from a reference video to a character image — preserves appearance with Pro quality',
        fields: [
            {
                name: 'image_url', label: 'Character Image URL', type: 'url',
                required: true, placeholder: 'https://example.com/character.jpg',
                helpText: 'Publicly accessible URL · JPG/PNG/WEBP · min 300×300px · max 10MB'
            },
            {
                name: 'video_url', label: 'Reference Video URL', type: 'url',
                required: true, placeholder: 'https://example.com/motion.mp4',
                helpText: 'MP4/MOV/WEBM/M4V · 3–30 seconds · publicly accessible'
            },
            {
                name: 'prompt', label: 'Prompt (Optional)', type: 'textarea',
                placeholder: 'Describe the desired motion...',
                helpText: 'Max 2500 characters'
            },
            {
                name: 'character_orientation', label: 'Output Orientation', type: 'select',
                options: [
                    { label: 'Video — matches reference video orientation (max 30s)', value: 'video' },
                    { label: 'Image — matches character image orientation (max 10s)', value: 'image' },
                ],
                defaultValue: 'video'
            },
            {
                name: 'cfg_scale', label: 'CFG Scale', type: 'number',
                defaultValue: 0.5, min: 0, max: 1, step: 0.1,
                helpText: 'Higher = stronger prompt adherence (0.0 – 1.0)'
            },
        ]
    },
    // --- Kling 2.6 Motion Control Standard ---
    // Docs: POST /v1/ai/video/kling-v2-6-motion-control-std
    // Status: GET /v1/ai/image-to-video/kling-v2-6/{task-id}
    // Body params: image_url, video_url, prompt, character_orientation (video|image), cfg_scale
    {
        id: 'kling-v2-6-motion-control-std',
        name: 'Kling Motion Control Standard',
        badge: 'STD',
        type: 'video-effects',
        endpoint: '/v1/ai/video/kling-v2-6-motion-control-std',
        statusEndpoint: '/v1/ai/image-to-video/kling-v2-6',
        description: 'Standard quality motion transfer — faster processing, more affordable',
        fields: [
            {
                name: 'image_url', label: 'Character Image URL', type: 'url',
                required: true, placeholder: 'https://example.com/character.jpg',
                helpText: 'Publicly accessible URL · JPG/PNG/WEBP · min 300×300px · max 10MB'
            },
            {
                name: 'video_url', label: 'Reference Video URL', type: 'url',
                required: true, placeholder: 'https://example.com/motion.mp4',
                helpText: 'MP4/MOV/WEBM/M4V · 3–30 seconds · publicly accessible'
            },
            {
                name: 'prompt', label: 'Prompt (Optional)', type: 'textarea',
                placeholder: 'Describe the desired motion...',
                helpText: 'Max 2500 characters'
            },
            {
                name: 'character_orientation', label: 'Output Orientation', type: 'select',
                options: [
                    { label: 'Video — matches reference video orientation (max 30s)', value: 'video' },
                    { label: 'Image — matches character image orientation (max 10s)', value: 'image' },
                ],
                defaultValue: 'video'
            },
            {
                name: 'cfg_scale', label: 'CFG Scale', type: 'number',
                defaultValue: 0.5, min: 0, max: 1, step: 0.1,
                helpText: 'Higher = stronger prompt adherence (0.0 – 1.0)'
            },
        ]
    },
];

export function getModelById(id: string): VideoModel | undefined {
    return models.find(m => m.id === id);
}

export function getAllModels(): VideoModel[] {
    return models;
}
