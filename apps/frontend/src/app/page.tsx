import { redirect } from 'next/navigation';

export default function HomePage() {
    // Redirect to dashboard or reports page
    redirect('/reports');
}
