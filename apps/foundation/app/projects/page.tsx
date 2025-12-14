import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { deleteProject } from './actions';

export default async function ProjectsPage() {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
        return <div>Please log in and select an organization</div>;
    }

    // Check if user is admin
    const isAdmin = orgRole === 'org:admin';

    // Fetch projects for the organization
    // Note: In a production app with getTenantDb(), this filtering would be automatic
    const projects = await prisma.project.findMany({
        where: {
            organizationId: orgId,
            deletedAt: null // Filter out soft-deleted projects
        },
        orderBy: { name: 'asc' },
    });

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Projects</h1>

            {projects.length === 0 ? (
                <p>No projects found.</p>
            ) : (
                <ul>
                    {projects.map((project) => (
                        <li key={project.id} style={{ marginBottom: '1rem' }}>
                            <span>{project.name}</span>
                            {/* Only admins can delete projects */}
                            {isAdmin && (
                                <form action={deleteProject.bind(null, project.id)} style={{ display: 'inline', marginLeft: '1rem' }}>
                                    <button type="submit">Delete Project</button>
                                </form>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
