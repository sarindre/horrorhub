// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetCard } from "./ResetCard.jsx";

afterEach(cleanup);

const counts = { films: 42, shelves: 2, challenges: 1, plans: 3 };
const setup = (props = {}) => {
  const handlers = { onExportNow: vi.fn(), onBeforeReset: vi.fn(async () => {}), resetFn: vi.fn(async () => {}) };
  render(<ResetCard counts={counts} {...handlers} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset app…" }));
  return { ...handlers, ...props };
};
const erase = () => screen.getByRole("button", { name: /Erase everything|Erasing…/ });
const type = (text) => fireEvent.change(screen.getByLabelText(/Type RESET to confirm/), { target: { value: text } });

describe("Reset app", () => {
  it("does nothing until you open the dialog, and says exactly what will go", () => {
    render(<ResetCard counts={counts} resetFn={vi.fn()} />);
    expect(screen.queryByText("Reset HorrorHub?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset app…" }));
    const text = screen.getByText(/permanently erases/).textContent;
    expect(text).toContain("42 films with your ratings, tags, notes and watch dates");
    expect(text).toContain("2 shelves");
    expect(text).toContain("1 challenge");
    expect(text).toContain("3 saved plans");
    expect(text).toContain("settings and API keys");
    expect(screen.getByText(/backup folder, and anything you've exported, are not touched/)).toBeTruthy();
  });

  it("won't erase until RESET is typed (any case, spaces ignored)", () => {
    const { resetFn } = setup();
    expect(erase().disabled).toBe(true);
    type("reset now");
    expect(erase().disabled).toBe(true);
    type("RES");
    expect(erase().disabled).toBe(true);
    fireEvent.click(erase());
    expect(resetFn).not.toHaveBeenCalled();
    type(" reset ");
    expect(erase().disabled).toBe(false);
  });

  it("erases everything by default, after stopping automatic backups", async () => {
    const order = [];
    const { resetFn } = setup({ onBeforeReset: vi.fn(async () => order.push("backup off")), resetFn: vi.fn(async () => order.push("reset")) });
    type("RESET");
    fireEvent.click(erase());
    await waitFor(() => expect(resetFn).toHaveBeenCalledWith({ keepSettings: false }));
    expect(order).toEqual(["backup off", "reset"]);
  });

  it("can keep settings and keys", async () => {
    const { resetFn } = setup();
    fireEvent.click(screen.getByLabelText(/Keep my settings and API keys/));
    type("RESET");
    fireEvent.click(erase());
    await waitFor(() => expect(resetFn).toHaveBeenCalledWith({ keepSettings: true }));
  });

  it("goes ahead even if stopping the backup fails", async () => {
    const { resetFn } = setup({ onBeforeReset: vi.fn(async () => { throw new Error("nope"); }) });
    type("RESET");
    fireEvent.click(erase());
    await waitFor(() => expect(resetFn).toHaveBeenCalled());
  });

  it("offers a backup first", () => {
    const { onExportNow } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Export a backup first" }));
    expect(onExportNow).toHaveBeenCalled();
  });

  it("doesn't offer a backup when there is nothing to back up", () => {
    render(<ResetCard counts={{ films: 0, shelves: 0, challenges: 0, plans: 0 }} resetFn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset app…" }));
    expect(screen.queryByRole("button", { name: "Export a backup first" })).toBeNull();
  });

  it("cancel closes it without erasing, and reopening starts clean", () => {
    const { resetFn } = setup();
    type("RESET");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Reset HorrorHub?")).toBeNull();
    expect(resetFn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset app…" }));
    expect(screen.getByLabelText(/Type RESET to confirm/).value).toBe("");
    expect(erase().disabled).toBe(true);
  });

  it("can't be dismissed or repeated while it is working", async () => {
    let finish;
    const { resetFn } = setup({ resetFn: vi.fn(() => new Promise((r) => { finish = r; })) });
    type("RESET");
    fireEvent.click(erase());
    await waitFor(() => expect(screen.getByRole("button", { name: "Erasing…" }).disabled).toBe(true));
    expect(screen.getByRole("button", { name: "Cancel" }).disabled).toBe(true);
    finish();
    expect(resetFn).toHaveBeenCalledTimes(1);
  });
});
