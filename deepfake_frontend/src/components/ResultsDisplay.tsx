import { CheckCircle, XCircle, Image as ImageIcon, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DetectionResult {
  status: "fake" | "real";
  confidence: number;
  fileName: string;
  fileType: "image" | "video";
  thumbnail?: string;
}

interface ResultsDisplayProps {
  // props ignored — component reads only localStorage('lastDetection')
}

export function ResultsDisplay(_: ResultsDisplayProps) {
  // Read only from localStorage key 'lastDetection' with exact shape:
  // { filename: string, result: string ('Real'|'Fake'), confidence: number (0-1) }
  let parsed: any = null;
  try {
    const raw = localStorage.getItem('lastDetection');
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch (e) {
    return null;
  }

  // Validate exact expected fields
  if (
    !parsed ||
    typeof parsed.filename !== 'string' ||
    typeof parsed.result !== 'string' ||
    (typeof parsed.confidence !== 'number')
  ) {
    return null;
  }

  const statusStr = parsed.result.toLowerCase();
  const status = statusStr.includes('fake') ? 'fake' : statusStr.includes('real') ? 'real' : null;
  if (!status) return null;

  // Normalize confidence: expect 0-1 float. If value >1 assume percent and clamp.
  let confidenceRaw = Number(parsed.confidence || 0);
  let confidencePercent = 0;
  if (confidenceRaw > 1) {
    confidencePercent = Math.round(confidenceRaw);
  } else {
    confidencePercent = Math.round(confidenceRaw * 100);
  }
  confidencePercent = Math.max(0, Math.min(100, confidencePercent));

  const active: DetectionResult = {
    status: status as 'fake' | 'real',
    confidence: confidencePercent,
    fileName: parsed.filename,
    fileType: parsed.fileType === 'video' ? 'video' : 'image',
    thumbnail: parsed.thumbnail || undefined,
  };

  const isFake = active.status === 'fake';
  
  return (
    <Card className="w-full max-w-2xl mx-auto animate-scale-in">
      <CardHeader>
        <div className="flex items-center justify-between animate-fade-in">
          <CardTitle className="text-xl">Detection Results</CardTitle>
          <Badge 
            variant={isFake ? "destructive" : "default"}
            className={cn(
              "px-3 py-1 hover-scale animate-pulse",
              isFake 
                ? "bg-destructive text-destructive-foreground" 
                : "bg-success text-success-foreground"
            )}
          >
            {isFake ? (
              <XCircle className="w-4 h-4 mr-1" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-1" />
            )}
            {active.status.toUpperCase()}
          </Badge>
        </div>
          <CardDescription className="animate-fade-in">
          Analysis completed for {active.fileName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-4 animate-fade-in">
          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center hover-scale">
            {active.thumbnail ? (
              <img 
                src={active.thumbnail} 
                alt="Uploaded file"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <>
                {active.fileType === "image" ? (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <Video className="w-8 h-8 text-muted-foreground" />
                )}
              </>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-medium">{active.fileName}</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {active.fileType} file
            </p>
          </div>
        </div>

        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence Score</span>
            <span className="text-sm text-muted-foreground">{active.confidence}%</span>
          </div>
          <Progress 
            value={active.confidence} 
            className={cn(
              "h-2 animate-scale-in",
              isFake && "[&>div]:bg-destructive",
              !isFake && "[&>div]:bg-success"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {isFake 
              ? "This file appears to be artificially generated or manipulated."
              : "This file appears to be authentic and unmodified."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}