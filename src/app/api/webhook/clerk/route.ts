import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest, NextResponse } from 'next/server'
import {prisma} from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Step 1: Verify the webhook signature
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Webhook received: ${eventType}`);

  // Step 2: Handle the event
  try {
    if (eventType === 'user.created') {
      const { id, email_addresses, first_name, last_name } = evt.data;
      
      const primaryEmail = email_addresses.find(
        (email) => email.id === evt.data.primary_email_address_id
      );
      
      if (!primaryEmail) {
        console.error('No primary email found for user:', id);
        return new NextResponse('No primary email found', { status: 400 });
      }

      const user = await prisma.user.create({
        data: {
          clerkId: id,
          email: primaryEmail.email_address,
          fullName: first_name && last_name
            ? `${first_name} ${last_name}`
            : first_name || last_name || null,
        },
      });
      console.log('User created in DB:', user.id, user.email);
    }

    if (eventType === 'user.updated') {
      const { id, email_addresses, first_name, last_name } = evt.data;

      const primaryEmail = email_addresses.find(
        (email) => email.id === evt.data.primary_email_address_id
      );
      
      if (!primaryEmail) {
        console.error('No primary email found for user:', id);
        return new NextResponse('No primary email found', { status: 400 });
      }

      await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: primaryEmail.email_address,
          fullName: first_name && last_name
            ? `${first_name} ${last_name}`
            : first_name || last_name || null,
        },
      });
      console.log('User updated:', id);
    }

    if (eventType === 'user.deleted') {
      const { id } = evt.data;
      await prisma.user.delete({
        where: { clerkId: id! },
      });
      console.log('User deleted:', id);
    }

    return new Response('Webhook received', { status: 200 });
  } catch (err) {
    console.error('Database operation failed:', err);
    return new Response('Database error', { status: 500 });
  }
}