import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { useToast } from "../lib/toastContext.js";
import { FORM_ANSWERS, TOKEN_API_URL, TOKEN_SIGNUP_URL } from "../lib/tokenCheck.js";

function CopyRow({ label, text }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied the ${label.toLowerCase()}.`, { kind: "success" });
    } catch {
      toast("Couldn't copy. Select the text and copy it by hand.", { kind: "error" });
    }
  };
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted p-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
        <div className="break-words text-sm">{text}</div>
      </div>
      <Button size="sm" variant="outline" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}><Copy className="mr-1 h-3.5 w-3.5" /> Copy</Button>
    </div>
  );
}

const LinkButton = ({ href, children }) => (
  <Button size="sm" onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>{children} <ExternalLink className="ml-1 h-3.5 w-3.5" /></Button>
);

// How to get a free TMDb token, step by step, with the answers for TMDb's form ready to copy.
export function TokenGuide({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label="How to get your free TMDb token" className="space-y-2">
      <Button size="sm" variant={open ? "ghost" : "outline"} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide the steps" : "How do I get a token? (about 3 minutes, free)"}
      </Button>
      {open ? (
        <div className="space-y-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <p>HorrorHub uses TMDb (The Movie Database) for film details, posters and suggestions. TMDb gives every user a free key for personal use. It's yours, it stays on this device, and it's only ever sent to TMDb.</p>
          <ol className="list-decimal space-y-4 pl-5">
            <li className="space-y-2">
              <div>Create a free TMDb account (or log in if you have one).</div>
              <LinkButton href={TOKEN_SIGNUP_URL}>Open TMDb sign-up</LinkButton>
            </li>
            <li className="space-y-2">
              <div>Open your API settings and request a key. Choose the personal / developer option. TMDb will ask a few questions about your use; these answers are accurate for HorrorHub:</div>
              <LinkButton href={TOKEN_API_URL}>Open TMDb API settings</LinkButton>
              <div className="space-y-2">
                <CopyRow label="Application name" text={FORM_ANSWERS.name} />
                <CopyRow label="Application URL" text={FORM_ANSWERS.url} />
                <CopyRow label="Summary" text={FORM_ANSWERS.summary} />
              </div>
              <div className="text-xs opacity-70">The rest of the form is your own contact details.</div>
            </li>
            <li>
              On the API settings page you'll then see two things: a short <strong>API Key</strong> and a very long <strong>API Read Access Token</strong>. Copy the <strong>long Read Access Token</strong> (it starts with “eyJ”).
            </li>
            <li>Paste it into the box above. HorrorHub tests it for you and tells you if it works.</li>
          </ol>
          <p className="text-xs opacity-70">HorrorHub is not endorsed by TMDb. The key is for your personal, non-commercial use under TMDb's terms.</p>
        </div>
      ) : null}
    </section>
  );
}
