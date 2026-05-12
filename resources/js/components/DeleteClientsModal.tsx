import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

type DeleteClientsModalProps = {
    isOpen: boolean;
    clients: { id: number; name: string }[];
    mode: 'single' | 'batch';
    onClose: () => void;
};

export default function DeleteClientsModal({ isOpen, clients, mode, onClose }: DeleteClientsModalProps) {
    const [submitting, setSubmitting] = useState(false);

    const count = clients.length;
    const showNameList = count <= 10;

    const handleDelete = () => {
        setSubmitting(true);

        if (mode === 'single') {
            router.delete(`/clients/${clients[0].id}`, {
                onSuccess: () => { setSubmitting(false); onClose(); },
                onError: () => setSubmitting(false),
            });
        } else {
            router.post(
                '/clients/batch-delete',
                { client_ids: clients.map((c) => c.id) },
                {
                    onSuccess: () => { setSubmitting(false); onClose(); },
                    onError: () => setSubmitting(false),
                },
            );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Delete {count} Client{count !== 1 ? 's' : ''}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-3 pt-1">
                            <p>
                                Permanently delete{' '}
                                <span className="font-medium text-foreground">
                                    {count} client{count !== 1 ? 's' : ''}
                                </span>{' '}
                                and all their associated financial records? This cannot be undone.
                            </p>

                            {showNameList && (
                                <ul className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-foreground">
                                    {clients.map((c) => (
                                        <li key={c.id} className="py-0.5">
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
                        {submitting ? 'Deleting…' : `Delete ${count === 1 ? 'Client' : `${count} Clients`}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
