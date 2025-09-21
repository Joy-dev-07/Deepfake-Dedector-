import { useEffect, useState } from "react";
import { Home, History, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { supabase, SUPABASE_TABLE } from "@/lib/supabase";

interface HistoryItem {
  id: string;
  fileName: string;
  fileType: "image" | "video";
  result: "fake" | "real";
  confidence: number;
  createdAt: Date;
  thumbnail?: string;
}

interface SidebarProps {
  className?: string;
  currentView: "home" | "history";
  onViewChange: (view: "home" | "history") => void;
  history: HistoryItem[];
}

const navigation = [
  { name: "Home", icon: Home, view: "home" as const },
  { name: "History", icon: History, view: "history" as const },
];

export function Sidebar({ className, currentView, onViewChange, history }: SidebarProps) {
  const [items, setItems] = useState<HistoryItem[]>(history || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchRecent() {
      try {
        if (!supabase) return; // fallback to provided prop
        setLoading(true);
        const { data, error } = await supabase
          .from(SUPABASE_TABLE)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (cancelled) return;
        const mapped: HistoryItem[] = (data || []).map((r: any) => ({
          id: String(r.id),
          fileName: r.file || r.filename || 'file',
          fileType: 'image',
          result: (String(r.result || 'unknown').toLowerCase() === 'fake') ? 'fake' : 'real',
          confidence: Number(r.confidence || 0),
          createdAt: new Date(r.created_at || Date.now()),
        }));
        setItems(mapped);
      } catch (e) {
        // keep fallback items
        if (import.meta.env.DEV) console.warn('Sidebar history fetch failed:', (e as any)?.message || e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRecent();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className={cn("w-64 bg-card border-r border-border flex flex-col animate-slide-in-right", className)}>
      <div className="p-6">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.name}
                onClick={() => onViewChange(item.view)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover-scale",
                  isActive
                    ? "bg-primary/10 text-primary animate-fade-in"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* History Section */}
      {currentView === "history" && (
        <div className="flex-1 px-6 pb-6 animate-fade-in">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Detections
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading && (
                <div className="text-xs text-muted-foreground">Loading...</div>
              )}
              {!loading && items.length === 0 && (
                <div className="text-xs text-muted-foreground">No recent detections</div>
              )}
              {!loading && items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border bg-background/50 hover:bg-background transition-all duration-200 hover-scale cursor-pointer animate-scale-in"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs font-medium truncate">{item.fileName}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={item.result === "fake" ? "destructive" : "default"}
                          className="text-xs px-1.5 py-0.5"
                        >
                          {item.result.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.confidence}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}