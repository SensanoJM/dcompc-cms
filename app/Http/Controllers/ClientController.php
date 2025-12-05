<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Client;
use Inertia\Inertia;

class ClientController extends Controller
{
    /**
     * Display dashboard with clients table
     */
    public function index(Request $request)
    {
        $query = Client::query()->with('sessions');

        // Search by name
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // Filter by period
        if ($request->filled('period')) {
            $query->byPeriod($request->period);
        }

        // Filter by date range
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $query->byDateRange($request->date_from, $request->date_to);
        }

        // Filter clients with arrears
        if ($request->boolean('with_arrears')) {
            $query->withArrears();
        }

        // Filter clients with loans
        if ($request->boolean('with_loans')) {
            $query->withLoans();
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Paginate
        $clients = $query->paginate(20)->withQueryString();

        // Get unique periods for filter dropdown
        $periods = Client::select('period')
            ->distinct()
            ->whereNotNull('period')
            ->pluck('period');

        return Inertia::render('Dashboard', [
            'clients' => $clients,
            'periods' => $periods,
            'filters' => $request->only(['search', 'period', 'date_from', 'date_to', 'with_arrears', 'with_loans']),
        ]);
    }

    /**
     * Display single client details with sessions
     */
    public function show($id)
    {
        $client = Client::with(['sessions.mediators', 'sessions' => function ($query) {
            $query->orderBy('session_date', 'desc');
        }])->findOrFail($id);

        return response()->json([
            'success' => true,
            'client' => [
                'client_id' => $client->client_id,
                'name' => $client->name,
                'fixed_deposit' => $client->fixed_deposit,
                'savings' => $client->savings,
                'loan_balance' => $client->loan_balance,
                'arrears' => $client->arrears,
                'fines' => $client->fines,
                'mortuary' => $client->mortuary,
                'uploaded_date' => $client->uploaded_date->format('Y-m-d'),
                'period' => $client->period,
                'total_assets' => $client->total_assets,
                'total_liabilities' => $client->total_liabilities,
                'net_worth' => $client->net_worth,
                'times_scheduled' => $client->times_scheduled,
                'sessions' => $client->sessions,
                'created_at' => $client->created_at->format('Y-m-d H:i:s'),
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
            'period' => 'nullable|string|max:255',
        ]);

        // Set defaults
        $validated['uploaded_date'] = $validated['uploaded_date'] ?? now();
        
        $client = Client::create($validated);

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
        $client = Client::findOrFail($id);

        $validated = $request->validate([
            'client_id' => 'required|numeric',
            'name' => 'sometimes|required|string|max:255',
            'fixed_deposit' => 'nullable|numeric',
            'savings' => 'nullable|numeric',
            'loan_balance' => 'nullable|numeric',
            'arrears' => 'nullable|numeric',
            'fines' => 'nullable|numeric',
            'mortuary' => 'nullable|numeric',
            'period' => 'nullable|string|max:255',
        ]);

        $client->update($validated);

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
        $client->delete();

        return response()->json([
            'success' => true,
            'message' => 'Client deleted successfully'
        ]);
    }

    /**
     * Get client statistics
     */
    public function statistics()
    {
        $stats = [
            'total_clients' => Client::count(),
            'clients_with_arrears' => Client::withArrears()->count(),
            'clients_with_loans' => Client::withLoans()->count(),
            'total_savings' => Client::sum('savings'),
            'total_loans' => Client::sum('loan_balance'),
            'total_arrears' => Client::sum('arrears'),
        ];

        return response()->json([
            'success' => true,
            'statistics' => $stats
        ]);
    }
}
