<?php

namespace App\Services;

use App\Models\Client;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class ExcelService
{
    /**
     * Import clients from Excel file
     */
    public function importClients($file): array
    {
        $data = Excel::toCollection(null, $file)->first();
        
        // Remove header row
        $headers = $data->first();
        $rows = $data->slice(1);

        $imported = 0;
        $failed = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            // Skip empty rows
            if ($row->filter()->isEmpty()) {
                continue;
            }

            // Map row data to client fields
            $clientData = $this->mapRowToClient($row);

            // Validate data
            $validator = Validator::make($clientData, [
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'fixed_deposit' => 'nullable|numeric|min:0',
                'savings' => 'nullable|numeric|min:0',
                'loan_balance' => 'nullable|numeric|min:0',
                'arrears' => 'nullable|numeric|min:0',
                'fines' => 'nullable|numeric|min:0',
                'mortuary' => 'nullable|numeric|min:0',
                'uploaded_date' => 'nullable|date',
                'period' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                $failed++;
                $errors[] = [
                    'row' => $index + 2, // +2 because of header and 0-index
                    'errors' => $validator->errors()->all()
                ];
                continue;
            }

            try {
                Client::create($clientData);
                $imported++;
            } catch (\Exception $e) {
                $failed++;
                $errors[] = [
                    'row' => $index + 2,
                    'errors' => [$e->getMessage()]
                ];
            }
        }

        return [
            'imported' => $imported,
            'failed' => $failed,
            'errors' => $errors,
            'total_processed' => $imported + $failed
        ];
    }

    /**
     * Map Excel row to client data array
     * Expected columns: First Name, Last Name, Fixed Deposit, Savings, Loan Balance, 
     *                   Arrears, Fines, Mortuary, Date, Period
     */
    private function mapRowToClient(Collection $row): array
    {
        return [
            'first_name' => $row[0] ?? '',
            'last_name' => $row[1] ?? '',
            'fixed_deposit' => $this->parseNumeric($row[2] ?? 0),
            'savings' => $this->parseNumeric($row[3] ?? 0),
            'loan_balance' => $this->parseNumeric($row[4] ?? 0),
            'arrears' => $this->parseNumeric($row[5] ?? 0),
            'fines' => $this->parseNumeric($row[6] ?? 0),
            'mortuary' => $this->parseNumeric($row[7] ?? 0),
            'uploaded_date' => $this->parseDate($row[8] ?? now()),
            'period' => $row[9] ?? null,
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
        
        // Remove currency symbols and commas
        $cleaned = preg_replace('/[^\d.-]/', '', $value);
        return (float) $cleaned ?: 0.00;
    }

    /**
     * Parse date from Excel cell
     */
    private function parseDate($value): string
    {
        if (is_numeric($value)) {
            // Excel date serial number
            return Date::excelToDateTimeObject($value)->format('Y-m-d');
        }

        try {
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return now()->format('Y-m-d');
        }
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

        $clients = $query->get();

        // Create export data
        $exportData = $this->prepareExportData($clients);

        $filename = 'clients_export_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download(
            new ClientsExport($exportData),
            $filename
        );
    }

    /**
     * Prepare data for export
     */
    private function prepareExportData(Collection $clients): array
    {
        $data = [
            ['First Name', 'Last Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 
             'Arrears', 'Fines', 'Mortuary', 'Date Uploaded', 'Period', 
             'Total Assets', 'Total Liabilities', 'Net Worth', 'Times Scheduled']
        ];

        foreach ($clients as $client) {
            $data[] = [
                $client->first_name,
                $client->last_name,
                number_format($client->fixed_deposit, 2),
                number_format($client->savings, 2),
                number_format($client->loan_balance, 2),
                number_format($client->arrears, 2),
                number_format($client->fines, 2),
                number_format($client->mortuary, 2),
                $client->uploaded_date->format('Y-m-d'),
                $client->period,
                number_format($client->total_assets, 2),
                number_format($client->total_liabilities, 2),
                number_format($client->net_worth, 2),
                $client->times_scheduled,
            ];
        }

        return $data;
    }

    /**
     * Download blank import template
     */
    public function downloadTemplate()
    {
        $data = [
            ['First Name', 'Last Name', 'Fixed Deposit', 'Savings', 'Loan Balance', 
             'Arrears', 'Fines', 'Mortuary', 'Date', 'Period'],
            ['Juan', 'Dela Cruz', '10000.00', '5000.00', '15000.00', 
             '500.00', '100.00', '200.00', '2024-01-15', '2024-Q1'],
        ];

        return Excel::download(
            new ClientsExport($data),
            'clients_import_template.xlsx'
        );
    }
}