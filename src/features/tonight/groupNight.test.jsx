// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupNight } from "./GroupNight.jsx";

const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, contentFlags: [], watchedDates: [], rating: 0, ...over });
const SETTINGS = { avoidFlags: [], maxScares: 10 };

const setup = (props = {}) => {
  const onOpenDetails = vi.fn();
  render(<GroupNight library={[film(1), film(2), film(3)]} settings={SETTINGS} onOpenDetails={onOpenDetails} {...props} />);
  return { onOpenDetails };
};
const titles = () => screen.queryAllByRole("heading", { level: 3 }).map((n) => n.textContent.replace(/\s*\(\d{4}\)$/, ""));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Group night", () => {
  it("starts with you and a guest and offers a best compromise", () => {
    setup();
    expect(screen.getByText("Best compromise")).toBeTruthy();
    expect(titles().length).toBe(3);
  });

  it("opens a film's details", () => {
    const { onOpenDetails } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]);
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("takes your limits from Settings and says so", () => {
    setup({ settings: { avoidFlags: ["gore"], maxScares: 6 }, library: [film(1, { scares: 8, title: "Brutal One" }), film(2, { title: "Mild One" })] });
    expect(titles()).toEqual(["Mild One"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByText(/come from Settings/)).toBeTruthy();
  });

  it("a guest's scare limit rules films out, and the panel says why", () => {
    setup({ library: [film(1, { scares: 9, title: "Brutal One" }), film(2, { title: "Mild One" })] });
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]); // the guest
    fireEvent.change(screen.getByRole("slider", { name: /scare limit/ }), { target: { value: "6" } });
    expect(titles()).toEqual(["Mild One"]);
    fireEvent.click(screen.getByText("Ruled out by limits"));
    expect(screen.getByText(/Guest: 1 film \(for example Brutal One\)/)).toBeTruthy();
  });

  it("a guest's avoided content rules films out", () => {
    setup({ library: [film(1, { contentFlags: ["animal-harm"], title: "Dog One" }), film(2, { title: "Safe One" })] });
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Animal harm" }));
    expect(titles()).toEqual(["Safe One"]);
  });

  it("ticking 'has seen it' takes the film off the list until you allow seen films", () => {
    setup({ library: [film(1), film(2)] });
    fireEvent.click(screen.getAllByRole("button", { name: /Guest has seen it/ })[0]);
    expect(titles().length).toBe(1);
    fireEvent.click(screen.getByLabelText(/Include films someone has already seen/));
    expect(titles().length).toBe(2);
    expect(screen.getByText(/Already seen by Guest/)).toBeTruthy();
  });

  it("holds at four people and at two", () => {
    setup();
    const add = screen.getByRole("button", { name: /Add person/ });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(add.disabled).toBe(true);
    expect(screen.getByText("Four is the most.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Guest 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Guest 2" }));
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull(); // two left: can't go lower
  });

  it("remembers a friend for next time, and can forget them", () => {
    setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Sam for next time" }));
    fireEvent.click(screen.getByRole("button", { name: /Add person/ })); // a third, so Sam can be removed
    fireEvent.click(screen.getByRole("button", { name: "Remove Sam" }));
    expect(screen.getByRole("button", { name: "+ Sam" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forget Sam" }));
    expect(screen.queryByRole("button", { name: "+ Sam" })).toBeNull();
  });

  it("keeps the group between visits", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Add person/ }));
    cleanup();
    setup();
    expect(within(document.body).getAllByRole("button", { name: /^Remove / }).length).toBe(3);
  });

  it("says so when nothing fits everyone", () => {
    setup({ library: [film(1, { scares: 9 })], settings: { avoidFlags: [], maxScares: 3 } });
    expect(screen.getByText("No film fits everyone")).toBeTruthy();
  });

  it("points an empty library at adding films", () => {
    setup({ library: [] });
    expect(screen.getByText(/library is empty/)).toBeTruthy();
  });
});
