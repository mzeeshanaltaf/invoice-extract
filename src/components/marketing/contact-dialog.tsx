"use client";

import { useState, useCallback } from "react";
import { Send, CheckCircle2, Mail, User, MessageSquare, ShieldCheck, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NAME_MAX = 30;
const MESSAGE_MAX = 1000;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateCaptcha(): { question: string; answer: number } {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  switch (op) {
    case "+":
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
      break;
    case "-":
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
      break;
    case "×":
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a * b;
      break;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

export function ContactDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  const captchaValid = captchaInput.trim() !== "" && parseInt(captchaInput.trim(), 10) === captcha.answer;

  const emailValid = isValidEmail(email);
  const canSubmit =
    name.trim().length > 0 &&
    name.length <= NAME_MAX &&
    emailValid &&
    message.trim().length > 0 &&
    message.length <= MESSAGE_MAX &&
    captchaValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      // Reset form when closing
      setTimeout(() => {
        setName("");
        setEmail("");
        setMessage("");
        setError("");
        setSuccess(false);
        setCaptcha(generateCaptcha());
        setCaptchaInput("");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Message sent!</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Thank you for your message. We will get back to you as soon as possible.
              </p>
            </div>
            <Button className="mt-2 w-full" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact Us</DialogTitle>
              <DialogDescription>
                Send us a message and we&apos;ll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Name
                </Label>
                <Input
                  id="contact-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                />
                <p className={`text-right text-xs ${name.length >= NAME_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                  {name.length}/{NAME_MAX}
                </p>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {email.length > 0 && !emailValid && (
                  <p className="text-xs text-destructive">Please enter a valid email address.</p>
                )}
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-message" className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Message
                </Label>
                <textarea
                  id="contact-message"
                  placeholder="How can we help you?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MESSAGE_MAX}
                  rows={4}
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className={`text-right text-xs ${message.length >= MESSAGE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                  {message.length}/{MESSAGE_MAX}
                </p>
              </div>

              {/* Math Captcha */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-captcha" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  Verify you&apos;re human
                </Label>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-muted px-3 py-2 text-sm font-medium tracking-wide">
                    {captcha.question} = ?
                  </span>
                  <Input
                    id="contact-captcha"
                    type="text"
                    inputMode="numeric"
                    placeholder="Answer"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="w-24"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={refreshCaptcha}
                    className="h-9 w-9 shrink-0"
                    title="New question"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {captchaInput.trim() !== "" && !captchaValid && (
                  <p className="text-xs text-destructive">Incorrect answer. Please try again.</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!canSubmit || submitting}
                className="mt-1 w-full gap-2"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
