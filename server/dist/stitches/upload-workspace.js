import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function createUploadWorkspace() {
    const directory = await mkdtemp(join(tmpdir(), 'image-stitch-'));
    return {
        directory,
        async cleanup() {
            await rm(directory, { recursive: true, force: true });
        },
    };
}
//# sourceMappingURL=upload-workspace.js.map