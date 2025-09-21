import { formatDistanceToNow } from "date-fns";
import { Trash2, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface HistoryItem {
  id: string;
  fileName: string;
  fileType: "image" | "video";
  result: "fake" | "real";
  confidence: number;
  createdAt: Date;
  thumbnail?: string;
}

import { useEffect, useState } from 'react';
import { supabase, SUPABASE_TABLE } from '@/lib/supabase';

interface HistorySectionProps {
  // optional callbacks for integration
  onClearHistory?: () => void;
}

export function HistorySection({ onClearHistory }: HistorySectionProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase client not configured');
      const { data: rows, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const items: HistoryItem[] = rows.map((r) => ({
        id: String(r.id),
        fileName: r.file || r.filename || 'file',
        fileType: 'image',
        result: (r.result || 'unknown').toLowerCase() === 'fake' ? 'fake' : 'real',
        confidence: Number(r.confidence || 0),
        createdAt: new Date(r.created_at || Date.now()),
        thumbnail: undefined,
      }));
      setHistory(items);
    } catch (e: any) {
      console.error('Failed to load history', e);
      setError(e?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);
  async function clearHistory() {
    try {
      if (!supabase) throw new Error('Supabase client not configured');
      const { error } = await supabase.from(SUPABASE_TABLE).delete().neq('id', 0);
      if (error) throw error;
      setHistory([]);
      if (onClearHistory) onClearHistory();
    } catch (e) {
      console.error('Clear history failed', e);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Recent History</CardTitle>
            <CardDescription>
              Your recent deepfake detection results
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No detection history yet</p>
            <p className="text-sm">Upload a file to get started</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          {item.thumbnail ? (
                            <img 
                              src={item.thumbnail} 
                              alt=""
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <>
                              {item.fileType === "image" ? (
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Video className="w-4 h-4 text-muted-foreground" />
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.fileName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {item.fileType}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.result === "fake" ? "destructive" : "default"}
                        className={cn(
                          "text-xs",
                          item.result === "fake"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-success text-success-foreground"
                        )}
                      >
                        {item.result.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{item.confidence}%</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}