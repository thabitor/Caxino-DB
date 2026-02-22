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

  const parseExcelFile = async (file: File): Promise<any[]> => {
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

          // Get all available columns from the first row
          const firstRow = jsonData[0] as Record<string, any>;
          const availableColumns = Object.keys(firstRow);
          console.log("Available columns:", availableColumns);

          // Column mapping - maps various column name formats to database fields
          const columnMap: Record<string, string[]> = {
            user_id: ["user_id", "userid", "id", "player_id", "playerid"],
            username: ["username", "user_name", "player_name", "playername", "name"],
            casino: ["casino", "casino_name", "casinoname", "site"],
            firstname: ["firstname", "first_name", "first name", "fname"],
            lastname: ["lastname", "last_name", "last name", "lname"],
            phone: ["phone", "phonenumber", "phone_number", "mobile", "telephone"],
            email: ["email", "e-mail", "emailaddress", "mail"],
            birthday: ["birthday", "dob", "date_of_birth", "dateofbirth", "birthdate"],
            vip_level: ["vip_level", "viplevel", "vip", "level"],
            total_deposits: ["total_deposits", "totaldeposits", "deposits"],
            last_deposit_date: ["last_deposit_date", "lastdepositdate", "last_deposit"],
            status: ["status", "player_status", "playerstatus", "account_status"],
            notes: ["notes", "note", "comments", "comment", "description"],
            last_contact_date: ["last_contact_date", "lastcontactdate", "last_contact"],
            preferred_contact_time: ["preferred_contact_time", "preferredcontacttime", "preferred_time", "contact_time"]
          };

          // Helper to find column value with flexible matching
          const getColumnValue = (row: Record<string, any>, dbField: string): any => {
            const possibleNames = columnMap[dbField] || [dbField];
            for (const name of possibleNames) {
              const key = Object.keys(row).find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
              if (key !== undefined && row[key] !== null && row[key] !== undefined && row[key] !== "") {
                return row[key];
              }
            }
            return null;
          };

          const players = jsonData.map((row: any, index: number) => {
            console.log(`Processing row ${index + 1}:`, row);

            const player: any = {};

            // Map all possible fields
            const user_id = getColumnValue(row, "user_id");
            const username = getColumnValue(row, "username");
            const casino = getColumnValue(row, "casino");
            const firstname = getColumnValue(row, "firstname");
            const lastname = getColumnValue(row, "lastname");
            const phone = getColumnValue(row, "phone");
            const email = getColumnValue(row, "email");
            const birthday = getColumnValue(row, "birthday");
            const vip_level = getColumnValue(row, "vip_level");
            const total_deposits = getColumnValue(row, "total_deposits");
            const last_deposit_date = getColumnValue(row, "last_deposit_date");
            const status = getColumnValue(row, "status");
            const notes = getColumnValue(row, "notes");
            const last_contact_date = getColumnValue(row, "last_contact_date");
            const preferred_contact_time = getColumnValue(row, "preferred_contact_time");

            // Add fields only if they have values
            if (user_id !== null) player.user_id = String(user_id).trim();
            if (username !== null) player.username = String(username).trim();
            if (casino !== null) player.casino = String(casino).trim();
            if (firstname !== null) player.firstname = String(firstname).trim();
            if (lastname !== null) player.lastname = String(lastname).trim();
            if (phone !== null) player.phone = String(phone).trim();
            if (email !== null) player.email = String(email).trim();
            if (birthday !== null) player.birthday = String(birthday).trim();
            if (vip_level !== null) player.vip_level = Number(vip_level) || 1;
            if (total_deposits !== null) player.total_deposits = Number(total_deposits) || 0;
            if (last_deposit_date !== null) player.last_deposit_date = String(last_deposit_date).trim();
            if (status !== null) player.status = String(status).trim();
            if (notes !== null) player.notes = String(notes).trim();
            if (last_contact_date !== null) player.last_contact_date = String(last_contact_date).trim();
            if (preferred_contact_time !== null) player.preferred_contact_time = String(preferred_contact_time).trim();

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
              <p>• <strong>Personal:</strong> firstname, lastname, phone, email, birthday</p>
              <p>• <strong>Account:</strong> vip_level, total_deposits, last_deposit_date, status</p>
              <p>• <strong>Contact:</strong> last_contact_date, preferred_contact_time, notes</p>
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