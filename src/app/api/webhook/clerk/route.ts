import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest, NextResponse } from 'next/server'
import {prisma} from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    // Do something with payload
    // For this guide, log payload to console
    const eventType = evt.type
        if (eventType === 'user.created') {
      const { id, email_addresses, first_name, last_name } = evt.data;
      
      // Extract primary email
      const primaryEmail = email_addresses.find(email => email.id === evt.data.primary_email_address_id);
      
      if (!primaryEmail) {
        console.error('No primary email found for user:', id);
        return new NextResponse('No primary email found', { status: 400 });
      }

      // Create user in database
      await prisma.user.create({
        data: {
          clerkId: id,
          email: primaryEmail.email_address,
          fullName: first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name || null,
        },
      });
    }

    if (eventType === 'user.updated') {
      const { id, email_addresses, first_name, last_name, username } = evt.data;

      // Extract primary email
      const primaryEmail = email_addresses.find(email => email.id === evt.data.primary_email_address_id);
      
      if (!primaryEmail) {
        console.error('No primary email found for user:', id);
        return new NextResponse('No primary email found', { status: 400 });
      }

      // Update user in database
      await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: primaryEmail.email_address,
          fullName: first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name || null,
        },
      });
    }

    if (eventType === 'user.deleted') {
      const { id } = evt.data;

      // Delete user from database (this will cascade delete chats due to our schema)
      await prisma.user.delete({
        where: { clerkId: id },
      });
    }


    return new Response('Webhook received', { status: 200 })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error verifying webhook', { status: 400 })
  }
}