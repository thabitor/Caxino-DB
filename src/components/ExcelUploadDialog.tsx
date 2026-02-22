import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { bulkCreatePlayers, type PlayerInsert } from "@/services/playerService";

interface ExcelUploadDialogProps {
  onUploadComplete?: () => void;
}

export function ExcelUploadDialog({ onUploadComplete }: ExcelUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const parseExcelFile = async (file: File): Promise<Partial<PlayerInsert>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const players: Partial<PlayerInsert>[] = jsonData.map((row: any) => {
            const player: Partial<PlayerInsert> = {};

            // Handle Name splitting
            const fullName = String(row.name || row.Name || row.NAME || "");
            if (fullName) {
              const parts = fullName.trim().split(/\s+/);
              if (parts.length > 0) {
                player.firstname = parts[0];
                player.lastname = parts.length > 1 ? parts.slice(1).join(" ") : "";
              }
            } else {
              // Try direct firstname/lastname columns if full name isn't present
              if (row.firstname || row.Firstname || row.FIRSTNAME) {
                player.firstname = String(row.firstname || row.Firstname || row.FIRSTNAME);
              }
              if (row.lastname || row.Lastname || row.LASTNAME) {
                player.lastname = String(row.lastname || row.Lastname || row.LASTNAME);
              }
            }

            if (row.phone || row.Phone || row.PHONE) {
              player.phone = String(row.phone || row.Phone || row.PHONE);
            }
            if (row.email || row.Email || row.EMAIL) {
              player.email = String(row.email || row.Email || row.EMAIL);
            }
            // Fix birthday/dob mapping
            if (row.birthday || row.Birthday || row.BIRTHDAY || row.dob || row.DOB) {
              player.dob = String(row.birthday || row.Birthday || row.BIRTHDAY || row.dob || row.DOB);
            }
            // Fix deposit amount mapping (assuming casino/custom fields logic might be needed, but sticking to standard fields for now)
            // Note: 'deposit_amount', 'frequency', 'preferred_time' might be in a JSON 'preferences' field or specific columns if schema supports them.
            // Checking schema via context: 'preferences' is Json. 'deposit_amount' is NOT in the top level type inferred from previous errors (property 'Insert'...).
            // Let's assume for now we put these extras into 'notes' or 'preferences' if they don't exist on PlayerInsert.
            // Wait, looking at previous error: "Property 'Insert' does not exist on type '{ casino: string; ... preferences: Json; ... vip_level: number; }'"
            // It lists: casino, created_at, dob, email, firstname, gender, id, last_email_sent, lastname, notes, phone, preferences, vip_level.
            // So 'deposit_amount', 'frequency', 'preferred_time' are likely NOT top level columns.
            // I should construct the preferences JSON object for these.
            
            const preferences: Record<string, any> = {};
            
            if (row.deposit_amount || row["Deposit Amount"] || row.DEPOSIT_AMOUNT) {
              preferences.deposit_amount = row.deposit_amount || row["Deposit Amount"] || row.DEPOSIT_AMOUNT;
            }
            if (row.frequency || row.Frequency || row.FREQUENCY) {
              preferences.frequency = String(row.frequency || row.Frequency || row.FREQUENCY);
            }
            if (row.last_contact_date || row["Last Contact Date"] || row.LAST_CONTACT_DATE) {
              preferences.last_contact_date = String(row.last_contact_date || row["Last Contact Date"] || row.LAST_CONTACT_DATE);
            }
            if (row.preferred_time || row["Preferred Time"] || row.PREFERRED_TIME) {
              preferences.preferred_time = String(row.preferred_time || row["Preferred Time"] || row.PREFERRED_TIME);
            }
            
            if (Object.keys(preferences).length > 0) {
              player.preferences = preferences;
            }

            if (row.notes || row.Notes || row.NOTES) {
              player.notes = String(row.notes || row.Notes || row.NOTES);
            }
            
            // Set default VIP level if not provided (required field usually)
            player.vip_level = 3; // Default to lowest VIP level

            return player;
          });

          resolve(players);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadResult(null);

    try {
      const players = await parseExcelFile(file);
      
      if (players.length === 0) {
        toast({
          title: "No data found",
          description: "The Excel file appears to be empty",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const result = await bulkCreatePlayers(players);
      
      setUploadResult(result);
      
      if (result.success > 0) {
        toast({
          title: "Upload complete",
          description: `Successfully uploaded ${result.success} player(s)`,
        });
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      }

      if (result.failed > 0) {
        toast({
          title: "Upload completed with errors",
          description: `${result.failed} player(s) failed to upload`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setUploadResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Players from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx or .xls) containing player data. All fields are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
              disabled={isProcessing}
            />
            <label htmlFor="excel-upload" className="cursor-pointer">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Excel files (.xlsx, .xls)
              </p>
            </label>
          </div>

          {file && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Selected file:</span> {file.name}
              </AlertDescription>
            </Alert>
          )}

          {uploadResult && (
            <div className="space-y-2">
              {uploadResult.success > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Successfully uploaded {uploadResult.success} player(s)
                  </AlertDescription>
                </Alert>
              )}
              
              {uploadResult.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">
                      {uploadResult.failed} player(s) failed to upload
                    </p>
                    <ul className="text-xs space-y-1 mt-2">
                      {uploadResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Expected columns (all optional):</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>• name, phone, email, birthday</p>
              <p>• deposit_amount, frequency, last_contact_date</p>
              <p>• preferred_time, notes</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Close
          </Button>
          <Button onClick={handleUpload} disabled={!file || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}