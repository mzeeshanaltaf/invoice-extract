"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { api, resetApiAuth } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";

/** Better Auth only deletes a user without a password if the session is this fresh (its default). */
const SESSION_FRESH_MS = 24 * 60 * 60 * 1000;
const DELETE_PHRASE = "delete my account";

function retentionLabel(days: number | null) {
  return days === null ? "Keep forever" : `${days} days`;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border grid gap-x-10 gap-y-4 border-t py-8 first:border-t-0 first:pt-0 xl:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{description}</p>
        )}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSettings(await api.settings());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // `optimistic` shows the new value at once; it is rolled back if the save fails.
  const update = async (
    label: string,
    fn: () => Promise<UserSettings>,
    optimistic?: Partial<UserSettings>
  ) => {
    const previous = settings;
    setSaving(label);
    setError(null);
    if (optimistic) setSettings((s) => (s ? { ...s, ...optimistic } : s));
    try {
      setSettings(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the setting.");
      if (previous) setSettings(previous);
    } finally {
      setSaving(null);
    }
  };

  const copyAddress = async () => {
    if (!settings?.inbound_address) return;
    try {
      await navigator.clipboard.writeText(settings.inbound_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the address is selectable on screen
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);

    // deleteUser needs a fresh session. Check before touching any data so we
    // never delete the API data and then fail to delete the login.
    const createdAt = session?.session?.createdAt;
    if (createdAt && Date.now() - new Date(createdAt).getTime() >= SESSION_FRESH_MS) {
      setDeleteError(
        "For your security, sign out and sign back in, then delete your account again."
      );
      return;
    }

    setDeleting(true);
    try {
      await api.deleteAccount(); // documents, files, credits
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete your data.");
      setDeleting(false);
      return;
    }

    // The API forgot this user; a still-valid token would recreate an empty
    // account on the next call, so drop it and delete the login right away.
    resetApiAuth();
    const { error: authError } = await authClient.deleteUser();
    if (authError) {
      setDeleteError(
        "Your data was deleted, but removing your login failed. Sign out and sign back in, then delete your account again."
      );
      setDeleting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const user = session?.user;
  const retentionValue = settings?.retention_days ?? null;
  const retentionChoices: (number | null)[] = settings ? [null, ...settings.retention_choices_days] : [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Your profile, how invoices reach you, and how long original files are kept."
      />

      {loadError && (
        <p role="alert" className="text-destructive mb-6 flex flex-wrap items-center gap-3 text-sm">
          {loadError}
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive mb-6 text-sm">
          {error}
        </p>
      )}

      <SettingsSection title="Profile" description="The account you are signed in with.">
        <dl className="border-border bg-card divide-border divide-y rounded-md border text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium break-words">{user?.name || "Not set"}</dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{user?.email ?? ""}</dd>
          </div>
        </dl>
      </SettingsSection>

      {!settings && !loadError ? (
        <div className="space-y-4 py-8" aria-hidden="true">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full max-w-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full max-w-xl" />
        </div>
      ) : settings ? (
        <>
          <SettingsSection
            title="Email-in"
            description="Forward invoices from your inbox instead of uploading them."
          >
            {!settings.inbound_available ? (
              <p className="text-muted-foreground text-sm">Email-in is not available yet.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="inbound-enabled"
                    checked={settings.inbound_enabled}
                    disabled={saving === "regenerate"}
                    onCheckedChange={(checked) =>
                      void update(
                        "inbound",
                        () => api.updateSettings({ inbound_enabled: checked }),
                        { inbound_enabled: checked }
                      )
                    }
                  />
                  <Label htmlFor="inbound-enabled" className="text-sm font-medium">
                    {settings.inbound_enabled ? "On: accepting invoices sent to your address" : "Off: your address ignores incoming mail"}
                  </Label>
                </div>

                {settings.inbound_address && (
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium">Your address</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="figures border-border bg-card rounded-md border px-3 py-2 text-sm break-all">
                        {settings.inbound_address}
                      </code>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={copyAddress}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      {!confirmRegen && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={saving !== null}
                          onClick={() => setConfirmRegen(true)}
                        >
                          <RefreshCw /> New address
                        </Button>
                      )}
                    </div>
                    {confirmRegen && (
                      <div role="alertdialog" aria-label="Confirm new address" className="border-border bg-card mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="font-medium">The current address stops working at once.</span>
                        <Button
                          size="sm"
                          disabled={saving !== null}
                          className="gap-1.5"
                          onClick={async () => {
                            await update("regenerate", () => api.regenerateInboundAddress());
                            setConfirmRegen(false);
                          }}
                        >
                          {saving === "regenerate" && <Loader2 className="animate-spin" />}
                          Create a new one
                        </Button>
                        <Button size="sm" variant="outline" disabled={saving === "regenerate"} onClick={() => setConfirmRegen(false)}>
                          Keep this one
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-muted-foreground text-sm leading-relaxed">
                  Forward an email with the invoice attached as a PDF, PNG or JPEG. Attachments are
                  checked and read like uploads, and the sender is shown on the document.
                </p>
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="File retention"
            description="How long the original PDF or image is kept."
          >
            <fieldset className="space-y-4">
              <legend className="sr-only">Keep original files for</legend>
              <div className="flex flex-wrap gap-2">
                {retentionChoices.map((d) => {
                  const id = `retention-${d ?? "forever"}`;
                  return (
                    <div key={id} className="relative">
                      <input
                        id={id}
                        type="radio"
                        name="retention"
                        className="peer sr-only"
                        checked={retentionValue === d}
                        onChange={() =>
                          void update(
                            "retention",
                            () => api.updateSettings({ retention_days: d }),
                            { retention_days: d }
                          )
                        }
                      />
                      <label
                        htmlFor={id}
                        className="border-input bg-card hover:bg-accent peer-checked:bg-foreground peer-checked:text-background peer-checked:border-foreground peer-focus-visible:outline-ring flex min-h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-semibold transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
                      >
                        {retentionLabel(d)}
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="text-muted-foreground space-y-1.5 text-sm leading-relaxed">
                <p>
                  <span className="text-foreground font-semibold">Deleted:</span> the original
                  PDF or image.
                </p>
                <p>
                  <span className="text-foreground font-semibold">Kept:</span> the extracted data,
                  the text transcript and your credit history, until you delete the document or
                  your account.
                </p>
                <p>
                  A change also applies to documents you already have, at the next sweep.
                </p>
              </div>
            </fieldset>
          </SettingsSection>
        </>
      ) : null}

      <SettingsSection
        title="Delete account"
        description="Removes your documents, original files, credits and login."
      >
        {!armed ? (
          <Button variant="outline-destructive" onClick={() => setArmed(true)}>
            Delete my account
          </Button>
        ) : (
          <div role="group" aria-label="Confirm account deletion" className="border-destructive/40 bg-card space-y-4 rounded-md border p-4">
            <p className="text-sm leading-relaxed">
              This cannot be undone. Everything is removed for good: all documents and their
              original files, your credit balance, and your login.
            </p>
            <div>
              <Label htmlFor="delete-confirm" className="mb-1.5 text-sm">
                Type <span className="figures font-semibold">{DELETE_PHRASE}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={deleting}
              />
            </div>
            {deleteError && (
              <p role="alert" className="text-destructive text-sm">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={deleting || typed.trim().toLowerCase() !== DELETE_PHRASE}
                onClick={deleteAccount}
                className="gap-2"
              >
                {deleting && <Loader2 className="animate-spin" />}
                Delete everything
              </Button>
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setArmed(false);
                  setTyped("");
                  setDeleteError(null);
                }}
              >
                Keep my account
              </Button>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
