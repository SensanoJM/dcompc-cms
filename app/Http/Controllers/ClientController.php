<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\ClientFinancialRecord;
use App\Models\MediationSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $periods = ClientFinancialRecord::select('period')
            ->distinct()
            ->whereNotNull('period')
            ->where('period', '!=', '')
            ->orderBy('period', 'desc')
            ->pluck('period');

        $mediators = ClientFinancialRecord::select('assigned_mediator')
            ->distinct()
            ->whereNotNull('assigned_mediator')
            ->where('assigned_mediator', '!=', '')
            ->orderBy('assigned_mediator')
            ->pluck('assigned_mediator');

        $selectedPeriod = $request->input('period', 'all');

        $query = Client::query();

        $financialFields = ['savings', 'loan_balance', 'arrears', 'fixed_deposit', 'fines', 'mortuary'];

        if ($selectedPeriod === 'all') {
            $sums = DB::table('client_financial_records')
                ->select(
                    'client_id',
                    DB::raw('SUM(fixed_deposit) as fixed_deposit'),
                    DB::raw('SUM(savings) as savings'),
                    DB::raw('SUM(loan_balance) as loan_balance'),
                    DB::raw('SUM(arrears) as arrears'),
                    DB::raw('SUM(fines) as fines'),
                    DB::raw('SUM(mortuary) as mortuary')
                )
                ->groupBy('client_id');

            $query->leftJoinSub($sums, 'fs', fn($j) => $j->on('clients.client_id', '=', 'fs.client_id'))
                ->select(
                    'clients.*',
                    DB::raw('COALESCE(fs.fixed_deposit, 0) as fixed_deposit'),
                    DB::raw('COALESCE(fs.savings, 0) as savings'),
                    DB::raw('COALESCE(fs.loan_balance, 0) as loan_balance'),
                    DB::raw('COALESCE(fs.arrears, 0) as arrears'),
                    DB::raw('COALESCE(fs.fines, 0) as fines'),
                    DB::raw('COALESCE(fs.mortuary, 0) as mortuary'),
                    DB::raw("'All Time' as period"),
                    DB::raw('NULL as assigned_mediator')
                );
            $alias = 'fs';
        } else {
            $query->join('client_financial_records as cfr', 'clients.client_id', '=', 'cfr.client_id')
                ->where('cfr.period', $selectedPeriod)
                ->select(
                    'clients.*',
                    DB::raw('COALESCE(cfr.fixed_deposit, 0) as fixed_deposit'),
                    DB::raw('COALESCE(cfr.savings, 0) as savings'),
                    DB::raw('COALESCE(cfr.loan_balance, 0) as loan_balance'),
                    DB::raw('COALESCE(cfr.arrears, 0) as arrears'),
                    DB::raw('COALESCE(cfr.fines, 0) as fines'),
                    DB::raw('COALESCE(cfr.mortuary, 0) as mortuary'),
                    'cfr.period',
                    'cfr.assigned_mediator'
                );
            $alias = 'cfr';
        }

        if ($request->filled('search')) {
            $query->where('clients.name', 'LIKE', '%' . $request->input('search') . '%');
        }

        if ($request->boolean('with_arrears')) {
            $query->where("{$alias}.arrears", '>', 0);
        }

        if ($selectedPeriod !== 'all' && $request->filled('mediator')) {
            $query->where('cfr.assigned_mediator', $request->input('mediator'));
        }

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = in_array($request->input('sort_order'), ['asc', 'desc'])
            ? $request->input('sort_order')
            : 'desc';

        if (in_array($sortBy, $financialFields)) {
            $query->orderBy("{$alias}.{$sortBy}", $sortOrder);
        } elseif (in_array($sortBy, ['name', 'client_id'])) {
            $query->orderBy("clients.{$sortBy}", $sortOrder);
        } else {
            $query->orderBy('clients.name', 'asc');
        }

        $perPage = in_array((int) $request->input('per_page', 20), [20, 50, 100])
            ? (int) $request->input('per_page', 20)
            : 20;

        $clients = $query->paginate($perPage)->withQueryString();

        return Inertia::render('clients/index', [
            'clients'   => $clients,
            'periods'   => $periods,
            'mediators' => $mediators,
            'filters'   => [
                'search'       => $request->input('search', ''),
                'period'       => $selectedPeriod,
                'with_arrears' => $request->boolean('with_arrears'),
                'mediator'     => $request->input('mediator', ''),
                'sort_by'      => $sortBy,
                'sort_order'   => $sortOrder,
                'per_page'     => $perPage,
            ],
        ]);
    }

    public function batchSchedule(Request $request)
    {
        $validated = $request->validate([
            'client_ids'     => 'required|array|min:1',
            'client_ids.*'   => 'integer|exists:clients,client_id',
            'session_date'   => 'required|date',
            'session_number' => 'nullable|string|max:100|unique:mediation_sessions,session_number',
            'period'         => 'required|string|max:100',
        ]);

        $scheduled = [];
        $alreadyScheduled = [];

        DB::transaction(function () use ($validated, $request, &$scheduled, &$alreadyScheduled) {
            $session = MediationSession::create([
                'session_number'     => $validated['session_number'] ?: null,
                'session_date'       => $validated['session_date'],
                'period'             => $validated['period'],
                'created_by_user_id' => $request->user()?->user_id,
            ]);

            foreach ($validated['client_ids'] as $clientId) {
                $inserted = DB::table('session_clients')->insertOrIgnore([
                    'session_id'  => $session->session_id,
                    'client_id'   => $clientId,
                    'assigned_at' => now(),
                ]);

                if ($inserted) {
                    $scheduled[] = $clientId;
                } else {
                    $alreadyScheduled[] = $clientId;
                }
            }
        });

        return redirect()->back()->with('flash', [
            'batch_schedule' => [
                'scheduled'         => $scheduled,
                'already_scheduled' => $alreadyScheduled,
            ],
        ]);
    }

    /**
     * Display the client detail page via Inertia.
     */
    public function show($id)
    {
        $client = Client::where('client_id', $id)
            ->with(['financialRecords' => function ($query) {
                $query->orderBy('uploaded_date', 'desc');
            }])
            ->firstOrFail();

        $totals = DB::table('client_financial_records')
            ->where('client_id', $client->client_id)
            ->select(
                DB::raw('SUM(savings) as savings'),
                DB::raw('SUM(fixed_deposit) as fixed_deposit'),
                DB::raw('SUM(loan_balance) as loan_balance'),
                DB::raw('SUM(arrears) as arrears'),
                DB::raw('SUM(fines) as fines'),
                DB::raw('SUM(mortuary) as mortuary')
            )
            ->first();

        return Inertia::render('clients/show', [
            'client' => [
                'client_id'        => $client->client_id,
                'name'             => $client->name,
                'period'           => $client->financialRecords->first()?->period,
                'financial_records' => $client->financialRecords,
                'total_financials' => $totals,
            ],
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

    public function destroy($id)
    {
        $client = Client::where('client_id', $id)->firstOrFail();
        $name = $client->name;
        $client->delete();

        return redirect()->route('clients')->with('flash', [
            'delete' => ['message' => "{$name} has been deleted."],
        ]);
    }

    public function batchDestroy(Request $request)
    {
        $validated = $request->validate([
            'client_ids'   => 'required|array|min:1',
            'client_ids.*' => 'integer|exists:clients,client_id',
        ]);

        $count = Client::whereIn('client_id', $validated['client_ids'])->count();
        Client::whereIn('client_id', $validated['client_ids'])->delete();

        return redirect()->back()->with('flash', [
            'delete' => ['message' => "{$count} client(s) deleted."],
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
