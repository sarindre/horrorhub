// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchDialog } from "./WatchDialog.jsx";
import { ViewingDiary } from "../features/details/ViewingDiary.jsx";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const open = (props = {}) => {
  const onLog = vi.fn();
  render(<WatchDialog label="Watched" longAgo onLog={onLog} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Watched" }));
  return onLog;
};

describe("logging a watch with a diary note", () => {
  it("offers the note as optional and logs fine without it", () => {
    const onLog = open();
    expect(screen.getByText("How was it? (optional)")).toBeTruthy();
    expect(screen.getByText("not set")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onLog.mock.calls[0][1]).toBeUndefined();
  });

  it("passes how scared you were, who with and when", () => {
    const onLog = open();
    fireEvent.change(screen.getByRole("slider", { name: "How scared were you?" }), { target: { value: "8" } });
    expect(screen.getByText("8/10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "With friends" }));
    fireEvent.click(screen.getByRole("button", { name: "Late night" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(onLog.mock.calls[0][1]).toEqual({ scared: 8, company: "friends", when: "late" });
  });

  it("keeps a score of zero (not scared at all)", () => {
    const onLog = open();
    fireEvent.change(screen.getByRole("slider", { name: "How scared were you?" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(onLog.mock.calls[0][1]).toEqual({ scared: 0 });
  });

  it("lets you change your mind: pressing a choice again or clearing the score removes it", () => {
    const onLog = open();
    fireEvent.change(screen.getByRole("slider", { name: "How scared were you?" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("not set")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alone" }));
    fireEvent.click(screen.getByRole("button", { name: "Alone" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(onLog.mock.calls[0][1]).toBeUndefined();
  });

  it("only takes a note for a real watch, not 'watched long ago'", () => {
    const onLog = open();
    fireEvent.click(screen.getByRole("button", { name: "Alone" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched long ago" }));
    expect(onLog.mock.calls[0][1]).toBeUndefined();
  });

  it("starts blank each time it opens", () => {
    const onLog = open();
    fireEvent.click(screen.getByRole("button", { name: "Alone" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(onLog.mock.calls[1][1]).toBeUndefined();
  });
});

describe("ViewingDiary", () => {
  const item = { id: 1, title: "F", diary: [{ day: "2026-01-02", scared: 4, company: "alone" }, { day: "2026-03-04", scared: 9, company: "friends", when: "late" }] };

  it("lists your notes, newest first", () => {
    render(<ViewingDiary item={item} onUpdate={() => {}} />);
    const rows = screen.getAllByRole("listitem").map((r) => r.textContent);
    expect(rows[0]).toContain("Scared 9/10 · With friends · Late night");
    expect(rows[1]).toContain("Scared 4/10 · Alone");
  });
  it("removes one entry", () => {
    const onUpdate = vi.fn();
    render(<ViewingDiary item={item} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Remove diary entry/ })[0]);
    expect(onUpdate.mock.calls[0][0].diary).toEqual([{ day: "2026-01-02", scared: 4, company: "alone" }]);
  });
  it("shows nothing for a film with no diary", () => {
    const { container } = render(<ViewingDiary item={{ id: 2, title: "G" }} onUpdate={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
