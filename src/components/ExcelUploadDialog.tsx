import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { bulkCreatePlayers } from "@/services/playerService";
import type { Database } from "@/integrations/supabase/types";

interface ExcelUploadDialogProps {
  onUploadComplete?: () => void;
}

type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];

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

          console.log("Raw Excel data:", jsonData);

          if (!jsonData || jsonData.length === 0) {
            resolve([]);
            return;
          }

          // Column mapping - maps Excel column names to database field names
          // Each database field maps to multiple possible Excel header variations
          const columnMapping: Record<string, string[]> = {
            user_id: ["user_id", "userid", "id"],
            username: ["username", "user_name"],
            casino: ["casino"],
            firstname: ["firstname", "first_name"],
            lastname: ["lastname", "last_name"],
            phone: ["phone"],
            email: ["email"],
            dob: ["dob", "birthday", "date_of_birth"],
            gender: ["gender"],
            vip_level: ["vip_level", "viplevel", "vip"],
            total_deposits: ["total_deposits", "totaldeposits", "deposits"],
            last_email_sent: ["last_email_sent", "lastemailsent"],
            account_status: ["account_status", "accountstatus"],
            notes: ["notes"],
            preferred_time_from: ["preferred_time_from", "preferredtimefrom"],
            preferred_time_to: ["preferred_time_to", "preferredtimeto"],
          };

          // Helper to find column value with flexible matching
          const getColumnValue = (row: Record<string, any>, dbField: string): any => {
            const possibleHeaders = columnMapping[dbField] || [dbField];
            
            for (const header of possibleHeaders) {
              // Find key in row that matches (case-insensitive, trimmed)
              const key = Object.keys(row).find(k => 
                k.toLowerCase().trim().replace(/\s+/g, "_") === header.toLowerCase().trim().replace(/\s+/g, "_")
              );
              
              if (key !== undefined && row[key] !== null && row[key] !== undefined && row[key] !== "") {
                return row[key];
              }
            }
            return null;
          };

          const players = jsonData.map((row: any, index: number) => {
            console.log(`Processing row ${index + 1}:`, row);

            const player: Partial<PlayerInsert> = {};

            // Map all possible fields
            const user_id = getColumnValue(row, "user_id");
            const username = getColumnValue(row, "username");
            const casino = getColumnValue(row, "casino");
            const firstname = getColumnValue(row, "firstname");
            const lastname = getColumnValue(row, "lastname");
            const phone = getColumnValue(row, "phone");
            const email = getColumnValue(row, "email");
            const dob = getColumnValue(row, "dob");
            const gender = getColumnValue(row, "gender");
            const vip_level = getColumnValue(row, "vip_level");
            const total_deposits = getColumnValue(row, "total_deposits");
            const last_email_sent = getColumnValue(row, "last_email_sent");
            const account_status = getColumnValue(row, "account_status");
            const notes = getColumnValue(row, "notes");
            const preferred_time_from = getColumnValue(row, "preferred_time_from");
            const preferred_time_to = getColumnValue(row, "preferred_time_to");

            // Add fields only if they have values
            if (user_id !== null) player.user_id = String(user_id).trim();
            if (username !== null) player.username = String(username).trim();
            if (casino !== null) player.casino = String(casino).trim();
            if (firstname !== null) player.firstname = String(firstname).trim();
            if (lastname !== null) player.lastname = String(lastname).trim();
            if (phone !== null) player.phone = String(phone).trim();
            if (email !== null) player.email = String(email).trim();
            if (dob !== null) player.dob = String(dob).trim();
            if (gender !== null) player.gender = String(gender).trim();
            if (vip_level !== null) player.vip_level = Number(vip_level) || 3;
            if (total_deposits !== null) player.total_deposits = Number(total_deposits) || 0;
            if (last_email_sent !== null) player.last_email_sent = String(last_email_sent).trim();
            if (account_status !== null) player.account_status = String(account_status).trim();
            if (notes !== null) player.notes = String(notes).trim();
            if (preferred_time_from !== null) player.preferred_time_from = Number(preferred_time_from);
            if (preferred_time_to !== null) player.preferred_time_to = Number(preferred_time_to);

            console.log(`Parsed player ${index + 1}:`, player);
            return player;
          });

          console.log("All parsed players:", players);
          
          // Filter out completely empty rows
          const validPlayers = players.filter(p => Object.keys(p).length > 0);
          console.log(`Valid players after filtering: ${validPlayers.length}`);
          
          resolve(validPlayers);
        } catch (error) {
          console.error("Error parsing Excel:", error);
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

    console.log("=== UPLOAD STARTED ===");
    console.log("File:", file.name, file.size, "bytes");
    setIsProcessing(true);
    setUploadResult(null);

    try {
      console.log("Starting file parse...");
      const players = await parseExcelFile(file);
      console.log("Parsed players:", players);
      console.log("Number of players:", players.length);
      
      if (players.length === 0) {
        console.log("No valid players found in Excel file");
        toast({
          title: "No data found",
          description: "The Excel file contains no valid player data. Please check that your file has data rows with at least one column filled.",
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
      console.log("=== UPLOAD FINISHED ===");
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
            <p className="text-sm font-medium mb-2">Supported columns (all optional):</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>• <strong>Identity:</strong> user_id, username, casino</p>
              <p>• <strong>Personal:</strong> firstname, lastname, phone, email, dob (date of birth), gender</p>
              <p>• <strong>Account:</strong> vip_level, total_deposits, last_email_sent, account_status</p>
              <p>• <strong>Contact:</strong> preferred_time_from, preferred_time_to, notes</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">
              Column names are flexible and case-insensitive (e.g., "user_id" = "UserID" = "User ID")
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