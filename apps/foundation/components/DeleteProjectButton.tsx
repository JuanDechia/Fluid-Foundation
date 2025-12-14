// components/DeleteProjectButton.tsx
'use client';

import { useOrganization } from '@clerk/nextjs';
import { deleteProject } from '@/app/projects/actions';

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const { membership, isLoaded } = useOrganization();

  if (!isLoaded) {
    return <button disabled>Loading...</button>;
  }

  const isAdmin = membership?.role === 'org:admin';

  // Only admins can delete projects (replacement for Permission.PROJECT_DELETE)
  if (!isAdmin) {
    return null;
  }

  const handleClick = async () => {
    if (confirm('Are you sure you want to delete this project?')) {
      const result = await deleteProject(projectId);
      if (!result.success) {
        alert(`Error: ${result.error}`);
      }
    }
  }

  return <button onClick={handleClick} className="text-red-500">Delete Project</button>;
}