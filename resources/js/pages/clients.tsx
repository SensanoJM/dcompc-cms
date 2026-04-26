import AppLayout from '@/layouts/app-layout';
import { dashboard, clients } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ClientTable from '@/components/ClientTable';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Clients', href: clients().url },
];

export default function Clients() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Clients" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <ClientTable />
            </div>
        </AppLayout>
    );
}
