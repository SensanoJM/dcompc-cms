<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Client;
use App\Models\ClientFinancialRecord;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $periods = ClientFinancialRecord::select('period')
            ->distinct()
            ->orderBy('period', 'desc')
            ->pluck('period');

        $selectedPeriod = $request->input('period') ?? ClientFinancialRecord::max('period');

        $query = Client::query()->with('sessions');

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

        if ($request->filled('search')) {
            $query->where('clients.name', 'LIKE', "%{$request->search}%");
        }

        if ($selectedPeriod) {
            if ($request->boolean('with_arrears')) {
                $query->where('client_financial_records.arrears', '>', 0);
            }
            if ($request->boolean('with_loans')) {
                $query->where('client_financial_records.loan_balance', '>', 0);
            }
            if ($request->filled('date_from') && $request->filled('date_to')) {
                $query->whereBetween('client_financial_records.uploaded_date', [$request->date_from, $request->date_to]);
            }
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        if (in_array($sortBy, ['savings', 'loan_balance', 'arrears', 'fixed_deposit', 'fines', 'mortuary']) && $selectedPeriod) {
            $query->orderBy("client_financial_records.$sortBy", $sortOrder);
        } elseif ($sortBy === 'name' || $sortBy === 'client_id') {
            $query->orderBy("clients.$sortBy", $sortOrder);
        } else {
            $query->orderBy("clients.created_at", $sortOrder);
        }

        $perPage = (int) $request->get('per_page', 20);
        $clients = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'success' => true,
            'data' => $clients->items(),
            'total' => $clients->total(),
            'periods' => $periods,
            'selected_period' => $selectedPeriod,
            'current_page' => $clients->currentPage(),
            'last_page' => $clients->lastPage(),
            'per_page' => $clients->perPage(),
        ]);
    }

    public function show($id)
    {
        $client = Client::where('client_id', $id)
            ->with(['financialRecords' => function ($q) {
                $q->orderBy('period', 'desc');
            }])
            ->first();

        if (!$client) {
            $client = Client::where('client_uuid', $id)
                ->with(['financialRecords' => function ($q) {
                    $q->orderBy('period', 'desc');
                }])
                ->firstOrFail();
        }

        $client->times_scheduled = DB::table('session_clients')
            ->where('client_id', $client->client_id)
            ->count();

        return response()->json([
            'success' => true,
            'data' => $client
        ]);
    }
}
