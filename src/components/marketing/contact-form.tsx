"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

const fieldClass =
  "mt-2 w-full rounded-[14px] border border-ink-200 bg-white/80 px-4 py-3 text-[15px] text-ink-900 outline-none transition-[border-color,box-shadow] placeholder:text-ink-300 focus:border-ink-400 focus:shadow-[0_0_0_3px_rgba(19,19,17,0.06)]";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }

      setStatus("success");
      form.reset();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="border-y border-ink-100 py-8">
        <p className="text-lg font-medium tracking-[-0.02em] text-ink-900">Thanks for reaching out.</p>
        <p className="mt-2 text-[15px] leading-7 text-ink-500">
          We’ve received your message and will get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink-800">
          Name
        </label>
        <input id="name" name="name" type="text" required className={fieldClass} />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-800">
          Email
        </label>
        <input id="email" name="email" type="email" required className={fieldClass} />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-ink-800">
          Message
        </label>
        <textarea id="message" name="message" required rows={5} className={fieldClass} />
      </div>

      {status === "error" && errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <Button type="submit" disabled={status === "submitting"} size="lg">
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
