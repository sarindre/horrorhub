// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenField } from "./TokenField.jsx";
import { TokenGuide } from "./TokenGuide.jsx";
import { NeedsToken } from "./NeedsToken.jsx";
import { Settings } from "../features/settings/Settings.jsx";
import { DEFAULT_SETTINGS } from "../lib/settings.js";
import { FORM_ANSWERS, TOKEN_API_URL, TOKEN_SIGNUP_URL } from "../lib/tokenCheck.js";

const REAL = `eyJhbGciOiJIUzI1NiJ9.${"a".repeat(180)}.${"b".repeat(43)}`;
const WAIT = { timeout: 3000 };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => localStorage.clear());

function Harness({ check, start = "" }) {
  const [value, setValue] = useState(start);
  return <TokenField value={value} onChange={setValue} check={check} />;
}
const box = () => screen.getByPlaceholderText(/Paste your TMDb API Read Access Token/);
const paste = (text) => fireEvent.change(box(), { target: { value: text } });

describe("TokenField", () => {
  it("tidies what you paste", () => {
    render(<Harness check={vi.fn(async () => ({ state: "ok", message: "x" }))} />);
    paste(`  Bearer "${REAL}"  `);
    expect(box().value).toBe(REAL);
  });

  it("tests the token a moment after you paste, and says it works", async () => {
    const check = vi.fn(async () => ({ state: "ok", message: "Connected to TMDb. Your token works." }));
    render(<Harness check={check} />);
    paste(REAL);
    expect(screen.getByRole("status").textContent).toMatch(/Checking/);
    expect((await screen.findByText(/Connected to TMDb/, {}, WAIT)).textContent).toMatch(/^✓/);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0][0]).toBe(REAL);
  });

  it("explains a token TMDb refuses, in red words with what to do", async () => {
    render(<Harness check={vi.fn(async () => ({ state: "bad", message: "TMDb rejected that token. Make sure you copied the long \"API Read Access Token\"." }))} />);
    paste(REAL);
    const line = await screen.findByText(/TMDb rejected that token/, {}, WAIT);
    expect(line.className).toContain("text-red-300");
  });

  it("says offline is not the token's fault", async () => {
    render(<Harness check={vi.fn(async () => ({ state: "offline", message: "Couldn't reach TMDb, so the token wasn't tested." }))} />);
    paste(REAL);
    expect((await screen.findByText(/wasn't tested/, {}, WAIT)).className).toContain("text-amber-300");
  });

  it("names the short API Key mistake at once, without asking TMDb", async () => {
    const check = vi.fn();
    render(<Harness check={check} />);
    paste("0123456789abcdef0123456789abcdef");
    expect(screen.getByText(/looks like the short "API Key"/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 900));
    expect(check).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Test token" }).disabled).toBe(true);
  });

  it("'Test token' checks again straight away", async () => {
    const check = vi.fn(async () => ({ state: "ok", message: "Connected to TMDb. Your token works." }));
    render(<Harness check={check} start={REAL} />);
    await screen.findByText(/Connected/, {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Test token" }));
    await waitFor(() => expect(check).toHaveBeenCalledTimes(2), WAIT);
  });

  it("says nothing, and tests nothing, with an empty box", () => {
    const check = vi.fn();
    render(<Harness check={check} />);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Test token" }).disabled).toBe(true);
    expect(check).not.toHaveBeenCalled();
  });

  it("drops a stale check when you keep typing", async () => {
    const results = [];
    const check = vi.fn(async (token) => { results.push(token); return { state: "ok", message: `ok ${token.length}` }; });
    render(<Harness check={check} />);
    paste(REAL);
    paste(REAL + "x");
    await screen.findByText(new RegExp(`ok ${REAL.length + 1}`), {}, WAIT);
    expect(results).toEqual([REAL + "x"]); // the first was never sent
  });

  it("masks the token until you press Show", () => {
    render(<Harness check={vi.fn()} start={REAL} />);
    expect(box().getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(box().getAttribute("type")).toBe("text");
  });
});

describe("TokenGuide", () => {
  it("is folded until asked, then gives the steps in order", () => {
    render(<TokenGuide />);
    expect(screen.queryByText(/Create a free TMDb account/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /How do I get a token/ }));
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(steps[0]).toContain("Create a free TMDb account");
    expect(steps[1]).toContain("request a key");
    expect(steps[2]).toContain("long Read Access Token");
    expect(steps[3]).toContain("Paste it into the box above");
  });

  it("opens TMDb's pages in a new tab, safely", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TokenGuide defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: /Open TMDb sign-up/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open TMDb API settings/ }));
    expect(open).toHaveBeenNthCalledWith(1, TOKEN_SIGNUP_URL, "_blank", "noopener,noreferrer");
    expect(open).toHaveBeenNthCalledWith(2, TOKEN_API_URL, "_blank", "noopener,noreferrer");
  });

  it("has the answers for TMDb's form ready to copy", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<TokenGuide defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FORM_ANSWERS.summary));
    fireEvent.click(screen.getByRole("button", { name: "Copy application name" }));
    expect(writeText).toHaveBeenLastCalledWith(FORM_ANSWERS.name);
  });

  it("tells you the key is personal and not endorsed by TMDb", () => {
    render(<TokenGuide defaultOpen />);
    expect(screen.getByText(/personal, non-commercial use under TMDb's terms/)).toBeTruthy();
  });
});

describe("NeedsToken", () => {
  it("says what needs a token and links to the setup", () => {
    render(<NeedsToken>Browsing needs a free TMDb token.</NeedsToken>);
    expect(screen.getByText(/Browsing needs a free TMDb token/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Set up your free TMDb token/ }).getAttribute("href")).toBe("#settings");
  });
});

describe("Settings: connections", () => {
  const setup = (settings) => {
    const update = vi.fn();
    const { container } = render(<Settings settings={{ ...DEFAULT_SETTINGS, ...settings }} update={update} onImport={() => {}} watchlist={[]} data={[]} extras={{}} />);
    return { update, container };
  };
  const order = (container) => [...container.querySelectorAll("[id='connections'], .text-lg")].map((n) => n.id || n.textContent);

  it("puts token setup first, with the guide open, until you have a token", () => {
    const { container } = setup({ apiKey: "" });
    const titles = [...container.querySelectorAll(".text-lg.font-semibold")].map((n) => n.textContent);
    expect(titles[0]).toBe("Connections");
    expect(screen.getByText(/Create a free TMDb account/)).toBeTruthy();
  });

  it("moves it back down, with the guide folded, once you have one", () => {
    const { container } = setup({ apiKey: REAL });
    const titles = [...container.querySelectorAll(".text-lg.font-semibold")].map((n) => n.textContent);
    expect(titles[0]).not.toBe("Connections");
    expect(titles).toContain("Connections");
    expect(screen.queryByText(/Create a free TMDb account/)).toBeNull();
  });

  it("saves what you paste, tidied", () => {
    const { update } = setup({ apiKey: "" });
    fireEvent.change(screen.getByPlaceholderText(/Paste your TMDb API Read Access Token/), { target: { value: ` Bearer ${REAL} ` } });
    expect(update).toHaveBeenCalledWith({ apiKey: REAL });
  });

  it("still has the optional OMDb and DoesTheDogDie keys", () => {
    setup({ apiKey: REAL });
    expect(screen.getByText(/OMDb API Key/)).toBeTruthy();
    expect(screen.getByText(/DoesTheDogDie API Key/)).toBeTruthy();
    void within;
    void order;
  });
});
