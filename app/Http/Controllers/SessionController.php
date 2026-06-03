<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\MediationSession;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SessionController extends Controller
{
    public function index(Request $request)
    {
        $query = MediationSession::with('clients')->orderBy('session_date', 'desc');

        if ($request->filled('status')) {
            match ($request->status) {
                'upcoming' => $query->upcoming(),
                'past'     => $query->past(),
                'today'    => $query->today(),
                default    => null,
            };
        }

        if ($request->filled('period')) {
            $query->where('period', $request->period);
        }

        if ($request->filled('date_from') && $request->filled('date_to')) {
            $query->whereBetween('session_date', [$request->date_from, $request->date_to]);
        }

        return Inertia::render('mediation', [
            'sessions' => $query->paginate(20)->withQueryString(),
            'filters'  => $request->only(['status', 'date_from', 'date_to', 'period']),
        ]);
    }

    public function show($id)
    {
        $session = MediationSession::with(['clients', 'mediators', 'creator'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'session' => $session,
        ]);
    }

    public function update(Request $request, $id)
    {
        $session = MediationSession::findOrFail($id);

        $validated = $request->validate([
            'session_date'    => 'sometimes|date',
            'remarks'         => 'nullable|string',
            'times_scheduled' => 'sometimes|integer|min:1',
        ]);

        $session->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Session updated successfully',
            'session' => $session->load(['clients', 'mediators']),
        ]);
    }

    public function updateRemarks(Request $request, $id)
    {
        $validated = $request->validate([
            'remarks' => 'required|string|max:5000',
        ]);

        $session = MediationSession::findOrFail($id);
        $session->update(['remarks' => $validated['remarks']]);

        return response()->json([
            'success' => true,
            'message' => 'Remarks updated successfully',
            'session' => $session,
        ]);
    }

    public function clientHistory($clientId)
    {
        $client = Client::where('client_id', $clientId)->firstOrFail();

        $sessions = $client->sessions()
            ->with(['mediators', 'creator'])
            ->orderBy('session_date', 'desc')
            ->get();

        return response()->json([
            'success'        => true,
            'client'         => $client->only(['client_id', 'name']),
            'sessions'       => $sessions,
            'total_sessions' => $sessions->count(),
        ]);
    }

    public function destroy($id)
    {
        $session = MediationSession::findOrFail($id);
        $session->delete();

        return response()->json([
            'success' => true,
            'message' => 'Session deleted successfully',
        ]);
    }
}
