import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Thumb } from "./Thumb";
import { makeItem } from "@/test/factories";

function setup(itemOverrides = {}, props = {}) {
  const onOpen = vi.fn();
  const onToggleFavorite = vi.fn();
  const item = makeItem({ thumbUrl: "blob:thumb", ...itemOverrides });
  render(
    <Thumb item={item} size={200} onOpen={onOpen} onToggleFavorite={onToggleFavorite} {...props} />
  );
  return { item, onOpen, onToggleFavorite };
}

describe("Thumb", () => {
  it("opens on click for a ready item", () => {
    const { item, onOpen } = setup();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onOpen).toHaveBeenCalledWith(item.id);
  });

  it("does not open a pending item", () => {
    const { onOpen } = setup({ status: "pending", thumbUrl: undefined });
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("toggles favorite without opening (stops propagation)", () => {
    const { item, onOpen, onToggleFavorite } = setup();
    fireEvent.click(screen.getByLabelText("즐겨찾기"));
    expect(onToggleFavorite).toHaveBeenCalledWith(item.id);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows an unfavorite label when already favorited", () => {
    setup({ favorite: true });
    expect(screen.getByLabelText("즐겨찾기 해제")).toBeInTheDocument();
  });

  it("renders duplicate badges", () => {
    setup({}, { badge: "dupe" });
    expect(screen.getByText("중복")).toBeInTheDocument();
  });

  it("renders keeper badge", () => {
    setup({}, { badge: "keep" });
    expect(screen.getByText("유지")).toBeInTheDocument();
  });

  it("toggles selection via the checkbox without opening", () => {
    const onSelect = vi.fn();
    const item = setup({}, { selectable: true, onSelect }).item;
    fireEvent.click(screen.getByLabelText("선택"));
    expect(onSelect).toHaveBeenCalledWith(item.id, expect.anything());
  });

  it("selects (not opens) on modifier-click", () => {
    const onSelect = vi.fn();
    const { item, onOpen } = setup({}, { selectable: true, onSelect });
    fireEvent.click(screen.getAllByRole("button")[0], { metaKey: true });
    expect(onSelect).toHaveBeenCalledWith(item.id, expect.anything());
    expect(onOpen).not.toHaveBeenCalled();
  });
});
