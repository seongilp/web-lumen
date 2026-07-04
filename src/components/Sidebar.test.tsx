import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Selection } from "@/lib/view";

function setup(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    selection: { kind: "all" } as Selection,
    onSelect: vi.fn(),
    folders: [{ value: "trip", label: "trip" }],
    collections: [{ id: "c1", name: "여름" }],
    tags: [{ value: "여행", count: 3 }],
    counts: { all: 5, favorites: 2, trash: 0, folders: { trip: 3 }, collections: { c1: 4 } },
    onCreateCollection: vi.fn(),
    onRenameCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onDropToFavorite: vi.fn(),
    onDropToCollection: vi.fn(),
    onDropToTag: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe("Sidebar", () => {
  it("renders library, folder and collection sections with counts", () => {
    setup();
    expect(screen.getByText("전체")).toBeInTheDocument();
    expect(screen.getByText("즐겨찾기")).toBeInTheDocument();
    expect(screen.getByText("trip")).toBeInTheDocument();
    expect(screen.getByText("여름")).toBeInTheDocument();
  });

  it("selects a collection on click", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText("여름"));
    expect(onSelect).toHaveBeenCalledWith({ kind: "collection", id: "c1" });
  });

  it("creates a collection via the + input", () => {
    const { onCreateCollection } = setup();
    fireEvent.click(screen.getByTitle("새 컬렉션"));
    const input = screen.getByPlaceholderText("컬렉션 이름");
    fireEvent.change(input, { target: { value: "가을" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateCollection).toHaveBeenCalledWith("가을");
  });

  it("deletes a collection", () => {
    const { onDeleteCollection } = setup();
    fireEvent.click(screen.getByTitle("컬렉션 삭제"));
    expect(onDeleteCollection).toHaveBeenCalledWith("c1");
  });

  it("adds a dropped image to a collection", () => {
    const { onDropToCollection } = setup();
    const dataTransfer = {
      types: ["application/x-lumen-id"],
      getData: () => "img-42",
      dropEffect: "",
    };
    const row = screen.getByText("여름").closest('[role="button"]')!;
    fireEvent.drop(row, { dataTransfer });
    expect(onDropToCollection).toHaveBeenCalledWith("c1", ["img-42"]);
  });

  it("favorites a dropped image", () => {
    const { onDropToFavorite } = setup();
    const dataTransfer = {
      types: ["application/x-lumen-id"],
      getData: () => "img-7",
      dropEffect: "",
    };
    const row = screen.getByText("즐겨찾기").closest('[role="button"]')!;
    fireEvent.drop(row, { dataTransfer });
    expect(onDropToFavorite).toHaveBeenCalledWith(["img-7"]);
  });
});
