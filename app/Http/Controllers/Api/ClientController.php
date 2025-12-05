<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Client;

class ClientController extends Controller
{
    /**
     * Return paginated clients as JSON for the frontend table.
     */
    public function index(Request $request)
    {
        $query = Client::query();

        // Eager load sessions count if needed
        if ($request->boolean('with_sessions', false)) {
            $query->with('sessions');
        }

        // Search by name or id or period
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('client_id', $search)
                  ->orWhere('period', 'LIKE', "%{$search}%");
            });
        }

        // Filters
        if ($request->filled('period')) {
            $query->where('period', $request->period);
        }

        if ($request->boolean('with_arrears')) {
            $query->where('arrears', '>', 0);
        }

        if ($request->boolean('with_loans')) {
            $query->where('loan_balance', '>', 0);
        }

        // Sorting: map friendly keys to columns
        $sortBy = $request->get('sort_by', 'created_at');
        $allowed = ['name', 'period', 'savings', 'loan_balance', 'arrears', 'created_at'];
        if (!in_array($sortBy, $allowed)) {
            $sortBy = 'created_at';
        }

        $sortOrder = $request->get('sort_order', 'desc') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = (int) $request->get('per_page', 20);

        $clients = $query->paginate($perPage)->withQueryString();

        // Return paginated response (Laravel paginator already structures keys)
        return response()->json($clients);
    }
}
