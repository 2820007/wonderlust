import prismadb from "@/lib/prismadb";
import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  const user = await currentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { booking, payment_intent_id } = body;

  const bookingData = {
    ...booking,
    userName: user.firstName,
    userEmail: user.emailAddresses[0].emailAddress,
    userId: user.id,
    currency: "usd",
    paymentIntentId: payment_intent_id,
  };

  try {
    let foundBooking;

    if (payment_intent_id) {
      foundBooking = await prismadb.booking.findUnique({
        where: { paymentIntentId: payment_intent_id },
      });
    }

    if (foundBooking && payment_intent_id) {
      // Update existing booking
      const currentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (currentIntent) {
        const updatedIntent = await stripe.paymentIntents.update(payment_intent_id, {
          amount: booking.totalPrice * 100,
        });

        const res = await prismadb.booking.update({
          where: { paymentIntentId: payment_intent_id },
          data: bookingData,
        });

        if (!res) {
          return NextResponse.error();
        }

        return NextResponse.json({ paymentIntent: updatedIntent });
      }
    } else {
      // Create new booking
      const paymentIntent = await stripe.paymentIntents.create({
        amount: booking.totalPrice * 100,
        currency: bookingData.currency,
        automatic_payment_methods: { enabled: true },
      });

      bookingData.paymentIntentId = paymentIntent.id;

      const newBooking = await prismadb.booking.create({
        data: bookingData,
      });

      if (!newBooking) {
        return NextResponse.error();
      }

      return NextResponse.json({ paymentIntent });
    }
  } catch (error) {
    console.error("Error processing booking:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
