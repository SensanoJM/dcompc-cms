<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\ExcelService;
use Illuminate\Support\Facades\Log;

class ExcelController extends Controller
{
    protected $excelService;

    public function __construct(ExcelService $excelService)
    {
        $this->excelService = $excelService;
    }

    /**
     * Import clients from Excel file
     */
    public function import(Request $request)
    {
        Log::info('ExcelController: Import request received.');

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            Log::info('File details:', [
                'original_name' => $file->getClientOriginalName(),
                'extension' => $file->getClientOriginalExtension(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        } else {
            Log::error('ExcelController: No file found in request.');
        }

        try {
            $result = $this->excelService->importClients($request->file('file'));
            
            Log::info('ExcelController: Import successful.', $result);

            return response()->json([
                'success' => true,
                'message' => 'Import completed successfully',
                'data' => $result
            ]);

        } catch (\Exception $e) {
            Log::error('ExcelController: Import exception.', ['message' => $e->getMessage()]);
            
            return response()->json([
                'success' => false,
                'message' => 'Import failed: ' . $e->getMessage()
            ], 422);
        }
    }

    /**
     * Export clients to Excel file
     */
    public function export(Request $request)
    {
        try {
            // Get filters from request
            $filters = $request->only([
                'search',
                'period',
                'date_from',
                'date_to',
                'with_arrears',
                'with_loans'
            ]);

            return $this->excelService->exportClients($filters);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Export failed: ' . $e->getMessage()
            ], 422);
        }
    }

    /**
     * Download Excel template for import
     */
    public function downloadTemplate()
    {
        return $this->excelService->downloadTemplate();
    }
}
