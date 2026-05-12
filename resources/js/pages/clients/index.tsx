import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BatchScheduleModal from '@/components/BatchScheduleModal';
import ClientTable from '@/components/ClientTable';
import DeleteClientsModal from '@/components/DeleteClientsModal';
import AppLayout from '@/layouts/app-layout';
import { clients as clientsRoute, dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Client = {
    client_id: number;
    name: string;
    period: string;
    savings: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    assigned_mediator: string | null;
};

type Paginator = {
    data: Client[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
};

export type Filters = {
    search: string;
    period: string;
    with_arrears: boolean;
    mediator: string;
    sort_by: string;
    sort_order: 'asc' | 'desc';
    per_page: number;
};

type Flash = {
    import?: { imported: number; failed: number };
    import_error?: string;
    batch_schedule?: { scheduled: number[]; already_scheduled: number[] };
    delete?: { message: string };
};

type PageProps = {
    clients: Paginator;
    periods: string[];
    mediators: string[];
    filters: Filters;
    flash?: Flash;
    auth: { user: { name: string } };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Clients', href: clientsRoute().url },
];

function FlashAlert({ flash, onDismiss }: { flash: Flash; onDismiss: () => void }) {
    if (flash.import) {
        const { imported, failed } = flash.import;
        return (
            <Alert className="relative pr-10">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Import Complete</AlertTitle>
                <AlertDescription>
                    {imported} client{imported !== 1 ? 's' : ''} imported successfully
                    {failed > 0 ? `, ${failed} row${failed !== 1 ? 's' : ''} failed` : ''}.
                </AlertDescription>
                <button className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
                    <XCircle className="h-4 w-4" />
                </button>
            </Alert>
        );
    }

    if (flash.import_error) {
        return (
            <Alert variant="destructive" className="relative pr-10">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Import Failed</AlertTitle>
                <AlertDescription>{flash.import_error}</AlertDescription>
                <button className="absolute right-3 top-3" onClick={onDismiss} aria-label="Dismiss">
                    <XCircle className="h-4 w-4" />
                </button>
            </Alert>
        );
    }

    if (flash.batch_schedule) {
        const { scheduled, already_scheduled } = flash.batch_schedule;
        return (
            <Alert className="relative pr-10">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Session Scheduled</AlertTitle>
                <AlertDescription>
                    {scheduled.length} client{scheduled.length !== 1 ? 's' : ''} scheduled.
                    {already_scheduled.length > 0 &&
                        ` ${already_scheduled.length} were already in a session and were skipped.`}
                </AlertDescription>
                <button className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
                    <XCircle className="h-4 w-4" />
                </button>
            </Alert>
        );
    }

    if (flash.delete) {
        return (
            <Alert className="relative pr-10">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Deleted</AlertTitle>
                <AlertDescription>{flash.delete.message}</AlertDescription>
                <button className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
                    <XCircle className="h-4 w-4" />
                </button>
            </Alert>
        );
    }

    return null;
}

export default function ClientsIndex({ clients, periods, mediators, filters }: PageProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const [modalOpen, setModalOpen] = useState(false);
    const [scheduledIds, setScheduledIds] = useState<number[]>([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pendingDeleteClients, setPendingDeleteClients] = useState<{ id: number; name: string }[]>([]);
    const [flashDismissed, setFlashDismissed] = useState(false);

    // Reset dismissed state whenever flash content changes (new redirect)
    useEffect(() => {
        setFlashDismissed(false);
    }, [flash]);

    // Reload on tab focus + every 60s to keep data fresh across concurrent mediators
    useEffect(() => {
        const reload = () => router.reload({ only: ['clients', 'periods', 'mediators'] });
        const onVisibility = () => {
            if (document.visibilityState === 'visible') reload();
        };
        document.addEventListener('visibilitychange', onVisibility);
        const interval = setInterval(reload, 60_000);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            clearInterval(interval);
        };
    }, []);

    const openBatchModal = (ids: number[]) => {
        setScheduledIds(ids);
        setModalOpen(true);
    };

    const openDeleteModal = (clients: { id: number; name: string }[]) => {
        setPendingDeleteClients(clients);
        setDeleteModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Clients" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {flash && !flashDismissed && (
                    <FlashAlert flash={flash} onDismiss={() => setFlashDismissed(true)} />
                )}
                <ClientTable
                    clients={clients.data}
                    pagination={{
                        total: clients.total,
                        currentPage: clients.current_page,
                        lastPage: clients.last_page,
                        perPage: clients.per_page,
                    }}
                    periods={periods}
                    mediators={mediators}
                    filters={filters}
                    currentUserName={auth.user.name}
                    onBatchSchedule={openBatchModal}
                    onBatchDelete={openDeleteModal}
                />
            </div>
            <BatchScheduleModal
                isOpen={modalOpen}
                selectedClientIds={scheduledIds}
                periods={periods}
                defaultPeriod={filters.period !== 'all' ? filters.period : (periods[0] ?? '')}
                onClose={() => setModalOpen(false)}
            />
            <DeleteClientsModal
                isOpen={deleteModalOpen}
                clients={pendingDeleteClients}
                mode="batch"
                onClose={() => setDeleteModalOpen(false)}
            />
        </AppLayout>
    );
}
