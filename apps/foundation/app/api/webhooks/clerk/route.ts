import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return new Response('Internal Server Error', { status: 500 });
  }

  // 1. Get Headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', { status: 400 });
  }

  // 2. CRITICAL FIX: Get raw body as text for verification
  // Do NOT use req.json() here, or signature verification will fail.
  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Verification failed', { status: 400 });
  }

  const eventType = evt.type;

  try {
    // --- Organization Lifecycle ---
    if (eventType === 'organization.created' || eventType === 'organization.updated') {
      const { id, name, slug } = evt.data;

      await prisma.organization.upsert({
        where: { id },
        create: {
          id,
          name,
          slug: slug || `org-${id}` // Use provided slug or generate from ID
        },
        update: {
          name,
          slug: slug || `org-${id}`
        },
      });
    }

    if (eventType === 'organization.deleted') {
      const { id } = evt.data;
      if (id) {
        // Soft delete
        await prisma.organization.update({
          where: { id },
          data: { deletedAt: new Date() }
        }).catch(() => null);
      }
    }

    // --- User Lifecycle ---
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id, email_addresses } = evt.data;
      const email = email_addresses[0]?.email_address;
      await prisma.user.upsert({
        where: { id },
        create: { id, email },
        update: { email },
      });
    }

    if (eventType === 'user.deleted') {
      const { id } = evt.data;
      if (id) await prisma.user.delete({ where: { id } }).catch(() => null);
    }

  } catch (error) {
    console.error('Database error in webhook:', error);
    return new Response('Database Error: ' + error, { status: 500 });
  }

  return NextResponse.json({ success: true });
}