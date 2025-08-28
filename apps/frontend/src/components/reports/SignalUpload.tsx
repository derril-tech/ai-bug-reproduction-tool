import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import {
    Upload,
    X,
    FileText,
    Image,
    Video,
    FileCode,
    AlertCircle
} from 'lucide-react';

interface SignalUploadProps {
    reportId: string;
    onUploadComplete?: () => void;
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
}

export function SignalUpload({
    reportId,
    onUploadComplete,
    onUploadStart,
    onUploadEnd,
}: SignalUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/json': ['.har'],
            'text/plain': ['.log', '.txt'],
            'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
            'video/*': ['.mp4', '.webm', '.avi'],
        },
        maxSize: 50 * 1024 * 1024, // 50MB
        multiple: true,
    });

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getFileType = (file: File): string => {
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'har') return 'har';
        if (['png', 'jpg', 'jpeg', 'gif'].includes(ext || '')) return 'screenshot';
        if (['mp4', 'webm', 'avi'].includes(ext || '')) return 'video';
        if (['log', 'txt'].includes(ext || '')) return 'log';

        return 'log'; // Default fallback
    };

    const getFileIcon = (file: File) => {
        const type = getFileType(file);

        switch (type) {
            case 'har':
                return <FileCode className="h-4 w-4" />;
            case 'screenshot':
                return <Image className="h-4 w-4" />;
            case 'video':
                return <Video className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    const formatFileSize = (bytes: number): string => {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const uploadFile = async (file: File): Promise<void> => {
        const formData = new FormData();
        const fileType = getFileType(file);

        formData.append('file', file);
        formData.append('kind', fileType);

        // Add metadata based on file type
        const meta: Record<string, any> = {
            originalName: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        };

        // Add type-specific metadata
        if (fileType === 'screenshot') {
            // Could add image dimensions, etc.
            meta.contentType = 'image';
        } else if (fileType === 'video') {
            meta.contentType = 'video';
        } else if (fileType === 'har') {
            meta.contentType = 'har';
        } else if (fileType === 'log') {
            meta.contentType = 'log';
        }

        formData.append('meta', JSON.stringify(meta));

        try {
            const response = await apiClient.post(
                `/reports/${reportId}/signals`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const progress = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            setUploadProgress(prev => ({
                                ...prev,
                                [file.name]: progress,
                            }));
                        }
                    },
                }
            );

            toast.success(`${file.name} uploaded successfully`);
            return response;
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || `Failed to upload ${file.name}`;
            toast.error(errorMessage);
            throw error;
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            toast.error('Please select files to upload');
            return;
        }

        setUploading(true);
        onUploadStart?.();

        try {
            const uploadPromises = files.map(file => uploadFile(file));
            await Promise.allSettled(uploadPromises);

            const successCount = uploadPromises.filter(
                promise => promise.status === 'fulfilled'
            ).length;

            if (successCount > 0) {
                toast.success(`Successfully uploaded ${successCount} of ${files.length} files`);
                setFiles([]);
                setUploadProgress({});
                onUploadComplete?.();
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
            onUploadEnd?.();
        }
    };

    return (
        <div className="space-y-4">
            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 hover:border-gray-400'
                    }
        `}
            >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                    {isDragActive
                        ? 'Drop files here...'
                        : 'Drag & drop files here, or click to select'
                    }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    Supports HAR files, screenshots, videos, and log files (max 50MB each)
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-medium">Files to upload:</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center space-x-3">
                                    {getFileIcon(file)}
                                    <div>
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {formatFileSize(file.size)} • {getFileType(file)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {uploadProgress[file.name] !== undefined && (
                                        <div className="text-xs text-gray-500">
                                            {uploadProgress[file.name]}%
                                        </div>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFile(index)}
                                        disabled={uploading}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Actions */}
            {files.length > 0 && (
                <div className="flex justify-between items-center">
                    <Button
                        variant="outline"
                        onClick={() => setFiles([])}
                        disabled={uploading}
                    >
                        Clear All
                    </Button>

                    <Button
                        onClick={handleUpload}
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
                    </Button>
                </div>
            )}

            {/* File Type Info */}
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                <div>
                    <strong className="text-gray-900">HAR Files:</strong> Network requests and responses
                </div>
                <div>
                    <strong className="text-gray-900">Screenshots:</strong> Visual bug reproduction
                </div>
                <div>
                    <strong className="text-gray-900">Videos:</strong> Screen recordings with audio
                </div>
                <div>
                    <strong className="text-gray-900">Logs:</strong> Application error logs
                </div>
            </div>
        </div>
    );
}
