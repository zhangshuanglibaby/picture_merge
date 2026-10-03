var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { IMAGE_LIMITS } from '../config/image-limits.js';
import { StitchError } from './stitch.error.js';
let StitchesService = class StitchesService {
    validateImageCount(count) {
        const valid = Number.isInteger(count) &&
            count >= IMAGE_LIMITS.minImages &&
            count <= IMAGE_LIMITS.maxImages;
        if (!valid) {
            throw new StitchError('INVALID_COUNT', '请选择 2～5 张图片');
        }
    }
};
StitchesService = __decorate([
    Injectable()
], StitchesService);
export { StitchesService };
//# sourceMappingURL=stitches.service.js.map