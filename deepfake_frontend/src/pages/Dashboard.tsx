import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { UploadSection } from "@/components/UploadSection";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { HistorySection } from "@/components/HistorySection";
import { useToast } from "@/hooks/use-toast";

interface DetectionResult {
  id: string;
  status: "fake" | "real";
  confidence: number;
  fileName: string;
  fileType: "image" | "video";
  thumbnail?: string;
  createdAt: Date;
}

// For compatibility with HistorySection
interface HistoryItem extends DetectionResult {
  result: "fake" | "real";
}

export default function Dashboard() {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "history">("home");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    
    // Simulate API call to backend
    try {
      // Create thumbnail if it's an image
      let thumbnail: string | undefined;
      if (file.type.startsWith('image/')) {
        thumbnail = URL.createObjectURL(file);
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock detection result
      const mockResult: HistoryItem = {
        id: Date.now().toString(),
        status: Math.random() > 0.5 ? "fake" : "real",
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
        fileName: file.name,
        fileType: file.type.startsWith('image/') ? "image" : "video",
        thumbnail,
        createdAt: new Date(),
        result: Math.random() > 0.5 ? "fake" : "real", // For compatibility
      };
      
      setResult(mockResult);
      
      // Add to history
      setHistory(prev => [mockResult, ...prev]);
      
      toast({
        title: "Analysis Complete",
        description: `File "${file.name}" has been analyzed successfully.`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "There was an error analyzing your file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    toast({
      title: "History Cleared",
      description: "All detection history has been cleared.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="flex">
        <Sidebar 
          currentView={currentView}
          onViewChange={setCurrentView}
          history={history}
        />
        
        <main className="flex-1 p-8 space-y-8 animate-fade-in">
          <div className="max-w-6xl mx-auto space-y-8">
            {currentView === "home" ? (
              <>
                {/* Platform Usage Section */}
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-6 border animate-scale-in">
                  <h2 className="text-xl font-semibold mb-4 text-foreground">How to Use Deepfake Detector</h2>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start gap-3 hover-scale">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-primary font-semibold text-xs">1</span>
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Upload Media</h3>
                        <p className="text-muted-foreground">Drag & drop or click to upload images or videos for analysis</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 hover-scale">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-primary font-semibold text-xs">2</span>
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">AI Analysis</h3>
                        <p className="text-muted-foreground">Our AI analyzes the media for deepfake signatures and artifacts</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 hover-scale">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-primary font-semibold text-xs">3</span>
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Get Results</h3>
                        <p className="text-muted-foreground">View detection results with confidence scores and detailed analysis</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Section */}
                <div className="space-y-4">
                  <UploadSection onFileUpload={handleFileUpload} />
                  
                  {isAnalyzing && (
                    <div className="text-center py-8 animate-fade-in">
                      <div className="inline-flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Analyzing file...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Results Section */}
                {result && !isAnalyzing && (
                  <ResultsDisplay result={result} />
                )}
              </>
            ) : (
              /* History View */
              <HistorySection 
                history={history}
                onClearHistory={handleClearHistory}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}