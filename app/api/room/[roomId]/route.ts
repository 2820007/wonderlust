import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { userId } = auth();

    if (!params.roomId) {
      return new NextResponse("Room Id is required", { status: 400 });
    }

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // First, delete all bookings associated with the room
    await prismadb.booking.deleteMany({
      where: {
        roomId: params.roomId,
      },
    });

    // Then, delete the room
    const room = await prismadb.room.delete({
      where: {
        id: params.roomId,
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.log("Error at /api/room/roomId DELETE", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
