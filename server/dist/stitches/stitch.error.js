import { HttpException, HttpStatus } from '@nestjs/common';
const STATUS_BY_CODE = {
    INVALID_COUNT: HttpStatus.BAD_REQUEST,
    INVALID_IMAGE: HttpStatus.BAD_REQUEST,
    IMAGE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
    OUTPUT_TOO_LARGE: HttpStatus.UNPROCESSABLE_ENTITY,
    BUSY: HttpStatus.SERVICE_UNAVAILABLE,
    PROCESSING_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
};
export class StitchError extends HttpException {
    constructor(code, message) {
        super({ code, message }, STATUS_BY_CODE[code]);
    }
}
//# sourceMappingURL=stitch.error.js.map