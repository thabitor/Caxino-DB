import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { bulkCreatePlayers } from "@/services/playerService";

interface ExcelUploadDialogProps {
  onUploadComplete?: () => void;
}

interface ExcelRow {
  [key: string]: any;
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

  const getColumnValue = (row: ExcelRow, ...possibleNames: string[]): string | undefined => {
    for (const name of possibleNames) {
      const lowerName = name.toLowerCase();
      const key = Object.keys(row).find(k => k.toLowerCase() === lowerName);
      if (key && row[key] !== null && row[key] !== undefined && row[key] !== "") {
        return String(row[key]).trim();
      }
    }
    return undefined;
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

          console.log("Raw Excel data:", jsonData);

          if (jsonData.length === 0) {
            resolve([]);
            return;
          }

          // Get available columns from first row
          const availableColumns = new Set(
            Object.keys(jsonData[0]).map(k => k.toLowerCase())
          );

          console.log("Available columns:", Array.from(availableColumns));

          const players = jsonData.map((row, index) => {
            const player: any = {};

            // Only process Name if it exists
            if (availableColumns.has("name") || availableColumns.has("full name") || availableColumns.has("fullname")) {
              const fullName = getColumnValue(row, "name", "full name", "fullname");
              if (fullName) {
                const parts = fullName.split(/\s+/);
                if (parts.length > 0) {
                  player.firstname = parts[0];
                  player.lastname = parts.length > 1 ? parts.slice(1).join(" ") : "";
                }
              }
            }

            // Try direct firstname/lastname only if those columns exist
            if (availableColumns.has("firstname") || availableColumns.has("first name") || availableColumns.has("first_name")) {
              const firstname = getColumnValue(row, "firstname", "first name", "first_name");
              if (firstname) player.firstname = firstname;
            }

            if (availableColumns.has("lastname") || availableColumns.has("last name") || availableColumns.has("last_name")) {
              const lastname = getColumnValue(row, "lastname", "last name", "last_name");
              if (lastname) player.lastname = lastname;
            }

            // Only process phone if it exists
            if (availableColumns.has("phone") || availableColumns.has("telephone") || availableColumns.has("mobile")) {
              const phone = getColumnValue(row, "phone", "telephone", "mobile");
              if (phone) player.phone = phone;
            }

            // Only process email if it exists
            if (availableColumns.has("email") || availableColumns.has("e-mail") || availableColumns.has("email address")) {
              const email = getColumnValue(row, "email", "e-mail", "email address");
              if (email) player.email = email;
            }

            // Only process dob if it exists
            if (availableColumns.has("dob") || availableColumns.has("birthday") || availableColumns.has("date of birth") || availableColumns.has("birthdate")) {
              const dob = getColumnValue(row, "dob", "birthday", "date of birth", "birthdate");
              if (dob) player.dob = dob;
            }

            // Only process notes if it exists
            if (availableColumns.has("notes") || availableColumns.has("note") || availableColumns.has("comments") || availableColumns.has("comment")) {
              const notes = getColumnValue(row, "notes", "note", "comments", "comment");
              if (notes) player.notes = notes;
            }

            // Preferences - only process if columns exist
            const preferences: Record<string, any> = {};
            
            if (availableColumns.has("deposit_amount") || availableColumns.has("deposit amount") || availableColumns.has("deposit")) {
              const depositAmount = getColumnValue(row, "deposit_amount", "deposit amount", "deposit");
              if (depositAmount) preferences.deposit_amount = depositAmount;
            }

            if (availableColumns.has("frequency") || availableColumns.has("contact frequency")) {
              const frequency = getColumnValue(row, "frequency", "contact frequency");
              if (frequency) preferences.frequency = frequency;
            }

            if (availableColumns.has("last_contact_date") || availableColumns.has("last contact date") || availableColumns.has("last_contact")) {
              const lastContactDate = getColumnValue(row, "last_contact_date", "last contact date", "last_contact");
              if (lastContactDate) preferences.last_contact_date = lastContactDate;
            }

            if (availableColumns.has("preferred_time") || availableColumns.has("preferred time") || availableColumns.has("best time")) {
              const preferredTime = getColumnValue(row, "preferred_time", "preferred time", "best time");
              if (preferredTime) preferences.preferred_time = preferredTime;
            }

            if (Object.keys(preferences).length > 0) {
              player.preferences = preferences;
            }

            // Set default VIP level
            player.vip_level = 3;

            console.log(`Row ${index + 1} parsed:`, player);
            return player;
          });

          // Filter out completely empty rows - accept any player with at least one field
          const validPlayers = players.filter(p => Object.keys(p).length > 1); // More than just vip_level
          console.log("Valid players after filtering:", validPlayers);
          
          resolve(validPlayers);
        } catch (error) {
          console.error("Parse error:", error);
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
      console.log("Starting file parse...");
      const players = await parseExcelFile(file);
      console.log("Parsed players:", players);
      
      if (players.length === 0) {
        toast({
          title: "No data found",
          description: "The Excel file appears to be empty or contains no valid player data",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      console.log("Starting bulk upload...");
      const result = await bulkCreatePlayers(players);
      console.log("Upload result:", result);
      
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
                    <ul className="text-xs space-y-1 mt-2 max-h-32 overflow-y-auto">
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
              <p>• <strong>Basic:</strong> name (or firstname/lastname), phone, email, birthday/dob</p>
              <p>• <strong>Preferences:</strong> deposit_amount, frequency, last_contact_date, preferred_time</p>
              <p>• <strong>Other:</strong> notes</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">
              Column names are case-insensitive and flexible (e.g., "Email" = "email" = "E-mail")
            </p>
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