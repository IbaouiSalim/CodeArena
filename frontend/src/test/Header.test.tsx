import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "../components/Header";

describe("Header", () => {
  it("renders the brand name", () => {
    render(<Header />);
    expect(screen.getByText("CodeArena")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<Header />);
    expect(screen.getByText("Run code instantly in your browser")).toBeInTheDocument();
  });
});
