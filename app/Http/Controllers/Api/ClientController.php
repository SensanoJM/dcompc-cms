<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Client;
use App\Models\ClientFinancialRecord;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    /**
     * Return paginated clients as JSON for the frontend table.
     */
    public function index(Request $request)
    {
        // 1. Get all available unique periods
        $periods = ClientFinancialRecord::select('period')
            ->distinct()
            ->orderBy('period', 'desc')
            ->pluck('period');

        // 2. Determine the period to show
        $selectedPeriod = $request->input('period') ?? $periods->first();

        // 3. Start building the query
        $query = Client::query()->with('sessions');

        // 4. Join with financial records for the selected period
        // Inner join ensures we only get clients relevant to that period if a period exists.
        if ($selectedPeriod) {
            $query->join('client_financial_records', 'clients.client_id', '=', 'client_financial_records.client_id')
                  ->where('client_financial_records.period', $selectedPeriod)
                  ->select(
                       'clients.*',
                       DB::raw('COALESCE(client_financial_records.fixed_deposit, 0) as fixed_deposit'),
                       DB::raw('COALESCE(client_financial_records.savings, 0) as savings'),
                       DB::raw('COALESCE(client_financial_records.loan_balance, 0) as loan_balance'),
                       DB::raw('COALESCE(client_financial_records.arrears, 0) as arrears'),
                       DB::raw('COALESCE(client_financial_records.fines, 0) as fines'),
                       DB::raw('COALESCE(client_financial_records.mortuary, 0) as mortuary'),
                       'client_financial_records.period',
                       'client_financial_records.assigned_mediator'
                  );
        } else {
             $query->select('clients.*');
        }

        // 5. Search
        if ($request->filled('search')) {
            $query->where('clients.name', 'LIKE', "%{$request->search}%");
        }

        // 6. Additional Filters (on financial record columns)
        if ($selectedPeriod) {
            if ($request->boolean('with_arrears')) {
                $query->where('client_financial_records.arrears', '>', 0);
            }
            if ($request->boolean('with_loans')) {
                $query->where('client_financial_records.loan_balance', '>', 0);
            }
             // Filter by date range (uploaded_date in financial record)
            if ($request->filled('date_from') && $request->filled('date_to')) {
                $query->whereBetween('client_financial_records.uploaded_date', [$request->date_from, $request->date_to]);
            }
        }

        // 7. Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        if (in_array($sortBy, ['savings', 'loan_balance', 'arrears', 'fixed_deposit', 'fines', 'mortuary'])) {
             $query->orderBy("client_financial_records.$sortBy", $sortOrder);
        } elseif ($sortBy === 'name' || $sortBy === 'client_id') {
             $query->orderBy("clients.$sortBy", $sortOrder);
        } else {
             $query->orderBy("clients.created_at", $sortOrder);
        }

        // 8. Pagination
        $perPage = (int) $request->get('per_page', 20);
        $clients = $query->paginate($perPage)->withQueryString();

        // 9. Return structured response matching frontend expectation
        // Frontend expects: { success: true, data: [...], total: ..., periods: [], selected_period: ... }
        return response()->json([
            'success' => true,
            'data' => $clients->items(), // The actual array of client objects
            'total' => $clients->total(),
            'periods' => $periods,
            'selected_period' => $selectedPeriod,
            // Include pagination meta if needed by standard paginators, but our frontend consumes 'data' and 'total'
            'current_page' => $clients->currentPage(),
            'last_page' => $clients->lastPage(),
            'per_page' => $clients->perPage(),
        ]);
    }
}
