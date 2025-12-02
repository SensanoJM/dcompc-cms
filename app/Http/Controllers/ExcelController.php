<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

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
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        try {
            $result = $this->excelService->importClients($request->file('file'));

            return response()->json([
                'success' => true,
                'message' => 'Import completed successfully',
                'data' => $result
            ]);

        } catch (\Exception $e) {
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
