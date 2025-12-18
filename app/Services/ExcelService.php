<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ClientFinancialRecord;
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
                return;
            }

            $rowCollection = collect($row);

            // Skip empty rows
            if ($rowCollection->filter()->isEmpty()) {
                return;
            }

            // Map row data
            $data = $this->mapRowToData($rowCollection);
            $clientData = $data['client'];
            $financialData = $data['financial'];

            // Validate foundational client data
            $clientValidator = Validator::make($clientData, [
                'client_id' => 'required|numeric',
                'name' => 'required|string|max:255',
            ]);

            if ($clientValidator->fails()) {
                $failed++;
                $errors[] = [
                    'row' => $index + 1,
                    'errors' => $clientValidator->errors()->all()
                ];
                return;
            }

            // Validate financial data
            $financialValidator = Validator::make($financialData, [
                'period' => 'required|string|max:255',
                'fixed_deposit' => 'nullable|numeric',
                'savings' => 'nullable|numeric',
                'loan_balance' => 'nullable|numeric',
                'arrears' => 'nullable|numeric',
                'fines' => 'nullable|numeric',
                'mortuary' => 'nullable|numeric',
                'uploaded_date' => 'nullable|date',
                // 'assigned_mediator' => 'nullable|string|max:255', // Removed from import
            ]);

             if ($financialValidator->fails()) {
                $failed++;
                $errors[] = [
                    'row' => $index + 1,
                    'errors' => $financialValidator->errors()->all()
                ];
                return;
            }

            try {
                // 1. Create or Update Client
                // Ensure client_id is cast to the correct type for lookup
                $clientId = (int) $clientData['client_id'];
                
                $client = Client::firstOrNew(['client_id' => $clientId]);
                $client->name = $clientData['name'];
                $client->save();

                // 2. Create or Update Financial Record for this Period
                // We use updateOrCreate to avoid duplicates for the same client+period
                $client->financialRecords()->updateOrCreate(
                    ['period' => $financialData['period']],
                    $financialData
                );

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
     * Map Excel row to data arrays for Client and FinancialRecord
     */
    private function mapRowToData(Collection $row): array
    {
        // Safely get columns
        $col0 = $this->safeString($row[0] ?? '');
        $col1 = $this->safeString($row[1] ?? '');

        // Logic for ID vs Name columns
        $clientId = is_numeric($col0) ? $col0 : null;
        $name = $col1;

        if (empty($name) && !empty($col0) && !is_numeric($col0)) {
            $name = $col0;
        }

        $data = [
            'client' => [
                'client_id' => $clientId,
                'name' => $name,
            ],
            'financial' => [
                'fixed_deposit' => $this->parseNumeric($row[2] ?? 0),
                'savings' => $this->parseNumeric($row[3] ?? 0),
                'loan_balance' => $this->parseNumeric($row[4] ?? 0),
                'arrears' => $this->parseNumeric($row[5] ?? 0),
                'fines' => $this->parseNumeric($row[6] ?? 0),
                'mortuary' => $this->parseNumeric($row[7] ?? 0),
                'uploaded_date' => $this->parseDate($row[8] ?? now()),
                'period' => $this->safeString($row[9] ?? 'Default'),
                'assigned_mediator' => $this->safeString($row[10] ?? null),
            ]
        ];

        Log::info('Mapped Row Data:', $data);

        return $data;
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
        // Join with financial records to filter and select columns
        $query = Client::query()
            ->join('client_financial_records', 'clients.client_id', '=', 'client_financial_records.client_id')
            ->select('clients.client_id', 'clients.name', 'client_financial_records.*');

        // Apply filters
        if (!empty($filters['search'])) {
            $query->where('clients.name', 'LIKE', "%{$filters['search']}%");
        }

        if (!empty($filters['period'])) {
            $query->where('client_financial_records.period', $filters['period']);
        }

        if (!empty($filters['date_from']) && !empty($filters['date_to'])) {
            $query->whereBetween('client_financial_records.uploaded_date', [$filters['date_from'], $filters['date_to']]);
        }

        if (!empty($filters['with_arrears'])) {
            $query->where('client_financial_records.arrears', '>', 0);
        }

        if (!empty($filters['with_loans'])) {
            $query->where('client_financial_records.loan_balance', '>', 0);
        }

        $filename = 'clients_export_' . now()->format('Y-m-d_His') . '.xlsx';
        
        $writer = SimpleExcelWriter::streamDownload($filename);
        
        $writer->addRow([
            'Client ID', 'Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 
            'Arrears', 'Fines', 'Mortuary', 'Date Uploaded', 'Period', 
            'Assigned Mediator'
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
                    $client->uploaded_date ? Carbon::parse($client->uploaded_date)->format('Y-m-d') : '',
                    $client->period,
                    $client->assigned_mediator ?? '',
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
            ['Client ID', 'Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 'Arrears', 'Fines', 'Mortuary', 'Date', 'Period', 'Mediator'],
            ['1001', 'Juan Dela Cruz', '10000.00', '5000.00', '15000.00', '500.00', '100.00', '200.00', '2024-01-15', '2024-Q1', 'Mediator A'],
        ]);

        return $writer->toBrowser();
    }
}