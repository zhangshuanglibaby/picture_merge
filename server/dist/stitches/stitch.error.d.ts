import { HttpException, HttpStatus } from '@nestjs/common';
declare const STATUS_BY_CODE: {
    readonly INVALID_COUNT: HttpStatus.BAD_REQUEST;
    readonly INVALID_IMAGE: HttpStatus.BAD_REQUEST;
    readonly IMAGE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE;
    readonly OUTPUT_TOO_LARGE: HttpStatus.UNPROCESSABLE_ENTITY;
    readonly BUSY: HttpStatus.SERVICE_UNAVAILABLE;
    readonly PROCESSING_FAILED: HttpStatus.INTERNAL_SERVER_ERROR;
};
export type StitchErrorCode = keyof typeof STATUS_BY_CODE;
export declare class StitchError extends HttpException {
    constructor(code: StitchErrorCode, message: string);
}
export {};
