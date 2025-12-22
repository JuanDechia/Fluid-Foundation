import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
    const { userId } = await auth();

    if (userId) {
        redirect('/editor');
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
            <h1 className="text-4xl font-bold mb-4">Welcome to Foundation</h1>
            <p className="text-slate-400 mb-8 max-w-md text-center">
                The unified platform for your SaaS projects. Now featuring the AI-powered Fluid Editor.
            </p>
            <div className="flex gap-4">
                <a
                    href="/sign-in"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                >
                    Sign In
                </a>
            </div>
        </div>
    );
}
