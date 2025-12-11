<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Client;
use App\Models\ClientFinancialRecord;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    /**
     * Display dashboard with clients table
     */
    public function index(Request $request)
    {
        // Get all available unique periods
        $periods = ClientFinancialRecord::select('period')
            ->distinct()
            ->orderBy('period', 'desc')
            ->pluck('period');

        // Determine the period to show:
        // 1. Request period
        // 2. Latest period available
        // 3. Or empty string if no data
        // 3. Or empty string if no data
        $selectedPeriod = $request->input('period') ?? $periods->first();

        $query = Client::query()->with('sessions');

        // Join with financial records to get the financial data for the selected period
        // We use leftJoin so clients without records in this specific period might still show up (with nulls), 
        // OR innerJoin if we only want clients valid for that period.
        // Given the requirement "filter... per period", Inner Join is probably safer to show only relevant clients.
        if ($selectedPeriod) {
            $query->join('client_financial_records', 'clients.client_id', '=', 'client_financial_records.client_id')
                  ->where('client_financial_records.period', $selectedPeriod)
                  ->select('clients.*', 
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
            // No periods exist at all? Just select clients
            $query->select('clients.*');
        }

        // Search by name
        if ($request->filled('search')) {
            $query->where('clients.name', 'LIKE', "%{$request->search}%");
        }

        // Filter by date range (uploaded_date in financial record)
        if ($request->filled('date_from') && $request->filled('date_to') && $selectedPeriod) {
            $query->whereBetween('client_financial_records.uploaded_date', [$request->date_from, $request->date_to]);
        }

        // Filter clients with arrears
        if ($request->boolean('with_arrears') && $selectedPeriod) {
            $query->where('client_financial_records.arrears', '>', 0);
        }

        // Filter clients with loans
        if ($request->boolean('with_loans') && $selectedPeriod) {
            $query->where('client_financial_records.loan_balance', '>', 0);
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Handle sorting by fields that might be ambiguous or mapped
        if (in_array($sortBy, ['savings', 'loan_balance', 'arrears', 'fixed_deposit', 'fines', 'mortuary'])) {
             // These are now on the joined table
             $query->orderBy("client_financial_records.$sortBy", $sortOrder);
        } elseif ($sortBy === 'name' || $sortBy === 'client_id') {
             $query->orderBy("clients.$sortBy", $sortOrder);
        } else {
             $query->orderBy("clients.created_at", $sortOrder);
        }

        // Paginate
        $clients = $query->paginate(20)->withQueryString();

        if ($request->wantsJson() && !$request->header('X-Inertia')) {
            return response()->json([
                'success' => true,
                'data' => $clients->items(),
                'total' => $clients->total(),
                'periods' => $periods,
                'selected_period' => $selectedPeriod
            ]);
        }

        return Inertia::render('Dashboard', [
            'clients' => $clients,
            'periods' => $periods,
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'with_arrears', 'with_loans']),
                ['period' => $selectedPeriod] // Return the effective period
            ),
        ]);
    }

    /**
     * Display single client details with sessions
     */
    public function show($id)
    {
        $client = Client::with(['sessions.mediators', 'financialRecords', 'sessions' => function ($query) {
            $query->orderBy('session_date', 'desc');
        }])->where('client_id', $id)->firstOrFail();

        return response()->json([
            'success' => true,
            'client' => [
                'client_id' => $client->client_id,
                'name' => $client->name,
                // Latest financial snapshot (optional, can be derived by frontend)
                'financial_records' => $client->financialRecords, 
                'sessions' => $client->sessions,
                'created_at' => $client->created_at->format('Y-m-d H:i:s'),
                'period' => $client->latestFinancial()?->period, // Add current period for context
            ]
        ]);
    }

    /**
     * Create new client (manual entry)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_id' => 'required|unique:clients,client_id|integer',
            'name' => 'required|string|max:255',
            'fixed_deposit' => 'nullable|numeric',
            'savings' => 'nullable|numeric',
            'loan_balance' => 'nullable|numeric',
            'arrears' => 'nullable|numeric',
            'fines' => 'nullable|numeric',
            'mortuary' => 'nullable|numeric',
            'uploaded_date' => 'nullable|date',
            'period' => 'required|string|max:255', // Enforce period for data entry
            'assigned_mediator' => 'nullable|string|max:255',
        ]);

        $client = Client::create([
            'client_id' => $validated['client_id'],
            'name' => $validated['name']
        ]);

        $client->financialRecords()->create([
            'period' => $validated['period'],
            'fixed_deposit' => $validated['fixed_deposit'] ?? 0,
            'savings' => $validated['savings'] ?? 0,
            'loan_balance' => $validated['loan_balance'] ?? 0,
            'arrears' => $validated['arrears'] ?? 0,
            'fines' => $validated['fines'] ?? 0,
            'mortuary' => $validated['mortuary'] ?? 0,
            'uploaded_date' => $validated['uploaded_date'] ?? now(),
            'assigned_mediator' => $validated['assigned_mediator'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Client created successfully',
            'client' => $client
        ], 201);
    }

    /**
     * Update existing client
     */
    public function update(Request $request, $id)
    {
        // Lookup by external client_id
        $client = Client::where('client_id', $id)->firstOrFail();

        $validated = $request->validate([
            'client_id' => 'required|numeric', // mostly just validation, we don't usually update ID
            'name' => 'sometimes|required|string|max:255',
            'fixed_deposit' => 'nullable|numeric',
            'savings' => 'nullable|numeric',
            'loan_balance' => 'nullable|numeric',
            'arrears' => 'nullable|numeric',
            'fines' => 'nullable|numeric',
            'mortuary' => 'nullable|numeric',
            'period' => 'required|string|max:255', // Needed to know which record
            'assigned_mediator' => 'nullable|string|max:255',
        ]);

        $client->update(['name' => $validated['name']]);

        // Update or Create the financial record for the specified period
        $client->financialRecords()->updateOrCreate(
            ['period' => $validated['period']],
            [
                'fixed_deposit' => $validated['fixed_deposit'] ?? 0,
                'savings' => $validated['savings'] ?? 0,
                'loan_balance' => $validated['loan_balance'] ?? 0,
                'arrears' => $validated['arrears'] ?? 0,
                'fines' => $validated['fines'] ?? 0,
                'mortuary' => $validated['mortuary'] ?? 0,
                'assigned_mediator' => $validated['assigned_mediator'] ?? null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Client updated successfully',
            'client' => $client
        ]);
    }

    /**
     * Soft delete client
     */
    public function destroy($id)
    {
        $client = Client::findOrFail($id);
        $client->delete(); // Cascades financial records if DB set up, otherwise purely Client deletion

        return response()->json([
            'success' => true,
            'message' => 'Client deleted successfully'
        ]);
    }

    /**
     * Get client statistics
     */
    public function statistics(Request $request)
    {
        // Statistics should probably respect the 'current' period or be global?
        // Usually global totals might not make sense if we have historical snapshots.
        // Let's use the period filter if provided, or default to latest.
        
        $period = $request->input('period') ?? ClientFinancialRecord::max('period');

        $query = ClientFinancialRecord::where('period', $period);

        $stats = [
            'total_clients' => $query->count(),
            'clients_with_arrears' => (clone $query)->where('arrears', '>', 0)->count(),
            'clients_with_loans' => (clone $query)->where('loan_balance', '>', 0)->count(),
            'total_savings' => $query->sum('savings'),
            'total_loans' => $query->sum('loan_balance'),
            'total_arrears' => $query->sum('arrears'),
            'period' => $period
        ];

        return response()->json([
            'success' => true,
            'statistics' => $stats
        ]);
    }
}
