const headerTemplate = new Uint8Array([
    0x42, 0x4D, // "BM" // ID field (42h, 4Dh)
    0x00, 0x00, 0x00, 0x00, // Placeholder // Size of the BMP file
    0x00, 0x00, // Unused // Application specific
    0x00, 0x00, // Unused // Application specific
    0x8A, 0x00, 0x00, 0x00, // 138 bytes // Offset where the pixel array can be found
    0x7C, 0x00, 0x00, 0x00, // 124 bytes // Number of bytes in the DIB header
    0x00, 0x00, 0x00, 0x00, // Placeholder // Width of the bitmap in pixels
    0x00, 0x00, 0x00, 0x00, // Placeholder // Height of the bitmap in pixels
    0x01, 0x00, // 1 plane // Number of color planes
    0x20, 0x00, // 32 bits // Number of bits per pixel
    0x03, 0x00, 0x00, 0x00, // 3 // BI_BITFIELDS, no pixel array compression used
    0x00, 0x00, 0x00, 0x00, // Placeholder // Size of the raw bitmap data (including padding)
    0x00, 0x00, 0x00, 0x00, // 0 pixels/metre // Horizontal resolution of the image
    0x00, 0x00, 0x00, 0x00, // 0 pixels/metre // Vertical resolution of the image
    0x00, 0x00, 0x00, 0x00, // 0 colors // Number of colors in the palette
    0x00, 0x00, 0x00, 0x00, // 0 important colors // Number of important colors
    0x00, 0x00, 0xFF, 0x00, // Red channel bit mask
    0x00, 0xFF, 0x00, 0x00, // Green channel bit mask
    0xFF, 0x00, 0x00, 0x00, // Blue channel bit mask
    0x00, 0x00, 0x00, 0xFF, // Alpha channel bit mask
    0x42, 0x47, 0x52, 0x73, // little-endian "sRGB" // LCS_sRGB
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // CIEXYZTRIPLE Color Space endpoints // Unused for LCS "Win " or "sRGB"
    0x00, 0x00, 0x00, 0x00, // 0 Red Gamma // Unused for LCS "Win " or "sRGB"
    0x00, 0x00, 0x00, 0x00, // 0 Green Gamma // Unused for LCS "Win " or "sRGB"
    0x00, 0x00, 0x00, 0x00, // 0 Blue Gamma // Unused for LCS "Win " or "sRGB"
    0x08, 0x00, 0x00, 0x00, // LCS_GM_ABS_COLORIMETRIC // Rendering intent for bitmap
    0x00, 0x00, 0x00, 0x00, // 0 // Offset to the start of the profile data
    0x00, 0x00, 0x00, 0x00, // 0 // Size, in bytes, of embedded profile data
    0x00, 0x00, 0x00, 0x00, // Unused // Reserved
]);

const createBMP = (rgba: Uint8Array, width: number, height: number): Uint8Array => {
    const header = new Uint8Array(headerTemplate);
    const view = new DataView(header.buffer);

    view.setUint32(0x02, header.byteLength + rgba.byteLength, true);
    view.setUint32(0x12, width, true);
    view.setUint32(0x16, height, true);
    view.setUint32(0x22, rgba.byteLength, true);

    const pixels = new Uint8Array(rgba.byteLength);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            const j = ((height - y - 1) * width + x) * 4;

            pixels[j + 0] = rgba[i + 2];
            pixels[j + 1] = rgba[i + 1];
            pixels[j + 2] = rgba[i + 0];
            pixels[j + 3] = rgba[i + 3];
        }
    }

    return new Uint8Array([...header, ...pixels]);
};
export default createBMP;
