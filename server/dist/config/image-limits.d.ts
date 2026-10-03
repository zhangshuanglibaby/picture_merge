export declare const IMAGE_LIMITS: {
    readonly minImages: 2;
    readonly maxImages: 5;
    readonly maxFileBytes: number;
    readonly maxUploadBytes: number;
    readonly maxInputPixels: 12000000;
    readonly maxInputSide: 16000;
    readonly maxOutputPixels: 25000000;
    readonly maxOutputHeight: 30000;
};
export declare function validateImageLimits(): void;
