import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DuplicateBar } from "./DuplicateBar";

function setup(overrides: Partial<Parameters<typeof DuplicateBar>[0]> = {}) {
  const onKindChange = vi.fn();
  const onDeleteAll = vi.fn();
  const onExit = vi.fn();
  render(
    <DuplicateBar
      groupCount={2}
      removableCount={3}
      kind="exact"
      onKindChange={onKindChange}
      onDeleteAll={onDeleteAll}
      onExit={onExit}
      {...overrides}
    />
  );
  return { onKindChange, onDeleteAll, onExit };
}

describe("DuplicateBar", () => {
  it("shows the removable count in the delete button", () => {
    setup();
    expect(screen.getByRole("button", { name: /3장 삭제/ })).toBeInTheDocument();
  });

  it("switches to the perceptual (similar) mode", () => {
    const { onKindChange } = setup();
    fireEvent.click(screen.getByText("유사 포함"));
    expect(onKindChange).toHaveBeenCalledWith("similar");
  });

  it("deletes all removable duplicates", () => {
    const { onDeleteAll } = setup();
    fireEvent.click(screen.getByRole("button", { name: /삭제/ }));
    expect(onDeleteAll).toHaveBeenCalled();
  });

  it("disables the delete button when nothing is removable", () => {
    setup({ removableCount: 0 });
    expect(screen.getByRole("button", { name: /삭제/ })).toBeDisabled();
  });

  it("exits duplicate mode", () => {
    const { onExit } = setup();
    fireEvent.click(screen.getByTitle("나가기"));
    expect(onExit).toHaveBeenCalled();
  });

  it("uses distinct copy for exact vs similar", () => {
    const { rerender } = renderBar("exact");
    expect(screen.getByText(/동일한 사진/)).toBeInTheDocument();
    rerender(barEl("similar"));
    expect(screen.getByText(/비슷한 사진/)).toBeInTheDocument();
  });
});

// Helpers for the rerender case.
function barEl(kind: "exact" | "similar") {
  return (
    <DuplicateBar
      groupCount={1}
      removableCount={1}
      kind={kind}
      onKindChange={() => {}}
      onDeleteAll={() => {}}
      onExit={() => {}}
    />
  );
}
function renderBar(kind: "exact" | "similar") {
  return render(barEl(kind));
}
