// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Attribution, TMDB_NOTICE } from "./Attribution.jsx";

afterEach(cleanup);

describe("TMDb attribution", () => {
  it("shows TMDb's logo, linked to their site, and the notice their terms require", () => {
    render(<Attribution />);
    const logo = screen.getByRole("img", { name: "TMDB" });
    expect(logo.getAttribute("src")).toMatch(/svg/); // TMDb's logo, embedded by the build
    const link = logo.closest("a");
    expect(link.getAttribute("href")).toBe("https://www.themoviedb.org/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(screen.getByText(/This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB\./)).toBeTruthy();
    expect(TMDB_NOTICE).toMatch(/not endorsed, certified, or otherwise approved by TMDB\.$/);
  });
});
