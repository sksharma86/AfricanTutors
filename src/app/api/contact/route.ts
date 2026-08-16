import { NextResponse } from "next/server";

/**
 * Minimal contact form handler for the foundation phase.
 *
 * This validates input and logs the submission server-side. It does not yet
 * send an email or store the message, since no transactional email provider
 * or database table has been connected (see SETUP.md and TODO.md). Wiring
 * this up to a real provider is tracked as a follow-up task.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string" ||
    !body.name.trim() ||
    !body.email.trim() ||
    !body.message.trim()
  ) {
    return NextResponse.json(
      { error: "Please fill in your name, email, and message." },
      { status: 400 },
    );
  }

  console.info("[contact] new inquiry received", {
    name: body.name,
    email: body.email,
  });

  return NextResponse.json({ ok: true });
}
