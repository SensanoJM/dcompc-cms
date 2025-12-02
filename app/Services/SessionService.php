<?php

namespace App\Services;

use App\Models\MediationSession;
use Illuminate\Support\Facades\DB;

class SessionService
{
    /**
     * Schedule a new mediation session with clients and mediators
     */
    public function scheduleSession(
        string $sessionDate,
        array $clientIds,
        array $mediatorIds,
        ?string $remarks = null,
        int $createdByUserId
    ): MediationSession {
        return DB::transaction(function () use (
            $sessionDate,
            $clientIds,
            $mediatorIds,
            $remarks,
            $createdByUserId
        ) {
            // Create session
            $session = MediationSession::create([
                'session_date' => $sessionDate,
                'remarks' => $remarks,
                'created_by_user_id' => $createdByUserId,
                'times_scheduled' => 1
            ]);

            // Attach clients
            $session->clients()->attach($clientIds);

            // Attach mediators
            $session->mediators()->attach($mediatorIds);

            return $session;
        });
    }

    /**
     * Reschedule session to new date
     */
    public function rescheduleSession(int $sessionId, string $newDate): MediationSession
    {
        $session = MediationSession::findOrFail($sessionId);
        
        $session->update([
            'session_date' => $newDate,
            'times_scheduled' => $session->times_scheduled + 1
        ]);

        return $session;
    }
}