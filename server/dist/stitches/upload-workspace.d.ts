export declare function createUploadWorkspace(): Promise<{
    directory: string;
    cleanup(): Promise<void>;
}>;
