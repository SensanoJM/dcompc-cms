import AppLayout from '@/layouts/app-layout';
import { dashboard, mediation } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Mediation', href: mediation().url },
];

const columns = ['Client Name', 'Date / Time', 'Mediator', 'Status', 'Actions'];

export default function Mediation() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mediation" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">

                <div className="overflow-hidden rounded-md border text-sm">
                    <table className="w-full table-auto">
                        <thead>
                            <tr className="bg-muted/10 text-left">
                                {columns.map((col) => (
                                    <th key={col} className="px-4 py-2">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    No mediation sessions scheduled yet.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </AppLayout>
    );
}
