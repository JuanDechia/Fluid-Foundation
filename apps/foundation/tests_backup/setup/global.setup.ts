
import { execSync } from 'child_process';

export default async function () {
  execSync('npx prisma migrate reset --force');
  execSync('npx prisma db seed');
}
