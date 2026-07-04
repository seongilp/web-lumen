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
  const onDensityChange = vi.fn();
  render(
    <ControlBar
      view={baseView}
      onChange={onChange}
      title="전체"
      shown={10}
      total={10}
      dupCount={0}
      dupMode={false}
      onToggleDup={onToggleDup}
      density="md"
      onDensityChange={onDensityChange}
      {...overrides}
    />
  );
  return { onChange, onToggleDup, onDensityChange };
}

describe("ControlBar", () => {
  it("renders the current selection title", () => {
    setup({ title: "여름휴가" });
    expect(screen.getByText("여름휴가")).toBeInTheDocument();
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

  it("changes orientation via the dropdown", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "방향 필터" }));
    fireEvent.click(screen.getByText("세로"));
    expect(onChange).toHaveBeenCalledWith({ orientation: "portrait" });
  });

  it("changes the favorite filter", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "즐겨찾기 필터" }));
    fireEvent.click(screen.getByText("즐겨찾기만"));
    expect(onChange).toHaveBeenCalledWith({ favFilter: "fav" });
  });

  it("shows the duplicate button only when duplicates exist and toggles it", () => {
    const { onToggleDup } = setup({ dupCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: /중복/ }));
    expect(onToggleDup).toHaveBeenCalled();
  });

  it("hides the duplicate button when there are no duplicates", () => {
    setup({ dupCount: 0 });
    expect(screen.queryByRole("button", { name: /중복/ })).toBeNull();
  });

  it("emits search query changes", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "beach" } });
    expect(onChange).toHaveBeenCalledWith({ query: "beach" });
  });

  it("changes grid density", () => {
    const { onDensityChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "썸네일 크게" }));
    expect(onDensityChange).toHaveBeenCalledWith("lg");
  });
});
