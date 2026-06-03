import AppLayout from '@/layouts/app-layout';
import { dashboard, mediation } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

type SessionClient = {
    client_id: number;
    name: string;
};

type Session = {
    session_id: number;
    session_number: string;
    session_date: string;
    period: string | null;
    remarks: string | null;
    clients: SessionClient[];
};

type Paginator = {
    data: Session[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
};

type Filters = {
    status?: string;
    date_from?: string;
    date_to?: string;
    period?: string;
};

type PageProps = {
    sessions: Paginator;
    filters: Filters;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Mediation', href: mediation().url },
];

function deriveStatus(sessionDate: string): 'Upcoming' | 'Today' | 'Past' {
    const today = new Date().toISOString().slice(0, 10);
    const date = sessionDate.slice(0, 10);
    if (date === today) return 'Today';
    return date > today ? 'Upcoming' : 'Past';
}

const statusStyles = {
    Upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Today: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Past: 'bg-muted text-muted-foreground',
} as const;

export default function Mediation({ sessions, filters }: PageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mediation" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="overflow-hidden rounded-md border text-sm">
                    <table className="w-full table-auto">
                        <thead>
                            <tr className="border-b bg-muted/10 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-3">Session #</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Period</th>
                                <th className="px-4 py-3">Clients</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sessions.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-10 text-center text-muted-foreground"
                                    >
                                        No mediation sessions scheduled yet.
                                    </td>
                                </tr>
                            ) : (
                                sessions.data.map((session) => {
                                    const status = deriveStatus(session.session_date);
                                    return (
                                        <tr
                                            key={session.session_id}
                                            className="hover:bg-muted/5"
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                {session.session_number}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums">
                                                {new Date(session.session_date).toLocaleDateString(
                                                    'en-US',
                                                    {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        timeZone: 'UTC',
                                                    },
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {session.period ?? (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums">
                                                {session.clients.length}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
                                                >
                                                    {status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {sessions.last_page > 1 && (
                    <p className="text-xs text-muted-foreground">
                        Showing{' '}
                        {(sessions.current_page - 1) * sessions.per_page + 1}–
                        {Math.min(
                            sessions.current_page * sessions.per_page,
                            sessions.total,
                        )}{' '}
                        of {sessions.total} sessions
                    </p>
                )}
            </div>
        </AppLayout>
    );
}
