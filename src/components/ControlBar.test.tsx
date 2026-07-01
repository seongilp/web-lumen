import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ControlBar } from "./ControlBar";
import type { ViewState } from "@/lib/view";

const baseView: ViewState = {
  sortKey: "date",
  sortDir: "asc",
  onlyFavorites: false,
  folder: "",
  orientation: "all",
};

function setup(overrides: Partial<Parameters<typeof ControlBar>[0]> = {}) {
  const onChange = vi.fn();
  const onToggleDup = vi.fn();
  render(
    <ControlBar
      view={baseView}
      onChange={onChange}
      folders={[]}
      shown={10}
      total={10}
      favCount={2}
      dupCount={0}
      dupMode={false}
      onToggleDup={onToggleDup}
      {...overrides}
    />
  );
  return { onChange, onToggleDup };
}

describe("ControlBar", () => {
  it("toggles the favorites filter", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /즐겨찾기/ }));
    expect(onChange).toHaveBeenCalledWith({ onlyFavorites: true });
  });

  it("flips sort direction", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "오름차순" }));
    expect(onChange).toHaveBeenCalledWith({ sortDir: "desc" });
  });

  it("changes sort key via the dropdown", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "정렬 기준" }));
    fireEvent.click(screen.getByText("이름"));
    expect(onChange).toHaveBeenCalledWith({ sortKey: "name" });
  });

  it("hides the folder dropdown when there are fewer than two folders", () => {
    setup({ folders: [{ value: "a", label: "a" }] });
    expect(screen.queryByLabelText("폴더 필터")).toBeNull();
  });

  it("shows the folder dropdown when there are two or more folders", () => {
    setup({ folders: [{ value: "a", label: "a" }, { value: "b", label: "b" }] });
    expect(screen.getByLabelText("폴더 필터")).toBeInTheDocument();
  });

  it("shows the duplicate button only when duplicates exist and toggles it", () => {
    const { onToggleDup } = setup({ dupCount: 3 });
    const btn = screen.getByRole("button", { name: /중복/ });
    fireEvent.click(btn);
    expect(onToggleDup).toHaveBeenCalled();
  });

  it("hides the duplicate button when there are no duplicates", () => {
    setup({ dupCount: 0 });
    expect(screen.queryByRole("button", { name: /중복/ })).toBeNull();
  });
});
