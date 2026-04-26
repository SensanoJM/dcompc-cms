import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const statCards = [
    { label: 'Total Clients' },
    { label: 'Active Mediations' },
    { label: 'Overdue Arrears' },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* Stat cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {statCards.map(({ label }) => (
                        <div key={label} className="rounded-xl border bg-card p-5 shadow-sm">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">{label}</p>
                            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                        </div>
                    ))}
                </div>

                {/* Placeholder chart / table area */}
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
                    <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${75 + (i % 3) * 8}%` }} />
                        ))}
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
