import { useState, useCallback } from "react";
import { Upload, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { analyzeImageWithGemini } from "@/lib/api";
import { supabase, SUPABASE_TABLE } from '@/lib/supabase';

interface UploadSectionProps {
  onFileUpload?: (file: File) => void;
}

export function UploadSection({ onFileUpload }: UploadSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<{ filename: string; result: string; confidence: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    // Allow image or video mime types. If mime is missing, infer from extension.
    const mime = file.type || '';
    let isImage = mime.startsWith('image/');
    let isVideo = mime.startsWith('video/');
    if (!isImage && !isVideo && file.name) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (['mp4','mov','webm','m4v','avi'].includes(ext)) isVideo = true;
      if (['jpg','jpeg','png','webp','gif'].includes(ext)) isImage = true;
    }
    if (!isImage && !isVideo) {
      setError("Unsupported file type. Please upload an image (JPG/PNG) or a video (MP4, MOV). If your file has an uncommon extension, please rename it.");
      return;
    }

    // Enforce 20 MB file size limit
    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError('File is too large. Maximum allowed size is 20 MB.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      // Read thumbnail for images as data URL and include fileType
      const isImage = file.type.startsWith('image/');
      let thumb: string | undefined = undefined;
      if (isImage) {
        thumb = await new Promise<string | undefined>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const r = reader.result as string | null;
            resolve(r ?? undefined);
          };
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }

      // Call Gemini
      const res = await analyzeImageWithGemini(file);
      const detection = {
        filename: file.name,
        result: res.result,
        confidence: res.confidence,
        fileType: isImage ? 'image' : 'video',
        thumbnail: thumb,
      };

  setResult(detection);

      // Persist last detection for ResultsDisplay (local dev storage)
      try {
        localStorage.setItem('lastDetection', JSON.stringify({ filename: detection.filename, result: detection.result, confidence: detection.confidence, fileType: detection.fileType, thumbnail: detection.thumbnail }));
      } catch (e) {
        // ignore storage errors
      }
      // Frontend Supabase save (browser) if configured
      try {
        if (supabase) {
          const { error } = await supabase
            .from(SUPABASE_TABLE)
            .insert([{ file: detection.filename, result: detection.result, confidence: detection.confidence }]);
          if (error) console.warn('Supabase insert (frontend) failed:', error.message || error);
        }
      } catch (e) {
        console.warn('Supabase insert (frontend) exception:', (e as any)?.message || e);
      }

      if (onFileUpload) onFileUpload(file);
    } catch (e: any) {
      console.error('Analysis failed', e);
      setError(e?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [onFileUpload]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  

  return (
    <Card className="w-full max-w-2xl mx-auto animate-scale-in">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl animate-fade-in">Upload Image for Deepfake Detection</CardTitle>
        <CardDescription className="animate-fade-in">
          Upload a JPG or PNG image to check if it's authentic or a deepfake
        </CardDescription>
  </CardHeader>
      <CardContent>
  <div
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 hover-scale",
            isDragOver
              ? "border-primary bg-primary/5 animate-pulse"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center hover-scale">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Drag and drop your image or video here</h3>
                <p className="text-sm text-muted-foreground">
                  Supports images (JPG, PNG) and videos (MP4, MOV)
                </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground hover-scale">
                <Image className="w-4 h-4" />
                <span>Images</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="px-6 hover-scale">
                Choose File
              </Button>
            </div>
            {loading && <div className="mt-4 text-sm">Analyzing...</div>}
            {result && (
              <div className="mt-4 p-3 border rounded">
                <div className="font-medium">{result.filename}</div>
                <div>Result: {result.result}</div>
                <div>Confidence: {(result.confidence * 100 || 0).toFixed(2)}%</div>
              </div>
            )}
            {error && (
              <div className="mt-4 p-3 border rounded border-red-300 text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}