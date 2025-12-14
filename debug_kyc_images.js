// Temporary debug script to inspect image URLs from Firestore
// Run this in browser console when viewing a candidate with KYC data

console.log('=== KYC IMAGE DEBUG ===');

// Get the candidate data from the page
if (typeof candidate !== 'undefined' && candidate?.backgroundCheck) {
    const bc = candidate.backgroundCheck;

    console.log('Background Check Status:', bc.status);
    console.log('\n--- ID Verification Images ---');
    console.log('Front Image:', bc.idVerification?.frontImage);
    console.log('Back Image:', bc.idVerification?.backImage);
    console.log('Portrait Image:', bc.idVerification?.portraitImage);

    console.log('\n--- Liveness Images ---');
    console.log('Reference Image:', bc.liveness?.referenceImage);

    console.log('\n--- Face Match Images ---');
    console.log('Source Image:', bc.faceMatch?.sourceImage);
    console.log('Target Image:', bc.faceMatch?.targetImage);

    // Test if images are URLs or base64
    const testImage = bc.idVerification?.frontImage;
    if (testImage) {
        console.log('\n--- Image Format Analysis ---');
        console.log('Starts with http:', testImage.startsWith('http'));
        console.log('Starts with data:', testImage.startsWith('data:'));
        console.log('First 100 chars:', testImage.substring(0, 100));
        console.log('Length:', testImage.length);
    }
} else {
    console.error('No candidate data found. Make sure you are on a candidate detail page.');
}
