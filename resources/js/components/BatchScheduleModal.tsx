import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { useState } from 'react';

type BatchScheduleModalProps = {
    isOpen: boolean;
    selectedClientIds: number[];
    periods: string[];
    defaultPeriod?: string;
    onClose: () => void;
};

export default function BatchScheduleModal({
    isOpen,
    selectedClientIds,
    periods,
    defaultPeriod,
    onClose,
}: BatchScheduleModalProps) {
    const [sessionDate, setSessionDate] = useState('');
    const [sessionNumber, setSessionNumber] = useState('');
    const [period, setPeriod] = useState(defaultPeriod ?? periods[0] ?? '');
    const [submitting, setSubmitting] = useState(false);

    // Sync period when defaultPeriod changes (e.g. user opens modal from a different period context)
    const [lastDefault, setLastDefault] = useState(defaultPeriod);
    if (defaultPeriod !== lastDefault) {
        setLastDefault(defaultPeriod);
        setPeriod(defaultPeriod ?? periods[0] ?? '');
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        router.post(
            '/clients/batch-schedule',
            {
                client_ids: selectedClientIds,
                session_date: sessionDate,
                session_number: sessionNumber || null,
                period,
            },
            {
                onSuccess: () => {
                    setSubmitting(false);
                    setSessionDate('');
                    setSessionNumber('');
                    onClose();
                },
                onError: () => {
                    setSubmitting(false);
                },
            },
        );
    };

    const canSubmit = !submitting && !!sessionDate && !!period;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Schedule Mediation Session</DialogTitle>
                    <DialogDescription>
                        Creating a new session for {selectedClientIds.length} selected client
                        {selectedClientIds.length !== 1 ? 's' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="session_date">Session Date</Label>
                        <Input
                            id="session_date"
                            type="date"
                            required
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="session_number">
                            Session Number{' '}
                            <span className="text-xs text-muted-foreground">(optional — auto-generated if blank)</span>
                        </Label>
                        <Input
                            id="session_number"
                            type="text"
                            placeholder="e.g. MED-2026-001"
                            value={sessionNumber}
                            onChange={(e) => setSessionNumber(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="period">Period</Label>
                        <Select value={period} onValueChange={setPeriod} required>
                            <SelectTrigger id="period">
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                                {periods.length === 0 ? (
                                    <SelectItem value="__no_periods__" disabled>
                                        No periods available
                                    </SelectItem>
                                ) : (
                                    periods.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {p}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {submitting ? 'Scheduling…' : 'Schedule Session'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
