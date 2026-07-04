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
  const onScanFaces = vi.fn();
  const onRescanFaces = vi.fn();
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
      unscanned={0}
      scanned={0}
      scanning={false}
      scanDone={0}
      scanTotal={0}
      onScanFaces={onScanFaces}
      onRescanFaces={onRescanFaces}
      {...overrides}
    />
  );
  return { onChange, onToggleDup, onDensityChange, onScanFaces, onRescanFaces };
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

  it("changes the face filter", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "얼굴 필터" }));
    fireEvent.click(screen.getByText("얼굴 있음"));
    expect(onChange).toHaveBeenCalledWith({ faceFilter: "with" });
  });

  it("shows the face-scan button with a count and runs a scan", () => {
    const { onScanFaces } = setup({ unscanned: 12 });
    const btn = screen.getByRole("button", { name: /얼굴 스캔/ });
    expect(btn).toHaveTextContent("12");
    fireEvent.click(btn);
    expect(onScanFaces).toHaveBeenCalled();
  });

  it("offers a re-scan once everything in view is scanned", () => {
    const { onRescanFaces } = setup({ unscanned: 0, scanned: 8, scanning: false });
    const btn = screen.getByRole("button", { name: /얼굴 재스캔/ });
    fireEvent.click(btn);
    expect(onRescanFaces).toHaveBeenCalled();
  });

  it("hides the face-scan button when nothing is scanned or unscanned", () => {
    setup({ unscanned: 0, scanned: 0, scanning: false });
    expect(screen.queryByRole("button", { name: /얼굴 스캔|얼굴 재스캔/ })).toBeNull();
  });

  it("shows scan progress while scanning", () => {
    setup({ unscanned: 0, scanning: true, scanDone: 3, scanTotal: 10 });
    expect(screen.getByText("3/10")).toBeInTheDocument();
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
