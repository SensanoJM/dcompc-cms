<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SessionController extends Controller
{
    protected $sessionService;

    public function __construct(SessionService $sessionService)
    {
        $this->sessionService = $sessionService;
    }

    /**
     * Get all sessions with filters
     */
    public function index(Request $request)
    {
        $query = MediationSession::with(['clients', 'mediators', 'creator']);

        // Filter by date range
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $query->byDateRange($request->date_from, $request->date_to);
        }

        // Filter by status
        if ($request->filled('status')) {
            switch ($request->status) {
                case 'upcoming':
                    $query->upcoming();
                    break;
                case 'past':
                    $query->past();
                    break;
                case 'today':
                    $query->today();
                    break;
            }
        }

        // Filter by mediator
        if ($request->filled('mediator_id')) {
            $query->whereHas('mediators', function ($q) use ($request) {
                $q->where('user_id', $request->mediator_id);
            });
        }

        $sessions = $query->orderBy('session_date', 'desc')
            ->paginate(20)
            ->withQueryString();

        return response()->json([
            'success' => true,
            'sessions' => $sessions
        ]);
    }

    /**
     * Get single session details
     */
    public function show($id)
    {
        $session = MediationSession::with(['clients', 'mediators', 'creator'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'session' => $session
        ]);
    }

    /**
     * Schedule new mediation session
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'session_date' => 'required|date|after_or_equal:today',
            'client_ids' => 'required|array|min:1',
            'client_ids.*' => 'exists:clients,client_id',
            'mediator_ids' => 'required|array|min:1',
            'mediator_ids.*' => 'exists:users,user_id',
            'remarks' => 'nullable|string',
        ]);

        try {
            $session = $this->sessionService->scheduleSession(
                $validated['session_date'],
                $validated['client_ids'],
                $validated['mediator_ids'],
                $validated['remarks'] ?? null,
                auth()->id()
            );

            return response()->json([
                'success' => true,
                'message' => 'Session scheduled successfully',
                'session' => $session->load(['clients', 'mediators'])
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to schedule session: ' . $e->getMessage()
            ], 422);
        }
    }

    /**
     * Update session (mainly for remarks)
     */
    public function update(Request $request, $id)
    {
        $session = MediationSession::findOrFail($id);

        $validated = $request->validate([
            'session_date' => 'sometimes|date',
            'remarks' => 'nullable|string',
            'times_scheduled' => 'sometimes|integer|min:1',
        ]);

        $session->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Session updated successfully',
            'session' => $session->load(['clients', 'mediators'])
        ]);
    }

    /**
     * Add or update remarks for a session
     */
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
            'session' => $session
        ]);
    }

    /**
     * Get session history for a specific client
     */
    public function clientHistory($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $sessions = $client->sessions()
            ->with(['mediators', 'creator'])
            ->orderBy('session_date', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'client' => $client->only(['client_id', 'full_name']),
            'sessions' => $sessions,
            'total_sessions' => $sessions->count()
        ]);
    }

    /**
     * Get upcoming sessions for authenticated mediator
     */
    public function myUpcoming()
    {
        $sessions = auth()->user()
            ->assignedSessions()
            ->upcoming()
            ->with(['clients', 'mediators'])
            ->get();

        return response()->json([
            'success' => true,
            'sessions' => $sessions
        ]);
    }

    /**
     * Delete session
     */
    public function destroy($id)
    {
        $session = MediationSession::findOrFail($id);
        $session->delete();

        return response()->json([
            'success' => true,
            'message' => 'Session deleted successfully'
        ]);
    }
}
