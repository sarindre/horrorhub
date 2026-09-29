// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button.jsx";
import { DateField } from "./date-field.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog.jsx";
import { Slider } from "./slider.jsx";

afterEach(cleanup);

describe("DateField", () => {
  it("shows the local day, even late in the evening (the picker used to show tomorrow west of UTC)", () => {
    render(<DateField value={new Date(2025, 9, 15, 21, 30)} onChange={() => {}} aria-label="Day" />);
    expect(screen.getByLabelText("Day").value).toBe("2025-10-15");
  });

  it("reports the day you picked as a local date (it used to report the day before west of UTC)", () => {
    const seen = [];
    render(<DateField value={new Date(2025, 9, 1)} onChange={(d) => seen.push(d)} aria-label="Day" />);
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2025-10-15" } });
    expect(seen).toHaveLength(1);
    expect([seen[0].getFullYear(), seen[0].getMonth() + 1, seen[0].getDate()]).toEqual([2025, 10, 15]);
    expect(seen[0].getHours()).toBe(0);
  });

  it("ignores an empty value (the user is mid-edit) and passes other props through", () => {
    const onChange = vi.fn();
    render(<DateField value={new Date(2025, 9, 1)} onChange={onChange} max="2025-10-20" aria-label="Day" />);
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Day").getAttribute("max")).toBe("2025-10-20");
  });
});

describe("Dialog", () => {
  function Harness({ onChange, initiallyOpen = false, triggerClick }) {
    const [open, setOpen] = useState(initiallyOpen);
    return (
      <Dialog open={open} onOpenChange={(v) => { onChange?.(v); setOpen(v); }}>
        <DialogTrigger><Button onClick={triggerClick}>Open it</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Log something</DialogTitle></DialogHeader>
          <button>Inside</button>
        </DialogContent>
      </Dialog>
    );
  }
  const dialog = () => document.querySelector("dialog");

  it("renders nothing until opened", () => {
    render(<Harness />);
    expect(dialog()).toBeNull();
  });

  it("opens as a modal dialog labelled by its title", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(dialog()).toBeTruthy();
    expect(dialog().hasAttribute("open")).toBe(true);
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Log something" }).id);
    expect(screen.getByRole("button", { name: "Open it" }).getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("keeps the trigger's own click handler", () => {
    const own = vi.fn();
    render(<Harness triggerClick={own} />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(own).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeTruthy();
  });

  it("closes on Escape (the browser's cancel event) by telling the parent", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initiallyOpen />);
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(dialog()).toBeNull();
  });

  it("closes on a click on the backdrop but not on a click inside", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initiallyOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(dialog()); // the backdrop is the dialog element itself
    expect(onChange).toHaveBeenCalledWith(false);
    expect(dialog()).toBeNull();
  });

  it("closes the native dialog when it unmounts while open", () => {
    const { unmount } = render(<Harness initiallyOpen />);
    const el = dialog();
    const close = vi.spyOn(el, "close");
    unmount();
    expect(close).toHaveBeenCalled();
  });

  it("a parent that refuses to close keeps it open", () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent><DialogTitle>Stays</DialogTitle></DialogContent>
      </Dialog>
    );
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(dialog()).toBeTruthy();
  });
});

describe("Button and Slider", () => {
  it("Button doesn't submit forms by default, but can be a submit button on request", () => {
    expect(renderToString(<Button>Go</Button>)).toContain('type="button"');
    expect(renderToString(<Button type="submit">Go</Button>)).toContain('type="submit"');
  });

  it("Button looks disabled when it is", () => {
    expect(renderToString(<Button disabled>Go</Button>)).toContain("disabled:opacity-50");
  });

  it("Slider passes accessibility props to the input and reports the value as an array", () => {
    const seen = [];
    render(<Slider aria-label="Volume" value={[3]} min={0} max={10} onValueChange={(v) => seen.push(v)} />);
    const input = screen.getByLabelText("Volume");
    expect(input.value).toBe("3");
    fireEvent.change(input, { target: { value: "7" } });
    expect(seen).toEqual([[7]]);
  });
});
