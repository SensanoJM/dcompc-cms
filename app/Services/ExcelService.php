<?php

namespace App\Services;

use App\Models\Client;
use Spatie\SimpleExcel\SimpleExcelReader;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class ExcelService
{
    /**
     * Import clients from Excel file
     */
    public function importClients($file): array
    {
        // Use SimpleExcelReader to read the file
        // Explicitly pass the extension because the temp file might not have one
        $rows = SimpleExcelReader::create($file->getPathname(), $file->getClientOriginalExtension())
            ->noHeaderRow()
            ->getRows();

        $imported = 0;
        $failed = 0;
        $errors = [];

        // Iterate through rows
        $rows->each(function(array $row, int $index) use (&$imported, &$failed, &$errors) {
            // Skip the first row (header)
            if ($index === 0) {
                // Log the header row to see what we're dealing with
                Log::info('Import Header Row:', $row);
                return;
            }

            $rowCollection = collect($row);

            // Skip empty rows
            if ($rowCollection->filter()->isEmpty()) {
                return;
            }

            // Log the first data row to debug mapping
            if ($index === 1) {
                Log::info('First Data Row:', $row);
            }

            // Map row data to client fields
            $clientData = $this->mapRowToClient($rowCollection);

            // Validate data
            $validator = Validator::make($clientData, [
                'client_id' => 'required|numeric',
                'name' => 'required|string|max:255',
                'fixed_deposit' => 'nullable|numeric',
                'savings' => 'nullable|numeric',
                'loan_balance' => 'nullable|numeric',
                'arrears' => 'nullable|numeric',
                'fines' => 'nullable|numeric',
                'mortuary' => 'nullable|numeric',
                'uploaded_date' => 'nullable|date',
                'period' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                $failed++;
                $rowErrors = $validator->errors()->all();
                $errors[] = [
                    'row' => $index + 1, // 1-based index (Excel row number)
                    'errors' => $rowErrors
                ];
                // Log the error for the first failure
                if ($failed === 1) {
                    Log::error('Validation Error Row ' . ($index + 1) . ':', ['data' => $clientData, 'errors' => $rowErrors]);
                }
                return;
            }

            try {
                Client::create($clientData);
                $imported++;
            } catch (\Exception $e) {
                $failed++;
                $errors[] = [
                    'row' => $index + 1,
                    'errors' => [$e->getMessage()]
                ];
            }
        });

        return [
            'imported' => $imported,
            'failed' => $failed,
            'errors' => $errors,
            'total_processed' => $imported + $failed
        ];
    }

    /**
     * Map Excel row to client data array
     * Expected columns: Client ID, Name, Fixed Deposit, Savings, Loan Balance, 
     *                   Arrears, Fines, Mortuary, Date, Period
     */
    private function mapRowToClient(Collection $row): array
    {
        // Safely get columns as strings
        $col0 = $this->safeString($row[0] ?? '');
        $col1 = $this->safeString($row[1] ?? '');

        // If the user added Client ID at index 0, then Name is at index 1.
        $clientId = is_numeric($col0) ? $col0 : null;
        $name = $col1;

        if (empty($name) && !empty($col0) && !is_numeric($col0)) {
            // Maybe column 0 is name?
            $name = $col0;
        }

        return [
            'client_id' => $clientId,
            'name' => $name,
            'fixed_deposit' => $this->parseNumeric($row[2] ?? 0),
            'savings' => $this->parseNumeric($row[3] ?? 0),
            'loan_balance' => $this->parseNumeric($row[4] ?? 0),
            'arrears' => $this->parseNumeric($row[5] ?? 0),
            'fines' => $this->parseNumeric($row[6] ?? 0),
            'mortuary' => $this->parseNumeric($row[7] ?? 0),
            'uploaded_date' => $this->parseDate($row[8] ?? now()),
            'period' => $this->safeString($row[9] ?? null),
        ];
    }

    /**
     * Parse numeric value from Excel cell
     */
    private function parseNumeric($value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }
        
        $strVal = $this->safeString($value);
        
        // Remove currency symbols and commas
        $cleaned = preg_replace('/[^\d.-]/', '', $strVal);
        return (float) $cleaned ?: 0.00;
    }

    /**
     * Parse date from Excel cell
     */
    private function parseDate($value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if (is_numeric($value)) {
            // Excel date serial number (days since Dec 30, 1899)
            try {
                return Carbon::createFromDate(1899, 12, 30)->addDays((int)$value)->format('Y-m-d');
            } catch (\Exception $e) {
                // Fallback
            }
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return now()->format('Y-m-d');
        }
    }

    /**
     * Safely convert value to string
     */
    private function safeString($value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        
        if (is_object($value)) {
            if (method_exists($value, '__toString')) {
                return (string) $value;
            }
            return '';
        }

        return trim((string) $value);
    }

    /**
     * Export clients to Excel file
     */
    public function exportClients(array $filters = [])
    {
        $query = Client::query();

        // Apply filters (same as ClientController)
        if (!empty($filters['search'])) {
            $query->search($filters['search']);
        }

        if (!empty($filters['period'])) {
            $query->byPeriod($filters['period']);
        }

        if (!empty($filters['date_from']) && !empty($filters['date_to'])) {
            $query->byDateRange($filters['date_from'], $filters['date_to']);
        }

        if (!empty($filters['with_arrears'])) {
            $query->withArrears();
        }

        if (!empty($filters['with_loans'])) {
            $query->withLoans();
        }

        $filename = 'clients_export_' . now()->format('Y-m-d_His') . '.xlsx';
        
        $writer = SimpleExcelWriter::streamDownload($filename);
        
        $writer->addRow([
            'Client ID', 'Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 
            'Arrears', 'Fines', 'Mortuary', 'Date Uploaded', 'Period', 
            'Total Assets', 'Total Liabilities', 'Net Worth', 'Times Scheduled'
        ]);

        $query->chunk(1000, function ($clients) use ($writer) {
            foreach ($clients as $client) {
                $writer->addRow([
                    $client->client_id,
                    $client->name,
                    number_format($client->fixed_deposit, 2),
                    number_format($client->savings, 2),
                    number_format($client->loan_balance, 2),
                    number_format($client->arrears, 2),
                    number_format($client->fines, 2),
                    number_format($client->mortuary, 2),
                    $client->uploaded_date ? $client->uploaded_date->format('Y-m-d') : '',
                    $client->period,
                    number_format($client->total_assets, 2),
                    number_format($client->total_liabilities, 2),
                    number_format($client->net_worth, 2),
                    $client->times_scheduled,
                ]);
            }
        });

        return $writer->toBrowser();
    }

    /**
     * Download blank import template
     */
    public function downloadTemplate()
    {
        $writer = SimpleExcelWriter::streamDownload('clients_import_template.xlsx');
        
        $writer->addRows([
            ['Client ID', 'Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 'Arrears', 'Fines', 'Mortuary', 'Date', 'Period'],
            ['1001', 'Juan Dela Cruz', '10000.00', '5000.00', '15000.00', '500.00', '100.00', '200.00', '2024-01-15', '2024-Q1'],
        ]);

        return $writer->toBrowser();
    }
}