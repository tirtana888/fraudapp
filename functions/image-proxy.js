/**
 * IMAGE PROXY FOR DIDIT KYC IMAGES
 * Fetches images from Didit's S3 URLs and returns them as base64
 * This bypasses CORS restrictions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const https = require("https");

/**
 * Fetch image from Didit S3 URL and convert to base64
 */
exports.fetchDiditImage = onCall({
    region: "europe-west1",
    cors: true
}, async (request) => {
    const { imageUrl } = request.data;

    if (!imageUrl) {
        throw new HttpsError('invalid-argument', 'Image URL is required');
    }

    // Validate that it's a Didit S3 URL
    if (!imageUrl.includes('service-didit-verification-production') && !imageUrl.includes('didit')) {
        throw new HttpsError('invalid-argument', 'Invalid image URL - must be from Didit');
    }

    try {
        logger.info(`[IMAGE-PROXY] Fetching image: ${imageUrl.substring(0, 100)}...`);

        const imageBuffer = await new Promise((resolve, reject) => {
            https.get(imageUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch image: ${res.statusCode}`));
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        });

        // Convert to base64
        const base64Image = imageBuffer.toString('base64');
        const contentType = 'image/jpeg'; // Didit typically returns JPEG

        logger.info(`[IMAGE-PROXY] Successfully fetched image, size: ${imageBuffer.length} bytes`);

        return {
            success: true,
            data: `data:${contentType};base64,${base64Image}`,
            size: imageBuffer.length
        };

    } catch (error) {
        logger.error(`[IMAGE-PROXY] Error fetching image: ${error.message}`);
        throw new HttpsError('internal', `Failed to fetch image: ${error.message}`);
    }
});
